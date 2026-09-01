const authMiddleware = require('./authMiddleware');
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { verifyHmacSignature, formatRWF } = require('@polyfit/shared-utils');

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
        const signature = req.headers['x-paypack-signature'];
        const paypackSecret = process.env.PAYPACK_WEBHOOK_SECRET;

        // Verify cryptographic HMAC signature
        if (paypackSecret) {
            const isValid = verifyHmacSignature(payload, paypackSecret, signature);
            if (!isValid) {
                console.warn('[paypack/webhook] Invalid HMAC signature received');
                return res.status(401).json({ error: 'Invalid webhook signature' });
            }
        }

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
        const signature = req.headers['x-momo-signature'];
        const momoSecret = process.env.MOMO_WEBHOOK_SECRET;

        // Verify cryptographic HMAC signature
        if (momoSecret) {
            const isValid = verifyHmacSignature(payload, momoSecret, signature);
            if (!isValid) {
                console.warn('[momo/webhook] Invalid HMAC signature received');
                return res.status(401).json({ error: 'Invalid webhook signature' });
            }
        }

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

// Airtel Money Webhook
router.post('/airtel/webhook', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

    try {
        const payload = req.body;
        const signature = req.headers['x-airtel-signature'];
        const airtelSecret = process.env.AIRTEL_WEBHOOK_SECRET;

        // Verify cryptographic HMAC signature
        if (airtelSecret) {
            const isValid = verifyHmacSignature(payload, airtelSecret, signature);
            if (!isValid) {
                console.warn('[airtel/webhook] Invalid HMAC signature received');
                return res.status(401).json({ error: 'Invalid webhook signature' });
            }
        }

        if (!payload || !payload.transaction_id || !payload.reference) {
            return res.status(400).json({ error: "Invalid payload format" });
        }

        const reference_code = payload.reference;
        const status = payload.status; // SUCCESSFUL, FAILED

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

        // Log webhook event
        const { data: webhookEvent, error: webhookError } = await supabase
            .from('webhook_events')
            .insert({
                tenant_id: tenant_id,
                provider: 'airtel',
                provider_event_id: payload.transaction_id,
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
            await supabase.from('payments')
                .update({ status: 'failed' })
                .eq('reference_code', reference_code);

            await supabase.from('webhook_events')
                .update({ status: 'completed', processed_at: new Date().toISOString() })
                .eq('id', webhookEvent.id);

            return res.status(200).json({ success: true, message: "Processed failed payment" });
        }

        // Update payment status
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

        // Update membership
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

        await supabase
            .from('webhook_events')
            .update({ status: 'completed', processed_at: new Date().toISOString() })
            .eq('id', webhookEvent.id);

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("Airtel webhook error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

// Initialize MTN MoMo payment request
router.post('/momo/request', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

    try {
        const { tenant_id, profile_id, amount, phone_number, member_name } = req.body;

        if (!tenant_id || !amount || !phone_number) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Generate reference code
        const reference_code = 'GYP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        // Insert payment record
        const { data: payment, error: paymentError } = await supabase
            .from('payments')
            .insert({
                tenant_id,
                profile_id,
                amount: parseFloat(amount),
                currency: 'RWF',
                payment_method: 'mtn_momo',
                reference_code,
                status: 'pending',
                phone_number,
                member_name,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (paymentError) {
            throw paymentError;
        }

        // In production, call MTN MoMo API here to initiate payment
        // For now, return mock response
        res.status(200).json({
            success: true,
            reference_code,
            payment_url: `https://momo.mtn.rw/payment/${reference_code}`,
            amount: formatRWF(parseFloat(amount)),
            currency: 'RWF',
            expires_in: 300 // 5 minutes
        });
    } catch (error) {
        console.error("MTN MoMo request error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Initialize Airtel Money payment request
router.post('/airtel/request', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

    try {
        const { tenant_id, profile_id, amount, phone_number, member_name } = req.body;

        if (!tenant_id || !amount || !phone_number) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const reference_code = 'GYA-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        const { data: payment, error: paymentError } = await supabase
            .from('payments')
            .insert({
                tenant_id,
                profile_id,
                amount: parseFloat(amount),
                currency: 'RWF',
                payment_method: 'airtel_money',
                reference_code,
                status: 'pending',
                phone_number,
                member_name,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (paymentError) {
            throw paymentError;
        }

        res.status(200).json({
            success: true,
            reference_code,
            payment_url: `https://airtel.rw/payment/${reference_code}`,
            amount: formatRWF(parseFloat(amount)),
            currency: 'RWF',
            expires_in: 300
        });
    } catch (error) {
        console.error("Airtel Money request error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Process cash payment
router.post('/cash', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

    try {
        const { tenant_id, profile_id, amount, reference, received_by, notes } = req.body;

        if (!tenant_id || !amount || !received_by) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const reference_code = reference || 'CASH-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        const { data: payment, error: paymentError } = await supabase
            .from('payments')
            .insert({
                tenant_id,
                profile_id,
                amount: parseFloat(amount),
                currency: 'RWF',
                payment_method: 'cash',
                reference_code,
                status: 'completed',
                received_by,
                notes,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (paymentError) {
            throw paymentError;
        }

        // Update membership if profile_id provided
        if (profile_id) {
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

                await supabase
                    .from('memberships')
                    .update({
                        status: 'active',
                        end_date: newEndDate.toISOString().split('T')[0]
                    })
                    .eq('id', membership.id);
            }
        }

        res.status(200).json({
            success: true,
            reference_code,
            amount: formatRWF(parseFloat(amount)),
            currency: 'RWF',
            payment_method: 'cash'
        });
    } catch (error) {
        console.error("Cash payment error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Charge to member tab
router.post('/tab/charge', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

    try {
        const { tenant_id, profile_id, amount, notes, charged_by } = req.body;

        if (!tenant_id || !profile_id || !amount) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const reference_code = 'TAB-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        // Add to member tab balance
        const { data: tab, error: tabError } = await supabase
            .from('member_tabs')
            .select('*')
            .eq('profile_id', profile_id)
            .eq('tenant_id', tenant_id)
            .single();

        let currentBalance = 0;
        if (!tabError && tab) {
            currentBalance = tab.balance || 0;
        }

        const newBalance = currentBalance + parseFloat(amount);

        if (tab) {
            await supabase
                .from('member_tabs')
                .update({
                    balance: newBalance,
                    currency: 'RWF',
                    updated_at: new Date().toISOString()
                })
                .eq('id', tab.id);
        } else {
            await supabase
                .from('member_tabs')
                .insert({
                    tenant_id,
                    profile_id,
                    balance: newBalance,
                    currency: 'RWF',
                    created_at: new Date().toISOString()
                });
        }

        // Record tab charge as payment
        const { data: payment, error: paymentError } = await supabase
            .from('payments')
            .insert({
                tenant_id,
                profile_id,
                amount: parseFloat(amount),
                currency: 'RWF',
                payment_method: 'tab',
                reference_code,
                status: 'completed',
                charged_by,
                notes,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (paymentError) {
            throw paymentError;
        }

        res.status(200).json({
            success: true,
            reference_code,
            amount: formatRWF(parseFloat(amount)),
            currency: 'RWF',
            tab_balance: formatRWF(newBalance),
            payment_method: 'tab'
        });
    } catch (error) {
        console.error("Tab charge error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Get member tab balance
router.get('/tab/balance/:profile_id', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

    try {
        const { profile_id } = req.params;
        const { tenant_id } = req.query;

        if (!profile_id || !tenant_id) {
            return res.status(400).json({ error: "Missing profile_id or tenant_id" });
        }

        const { data: tab, error } = await supabase
            .from('member_tabs')
            .select('*')
            .eq('profile_id', profile_id)
            .eq('tenant_id', tenant_id)
            .single();

        if (error || !tab) {
            return res.status(404).json({ error: "Tab not found", balance: 0 });
        }

        res.status(200).json({
            success: true,
            balance: tab.balance,
            currency: tab.currency || 'RWF',
            formatted_balance: formatRWF(tab.balance)
        });
    } catch (error) {
        console.error("Get tab balance error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Cash till audit
router.get('/audit/cash-till', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "supabase config missing" });

    try {
        const { tenant_id, start_date, end_date } = req.query;

        if (!tenant_id || !start_date || !end_date) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        // Get cash payments for the date range
        const { data: cashPayments, error: paymentsError } = await supabase
            .from('payments')
            .select('*')
            .eq('tenant_id', tenant_id)
            .eq('payment_method', 'cash')
            .gte('created_at', start_date)
            .lte('created_at', end_date)
            .eq('status', 'completed')
            .order('created_at', { ascending: true });

        if (paymentsError) {
            throw paymentsError;
        }

        const totalCash = cashPayments.reduce((sum, payment) => sum + payment.amount, 0);
        const expectedCash = cashPayments.reduce((sum, payment) => sum + payment.amount, 0); // In production, this would come from shift records

        const discrepancy = totalCash - expectedCash;

        res.status(200).json({
            success: true,
            audit_date_range: { start_date, end_date },
            total_cash: totalCash,
            expected_cash: expectedCash,
            discrepancy: discrepancy,
            discrepancy_status: discrepancy === 0 ? 'balanced' : discrepancy > 0 ? 'over' : 'short',
            transaction_count: cashPayments.length,
            transactions: cashPayments.map(p => ({
                id: p.id,
                amount: p.amount,
                reference_code: p.reference_code,
                received_by: p.received_by,
                created_at: p.created_at,
                notes: p.notes
            }))
        });
    } catch (error) {
        console.error("Cash till audit error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Validate Promo Code
router.post('/validate-promo', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

    try {
        const { tenant_id, code, subtotal = 0, apply = false } = req.body;

        if (!tenant_id || !code) {
            return res.status(400).json({ error: "Missing required fields: tenant_id and code" });
        }

        const { data: promo, error } = await supabase
            .from('promotions')
            .select('*')
            .eq('tenant_id', tenant_id)
            .ilike('code', code.trim())
            .single();

        if (error || !promo) {
            return res.status(404).json({ error: "Invalid promotion code" });
        }

        if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
            return res.status(400).json({ error: "Promotion code has expired" });
        }

        if (promo.max_uses !== null && promo.max_uses !== undefined && promo.times_used >= promo.max_uses) {
            return res.status(400).json({ error: "Promotion code usage limit reached" });
        }

        let discount = 0;
        const numericSubtotal = parseFloat(subtotal) || 0;
        const discountVal = parseFloat(promo.discount_value) || 0;

        if (promo.discount_type === 'percentage') {
            discount = numericSubtotal > 0 ? (numericSubtotal * discountVal) / 100 : discountVal;
        } else {
            discount = discountVal;
        }

        const calculatedDiscount = numericSubtotal > 0 ? Math.min(discount, numericSubtotal) : discount;

        if (apply) {
            await supabase
                .from('promotions')
                .update({
                    times_used: (promo.times_used || 0) + 1,
                    updated_at: new Date().toISOString()
                })
                .eq('id', promo.id);
        }

        res.status(200).json({
            success: true,
            promotion: {
                id: promo.id,
                code: promo.code,
                discount_type: promo.discount_type,
                discount_value: promo.discount_value,
                calculated_discount: calculatedDiscount,
                formatted_discount: formatRWF(calculatedDiscount)
            }
        });
    } catch (error) {
        console.error("Validate promo error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Read-Only Validate / Preview Gift Voucher (Does NOT mutate balance)
router.post('/validate-voucher', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

    try {
        const { tenant_id, code, subtotal = 0 } = req.body;

        if (!tenant_id || !code) {
            return res.status(400).json({ error: "Missing required fields: tenant_id and code" });
        }

        const { data: voucher, error } = await supabase
            .from('gift_vouchers')
            .select('*')
            .eq('tenant_id', tenant_id)
            .ilike('code', code.trim())
            .single();

        if (error || !voucher) {
            return res.status(404).json({ error: "Invalid gift voucher code" });
        }

        if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
            return res.status(400).json({ error: "Gift voucher has expired" });
        }

        const currentBalance = parseFloat(voucher.current_balance_rwf) || 0;
        if (currentBalance <= 0) {
            return res.status(400).json({ error: "Gift voucher has zero remaining balance" });
        }

        const numericSubtotal = parseFloat(subtotal) || 0;
        const usableDiscount = numericSubtotal > 0 ? Math.min(currentBalance, numericSubtotal) : currentBalance;

        res.status(200).json({
            success: true,
            voucher: {
                id: voucher.id,
                code: voucher.code,
                current_balance_rwf: currentBalance,
                usable_discount: usableDiscount,
                formatted_balance: formatRWF(currentBalance),
                formatted_discount: formatRWF(usableDiscount)
            }
        });
    } catch (error) {
        console.error("Validate voucher error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Issue Gift Voucher
router.post('/issue-gift-voucher', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

    try {
        const { tenant_id, code, initial_balance_rwf, expires_at } = req.body;

        if (!tenant_id || !initial_balance_rwf) {
            return res.status(400).json({ error: "Missing required fields: tenant_id and initial_balance_rwf" });
        }

        const initialBalance = parseFloat(initial_balance_rwf);
        if (isNaN(initialBalance) || initialBalance <= 0) {
            return res.status(400).json({ error: "initial_balance_rwf must be a positive number" });
        }

        const voucherCode = code ? code.trim().toUpperCase() : 'GV-' + Math.random().toString(36).substring(2, 8).toUpperCase();

        const { data: voucher, error } = await supabase
            .from('gift_vouchers')
            .insert({
                tenant_id,
                code: voucherCode,
                initial_balance_rwf: initialBalance,
                current_balance_rwf: initialBalance,
                expires_at: expires_at || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error("Issue gift voucher DB error:", error);
            return res.status(400).json({ error: error.message || "Failed to issue gift voucher" });
        }

        res.status(201).json({
            success: true,
            voucher: {
                ...voucher,
                formatted_initial_balance: formatRWF(voucher.initial_balance_rwf),
                formatted_current_balance: formatRWF(voucher.current_balance_rwf)
            }
        });
    } catch (error) {
        console.error("Issue gift voucher error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Apply Gift Voucher (Atomic Deduction called upon sale completion)
router.post('/apply-gift-voucher', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

    try {
        const { tenant_id, code, amount_to_use } = req.body;

        if (!tenant_id || !code || !amount_to_use) {
            return res.status(400).json({ error: "Missing required fields: tenant_id, code, and amount_to_use" });
        }

        const requestedAmount = parseFloat(amount_to_use);
        if (isNaN(requestedAmount) || requestedAmount <= 0) {
            return res.status(400).json({ error: "amount_to_use must be a positive number" });
        }

        // Fetch voucher ID securely for the given tenant and code
        const { data: voucher, error: fetchErr } = await supabase
            .from('gift_vouchers')
            .select('id, expires_at, current_balance_rwf')
            .eq('tenant_id', tenant_id)
            .ilike('code', code.trim())
            .single();

        if (fetchErr || !voucher) {
            return res.status(404).json({ error: "Invalid gift voucher code" });
        }

        // Execute atomic PostgreSQL RPC function with row locking
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('deduct_gift_voucher_balance', {
            p_voucher_id: voucher.id,
            p_amount: requestedAmount
        });

        if (rpcErr || !rpcRes || rpcRes.length === 0) {
            console.error("Atomic voucher deduction RPC error:", rpcErr);
            return res.status(500).json({ error: "Failed to deduct gift voucher balance" });
        }

        const result = rpcRes[0];
        if (!result.success) {
            return res.status(400).json({ error: result.error_message || "Deduction failed" });
        }

        res.status(200).json({
            success: true,
            applied_amount: parseFloat(result.applied_amount),
            remaining_balance: parseFloat(result.remaining_balance),
            formatted_applied: formatRWF(result.applied_amount),
            formatted_remaining: formatRWF(result.remaining_balance)
        });
    } catch (error) {
        console.error("Apply gift voucher error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
