const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

const corsOptions = {
  origin: process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000'),
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn("Supabase credentials not found, endpoints using supabase will fail.");
}

const gymEmitter = require("./events");
const upload = multer({ storage: multer.memoryStorage() });

// ─── Live Occupancy Helper (shared logic with iot.js) ────────────────────────
async function getLiveOccupancy(supabaseClient, tenant_id, autoCheckoutMinutes = 120) {
  const windowStart = new Date(Date.now() - autoCheckoutMinutes * 60 * 1000).toISOString();
  const { count, error } = await supabaseClient
    .from('check_ins')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant_id)
    .in('status', ['approved', 'warning'])
    .is('checkout_at', null)
    .gte('created_at', windowStart);
  if (error) {
    console.error('[getLiveOccupancy] error:', error);
    return 0;
  }
  return count || 0;
}
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/waivers/sign', upload.single('pdf'), async (req, res) => {
  try {
    const { tenant_id, profile_id } = req.body;

    if (!tenant_id || !profile_id || !req.file) {
      return res.status(400).json({ error: 'Missing tenant_id, profile_id, or pdf file' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${tenant_id}/${profile_id}/waiver_${timestamp}.pdf`;

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('waivers')
      .upload(fileName, req.file.buffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return res.status(500).json({ error: uploadError.message });
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .update({
        waiver_signed: true,
        waiver_signed_at: new Date().toISOString()
      })
      .eq('id', profile_id)
      .eq('tenant_id', tenant_id)
      .select();

    if (profileError) {
      console.error("Profile update error:", profileError);
      return res.status(500).json({ error: profileError.message });
    }

    res.status(200).json({ success: true, file: uploadData.path, profile: profileData });

  } catch (error) {
    console.error("Endpoint error:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/checkin', async (req, res) => {
  try {
    const { tenant_id, profile_id, device_id, access_method, user_lat, user_lon } = req.body;

    if (!tenant_id || !profile_id) {
       return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (!supabase) {
       return res.status(500).json({ error: 'Supabase not configured' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
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

    // Authorize check-in: Must be the profile owner themselves, OR a staff member.
    // This allows staff to trigger check-ins on behalf of a member (e.g. from the POS kiosk).
    const { data: staffCheck } = await supabase.from('profiles').select('role').eq('id', user.id).eq('tenant_id', tenant_id).single();
    if (user.id !== profile_id && (!staffCheck || (staffCheck.role !== 'staff' && staffCheck.role !== 'admin' && staffCheck.role !== 'trainer'))) {
        return res.status(403).json({ error: 'Unauthorized to check in for this profile' });
    }

    // Fetch tenant details for geofencing
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('latitude, longitude, geofence_radius_meters')
      .eq('id', tenant_id)
      .single();


    // Helper function for Haversine distance
    const getDistanceFromLatLonInM = (lat1, lon1, lat2, lon2) => {
        const R = 6371e3; // Radius of the earth in m
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; // Distance in m
        return d;
    };

    let finalStatus = 'approved';
    let reasons = [];

    if (access_method === 'qr_code') {
        if (tenantError || !tenant) {
            finalStatus = 'denied_geofence';
            reasons.push('Gym location not configured');
        } else {
            const tenantLat = parseFloat(tenant.latitude);
            const tenantLon = parseFloat(tenant.longitude);
            const uLat = parseFloat(user_lat);
            const uLon = parseFloat(user_lon);

            if (!Number.isFinite(tenantLat) || !Number.isFinite(tenantLon)) {
                finalStatus = 'denied_geofence';
                reasons.push('Gym location is improperly configured');
            } else if (user_lat === undefined || user_lon === undefined || user_lat === null || user_lon === null || !Number.isFinite(uLat) || !Number.isFinite(uLon)) {
                finalStatus = 'denied_geofence';
                reasons.push('Valid location coordinates required for QR code check-in');
            } else {
                const distance = getDistanceFromLatLonInM(uLat, uLon, tenantLat, tenantLon);
                const radius = Number.isFinite(tenant.geofence_radius_meters) ? tenant.geofence_radius_meters : 100;

                if (Number.isNaN(distance) || distance > radius) {
                    finalStatus = 'denied_geofence';
                    reasons.push('Not physically present at the gym');
                }
            }
        }
    }

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

    // ── Capacity Gating ──────────────────────────────────────────────────────
    if (finalStatus === 'approved' || finalStatus === 'warning') {
        const { data: tenantCap } = await supabase
            .from('tenants')
            .select('max_occupancy_limit, auto_checkout_minutes, capacity_policy')
            .eq('id', tenant_id)
            .single();

        if (tenantCap && tenantCap.max_occupancy_limit > 0) {
            const currentOccupancy = await getLiveOccupancy(supabase, tenant_id, tenantCap.auto_checkout_minutes || 120);
            if (currentOccupancy >= tenantCap.max_occupancy_limit) {
                if (tenantCap.capacity_policy === 'hard') {
                    await supabase.from('check_ins').insert({
                        tenant_id,
                        profile_id,
                        device_id: device_id || null,
                        access_method: access_method || 'manual_override',
                        status: 'denied_capacity'
                    });
                    gymEmitter.emit('capacity.full', { tenant_id, profile_id, current_occupancy: currentOccupancy, max_limit: tenantCap.max_occupancy_limit });
                    return res.status(403).json({
                        success: false,
                        status: 'denied_capacity',
                        reason: `Facility is at maximum capacity (${currentOccupancy}/${tenantCap.max_occupancy_limit}).`,
                        occupancy: { current: currentOccupancy, max: tenantCap.max_occupancy_limit }
                    });
                } else {
                    if (finalStatus === 'approved') finalStatus = 'warning';
                    reasons.push(`Facility at capacity (${currentOccupancy}/${tenantCap.max_occupancy_limit})`);
                    gymEmitter.emit('capacity.warning', { tenant_id, profile_id, current_occupancy: currentOccupancy, max_limit: tenantCap.max_occupancy_limit });
                }
            }
        }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const { data: checkin, error: checkinError } = await supabase.from('check_ins').insert({
        tenant_id,
        profile_id,
        device_id: device_id || null,
        access_method: access_method || 'manual_override',
        status: finalStatus
    }).select();

    if (checkinError) {
        return res.status(500).json({ error: checkinError.message });
    }

    if (finalStatus.startsWith('denied')) {
        gymEmitter.emit('checkin.denied', {
            tenant_id,
            profile_id,
            phone: profile.phone,
            reason: reasons.length > 0 ? reasons.join('; ') : 'Denied'
        });
    }

    res.status(200).json({
        success: true,
        status: finalStatus,
        checkin: checkin[0],
        reason: reasons.length > 0 ? reasons.join('; ') : undefined
    });

  } catch (error) {

     console.error("Checkin error:", error);
     res.status(500).json({ error: 'Internal server error' });
  }
});

const posRoutes = require("./pos");
app.use("/api/pos", posRoutes);

const staffRoutes = require("./staff");
app.use("/api/staff", staffRoutes);

const membershipHoldsRoutes = require("./membership_holds");
app.use("/api/membership-holds", membershipHoldsRoutes);

const calendarRoutes = require("./calendar");

const initCron = require("./cron");

const adminRoutes = require("./admin");
app.use("/api/admin", adminRoutes);
const paymentsRoutes = require("./payments");
app.use("/api/payments", paymentsRoutes);
app.use("/api/calendar", calendarRoutes);
const iotRoutes = require("./iot");
app.use("/api/iot", iotRoutes);

const memberCrmRoutes = require("./member-crm");
app.use("/api/members", memberCrmRoutes);

const publicRoutes = require("./public");
app.use("/api/public", publicRoutes);
app.use("/widgets", publicRoutes);

const syncRoutes = require("./sync");
app.use("/api/sync", syncRoutes);

const contractsRoutes = require("./contracts");
app.use("/api/contracts", contractsRoutes);

const corporateRoutes = require("./corporate");
app.use("/api/corporate", corporateRoutes);

const tierRoutes = require("./tier_proration");
app.use("/api/tiers", tierRoutes);

const staffTasksRoutes = require("./staff_tasks");
app.use("/api/tasks", staffTasksRoutes);

const communicationsRoutes = require("./communications");
app.use("/api/communications", communicationsRoutes);

const { router: dripRoutes } = require("./drip_engine");
app.use("/api/workflows", dripRoutes);


initCron(supabase);


app.post("/api/kiosk/verify-pin", async (req, res) => {
  try {
    const { tenant_id, pin } = req.body;
    if (!tenant_id || !pin) {
      return res.status(400).json({ error: "Missing tenant_id or pin" });
    }
    if (!supabase) {
      return res.status(500).json({ error: "Supabase not configured" });
    }

    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("kiosk_admin_pin")
      .eq("id", tenant_id)
      .single();

    if (error || !tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const validPin = tenant.kiosk_admin_pin || "1234";
    if (String(pin).trim() === String(validPin).trim()) {
      return res.status(200).json({ success: true, verified: true });
    } else {
      return res.status(401).json({ success: false, error: "Incorrect Admin PIN" });
    }
  } catch (err) {
    console.error("Kiosk verify pin error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/kiosk/checkin", async (req, res) => {
  try {
    const { tenant_id, identifier, access_method } = req.body;
    if (!tenant_id || !identifier) {
      return res.status(400).json({ error: "Missing tenant_id or search identifier" });
    }
    if (!supabase) {
      return res.status(500).json({ error: "Supabase not configured" });
    }

    const term = String(identifier).trim();
    let profile = null;

    const { data: tokenData } = await supabase
      .from("access_tokens")
      .select("profile_id")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true)
      .or("token_value.eq." + term + ",pin_code.eq." + term)
      .limit(1);

    if (tokenData && tokenData.length > 0) {
      const { data: pData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", tokenData[0].profile_id)
        .eq("tenant_id", tenant_id)
        .single();
      if (pData) profile = pData;
    }

    if (!profile) {
      const cleanDigits = term.replace(/[^\d]/g, '');
      const searchPattern = cleanDigits.length >= 6 ? cleanDigits.slice(-7) : cleanDigits;
      
      const { data: phoneProfiles } = await supabase
        .from("profiles")
        .select("*")
        .eq("tenant_id", tenant_id)
        .or(`phone.eq.${term},phone.ilike.%${searchPattern}%`)
        .limit(1);

      if (phoneProfiles && phoneProfiles.length > 0) {
        profile = phoneProfiles[0];
      }
    }

    if (!profile) {
      return res.status(404).json({
        success: false,
        status: "denied_not_found",
        error: "Member profile or PIN code not found"
      });
    }

    let finalStatus = "approved";
    let reasons = [];

    if (profile.status === "debtor" || profile.membership_status === "canceled" || profile.membership_status === "expired") {
      finalStatus = "denied";
      reasons.push("Account status: " + (profile.membership_status || profile.status || "Inactive"));
    }

    const { data: tab } = await supabase
      .from("member_tabs")
      .select("balance")
      .eq("profile_id", profile.id)
      .eq("tenant_id", tenant_id)
      .single();

    if (tab && parseFloat(tab.balance) > 0) {
      if (finalStatus === "approved") finalStatus = "warning";
      reasons.push("Outstanding tab balance: " + parseFloat(tab.balance).toFixed(2) + " RWF");
    }

    if (!profile.waiver_signed) {
      if (finalStatus === "approved") finalStatus = "warning";
      reasons.push("Liability Waiver Unsigned");
    }

    const { data: activeHold } = await supabase
      .from("membership_holds")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("tenant_id", tenant_id)
      .eq("status", "active")
      .single();

    if (activeHold) {
      if (finalStatus === "approved") finalStatus = "warning";
      reasons.push("Membership on hold until " + (activeHold.end_date || "indefinitely"));
    }

    // ── Capacity Gating ──────────────────────────────────────────────────────
    if (finalStatus === "approved" || finalStatus === "warning") {
        const { data: tenantCapK } = await supabase
            .from("tenants")
            .select("max_occupancy_limit, auto_checkout_minutes, capacity_policy")
            .eq("id", tenant_id)
            .single();

        if (tenantCapK && tenantCapK.max_occupancy_limit > 0) {
            const currentOccupancy = await getLiveOccupancy(supabase, tenant_id, tenantCapK.auto_checkout_minutes || 120);
            if (currentOccupancy >= tenantCapK.max_occupancy_limit) {
                if (tenantCapK.capacity_policy === "hard") {
                    await supabase.from("check_ins").insert({
                        tenant_id,
                        profile_id: profile.id,
                        access_method: access_method || "kiosk_pin",
                        status: "denied_capacity"
                    });
                    gymEmitter.emit("capacity.full", { tenant_id, profile_id: profile.id, current_occupancy: currentOccupancy, max_limit: tenantCapK.max_occupancy_limit });
                    return res.status(403).json({
                        success: false,
                        status: "denied_capacity",
                        reason: `Facility is at maximum capacity (${currentOccupancy}/${tenantCapK.max_occupancy_limit}).`,
                        occupancy: { current: currentOccupancy, max: tenantCapK.max_occupancy_limit }
                    });
                } else {
                    if (finalStatus === "approved") finalStatus = "warning";
                    reasons.push(`Facility at capacity (${currentOccupancy}/${tenantCapK.max_occupancy_limit})`);
                    gymEmitter.emit("capacity.warning", { tenant_id, profile_id: profile.id, current_occupancy: currentOccupancy, max_limit: tenantCapK.max_occupancy_limit });
                }
            }
        }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const { data: checkin, error: checkinError } = await supabase
      .from("check_ins")
      .insert({
        tenant_id,
        profile_id: profile.id,
        access_method: access_method || "kiosk_pin",
        status: finalStatus
      })
      .select();

    if (checkinError) {
      return res.status(500).json({ error: checkinError.message });
    }

    if (finalStatus.startsWith("denied")) {
      gymEmitter.emit("checkin.denied", {
        tenant_id,
        profile_id: profile.id,
        phone: profile.phone,
        reason: reasons.length > 0 ? reasons.join("; ") : "Denied"
      });
    } else {
      gymEmitter.emit("checkin.approved", {
        tenant_id,
        profile_id: profile.id,
        member_name: profile.first_name + " " + profile.last_name
      });
    }

    res.status(200).json({
      success: true,
      status: finalStatus,
      profile: {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        avatar_url: profile.avatar_url,
        membership_status: profile.membership_status || profile.status || "active",
        phone: profile.phone
      },
      checkin: checkin ? checkin[0] : null,
      reasons
    });
  } catch (err) {
    console.error("Kiosk checkin error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(port, () => {

  console.log(`Backend server running on port ${port}`);
});
