const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { dispatchMultiChannelMessage, normalizePhoneNumber } = require('./gateways');
const authMiddleware = require('./authMiddleware');
require('dotenv').config();

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

/**
 * Enhanced authentication middleware that supports internal API key bypass
 * for system-to-system communication (webhooks, cron jobs, etc.)
 */
async function requireStaffAuth(req, res, next) {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

  const apiKeyHeader = req.headers['x-api-key'];

  // Check if system master API key matches for internal system calls
  if (apiKeyHeader && process.env.INTERNAL_API_KEY && apiKeyHeader === process.env.INTERNAL_API_KEY) {
    // For internal API calls, we need to extract tenant_id from body/query
    const tenantId = req.body?.tenant_id || req.query?.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant_id for internal API call' });
    }
    req.internalApiCall = true;
    req.tenantId = tenantId;
    return next();
  }

  // Use standard auth middleware for regular user requests
  return authMiddleware(req, res, next);
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
    gym_name: extra.gym_name || 'PolyFit',
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
    // For internal API calls, use the tenant_id from the middleware
    const tenant_id = req.internalApiCall ? req.tenantId : req.body.tenant_id;
    const { profile_id, channel = 'sms', recipient, message, subject } = req.body;

    if (!tenant_id || !recipient || !message) {
      return res.status(400).json({ error: 'Missing required parameters (tenant_id, recipient, message)' });
    }

    // For user calls, verify tenant access
    if (!req.internalApiCall && req.user) {
      const { data: profile } = await supabase.from('profiles').select('tenant_id, role').eq('id', req.user.id).single();
      if (!profile || (profile.tenant_id !== tenant_id && profile.role !== 'admin')) {
        return res.status(403).json({ error: 'Tenant access denied' });
      }
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
      const personalizedMessage = resolveMergeTags(message_template, member, { gym_name: 'PolyFit Kigali' });
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
 * Query: ?tenant_id=<uuid>&channel=<all|sms|whatsapp|email|in_app>&status=<all|sent|delivered|failed|pending>&profile_id=<uuid>&search=<text>&limit=100
 */
router.get('/logs', requireStaffAuth, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { tenant_id, channel, status, profile_id, search, limit = 100 } = req.query;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    let query = supabase
      .from('communications_log')
      .select('*, profile:profiles(id, first_name, last_name, phone, email, avatar_url)')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (channel && channel !== 'all') {
      query = query.eq('channel', channel);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (profile_id) {
      query = query.eq('profile_id', profile_id);
    }
    if (search) {
      query = query.ilike('content', '%'+search+'%');
    }

    const { data: commLogs, error } = await query;

    if (error || !commLogs || commLogs.length === 0) {
      // Fallback to notification_queue if communications_log returns empty or query fails
      let nqQuery = supabase
        .from('notification_queue')
        .select('*, profile:profiles(id, first_name, last_name, phone, email, avatar_url)')
        .eq('tenant_id', tenant_id)
        .order('created_at', { ascending: false })
        .limit(Number(limit));

      if (channel && channel !== 'all') nqQuery = nqQuery.eq('channel', channel);
      if (status && status !== 'all') nqQuery = nqQuery.eq('status', status);
      if (profile_id) nqQuery = nqQuery.eq('profile_id', profile_id);

      const { data: nqLogs } = await nqQuery;

      const normalizedNq = (nqLogs || []).map(l => ({
        id: l.id,
        tenant_id: l.tenant_id,
        profile_id: l.profile_id,
        channel: l.channel,
        direction: 'outbound',
        status: l.status === 'sent' ? 'delivered' : l.status,
        content: l.content,
        created_at: l.created_at,
        external_message_id: l.metadata?.message_id || null,
        error_message: l.error_message || l.metadata?.error || null,
        retry_count: l.attempts || 0,
        metadata: {
          recipient: l.recipient,
          provider: l.metadata?.provider || 'sms_gateway',
          cost: l.metadata?.cost || null,
          subject: l.subject || null,
          simulated: l.metadata?.simulated || false
        },
        profile: l.profile
      }));

      return res.json({ success: true, logs: normalizedNq });
    }

    res.json({ success: true, logs: commLogs || [] });
  } catch (error) {
    console.error('[communications/logs GET] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/communications/resend/:id
 * Manual trigger to resend a failed message from communications_log or notification_queue.
 */
router.post('/resend/:id', requireStaffAuth, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { id } = req.params;
    const { tenant_id } = req.body;

    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    // 1. Fetch record from communications_log
    let { data: commRecord } = await supabase
      .from('communications_log')
      .select('*, profile:profiles(id, phone, first_name, last_name)')
      .eq('id', id)
      .single();

    let recipient = commRecord?.metadata?.recipient || commRecord?.profile?.phone;
    let channel = commRecord?.channel || 'sms';
    let message = commRecord?.content;
    let profileId = commRecord?.profile_id;

    // 2. If not found in communications_log, fallback to notification_queue
    if (!commRecord) {
      const { data: nqRecord } = await supabase
        .from('notification_queue')
        .select('*, profile:profiles(id, phone)')
        .eq('id', id)
        .single();

      if (!nqRecord) {
        return res.status(404).json({ error: 'Communication record not found' });
      }

      recipient = nqRecord.recipient || nqRecord.profile?.phone;
      channel = nqRecord.channel || 'sms';
      message = nqRecord.content;
      profileId = nqRecord.profile_id;
    }

    if (!recipient || !message) {
      return res.status(400).json({ error: 'Record missing recipient phone or message body' });
    }

    // 3. Dispatch resend
    const dispatchResult = await dispatchMultiChannelMessage({
      tenant_id,
      profile_id: profileId,
      channel: channel === 'auto_fallback' ? 'sms' : channel,
      recipient,
      subject: 'Resent Notification',
      message,
      metadata: { resend_of: id, triggered_by_staff: true },
      supabase
    });

    // 4. Update status in communications_log if present
    if (commRecord) {
      await supabase
        .from('communications_log')
        .update({
          status: dispatchResult?.status || 'delivered',
          retry_count: (commRecord.retry_count || 0) + 1,
          updated_at: new Date().toISOString(),
          error_message: null
        })
        .eq('id', id);
    }

    res.json({
      success: true,
      result: dispatchResult
    });
  } catch (error) {
    console.error('[communications/resend POST] error:', error);
    res.status(500).json({ error: error.message || 'Resend failed' });
  }
});

/**
 * POST /api/communications/webhook/sms
 * Provider delivery status webhook (Africa's Talking / Twilio / Generic SMS gateways)
 */
router.post('/webhook/sms', async (req, res) => {
  if (!supabase) return res.status(200).send('OK');
  try {
    const { id, status, phoneNumber, messageId, failureReason } = req.body;
    console.log('[SMS Provider Webhook] Received update:', req.body);

    const targetMsgId = id || messageId || req.body.id;
    const rawStatus = String(status || req.body.status || '').toLowerCase();

    let mappedStatus = 'sent';
    if (['success', 'delivered', 'sent'].includes(rawStatus)) mappedStatus = 'delivered';
    else if (['failed', 'rejected', 'undelivered'].includes(rawStatus)) mappedStatus = 'failed';

    if (targetMsgId) {
      // Update communications_log
      await supabase
        .from('communications_log')
        .update({
          status: mappedStatus,
          error_message: failureReason || null,
          updated_at: new Date().toISOString()
        })
        .eq('external_message_id', targetMsgId);

      // Also update notification_queue metadata if applicable
      const { data: nq } = await supabase
        .from('notification_queue')
        .select('id, metadata')
        .contains('metadata', { message_id: targetMsgId })
        .limit(1);

      if (nq && nq.length > 0) {
        await supabase
          .from('notification_queue')
          .update({
            status: mappedStatus === 'delivered' ? 'sent' : mappedStatus,
            error_message: failureReason || null
          })
          .eq('id', nq[0].id);
      }
    }

    res.status(200).json({ status: 'ACKNOWLEDGED' });
  } catch (error) {
    console.error('[SMS Webhook] error:', error);
    res.status(200).json({ status: 'ACKNOWLEDGED' });
  }
});

/**
 * GET /api/communications/in-app
 * Query: ?tenant_id=<uuid>&profile_id=<uuid>&unread_only=true
 * Returns in-app notifications for the member PWA feed
 */
router.get('/in-app', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { tenant_id, profile_id, unread_only } = req.query;
    if (!tenant_id || !profile_id) {
      return res.status(400).json({ error: 'Missing tenant_id or profile_id' });
    }

    let query = supabase
      .from('communications_log')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('profile_id', profile_id)
      .eq('channel', 'in_app')
      .order('created_at', { ascending: false })
      .limit(50);

    if (unread_only === 'true') {
      query = query.neq('status', 'read');
    }

    let { data: items, error } = await query;

    // Fallback to notification_queue in_app items if empty
    if (!items || items.length === 0) {
      const { data: nqItems } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('profile_id', profile_id)
        .eq('channel', 'in_app')
        .order('created_at', { ascending: false })
        .limit(50);

      items = (nqItems || []).map(n => ({
        id: n.id,
        tenant_id: n.tenant_id,
        profile_id: n.profile_id,
        channel: 'in_app',
        direction: 'outbound',
        status: n.status === 'sent' ? 'delivered' : n.status,
        content: n.content,
        created_at: n.created_at,
        metadata: { subject: n.subject, ...n.metadata }
      }));
    }

    const unreadCount = items.filter(i => i.status !== 'read').length;

    res.json({
      success: true,
      notifications: items,
      unread_count: unreadCount
    });
  } catch (error) {
    console.error('[communications/in-app GET] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/communications/in-app/read
 * Mark in-app notifications as read for a member
 */
router.patch('/in-app/read', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { tenant_id, profile_id, notification_ids } = req.body;
    if (!tenant_id || !profile_id) {
      return res.status(400).json({ error: 'Missing tenant_id or profile_id' });
    }

    let query = supabase
      .from('communications_log')
      .update({ status: 'read', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenant_id)
      .eq('profile_id', profile_id)
      .eq('channel', 'in_app');

    if (Array.isArray(notification_ids) && notification_ids.length > 0) {
      query = query.in('id', notification_ids);
    }

    await query;

    res.json({ success: true, message: 'Notifications marked as read' });
  } catch (error) {
    console.error('[communications/in-app/read PATCH] error:', error);
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
