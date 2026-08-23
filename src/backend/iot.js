const express = require('express');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const gymEmitter = require("./events");
const crypto = require('crypto');
const ipaddr = require('ipaddr.js');
const dns = require('dns');
const { promisify } = require('util');
const lookupAsync = promisify(dns.lookup);

require('dotenv').config();

// SSRF Protection Validator
async function isSafeUrl(urlString) {
    try {
        const url = new URL(urlString);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return false;
        }

        const hostname = url.hostname;
        let ip = hostname;

        if (!ipaddr.isValid(hostname)) {
            const lookupResult = await lookupAsync(hostname);
            ip = lookupResult.address;
        }

        const addr = ipaddr.parse(ip);
        const range = addr.range();

        const forbiddenRanges = [
            'unspecified',
            'loopback',
            'linkLocal',
            'multicast',
            'broadcast',
            'private',
            'carrierGradeNat',
            'reserved'
        ];

        if (forbiddenRanges.includes(range) || ip === '169.254.169.254') {
             return false;
        }

        return true;
    } catch (err) {
        console.error("SSRF validation error:", err);
        return false;
    }
}


const router = express.Router();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// Access token generator
function generateAccessToken(profileId, tenantId) {
  const timestamp = Date.now();
  const signature = crypto.createHmac('sha256', process.env.JWT_SECRET || 'secret')
    .update(`${profileId}:${tenantId}:${timestamp}`)
    .digest('hex');
  return Buffer.from(`${profileId}:${tenantId}:${timestamp}:${signature}`).toString('base64');
}

function verifyAccessToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [profileId, tenantId, timestamp, signature] = decoded.split(':');
    
    const expectedSignature = crypto.createHmac('sha256', process.env.JWT_SECRET || 'secret')
      .update(`${profileId}:${tenantId}:${timestamp}`)
      .digest('hex');
    
    if (signature !== expectedSignature) return null;
    
    // Check if token is expired (24 hours)
    const tokenAge = Date.now() - parseInt(timestamp);
    if (tokenAge > 24 * 60 * 60 * 1000) return null;
    
    return { profileId, tenantId };
  } catch (error) {
    return null;
  }
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

                // SSRF Protection Check
                if (!(await isSafeUrl(triggerUrl))) {
                    console.error(`Blocked unsafe trigger URL: ${triggerUrl}`);
                    return res.status(400).json({ error: 'Unsafe device IP address or trigger URL' });
                }

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

// Generate access token for member
router.post('/access-token/generate', async (req, res) => {
    try {
        const { tenant_id, profile_id, generated_by } = req.body;

        if (!tenant_id || !profile_id) {
            return res.status(400).json({ error: 'Missing required parameters' });
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

        // Check membership status
        const { data: membership, error: membershipError } = await supabase
            .from('memberships')
            .select('*')
            .eq('profile_id', profile_id)
            .eq('tenant_id', tenant_id)
            .eq('status', 'active')
            .order('end_date', { ascending: false })
            .limit(1)
            .single();

        if (membershipError || !membership) {
            return res.status(403).json({ error: 'No active membership found' });
        }

        // Check for active holds
        const { data: activeHold } = await supabase
            .from('membership_holds')
            .select('*')
            .eq('profile_id', profile_id)
            .eq('tenant_id', tenant_id)
            .eq('status', 'active')
            .single();

        if (activeHold) {
            return res.status(403).json({ error: 'Membership is on hold' });
        }

        // Generate access token
        const token = generateAccessToken(profile_id, tenant_id);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Store token in database
        const { data: tokenData, error: tokenError } = await supabase
            .from('access_tokens')
            .insert({
                tenant_id,
                profile_id,
                token,
                expires_at: expiresAt.toISOString(),
                generated_by,
                status: 'active'
            })
            .select()
            .single();

        if (tokenError) {
            throw tokenError;
        }

        res.status(200).json({
            success: true,
            token: token,
            expires_at: expiresAt.toISOString(),
            profile: {
                name: `${profile.first_name} ${profile.last_name}`,
                membership_type: membership.membership_type,
                membership_end_date: membership.end_date
            }
        });
    } catch (error) {
        console.error("Generate access token error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Verify access token
router.post('/access-token/verify', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Missing token' });
        }

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        // Verify token signature
        const decoded = verifyAccessToken(token);
        if (!decoded) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Check if token exists in database and is active
        const { data: tokenData, error: tokenError } = await supabase
            .from('access_tokens')
            .select('*')
            .eq('token', token)
            .eq('status', 'active')
            .single();

        if (tokenError || !tokenData) {
            return res.status(401).json({ error: 'Token not found or inactive' });
        }

        // Check if token is expired
        if (new Date(tokenData.expires_at) < new Date()) {
            await supabase
                .from('access_tokens')
                .update({ status: 'expired' })
                .eq('id', tokenData.id);
            return res.status(401).json({ error: 'Token expired' });
        }

        // Get profile details
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', decoded.profileId)
            .eq('tenant_id', decoded.tenantId)
            .single();

        if (profileError || !profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Check membership status
        const { data: membership, error: membershipError } = await supabase
            .from('memberships')
            .select('*')
            .eq('profile_id', decoded.profileId)
            .eq('tenant_id', decoded.tenantId)
            .eq('status', 'active')
            .order('end_date', { ascending: false })
            .limit(1)
            .single();

        if (membershipError || !membership) {
            return res.status(403).json({ error: 'No active membership' });
        }

        res.status(200).json({
            success: true,
            valid: true,
            profile: {
                id: profile.id,
                name: `${profile.first_name} ${profile.last_name}`,
                membership_type: membership.membership_type,
                membership_end_date: membership.end_date
            }
        });
    } catch (error) {
        console.error("Verify access token error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Revoke access token
router.post('/access-token/revoke', async (req, res) => {
    try {
        const { token, revoked_by } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Missing token' });
        }

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        const { error: updateError } = await supabase
            .from('access_tokens')
            .update({ 
                status: 'revoked',
                revoked_by,
                revoked_at: new Date().toISOString()
            })
            .eq('token', token);

        if (updateError) {
            throw updateError;
        }

        res.status(200).json({ success: true, message: 'Token revoked successfully' });
    } catch (error) {
        console.error("Revoke access token error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Scanner check-in processing
router.post('/scanner/checkin', async (req, res) => {
    try {
        const { tenant_id, scan_data, device_id, scanner_type } = req.body;

        if (!tenant_id || !scan_data) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        // Try to find profile by QR code, barcode, or access token
        let profile = null;
        let accessMethod = 'unknown';

        // Try access token first
        const tokenData = verifyAccessToken(scan_data);
        if (tokenData) {
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', tokenData.profileId)
                .eq('tenant_id', tenant_id)
                .single();

            if (!profileError && profileData) {
                profile = profileData;
                accessMethod = 'access_token';
            }
        }

        // Try QR code if token failed
        if (!profile) {
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('qr_code', scan_data)
                .eq('tenant_id', tenant_id)
                .single();

            if (!profileError && profileData) {
                profile = profileData;
                accessMethod = 'qr_code';
            }
        }

        // Try barcode if QR failed
        if (!profile) {
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('barcode', scan_data)
                .eq('tenant_id', tenant_id)
                .single();

            if (!profileError && profileData) {
                profile = profileData;
                accessMethod = 'barcode';
            }
        }

        if (!profile) {
            return res.status(404).json({ 
                error: 'Member not found',
                scan_data,
                scanner_type
            });
        }

        // Perform access control checks
        let accessStatus = 'approved';
        let reasons = [];

        // Check profile status
        if (profile.status === 'debtor') {
            accessStatus = 'denied_debt';
            reasons.push('Account locked due to outstanding debt');
        }

        // Check membership
        const { data: membership, error: membershipError } = await supabase
            .from('memberships')
            .select('*')
            .eq('profile_id', profile.id)
            .eq('tenant_id', tenant_id)
            .order('end_date', { ascending: false })
            .limit(1)
            .single();

        if (membershipError || !membership || membership.status !== 'active') {
            if (accessStatus === 'approved') accessStatus = 'denied_membership';
            reasons.push('No active membership');
        } else {
            // Check if membership is expired
            if (new Date(membership.end_date) < new Date()) {
                if (accessStatus === 'approved') accessStatus = 'denied_membership';
                reasons.push('Membership expired');
            }
        }

        // Check membership holds
        const { data: activeHold } = await supabase
            .from('membership_holds')
            .select('*')
            .eq('profile_id', profile.id)
            .eq('tenant_id', tenant_id)
            .eq('status', 'active')
            .single();

        if (activeHold) {
            if (accessStatus === 'approved') accessStatus = 'warning';
            reasons.push(`Membership on hold until ${activeHold.end_date || 'indefinitely'}`);
        }

        // Check waiver
        if (!profile.waiver_signed) {
            if (accessStatus === 'approved') accessStatus = 'warning';
            reasons.push('Liability waiver not signed');
        } else if (profile.waiver_signed_at) {
            const waiverDate = new Date(profile.waiver_signed_at);
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

            if (waiverDate < oneYearAgo) {
                if (accessStatus === 'approved') accessStatus = 'warning';
                reasons.push('Liability waiver expired');
            }
        }

        // Check member tab balance
        const { data: tab } = await supabase
            .from('member_tabs')
            .select('balance')
            .eq('profile_id', profile.id)
            .eq('tenant_id', tenant_id)
            .single();

        if (tab && parseFloat(tab.balance) > 0) {
            if (accessStatus === 'approved') accessStatus = 'warning';
            reasons.push(`Outstanding tab balance: ${parseFloat(tab.balance).toFixed(2)}`);
        }

        // Log check-in
        const { data: checkin, error: checkinError } = await supabase
            .from('check_ins')
            .insert({
                tenant_id,
                profile_id: profile.id,
                device_id,
                access_method: accessMethod,
                scanner_type,
                status: accessStatus,
                metadata: {
                    scan_data,
                    reasons: reasons
                }
            })
            .select()
            .single();

        if (checkinError) {
            console.error("Failed to log checkin:", checkinError);
        }

        // Emit event for denied access
        if (accessStatus.startsWith('denied')) {
            gymEmitter.emit('checkin.denied', {
                tenant_id,
                profile_id: profile.id,
                phone: profile.phone,
                reason: reasons.join('; ')
            });
        }

        res.status(200).json({
            success: true,
            access_status: accessStatus,
            profile: {
                id: profile.id,
                name: `${profile.first_name} ${profile.last_name}`,
                membership_type: membership?.membership_type,
                membership_end_date: membership?.end_date
            },
            reasons: reasons.length > 0 ? reasons : undefined,
            checkin: checkin || null
        });
    } catch (error) {
        console.error("Scanner checkin error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get check-in history for a member
router.get('/checkins/:profile_id', async (req, res) => {
    try {
        const { profile_id } = req.params;
        const { tenant_id, limit = 50 } = req.query;

        if (!profile_id || !tenant_id) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        const { data: checkins, error } = await supabase
            .from('check_ins')
            .select('*')
            .eq('profile_id', profile_id)
            .eq('tenant_id', tenant_id)
            .order('created_at', { ascending: false })
            .limit(parseInt(limit));

        if (error) {
            throw error;
        }

        res.status(200).json({
            success: true,
            checkins: checkins || []
        });
    } catch (error) {
        console.error("Get checkins error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get device status
router.get('/device/:device_id/status', async (req, res) => {
    try {
        const { device_id } = req.params;
        const { tenant_id } = req.query;

        if (!device_id || !tenant_id) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        const { data: device, error } = await supabase
            .from('hardware_devices')
            .select('*')
            .eq('id', device_id)
            .eq('tenant_id', tenant_id)
            .single();

        if (error || !device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        // Try to ping the device if it's a Shelly relay
        let isOnline = device.is_online;
        if (device.device_type === 'shelly_relay' && device.ip_address) {
            try {
                const statusUrl = `http://${device.ip_address}/status`;

                // SSRF Protection Check
                if (!(await isSafeUrl(statusUrl))) {
                    console.error(`Blocked unsafe status check URL: ${statusUrl}`);
                    return res.status(400).json({ error: 'Unsafe device IP address' });
                }

                const response = await fetch(statusUrl, {
                    method: 'GET',
                    timeout: 3000
                });
                isOnline = response.ok;
                
                // Update device status in database
                await supabase
                    .from('hardware_devices')
                    .update({ is_online: isOnline, last_seen: new Date().toISOString() })
                    .eq('id', device_id);
            } catch (err) {
                isOnline = false;
                await supabase
                    .from('hardware_devices')
                    .update({ is_online: false, last_seen: new Date().toISOString() })
                    .eq('id', device_id);
            }
        }

        res.status(200).json({
            success: true,
            device: {
                ...device,
                is_online: isOnline
            }
        });
    } catch (error) {
        console.error("Get device status error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
