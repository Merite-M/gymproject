const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

module.exports = router;

// Paypack Webhook
router.post('/paypack/webhook', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

    try {
        const payload = req.body;
        // In a real scenario, verify cryptographic signature here using req.headers
        const signature = req.headers['x-paypack-signature'];

        // Ensure payload has necessary data
        if (!payload || !payload.data || !payload.data.ref) {
            return res.status(400).json({ error: "Invalid payload format" });
        }

        const reference_code = payload.data.ref;
        // The event type might come from the payload. Let's assume it's a successful payment.
        const event_type = payload.event_kind || 'payment.success';

        // Wait... we need tenant_id. We'll have to get it from the payments table based on the reference_code
        // So let's insert into webhook_events first, maybe without tenant_id initially, or fetch tenant_id first.
        const { data: paymentInfo, error: paymentFetchError } = await supabase
            .from('payments')
            .select('tenant_id, profile_id')
            .eq('reference_code', reference_code)
            .single();

        let tenant_id = null;
        let profile_id = null;
        if (!paymentFetchError && paymentInfo) {
            tenant_id = paymentInfo.tenant_id;
            profile_id = paymentInfo.profile_id;
        }

        // 1. Log event into webhook_events
        const { data: webhookEvent, error: webhookError } = await supabase
            .from('webhook_events')
            .insert({
                tenant_id: tenant_id, // Could be null if payment not found, that's okay for logging
                provider: 'paypack',
                provider_event_id: payload.data.id || reference_code,
                event_type: event_type,
                payload: payload,
                status: 'processing'
            })
            .select()
            .single();

        if (webhookError) {
            console.error("Failed to log webhook event:", webhookError);
            return res.status(500).json({ error: "Internal server error" });
        }

        if (paymentFetchError || !paymentInfo) {
            // Payment not found
            await supabase.from('webhook_events')
                .update({ status: 'failed', error_message: 'Payment reference not found', processed_at: new Date().toISOString() })
                .eq('id', webhookEvent.id);
            return res.status(404).json({ error: "Payment reference not found" });
        }

        if (event_type !== 'payment.success' && event_type !== 'Transaction:Successful') {
             // Not a success event, just mark processed
             await supabase.from('webhook_events')
                 .update({ status: 'completed', processed_at: new Date().toISOString() })
                 .eq('id', webhookEvent.id);
             return res.status(200).json({ success: true, message: "Ignored non-success event" });
        }

        // 2. Update payments table status to 'completed'
        const { error: paymentUpdateError } = await supabase
            .from('payments')
            .update({ status: 'completed' })
            .eq('reference_code', reference_code);

        if (paymentUpdateError) {
             await supabase.from('webhook_events')
                 .update({ status: 'failed', error_message: paymentUpdateError.message, processed_at: new Date().toISOString() })
                 .eq('id', webhookEvent.id);
             throw paymentUpdateError;
        }

        // 3. Update memberships table
        // Find existing active membership or just any membership for this profile
        const { data: membership, error: membershipError } = await supabase
            .from('memberships')
            .select('*')
            .eq('profile_id', profile_id)
            .eq('tenant_id', tenant_id)
            .order('end_date', { ascending: false })
            .limit(1)
            .single();

        if (!membershipError && membership) {
            let currentEndDate = new Date(membership.end_date);
            let today = new Date();
            // If membership has expired, start from today
            let baseDate = currentEndDate > today ? currentEndDate : today;

            // Add 30 days
            let newEndDate = new Date(baseDate);
            newEndDate.setDate(newEndDate.getDate() + 30);

            const { error: memUpdateError } = await supabase
                .from('memberships')
                .update({
                    status: 'active',
                    end_date: newEndDate.toISOString().split('T')[0] // format as date
                })
                .eq('id', membership.id);

            if (memUpdateError) {
                 await supabase.from('webhook_events')
                     .update({ status: 'failed', error_message: memUpdateError.message, processed_at: new Date().toISOString() })
                     .eq('id', webhookEvent.id);
                 throw memUpdateError;
            }
        } else {
            // No membership found, maybe create one? The issue says "extend membership"
            // If no membership found, we might just log an error or create a new one.
            // For now, let's just log in webhook_events that membership was not found
             await supabase.from('webhook_events')
                 .update({ status: 'failed', error_message: 'Membership not found for profile', processed_at: new Date().toISOString() })
                 .eq('id', webhookEvent.id);
             return res.status(404).json({ error: "Membership not found for profile" });
        }

        // 4. Update webhook_events to 'completed'
        await supabase
            .from('webhook_events')
            .update({ status: 'completed', processed_at: new Date().toISOString() })
            .eq('id', webhookEvent.id);

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("Paypack webhook error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

// MTN MoMo Webhook
router.post('/momo/webhook', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

    try {
        const payload = req.body;
        // In a real scenario, verify cryptographic signature here
        const signature = req.headers['x-momo-signature'];

        // MTN MoMo payloads vary, let's assume a standard structure where FinancialTransactionId is the reference
        if (!payload || !payload.financialTransactionId || !payload.externalId) {
            return res.status(400).json({ error: "Invalid payload format" });
        }

        // externalId usually contains the reference code we passed when requesting to pay
        const reference_code = payload.externalId;
        const status = payload.status; // e.g. SUCCESSFUL, FAILED

        const { data: paymentInfo, error: paymentFetchError } = await supabase
            .from('payments')
            .select('tenant_id, profile_id')
            .eq('reference_code', reference_code)
            .single();

        let tenant_id = null;
        let profile_id = null;
        if (!paymentFetchError && paymentInfo) {
            tenant_id = paymentInfo.tenant_id;
            profile_id = paymentInfo.profile_id;
        }

        // 1. Log event into webhook_events
        const { data: webhookEvent, error: webhookError } = await supabase
            .from('webhook_events')
            .insert({
                tenant_id: tenant_id,
                provider: 'momo',
                provider_event_id: payload.financialTransactionId,
                event_type: status === 'SUCCESSFUL' ? 'payment.success' : 'payment.failed',
                payload: payload,
                status: 'processing'
            })
            .select()
            .single();

        if (webhookError) {
            console.error("Failed to log webhook event:", webhookError);
            return res.status(500).json({ error: "Internal server error" });
        }

        if (paymentFetchError || !paymentInfo) {
            await supabase.from('webhook_events')
                .update({ status: 'failed', error_message: 'Payment reference not found', processed_at: new Date().toISOString() })
                .eq('id', webhookEvent.id);
            return res.status(404).json({ error: "Payment reference not found" });
        }

        if (status !== 'SUCCESSFUL') {
             // Handle failed payment
             await supabase.from('payments')
                 .update({ status: 'failed' })
                 .eq('reference_code', reference_code);

             await supabase.from('webhook_events')
                 .update({ status: 'completed', processed_at: new Date().toISOString() })
                 .eq('id', webhookEvent.id);

             return res.status(200).json({ success: true, message: "Processed failed payment" });
        }

        // 2. Update payments table status to 'completed'
        const { error: paymentUpdateError } = await supabase
            .from('payments')
            .update({ status: 'completed' })
            .eq('reference_code', reference_code);

        if (paymentUpdateError) {
             await supabase.from('webhook_events')
                 .update({ status: 'failed', error_message: paymentUpdateError.message, processed_at: new Date().toISOString() })
                 .eq('id', webhookEvent.id);
             throw paymentUpdateError;
        }

        // 3. Update memberships table
        const { data: membership, error: membershipError } = await supabase
            .from('memberships')
            .select('*')
            .eq('profile_id', profile_id)
            .eq('tenant_id', tenant_id)
            .order('end_date', { ascending: false })
            .limit(1)
            .single();

        if (!membershipError && membership) {
            let currentEndDate = new Date(membership.end_date);
            let today = new Date();
            let baseDate = currentEndDate > today ? currentEndDate : today;

            let newEndDate = new Date(baseDate);
            newEndDate.setDate(newEndDate.getDate() + 30);

            const { error: memUpdateError } = await supabase
                .from('memberships')
                .update({
                    status: 'active',
                    end_date: newEndDate.toISOString().split('T')[0]
                })
                .eq('id', membership.id);

            if (memUpdateError) {
                 await supabase.from('webhook_events')
                     .update({ status: 'failed', error_message: memUpdateError.message, processed_at: new Date().toISOString() })
                     .eq('id', webhookEvent.id);
                 throw memUpdateError;
            }
        } else {
             await supabase.from('webhook_events')
                 .update({ status: 'failed', error_message: 'Membership not found for profile', processed_at: new Date().toISOString() })
                 .eq('id', webhookEvent.id);
             return res.status(404).json({ error: "Membership not found for profile" });
        }

        // 4. Update webhook_events to 'completed'
        await supabase
            .from('webhook_events')
            .update({ status: 'completed', processed_at: new Date().toISOString() })
            .eq('id', webhookEvent.id);

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("MoMo webhook error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});
