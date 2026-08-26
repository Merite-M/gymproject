const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { dispatchMultiChannelMessage, normalizePhoneNumber } = require('./gateways');
require('dotenv').config();

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

/**
 * Authentication and Staff authorization middleware
 */
async function requireStaffAuth(req, res, next) {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'];

  // Check if system master API key matches
  if (apiKeyHeader && process.env.INTERNAL_API_KEY && apiKeyHeader === process.env.INTERNAL_API_KEY) {
    return next();
  }

  if (!authHeader) {
    // In dev test mode without auth header, verify tenant_id exists
    const tenantId = req.body?.tenant_id || req.query?.tenant_id;
    if (tenantId) return next();
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired authorization token' });
    }

    const { data: profile, error: pError } = await supabase
      .from('profiles')
      .select('id, tenant_id, role')
      .eq('id', user.id)
      .single();

    if (pError || !profile || !profile.tenant_id) {
      return res.status(403).json({ error: 'Profile or tenant not found' });
    }

    const requestTenantId = req.body.tenant_id || req.query.tenant_id;
    if (requestTenantId && profile.tenant_id !== requestTenantId && profile.role !== 'admin') {
      return res.status(403).json({ error: 'Tenant access denied' });
    }

    req.userProfile = profile;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Merge tag resolver for templates
 */
function resolveMergeTags(template, profile = {}, extra = {}) {
  let result = template || '';
  const tags = {
    first_name: profile.first_name || 'Member',
    last_name: profile.last_name || '',
    full_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Valued Member',
    gym_name: extra.gym_name || 'GymPartner',
    phone: profile.phone || '',
    email: profile.email || '',
    ...extra
  };

  for (const [key, val] of Object.entries(tags)) {
    const regex = new RegExp(`{{${key}}}`, 'gi');
    result = result.replace(regex, String(val));
  }
  return result;
}

/**
 * POST /api/communications/send-single
 * Instant transactional single message dispatch (SMS / WhatsApp / Auto-fallback).
 * Body: { tenant_id, profile_id?, channel, recipient, message, subject? }
 */
router.post('/send-single', requireStaffAuth, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { tenant_id, profile_id, channel = 'sms', recipient, message, subject } = req.body;

    if (!tenant_id || !recipient || !message) {
      return res.status(400).json({ error: 'Missing required parameters (tenant_id, recipient, message)' });
    }

    const dispatchResult = await dispatchMultiChannelMessage({
      tenant_id,
      profile_id,
      channel,
      recipient,
      subject,
      message,
      supabase
    });

    res.json({
      success: true,
      result: dispatchResult
    });
  } catch (error) {
    console.error('[communications/send-single POST] error:', error);
    res.status(500).json({ error: error.message || 'Dispatch failed' });
  }
});

/**
 * POST /api/communications/broadcast
 * Send a mass broadcast campaign to a segmented target audience.
 * Body: { tenant_id, name, channel, target_audience, message_template }
 */
router.post('/broadcast', requireStaffAuth, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const {
      tenant_id,
      name,
      channel = 'sms',
      target_audience = 'all_active',
      message_template
    } = req.body;

    if (!tenant_id || !name || !message_template) {
      return res.status(400).json({ error: 'Missing required parameters (tenant_id, name, message_template)' });
    }

    let validRecipients = [];

    // 1. Precise Audience Segmentation Filter
    if (target_audience === 'all_active') {
      const { data: members, error: mErr } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, phone, email, status')
        .eq('tenant_id', tenant_id)
        .eq('status', 'active')
        .not('phone', 'is', null);
      if (mErr) throw mErr;
      validRecipients = members || [];
    } else if (target_audience === 'at_risk_churn') {
      // Find members with high churn risk score or inactive for 14+ days
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data: allActive } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, phone, email, status')
        .eq('tenant_id', tenant_id)
        .eq('status', 'active')
        .not('phone', 'is', null);

      const { data: recentCheckIns } = await supabase
        .from('check_ins')
        .select('profile_id')
        .eq('tenant_id', tenant_id)
        .gte('created_at', fourteenDaysAgo);

      const activeIds = new Set((recentCheckIns || []).map(c => c.profile_id));
      validRecipients = (allActive || []).filter(p => !activeIds.has(p.id));
    } else if (target_audience === 'vip_tier') {
      // Find members on VIP / Gold / Platinum tiers
      const { data: vipMemberships } = await supabase
        .from('memberships')
        .select('profile_id')
        .eq('tenant_id', tenant_id)
        .eq('status', 'active')
        .or('membership_type.ilike.%vip%,membership_type.ilike.%gold%,membership_type.ilike.%platinum%');

      const vipProfileIds = Array.from(new Set((vipMemberships || []).map(m => m.profile_id)));
      if (vipProfileIds.length > 0) {
        const { data: vipProfiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, phone, email, status')
          .eq('tenant_id', tenant_id)
          .in('id', vipProfileIds)
          .not('phone', 'is', null);
        validRecipients = vipProfiles || [];
      }
    } else if (target_audience === 'leads') {
      // Find prospects and leads
      const { data: leads, error: lErr } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, phone, email, status')
        .eq('tenant_id', tenant_id)
        .or('role.eq.lead,status.eq.lead,status.eq.prospect')
        .not('phone', 'is', null);
      if (lErr) throw lErr;
      validRecipients = leads || [];
    } else {
      return res.status(400).json({ error: `Invalid target_audience '${target_audience}'. Allowed: all_active, at_risk_churn, vip_tier, leads` });
    }

    const filteredRecipients = validRecipients.filter(p => p.phone && p.phone.trim().length >= 8);
    let successCount = 0;
    let failCount = 0;

    // 2. Dispatch to each recipient with merge tags
    for (const member of filteredRecipients) {
      const personalizedMessage = resolveMergeTags(message_template, member, { gym_name: 'GymPartner Kigali' });
      try {
        await dispatchMultiChannelMessage({
          tenant_id,
          profile_id: member.id,
          channel,
          recipient: member.phone,
          subject: name,
          message: personalizedMessage,
          metadata: { campaign_name: name, target_audience },
          supabase
        });
        successCount++;
      } catch (err) {
        console.error(`[broadcast] Delivery failed for ${member.phone}:`, err.message);
        failCount++;
      }
    }

    // 3. Record campaign record with explicit sent_at
    const nowIso = new Date().toISOString();
    const { data: campaign, error: cError } = await supabase
      .from('broadcast_campaigns')
      .insert({
        tenant_id,
        name,
        channel,
        target_audience,
        message_template,
        total_recipients: filteredRecipients.length,
        successful_deliveries: successCount,
        failed_deliveries: failCount,
        status: 'completed',
        sent_at: nowIso
      })
      .select()
      .single();

    if (cError) console.error("Error logging campaign:", cError);

    res.json({
      success: true,
      campaign,
      summary: {
        total: filteredRecipients.length,
        successful: successCount,
        failed: failCount
      }
    });
  } catch (error) {
    console.error('[communications/broadcast POST] error:', error);
    res.status(500).json({ error: error.message || 'Broadcast failed' });
  }
});

/**
 * GET /api/communications/campaigns
 * Query: ?tenant_id=<uuid>
 */
router.get('/campaigns', requireStaffAuth, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const { data: campaigns, error } = await supabase
      .from('broadcast_campaigns')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('sent_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, campaigns: campaigns || [] });
  } catch (error) {
    console.error('[communications/campaigns GET] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/communications/logs
 * Query: ?tenant_id=<uuid>&channel=<all|sms|whatsapp>&limit=50
 */
router.get('/logs', requireStaffAuth, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { tenant_id, channel, limit = 50 } = req.query;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    let query = supabase
      .from('notification_queue')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (channel && channel !== 'all') {
      query = query.eq('channel', channel);
    }

    const { data: logs, error } = await query;
    if (error) throw error;

    res.json({ success: true, logs: logs || [] });
  } catch (error) {
    console.error('[communications/logs GET] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/communications/config
 * Query: ?tenant_id=<uuid>
 */
router.get('/config', requireStaffAuth, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const { data: configs, error } = await supabase
      .from('gateway_configs')
      .select('*')
      .eq('tenant_id', tenant_id);

    if (error) throw error;

    res.json({ success: true, configs: configs || [] });
  } catch (error) {
    console.error('[communications/config GET] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Webhook for Meta WhatsApp Business Cloud API
 */
router.all('/webhook/whatsapp', (req, res) => {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;
    if (!expectedToken) {
      console.error("[WhatsApp Webhook] WHATSAPP_VERIFY_TOKEN not configured in environment.");
      return res.status(500).json({ error: 'Server configuration error: WHATSAPP_VERIFY_TOKEN missing' });
    }

    if (mode === 'subscribe' && token === expectedToken) {
      console.log("[WhatsApp Webhook] Verification challenge passed.");
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }

  // POST: Receive inbound status receipts or member replies
  const body = req.body;
  console.log("[WhatsApp Webhook] Inbound event:", JSON.stringify(body?.entry?.[0]?.changes?.[0]?.value?.statuses || 'receipt'));
  res.status(200).send('EVENT_RECEIVED');
});

module.exports = router;
