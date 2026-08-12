const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn("Supabase credentials not found, endpoints using supabase will fail.");
}

const upload = multer({ storage: multer.memoryStorage() });

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
    const { tenant_id, profile_id, device_id, access_method } = req.body;

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

    if (!profile.waiver_signed) {
        // Record denied checkin
        await supabase.from('check_ins').insert({
            tenant_id,
            profile_id,
            device_id: device_id || null,
            access_method: access_method || 'manual_override',
            status: 'warning' // Or a specific denied status, let's use warning as per spec 'Liability Waiver Unsigned'
        });
        return res.status(200).json({ success: true, status: 'warning', reason: 'Liability Waiver Unsigned' });
    }

    // Check membership status logic can go here (simplified for now)

    // Check if waiver is older than 1 year
    const waiverDate = new Date(profile.waiver_signed_at);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    if (waiverDate < oneYearAgo) {
        await supabase.from('check_ins').insert({
            tenant_id,
            profile_id,
            device_id: device_id || null,
            access_method: access_method || 'manual_override',
            status: 'warning'
        });
        return res.status(200).json({ success: true, status: 'warning', reason: 'Liability Waiver Expired (Needs Renewal)' });
    }

    const { data: checkin, error: checkinError } = await supabase.from('check_ins').insert({
        tenant_id,
        profile_id,
        device_id: device_id || null,
        access_method: access_method || 'manual_override',
        status: 'approved'
    }).select();

    if (checkinError) {
        return res.status(500).json({ error: checkinError.message });
    }

    res.status(200).json({ success: true, status: 'approved', checkin: checkin[0] });

  } catch (error) {
     console.error("Checkin error:", error);
     res.status(500).json({ error: 'Internal server error' });
  }
});

const posRoutes = require("./pos");
app.use("/api/pos", posRoutes);

const staffRoutes = require("./staff");
app.use("/api/staff", staffRoutes);

const marketingRoutes = require("./marketing");
app.use("/api/analytics", marketingRoutes);

app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});
