const EventEmitter = require('events');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

class GymEventEmitter extends EventEmitter {}
const gymEmitter = new GymEventEmitter();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
}

// Register event listeners for marketing workflows

gymEmitter.on('payment.failed', async (data) => {
    console.log(`[Event] payment.failed triggered for tenant ${data.tenant_id}, profile ${data.profile_id}`);
    if (!supabase) return;

    try {
        const today = new Date().toISOString().split('T')[0];
        const { data: existingSnap } = await supabase
            .from('analytics_snapshots')
            .select('id')
            .eq('profile_id', data.profile_id)
            .eq('snapshot_date', today)
            .single();

        let snapError = null;
        if (existingSnap) {
            const { error } = await supabase
                .from('analytics_snapshots')
                .update({ churn_risk_score: 90 })
                .eq('id', existingSnap.id);
            snapError = error;
        } else {
            const { error } = await supabase
                .from('analytics_snapshots')
                .insert({
                    tenant_id: data.tenant_id,
                    profile_id: data.profile_id,
                    snapshot_date: today,
                    churn_risk_score: 90, // Very high risk due to payment failure
                    trailing_4wk_avg_visits: 0,
                    current_wk_visits: 0
                });
            snapError = error;
        }

        if (snapError) {
             console.error("Supabase upsert error for analytics_snapshots in payment.failed:", snapError);
        }

        const { error } = await supabase.from('notification_queue').insert({

            tenant_id: data.tenant_id,
            profile_id: data.profile_id,
            channel: 'email',
            recipient: data.email || 'member@example.com',
            subject: 'Payment Failed',
            content: `Your payment of ${data.amount || 0} failed. Reason: ${data.reason || 'Unknown'}. Please update your payment method.`,
            status: 'pending'
        });
        if (error) {
            console.error("Supabase insert error for payment.failed:", error);
        }
    } catch (error) {
        console.error("Error processing payment.failed event:", error);
    }
});

gymEmitter.on('checkin.denied', async (data) => {
    console.log(`[Event] checkin.denied triggered for tenant ${data.tenant_id}, profile ${data.profile_id}`);
    if (!supabase) return;
    try {
        const { error } = await supabase.from('notification_queue').insert({
            tenant_id: data.tenant_id,
            profile_id: data.profile_id,
            channel: 'sms',
            recipient: data.phone || '0000000000',
            subject: 'Check-in Denied',
            content: `Your check-in was denied. Reason: ${data.reason || 'Unknown'}`,
            status: 'pending'
        });
        if (error) {
            console.error("Supabase insert error for checkin.denied:", error);
        }
    } catch (error) {
        console.error("Error processing checkin.denied event:", error);
    }
});

// ─── Anti-Passback Front-Desk Alert ──────────────────────────────────────────
// Fires whenever a scan is blocked by the 30-second anti-passback cooldown.
// Inserts a high-priority 'antipassback' notification so the reception
// dashboard Supabase Realtime listener can surface an instant visual alert.
gymEmitter.on('checkin.antipassback', async (data) => {
    console.warn(
        `[SECURITY] Anti-passback violation — tenant: ${data.tenant_id}, ` +
        `profile: ${data.profile_id}, device: ${data.device_id}, ` +
        `last entry: ${data.last_checkin_at}`
    );
    if (!supabase) return;
    try {
        const { error } = await supabase.from('notification_queue').insert({
            tenant_id: data.tenant_id,
            profile_id: data.profile_id,
            channel: 'antipassback',          // reception dashboard listens on this channel
            recipient: 'front_desk',
            subject: '⚠️ Anti-Passback Violation Detected',
            content: `SECURITY ALERT: Profile ${data.profile_id} attempted to re-enter within 30 seconds of their last check-in (${data.last_checkin_at}). Possible tailgating. Device: ${data.device_id || 'unknown'}.`,
            status: 'pending',
            metadata: {
                violation_type: 'anti_passback',
                profile_id: data.profile_id,
                device_id: data.device_id,
                last_checkin_at: data.last_checkin_at
            }
        });
        if (error) {
            console.error("Supabase insert error for checkin.antipassback:", error);
        }
    } catch (error) {
        console.error("Error processing checkin.antipassback event:", error);
    }
});
// ─────────────────────────────────────────────────────────────────────────────

module.exports = gymEmitter;
