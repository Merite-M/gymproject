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

        // Automatic Staff Task Creation for Failed Billing Recovery
        await supabase.from('staff_tasks').insert({
            tenant_id: data.tenant_id,
            profile_id: data.profile_id,
            title: `💳 Failed Billing Follow-Up (${data.amount || 'Subscription'} RWF)`,
            description: `Payment attempt failed for member (Reason: ${data.reason || 'MoMo / Card error'}). Contact member to update billing details or collect at reception.`,
            trigger_event: 'payment.failed',
            task_type: 'billing_recovery',
            priority: 'urgent',
            status: 'pending',
            due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            assigned_role: 'reception',
            metadata: {
                amount: data.amount,
                reason: data.reason
            }
        });
    } catch (error) {
        console.error("Error processing payment.failed event:", error);
    }
});

// ─── Lead Tour Completed Event ─────────────────────────────────────────────
gymEmitter.on('lead.tour_completed', async (data) => {
    console.log(`[Event] lead.tour_completed triggered for tenant ${data.tenant_id}, profile ${data.profile_id}`);
    if (!supabase) return;
    try {
        await supabase.from('staff_tasks').insert({
            tenant_id: data.tenant_id,
            profile_id: data.profile_id,
            title: `👋 24h Tour Follow-Up: ${data.lead_name || 'Prospect'}`,
            description: `Lead completed facility tour. Contact via WhatsApp/Call to answer questions and present membership tier options.`,
            trigger_event: 'lead.tour_completed',
            task_type: 'tour_feedback',
            priority: 'high',
            status: 'pending',
            due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            assigned_role: 'sales',
            metadata: {
                tour_date: data.tour_date,
                interests: data.interests
            }
        });
    } catch (error) {
        console.error("Error processing lead.tour_completed event:", error);
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

// ─── Capacity Alert Events ───────────────────────────────────────────────────
// Fires when the facility reaches max occupancy limit.
gymEmitter.on('capacity.full', async (data) => {
    console.warn(
        `[CAPACITY] FULL — tenant: ${data.tenant_id}, ` +
        `occupancy: ${data.current_occupancy}/${data.max_limit}, ` +
        `member denied: ${data.profile_id}`
    );
    if (!supabase) return;
    try {
        const { error } = await supabase.from('notification_queue').insert({
            tenant_id: data.tenant_id,
            profile_id: data.profile_id,
            channel: 'capacity_alert',
            recipient: 'front_desk',
            subject: '🚫 Facility at Maximum Capacity — Entry Denied',
            content: `Gym is FULL (${data.current_occupancy}/${data.max_limit}). Member ${data.profile_id} was denied entry. Capacity policy: HARD GATE.`,
            status: 'pending',
            metadata: {
                alert_type: 'capacity_full',
                current_occupancy: data.current_occupancy,
                max_limit: data.max_limit,
                profile_id: data.profile_id
            }
        });
        if (error) {
            console.error("Supabase insert error for capacity.full:", error);
        }
    } catch (error) {
        console.error("Error processing capacity.full event:", error);
    }
});

gymEmitter.on('capacity.warning', async (data) => {
    console.warn(
        `[CAPACITY] WARNING — tenant: ${data.tenant_id}, ` +
        `occupancy: ${data.current_occupancy}/${data.max_limit}`
    );
    if (!supabase) return;
    try {
        const { error } = await supabase.from('notification_queue').insert({
            tenant_id: data.tenant_id,
            profile_id: data.profile_id,
            channel: 'capacity_alert',
            recipient: 'front_desk',
            subject: '⚠️ Facility Approaching/At Capacity',
            content: `Gym occupancy at ${data.current_occupancy}/${data.max_limit}. Member was allowed entry with warning.`,
            status: 'pending',
            metadata: {
                alert_type: 'capacity_warning',
                current_occupancy: data.current_occupancy,
                max_limit: data.max_limit,
                profile_id: data.profile_id
            }
        });
        if (error) {
            console.error("Supabase insert error for capacity.warning:", error);
        }
    } catch (error) {
        console.error("Error processing capacity.warning event:", error);
    }
});
// ─── Contract & E-Signature Events ───────────────────────────────────────────
gymEmitter.on('contract.signed', async (data) => {
    console.log(`[CONTRACT] SIGNED — tenant: ${data.tenant_id}, profile: ${data.profile_id}, contract: ${data.contract_id}, title: ${data.title}`);
    if (!supabase) return;
    try {
        const { error } = await supabase.from('notification_queue').insert({
            tenant_id: data.tenant_id,
            profile_id: data.profile_id,
            channel: 'contract_signed',
            recipient: 'front_desk',
            subject: '📝 Membership Agreement Digitally Executed',
            content: `Member ${data.profile_id} has signed agreement: "${data.title}" at ${data.signed_at}.`,
            status: 'pending',
            metadata: {
                contract_id: data.contract_id,
                title: data.title,
                signed_at: data.signed_at
            }
        });
        if (error) {
            console.error("Supabase insert error for contract.signed:", error);
        }
    } catch (error) {
        console.error("Error processing contract.signed event:", error);
    }
});
// ─── Corporate Billing Events ───────────────────────────────────────────────
gymEmitter.on('corporate.invoice_generated', async (data) => {
    console.log(`[CORPORATE] INVOICE GENERATED — tenant: ${data.tenant_id}, company: ${data.company_name}, invoice: ${data.invoice_number}, total: ${data.total_due}`);
    if (!supabase) return;
    try {
        const { error } = await supabase.from('notification_queue').insert({
            tenant_id: data.tenant_id,
            channel: 'corporate_billing',
            recipient: 'management',
            subject: `💼 Corporate Invoice Issued: ${data.company_name}`,
            content: `Grouped B2B invoice ${data.invoice_number} generated for ${data.company_name}. Total due: ${data.total_due} RWF.`,
            status: 'pending',
            metadata: {
                corporate_account_id: data.corporate_account_id,
                invoice_id: data.invoice_id,
                invoice_number: data.invoice_number,
                total_due: data.total_due
            }
        });
        if (error) console.error("Supabase insert error for corporate.invoice_generated:", error);
    } catch (error) {
        console.error("Error processing corporate.invoice_generated event:", error);
    }
});

gymEmitter.on('corporate.invoice_paid', async (data) => {
    console.log(`[CORPORATE] INVOICE PAID — tenant: ${data.tenant_id}, invoice: ${data.invoice_number}, amount: ${data.amount}`);
    if (!supabase) return;
    try {
        const { error } = await supabase.from('notification_queue').insert({
            tenant_id: data.tenant_id,
            channel: 'corporate_billing',
            recipient: 'management',
            subject: `✅ Corporate Invoice Paid: ${data.invoice_number}`,
            content: `Payment received for B2B invoice ${data.invoice_number}. Amount: ${data.amount} RWF via ${data.payment_method}.`,
            status: 'pending',
            metadata: {
                invoice_id: data.invoice_id,
                invoice_number: data.invoice_number,
                corporate_account_id: data.corporate_account_id,
                amount: data.amount,
                payment_method: data.payment_method,
                paid_at: data.paid_at
            }
        });
        if (error) console.error("Supabase insert error for corporate.invoice_paid:", error);
    } catch (error) {
        console.error("Error processing corporate.invoice_paid event:", error);
    }
});
// ─── Membership Tier Change Events ──────────────────────────────────────────
gymEmitter.on('membership.tier_changed', async (data) => {
    console.log(`[TIER] CHANGED — tenant: ${data.tenant_id}, profile: ${data.profile_id}, ${data.previous_tier} -> ${data.new_tier} (${data.change_type}, delta: ${data.delta_amount})`);
    if (!supabase) return;
    try {
        const { error } = await supabase.from('notification_queue').insert({
            tenant_id: data.tenant_id,
            profile_id: data.profile_id,
            channel: 'system_event',
            recipient: 'front_desk',
            subject: `⚡ Membership Plan ${data.change_type === 'upgrade' ? 'Upgraded' : 'Changed'}: ${data.new_tier}`,
            content: `Member plan transitioned from "${data.previous_tier}" to "${data.new_tier}". Proration mode: ${data.proration_mode}. Delta: ${data.delta_amount} RWF.`,
            status: 'pending',
            metadata: {
                membership_id: data.membership_id,
                change_type: data.change_type,
                previous_tier: data.previous_tier,
                new_tier: data.new_tier,
                delta_amount: data.delta_amount,
                proration_mode: data.proration_mode
            }
        });
        if (error) console.error("Supabase insert error for membership.tier_changed:", error);
    } catch (error) {
        console.error("Error processing membership.tier_changed event:", error);
    }
});
// ─────────────────────────────────────────────────────────────────────────────

module.exports = gymEmitter;
