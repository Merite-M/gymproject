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

module.exports = gymEmitter;
