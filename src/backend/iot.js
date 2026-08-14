const express = require('express');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const gymEmitter = require("./events");
require('dotenv').config();

const router = express.Router();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

router.post('/unlock', async (req, res) => {
    try {
        const { tenant_id, profile_id, device_id, access_method, geofence_verified } = req.body;

        if (!tenant_id || !profile_id || !device_id) {
            return res.status(400).json({ error: 'Missing required parameters (tenant_id, profile_id, device_id)' });
        }

        if (access_method === 'geofence') {
            if (geofence_verified !== true) {
                return res.status(403).json({ error: 'Geofence verification failed or missing' });
            }
        }

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        // Check profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', profile_id)
            .eq('tenant_id', tenant_id)
            .single();

        if (profileError || !profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        let finalStatus = 'approved';
        let reasons = [];

        if (profile.status === 'debtor') {
            finalStatus = 'denied_debt';
            reasons.push('Account locked due to outstanding debt');
        }

        // Check member tab balance
        const { data: tab } = await supabase
            .from('member_tabs')
            .select('balance')
            .eq('profile_id', profile_id)
            .eq('tenant_id', tenant_id)
            .single();

        if (tab && parseFloat(tab.balance) > 0) {
            if (finalStatus === 'approved') finalStatus = 'warning';
            reasons.push(`Outstanding tab balance: ${parseFloat(tab.balance).toFixed(2)}`);
        }

        if (!profile.waiver_signed) {
            if (finalStatus === 'approved') finalStatus = 'warning';
            reasons.push('Liability Waiver Unsigned');
        }

        // Check for active membership holds
        const { data: activeHold } = await supabase
            .from('membership_holds')
            .select('*')
            .eq('profile_id', profile_id)
            .eq('tenant_id', tenant_id)
            .eq('status', 'active')
            .single();

        if (activeHold) {
            if (finalStatus === 'approved') finalStatus = 'warning';
            reasons.push(`Membership on hold until ${activeHold.end_date || 'indefinitely'}`);
        }

        // Check if waiver is older than 1 year
        if (profile.waiver_signed_at) {
            const waiverDate = new Date(profile.waiver_signed_at);
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

            if (waiverDate < oneYearAgo) {
                if (finalStatus === 'approved') finalStatus = 'warning';
                reasons.push('Liability Waiver Expired (Needs Renewal)');
            }
        }

        // Fetch hardware device
        const { data: device, error: deviceError } = await supabase
            .from('hardware_devices')
            .select('*')
            .eq('id', device_id)
            .eq('tenant_id', tenant_id)
            .single();

        if (deviceError || !device) {
            return res.status(404).json({ error: 'Hardware device not found' });
        }

        if (device.device_type !== 'shelly_relay' || !device.is_online) {
            return res.status(400).json({ error: 'Device is offline or not a relay' });
        }

        let triggerSuccess = false;

        // Hardware Trigger
        if (finalStatus === 'approved' || finalStatus === 'warning') {
            try {
                const urlPath = device.trigger_url_path || '/relay/0?turn=on';
                const triggerUrl = `http://${device.ip_address}${urlPath}`;

                // Add a small timeout (3s) for the local relay request
                const controller = new AbortController();
                const timeout = setTimeout(() => { controller.abort(); }, 3000);

                const response = await fetch(triggerUrl, {
                    method: 'POST',
                    signal: controller.signal
                });

                clearTimeout(timeout);

                if (response.ok) {
                    triggerSuccess = true;
                } else {
                    console.error(`Hardware trigger failed with status: ${response.status}`);
                }
            } catch (err) {
                console.error("Hardware trigger error:", err);
            }
        }

        // Log Check-in
        const { data: checkin, error: checkinError } = await supabase.from('check_ins').insert({
            tenant_id,
            profile_id,
            device_id,
            access_method: access_method || 'manual_override',
            status: finalStatus
        }).select();

        if (checkinError) {
            console.error("Failed to log checkin:", checkinError);
        }

        if (finalStatus.startsWith('denied')) {
            gymEmitter.emit('checkin.denied', {
                tenant_id,
                profile_id,
                phone: profile.phone,
                reason: reasons.length > 0 ? reasons.join('; ') : 'Denied'
            });
        }

        return res.status(200).json({
            success: true,
            status: finalStatus,
            trigger_success: triggerSuccess,
            checkin: checkin ? checkin[0] : null,
            reason: reasons.length > 0 ? reasons.join('; ') : undefined
        });

    } catch (error) {
        console.error("IoT Unlock error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
