const express = require('express');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const gymEmitter = require("./events");
const crypto = require('crypto');
const ipaddr = require('ipaddr.js');
const dns = require('dns');
const { promisify } = require('util');
const lookupAsync = promisify(dns.lookup);
const authMiddleware = require('./authMiddleware');
const { getLiveOccupancy: sharedGetLiveOccupancy } = require('@gym-partner/shared-utils');

require('dotenv').config();

// SSRF Protection Validator
async function getSafeIpAndHost(urlString) {
    try {
        const url = new URL(urlString);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return { safe: false };
        }

        const hostname = url.hostname.replace(/^\[|\]$/g, '');
        let ip = hostname;

        if (!ipaddr.isValid(hostname)) {
            const lookupResult = await lookupAsync(hostname);
            ip = lookupResult.address;
        }

        const addr = ipaddr.parse(ip);
        let checkAddr = addr;

        if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
            checkAddr = addr.toIPv4Address();
        }

        const range = checkAddr.range();

        const forbiddenRanges = [
            'unspecified',
            'loopback',
            'linkLocal',
            'multicast',
            'broadcast',
            'carrierGradeNat',
            'reserved'
        ];

        // Ensure we correctly identify uniqueLocal for IPv6
        if (forbiddenRanges.includes(range) || checkAddr.toString() === '169.254.169.254' || (addr.kind() === 'ipv6' && range === 'uniqueLocal')) {
             return { safe: false };
        }

        // ipaddr parses IPv6 with colons. node-fetch needs brackets around IPv6 addresses in URL
        const safeFetchIp = addr.kind() === 'ipv6' ? `[${ip}]` : ip;

        return {
            safe: true,
            ip: safeFetchIp,
            hostname: url.hostname,
            port: url.port,
            protocol: url.protocol,
            pathname: url.pathname,
            search: url.search
        };
    } catch (err) {
        console.error("SSRF validation error:", err);
        return { safe: false };
    }
}

const router = express.Router();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}


// ─── Dynamic TOTP & Hardware Token Helpers ──────────────────────────────────
const TOTP_PERIOD = 15; // 15-second refresh window for dynamic anti-screenshot QR codes

function generateTOTP(profileId, tenantId, epochOffset = 0) {
  const secret = process.env.JWT_SECRET || 'secret';
  const epoch = Math.floor(Date.now() / 1000 / TOTP_PERIOD) + epochOffset;
  const message = `${profileId}:${tenantId}:${epoch}`;
  const hmac = crypto.createHmac('sha256', secret).update(message).digest('hex');
  const code = hmac.substring(0, 8).toUpperCase();
  return { code, epoch, expires_in_seconds: TOTP_PERIOD - (Math.floor(Date.now() / 1000) % TOTP_PERIOD) };
}

function verifyTOTPToken(scanData, profileId, tenantId) {
  if (!scanData) return false;
  // Format check: TOTP:<profile_id>:<hash>
  const parts = scanData.split(':');
  if (parts.length === 3 && parts[0] === 'TOTP') {
    const [_, targetProfileId, scannedHash] = parts;
    if (profileId && targetProfileId !== profileId) return false;

    // Check epoch window tolerance ±1 (current, -1, +1)
    for (const offset of [0, -1, 1]) {
      const { code } = generateTOTP(targetProfileId, tenantId, offset);
      if (scannedHash.toUpperCase() === code) {
        return { valid: true, profileId: targetProfileId };
      }
    }
  }
  return false;
}
// ─────────────────────────────────────────────────────────────────────────────

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

// ─── Anti-Passback Helper ────────────────────────────────────────────────────
// Returns the most recent SUCCESSFUL check-in for a profile within the last
// ANTI_PASSBACK_WINDOW_MS milliseconds, or null if none exists.
const ANTI_PASSBACK_WINDOW_MS = 30_000; // 30 seconds

async function checkAntiPassback(profile_id, tenant_id) {
  const windowStart = new Date(Date.now() - ANTI_PASSBACK_WINDOW_MS).toISOString();

  const { data, error } = await supabase
    .from('check_ins')
    .select('id, created_at, access_method')
    .eq('profile_id', profile_id)
    .eq('tenant_id', tenant_id)
    .in('status', ['approved', 'warning'])   // only count successful entries
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null; // no recent check-in → allow
  return data;                     // recent check-in found → deny
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Live Occupancy Helper ───────────────────────────────────────────────────
// Returns the count of members currently inside the gym:
// checked-in (approved/warning), not yet checked out, and within the
// auto-checkout window.
async function getLiveOccupancy(tenant_id, autoCheckoutMinutes = 120) {
  return sharedGetLiveOccupancy(supabase, tenant_id, autoCheckoutMinutes);
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Shelly Relay Trigger with Retry ─────────────────────────────────────────
async function triggerShellyRelayWithRetry(device, maxRetries = 2, timeoutMs = 3000) {
  const urlPath = device.trigger_url_path || '/relay/0?turn=on';
  const triggerUrl = `http://${device.ip_address}${urlPath}`;

  // SSRF Protection Check
  const safeUrlInfo = await getSafeIpAndHost(triggerUrl);
  if (!safeUrlInfo.safe) {
    console.error(`[Hardware Trigger] Blocked unsafe trigger URL: ${triggerUrl}`);
    return { success: false, error: 'Unsafe device IP address or trigger URL', unsafe: true };
  }

  const portStr = safeUrlInfo.port ? `:${safeUrlInfo.port}` : '';
  const safeFetchUrl = `${safeUrlInfo.protocol}//${safeUrlInfo.ip}${portStr}${safeUrlInfo.pathname}${safeUrlInfo.search}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); }, timeoutMs);
    try {
      const response = await fetch(safeFetchUrl, {
        headers: { 'Host': safeUrlInfo.hostname },
        method: 'POST',
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (response.ok) {
        return { success: true, attempts: attempt };
      }
      console.warn(`[Hardware Trigger] Attempt ${attempt}/${maxRetries} failed with status: ${response.status}`);
    } catch (err) {
      clearTimeout(timeout);
      console.warn(`[Hardware Trigger] Attempt ${attempt}/${maxRetries} network/timeout error:`, err.message);
    }

    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 400 * attempt));
    }
  }

  return { success: false, error: 'Hardware trigger failed after retries' };
}
// ─────────────────────────────────────────────────────────────────────────────

router.post('/unlock', authMiddleware, async (req, res) => {
    try {
        const { tenant_id, profile_id, device_id, access_method, geofence_verified } = req.body;

        if (!tenant_id || !profile_id || !device_id) {
            return res.status(400).json({ error: 'Missing required parameters (tenant_id, profile_id, device_id)' });
        }

        // Check if user is authorized to unlock for this profile
        // Users can unlock for themselves, or staff/admin can unlock for others
        const { data: staffCheck } = await supabase.from('profiles').select('role').eq('id', req.user.id).eq('tenant_id', tenant_id).single();
        if (req.user.id !== profile_id && (!staffCheck || (staffCheck.role !== 'staff' && staffCheck.role !== 'admin' && staffCheck.role !== 'trainer'))) {
            return res.status(403).json({ error: 'Unauthorized to unlock for this profile' });
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

        // ── Anti-Passback Check ──────────────────────────────────────────────
        // Block if this profile already had a successful entry in the last 30 s
        if (finalStatus === 'approved' || finalStatus === 'warning') {
            const recentCheckin = await checkAntiPassback(profile_id, tenant_id);
            if (recentCheckin) {
                // Log the anti-passback violation
                await supabase.from('check_ins').insert({
                    tenant_id,
                    profile_id,
                    device_id,
                    access_method: access_method || 'manual_override',
                    status: 'denied_anti_passback',
                    metadata: {
                        violation: 'anti_passback',
                        last_checkin_id: recentCheckin.id,
                        last_checkin_at: recentCheckin.created_at,
                        window_seconds: ANTI_PASSBACK_WINDOW_MS / 1000
                    }
                });

                // Emit front-desk alert
                gymEmitter.emit('checkin.antipassback', {
                    tenant_id,
                    profile_id,
                    phone: profile.phone,
                    device_id,
                    last_checkin_at: recentCheckin.created_at
                });

                return res.status(429).json({
                    success: false,
                    status: 'denied_anti_passback',
                    reason: `Anti-passback: entry already recorded ${Math.round((Date.now() - new Date(recentCheckin.created_at).getTime()) / 1000)}s ago. Please wait ${ANTI_PASSBACK_WINDOW_MS / 1000}s between scans.`
                });
            }
        }
        // ────────────────────────────────────────────────────────────────────

        // ── Capacity Gating ──────────────────────────────────────────────────
        if (finalStatus === 'approved' || finalStatus === 'warning') {
            const { data: tenantCap } = await supabase
                .from('tenants')
                .select('max_occupancy_limit, auto_checkout_minutes, capacity_policy')
                .eq('id', tenant_id)
                .single();

            if (tenantCap && tenantCap.max_occupancy_limit > 0) {
                const currentOccupancy = await getLiveOccupancy(tenant_id, tenantCap.auto_checkout_minutes || 120);
                if (currentOccupancy >= tenantCap.max_occupancy_limit) {
                    if (tenantCap.capacity_policy === 'hard') {
                        // Hard gate: deny entry
                        await supabase.from('check_ins').insert({
                            tenant_id,
                            profile_id,
                            device_id,
                            access_method: access_method || 'manual_override',
                            status: 'denied_capacity'
                        });

                        gymEmitter.emit('capacity.full', {
                            tenant_id,
                            profile_id,
                            current_occupancy: currentOccupancy,
                            max_limit: tenantCap.max_occupancy_limit
                        });

                        return res.status(403).json({
                            success: false,
                            status: 'denied_capacity',
                            reason: `Facility is at maximum capacity (${currentOccupancy}/${tenantCap.max_occupancy_limit}). Please wait for a member to leave.`,
                            occupancy: { current: currentOccupancy, max: tenantCap.max_occupancy_limit }
                        });
                    } else {
                        // Soft gate: allow with warning
                        if (finalStatus === 'approved') finalStatus = 'warning';
                        reasons.push(`Facility at capacity (${currentOccupancy}/${tenantCap.max_occupancy_limit})`);

                        gymEmitter.emit('capacity.warning', {
                            tenant_id,
                            profile_id,
                            current_occupancy: currentOccupancy,
                            max_limit: tenantCap.max_occupancy_limit
                        });
                    }
                }
            }
        }
        // ────────────────────────────────────────────────────────────────────

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

        // Hardware Trigger with Resilience Retry
        if (finalStatus === 'approved' || finalStatus === 'warning') {
            const triggerResult = await triggerShellyRelayWithRetry(device, 2, 3000);
            if (triggerResult.unsafe) {
                return res.status(400).json({ error: triggerResult.error });
            }
            triggerSuccess = triggerResult.success;
            if (!triggerSuccess) {
                console.error(`[unlock] Hardware relay trigger failed for device ${device.id}: ${triggerResult.error}`);
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

        // Try to find profile by dynamic TOTP QR code, paired hardware tokens (NFC/BLE), QR code, barcode, or legacy access token
        let profile = null;
        let accessMethod = 'unknown';

        // 1. Try TOTP dynamic QR token verification
        const totpRes = verifyTOTPToken(scan_data, null, tenant_id);
        if (totpRes && totpRes.valid) {
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', totpRes.profileId)
                .eq('tenant_id', tenant_id)
                .single();

            if (!profileError && profileData) {
                profile = profileData;
                accessMethod = 'totp_qr';
            }
        }

        // 2. Try paired access_tokens (NFC wristband, BLE key fob, RFID fob, etc.)
        if (!profile) {
            const { data: pairedToken } = await supabase
                .from('access_tokens')
                .select('*, profile:profile_id(*)')
                .eq('tenant_id', tenant_id)
                .eq('token_value', scan_data.trim())
                .eq('is_active', true)
                .maybeSingle();

            if (pairedToken && pairedToken.profile) {
                profile = pairedToken.profile;
                accessMethod = pairedToken.token_type || 'rfid_fob';
            }
        }

        // 3. Try legacy access token signature
        if (!profile) {
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

        // ── Anti-Passback Check ──────────────────────────────────────────────
        // Block if this profile already had a successful entry in the last 30 s
        if (accessStatus === 'approved' || accessStatus === 'warning') {
            const recentCheckin = await checkAntiPassback(profile.id, tenant_id);
            if (recentCheckin) {
                // Log the anti-passback violation
                await supabase.from('check_ins').insert({
                    tenant_id,
                    profile_id: profile.id,
                    device_id,
                    access_method: accessMethod,
                    scanner_type,
                    status: 'denied_anti_passback',
                    metadata: {
                        violation: 'anti_passback',
                        scan_data,
                        last_checkin_id: recentCheckin.id,
                        last_checkin_at: recentCheckin.created_at,
                        window_seconds: ANTI_PASSBACK_WINDOW_MS / 1000
                    }
                });

                // Emit front-desk alert
                gymEmitter.emit('checkin.antipassback', {
                    tenant_id,
                    profile_id: profile.id,
                    phone: profile.phone,
                    device_id,
                    last_checkin_at: recentCheckin.created_at
                });

                return res.status(429).json({
                    success: false,
                    access_status: 'denied_anti_passback',
                    profile: {
                        id: profile.id,
                        name: `${profile.first_name} ${profile.last_name}`
                    },
                    reason: `Anti-passback: entry already recorded ${Math.round((Date.now() - new Date(recentCheckin.created_at).getTime()) / 1000)}s ago. Please wait ${ANTI_PASSBACK_WINDOW_MS / 1000}s between scans.`
                });
            }
        }
        // ────────────────────────────────────────────────────────────────────

        // ── Capacity Gating ──────────────────────────────────────────────────
        if (accessStatus === 'approved' || accessStatus === 'warning') {
            const { data: tenantCap } = await supabase
                .from('tenants')
                .select('max_occupancy_limit, auto_checkout_minutes, capacity_policy')
                .eq('id', tenant_id)
                .single();

            if (tenantCap && tenantCap.max_occupancy_limit > 0) {
                const currentOccupancy = await getLiveOccupancy(tenant_id, tenantCap.auto_checkout_minutes || 120);
                if (currentOccupancy >= tenantCap.max_occupancy_limit) {
                    if (tenantCap.capacity_policy === 'hard') {
                        await supabase.from('check_ins').insert({
                            tenant_id,
                            profile_id: profile.id,
                            device_id,
                            access_method: accessMethod,
                            status: 'denied_capacity'
                        });

                        gymEmitter.emit('capacity.full', {
                            tenant_id,
                            profile_id: profile.id,
                            current_occupancy: currentOccupancy,
                            max_limit: tenantCap.max_occupancy_limit
                        });

                        return res.status(403).json({
                            success: false,
                            access_status: 'denied_capacity',
                            profile: { id: profile.id, name: `${profile.first_name} ${profile.last_name}` },
                            reason: `Facility is at maximum capacity (${currentOccupancy}/${tenantCap.max_occupancy_limit}).`,
                            occupancy: { current: currentOccupancy, max: tenantCap.max_occupancy_limit }
                        });
                    } else {
                        if (accessStatus === 'approved') accessStatus = 'warning';
                        reasons.push(`Facility at capacity (${currentOccupancy}/${tenantCap.max_occupancy_limit})`);
                        gymEmitter.emit('capacity.warning', {
                            tenant_id,
                            profile_id: profile.id,
                            current_occupancy: currentOccupancy,
                            max_limit: tenantCap.max_occupancy_limit
                        });
                    }
                }
            }
        }
        // ────────────────────────────────────────────────────────────────────

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
            const controller = new AbortController();
            const timeout = setTimeout(() => { controller.abort(); }, 3000);
            try {
                const statusUrl = `http://${device.ip_address}/status`;

                // SSRF Protection Check
                const safeUrlInfo = await getSafeIpAndHost(statusUrl);
                if (!safeUrlInfo.safe) {
                    console.error(`Blocked unsafe status check URL: ${statusUrl}`);
                    throw new Error('Unsafe device IP address');
                }

                const portStr = safeUrlInfo.port ? `:${safeUrlInfo.port}` : '';
                const safeFetchUrl = `${safeUrlInfo.protocol}//${safeUrlInfo.ip}${portStr}${safeUrlInfo.pathname}${safeUrlInfo.search}`;

                const response = await fetch(safeFetchUrl, {
                    headers: { 'Host': safeUrlInfo.hostname },
                    method: 'GET',
                    signal: controller.signal
                });
                clearTimeout(timeout);
                isOnline = response.ok;
                
                // Update device status in database
                await supabase
                    .from('hardware_devices')
                    .update({ is_online: isOnline, last_seen: new Date().toISOString() })
                    .eq('id', device_id);
            } catch (err) {
                clearTimeout(timeout);
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

/**
 * POST /checkout
 * Records a member checkout event, updating the check-in record with checkout_at
 * and checkout_method. Supports manual, kiosk, and scanner checkout.
 *
 * Body: { tenant_id, profile_id, checkout_method? }
 * Response: { success, checkout_at, occupancy }
 */
router.post('/checkout', async (req, res) => {
    try {
        const { tenant_id, profile_id, checkout_method } = req.body;

        if (!tenant_id || !profile_id) {
            return res.status(400).json({ error: 'Missing required parameters (tenant_id, profile_id)' });
        }

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        // Authenticate staff or scanner caller
        const authHeader = req.headers.authorization;
        const apiKeyHeader = req.headers['x-api-key'] || req.headers['x-scanner-token'];
        if (apiKeyHeader && process.env.INTERNAL_API_KEY && apiKeyHeader === process.env.INTERNAL_API_KEY) {
            // Authorized by internal system key
        } else if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
            if (authErr || !user) {
                return res.status(401).json({ error: 'Invalid or expired authorization token' });
            }
        }

        // Find the latest active (non-checked-out) check-in for this member
        const { data: activeCheckin, error: findError } = await supabase
            .from('check_ins')
            .select('id, created_at')
            .eq('tenant_id', tenant_id)
            .eq('profile_id', profile_id)
            .in('status', ['approved', 'warning'])
            .is('checkout_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (findError || !activeCheckin) {
            return res.status(404).json({
                success: false,
                error: 'No active check-in found for this member'
            });
        }

        const checkoutAt = new Date().toISOString();

        const { error: updateError } = await supabase
            .from('check_ins')
            .update({
                checkout_at: checkoutAt,
                checkout_method: checkout_method || 'manual'
            })
            .eq('id', activeCheckin.id);

        if (updateError) {
            console.error('[checkout] update error:', updateError);
            return res.status(500).json({ error: 'Failed to record checkout' });
        }

        // Fetch updated occupancy
        const { data: tenantCap } = await supabase
            .from('tenants')
            .select('max_occupancy_limit, auto_checkout_minutes')
            .eq('id', tenant_id)
            .single();

        const currentOccupancy = await getLiveOccupancy(
            tenant_id,
            tenantCap?.auto_checkout_minutes || 120
        );

        gymEmitter.emit('checkout.completed', {
            tenant_id,
            profile_id,
            checkin_id: activeCheckin.id,
            checkout_at: checkoutAt,
            current_occupancy: currentOccupancy
        });

        res.status(200).json({
            success: true,
            checkout_at: checkoutAt,
            checkin_id: activeCheckin.id,
            duration_minutes: Math.round((new Date(checkoutAt).getTime() - new Date(activeCheckin.created_at).getTime()) / 60000),
            occupancy: {
                current: currentOccupancy,
                max: tenantCap?.max_occupancy_limit || 150
            }
        });
    } catch (error) {
        console.error('[checkout] error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /occupancy
 * Returns real-time facility occupancy for a tenant.
 *
 * Query: ?tenant_id=<uuid>
 * Response: { current, max, percentage, policy, threshold_status }
 */
router.get('/occupancy', async (req, res) => {
    try {
        const { tenant_id } = req.query;

        if (!tenant_id) {
            return res.status(400).json({ error: 'Missing tenant_id' });
        }

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .select('max_occupancy_limit, auto_checkout_minutes, capacity_policy')
            .eq('id', tenant_id)
            .single();

        if (tenantError || !tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        const maxLimit = tenant.max_occupancy_limit || 150;
        const autoCheckoutMinutes = tenant.auto_checkout_minutes || 120;
        const currentOccupancy = await getLiveOccupancy(tenant_id, autoCheckoutMinutes);
        const percentage = maxLimit > 0 ? Math.round((currentOccupancy / maxLimit) * 100) : 0;

        let thresholdStatus = 'normal';
        if (percentage >= 100) thresholdStatus = 'full';
        else if (percentage >= 90) thresholdStatus = 'critical';
        else if (percentage >= 80) thresholdStatus = 'warning';

        res.status(200).json({
            success: true,
            occupancy: {
                current: currentOccupancy,
                max: maxLimit,
                percentage,
                policy: tenant.capacity_policy || 'warning',
                threshold_status: thresholdStatus,
                auto_checkout_minutes: autoCheckoutMinutes
            }
        });
    } catch (error) {
        console.error('[occupancy] error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Generate TOTP QR Token payload
router.get('/totp/generate', async (req, res) => {
    try {
        const { tenant_id, profile_id } = req.query;
        if (!tenant_id || !profile_id) {
            return res.status(400).json({ error: 'Missing tenant_id or profile_id' });
        }

        const { code, epoch, expires_in_seconds } = generateTOTP(profile_id, tenant_id);
        const qrPayload = `TOTP:${profile_id}:${code}`;

        res.status(200).json({
            success: true,
            qr_payload: qrPayload,
            totp_code: code,
            epoch,
            expires_in_seconds,
            period_seconds: TOTP_PERIOD
        });
    } catch (error) {
        console.error("TOTP generation error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Self-service Pair NFC Wristband or BLE Fob
router.post('/credentials/pair', async (req, res) => {
    try {
        const { tenant_id, profile_id, token_type, token_value, device_name } = req.body;

        if (!tenant_id || !profile_id || !token_type || !token_value) {
            return res.status(400).json({ error: 'Missing required parameters (tenant_id, profile_id, token_type, token_value)' });
        }

        const validTypes = ['nfc_wristband', 'ble_fob', 'rfid_fob', 'ble_mac', 'qr_static'];
        if (!validTypes.includes(token_type)) {
            return res.status(400).json({ error: `Invalid token_type. Must be one of: ${validTypes.join(', ')}` });
        }

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        // Check if token_value already registered under another account
        const { data: existing } = await supabase
            .from('access_tokens')
            .select('*')
            .eq('tenant_id', tenant_id)
            .eq('token_value', token_value.trim())
            .eq('is_active', true)
            .maybeSingle();

        if (existing && existing.profile_id !== profile_id) {
            return res.status(409).json({ error: 'This wristband/key fob is already paired to another member.' });
        }

        // Deactivate older active token of same type for this member if exists
        await supabase
            .from('access_tokens')
            .update({ is_active: false })
            .eq('tenant_id', tenant_id)
            .eq('profile_id', profile_id)
            .eq('token_type', token_type);

        // Insert new paired access token
        const { data: pairedToken, error: insertError } = await supabase
            .from('access_tokens')
            .insert({
                tenant_id,
                profile_id,
                token_type,
                token_value: token_value.trim(),
                is_active: true
            })
            .select()
            .single();

        if (insertError) {
            throw insertError;
        }

        res.status(200).json({
            success: true,
            message: `Successfully paired ${token_type.replace('_', ' ')}`,
            credential: pairedToken
        });
    } catch (error) {
        console.error("Credential pairing error:", error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// List paired credentials for profile
router.get('/credentials/list/:profile_id', async (req, res) => {
    try {
        const { profile_id } = req.params;
        const { tenant_id } = req.query;

        if (!profile_id || !tenant_id) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        const { data: credentials, error } = await supabase
            .from('access_tokens')
            .select('*')
            .eq('tenant_id', tenant_id)
            .eq('profile_id', profile_id)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.status(200).json({
            success: true,
            credentials: credentials || []
        });
    } catch (error) {
        console.error("List credentials error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Revoke credential
router.post('/credentials/revoke', async (req, res) => {
    try {
        const { tenant_id, credential_id } = req.body;
        if (!tenant_id || !credential_id) {
            return res.status(400).json({ error: 'Missing tenant_id or credential_id' });
        }

        const { error } = await supabase
            .from('access_tokens')
            .update({ is_active: false })
            .eq('tenant_id', tenant_id)
            .eq('id', credential_id);

        if (error) throw error;

        res.status(200).json({ success: true, message: 'Credential revoked successfully' });
    } catch (error) {
        console.error("Revoke credential error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
