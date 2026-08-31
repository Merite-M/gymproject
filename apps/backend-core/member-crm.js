const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();
const authMiddleware = require('./authMiddleware');
const { validateTenantAccess: sharedValidateTenantAccess, formatRWF } = require('@gym-partner/shared-utils');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// Apply centralized authentication middleware to all member CRM routes
router.use(authMiddleware);

// Helper function to extract authenticated user from req.user
async function verifyAuthToken(req) {
  if (req.user) {
    return { user: req.user };
  }
  return { error: 'Authentication required' };
}

// Helper function to validate tenant access using shared utility
async function validateTenantAccess(userId, tenantId) {
  const result = await sharedValidateTenantAccess(supabase, userId, tenantId);
  if (!result.authorized) {
    return { error: result.error || 'Access denied' };
  }
  return { profile: result.profile };
}

const gymEmitter = require('./events');

// Helper to generate unique referral code
function generateReferralCode(name = 'MEMBER') {
  const clean = (name || 'MEM').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'MEM';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `GP-${clean}${rand}`;
}

// Helper to generate voucher code
function generateVoucherCode(prefix = 'REF') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${rand}`;
}

// ==========================================
// SALES LEAD PIPELINE CRM API
// ==========================================

/**
 * GET /api/members/leads
 * Retrieves sales leads with filtering by stage, search query, source, and pagination.
 */
router.get('/leads', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { tenant_id, stage, search, source, limit = 100, offset = 0 } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'Missing tenant_id' });
    }

    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    let query = supabase
      .from('leads')
      .select('*, assigned_staff:profiles!assigned_staff_id(id, first_name, last_name), referred_by:profiles!referred_by_id(id, first_name, last_name, referral_code)', { count: 'exact' })
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (stage && stage !== 'all') {
      query = query.eq('pipeline_stage', stage);
    }

    if (source && source !== 'all') {
      query = query.eq('source', source);
    }

    if (search) {
      const cleanSearch = String(search).replace(/[,.()%\\/]/g, '').trim();
      if (cleanSearch) {
        query = query.or(`first_name.ilike.%${cleanSearch}%,last_name.ilike.%${cleanSearch}%,phone.ilike.%${cleanSearch}%,email.ilike.%${cleanSearch}%`);
      }
    }

    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: leads, error: leadsError, count } = await query;

    if (leadsError) {
      console.error('[leads-list] error:', leadsError);
      return res.status(500).json({ error: leadsError.message });
    }

    // Compute stage duration days for each lead
    const enhancedLeads = (leads || []).map(lead => {
      const enteredAt = lead.stage_entered_at ? new Date(lead.stage_entered_at) : new Date(lead.created_at);
      const daysInStage = Math.max(0, Math.floor((Date.now() - enteredAt.getTime()) / (1000 * 60 * 60 * 24)));
      return {
        ...lead,
        days_in_stage: daysInStage
      };
    });

    // Compute stage breakdown counts
    const { data: allTenantLeads } = await supabase
      .from('leads')
      .select('pipeline_stage')
      .eq('tenant_id', tenant_id);

    const stageSummary = {
      inquiry: 0,
      tour_scheduled: 0,
      trial_active: 0,
      trial_expired: 0,
      closed_won: 0,
      closed_lost: 0,
      total: (allTenantLeads || []).length
    };

    (allTenantLeads || []).forEach(l => {
      if (stageSummary[l.pipeline_stage] !== undefined) {
        stageSummary[l.pipeline_stage]++;
      }
    });

    res.json({
      leads: enhancedLeads,
      total_count: count || 0,
      stage_summary: stageSummary
    });

  } catch (error) {
    console.error('[leads-list] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/members/leads
 * Creates a new sales lead in the pipeline.
 */
router.post('/leads', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const {
      tenant_id,
      first_name,
      last_name,
      email,
      phone,
      pipeline_stage = 'inquiry',
      source = 'manual',
      tour_date,
      trial_start_date,
      trial_end_date,
      assigned_staff_id,
      referred_by_id,
      referral_code_used,
      notes,
      custom_fields
    } = req.body;

    if (!tenant_id || !first_name || !last_name || !phone) {
      return res.status(400).json({ error: 'Missing required fields: tenant_id, first_name, last_name, phone' });
    }

    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    // Check if referral code was provided without referred_by_id
    let resolvedReferrerId = referred_by_id || null;
    if (!resolvedReferrerId && referral_code_used) {
      const { data: refUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('referral_code', referral_code_used.trim().toUpperCase())
        .maybeSingle();

      if (refUser) resolvedReferrerId = refUser.id;
    }

    const now = new Date().toISOString();
    const { data: lead, error: insertError } = await supabase
      .from('leads')
      .insert({
        tenant_id,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email ? email.trim() : null,
        phone: phone.trim(),
        pipeline_stage,
        stage_entered_at: now,
        source,
        tour_date: tour_date ? new Date(tour_date).toISOString() : null,
        trial_start_date: trial_start_date || (pipeline_stage === 'trial_active' ? now.split('T')[0] : null),
        trial_end_date: trial_end_date || (pipeline_stage === 'trial_active' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null),
        assigned_staff_id: assigned_staff_id || null,
        referred_by_id: resolvedReferrerId,
        referral_code_used: referral_code_used ? referral_code_used.trim().toUpperCase() : null,
        notes: notes || null,
        custom_fields: custom_fields || {}
      })
      .select('*, assigned_staff:profiles!assigned_staff_id(id, first_name, last_name), referred_by:profiles!referred_by_id(id, first_name, last_name)')
      .single();

    if (insertError) {
      console.error('[leads-create] error:', insertError);
      return res.status(500).json({ error: insertError.message });
    }

    // Audit stage history
    await supabase.from('lead_stage_history').insert({
      tenant_id,
      lead_id: lead.id,
      from_stage: null,
      to_stage: pipeline_stage,
      changed_by: authResult.user.id,
      trigger_source: 'manual_create',
      notes: notes || 'Lead created'
    });

    // If referral exists, create referral reward tracking row
    if (resolvedReferrerId) {
      await supabase.from('referral_rewards').upsert({
        tenant_id,
        referrer_profile_id: resolvedReferrerId,
        referee_lead_id: lead.id,
        referral_code: referral_code_used ? referral_code_used.trim().toUpperCase() : 'DIRECT',
        status: 'pending',
        reward_amount_rwf: 10000
      }, { onConflict: 'referrer_profile_id, referee_lead_id' });
    }

    // Queue welcome or tour confirmation SMS if applicable
    if (pipeline_stage === 'tour_scheduled' && tour_date) {
      await supabase.from('notification_queue').insert({
        tenant_id,
        profile_id: null,
        channel: 'sms',
        recipient: phone.trim(),
        subject: 'Gym Tour Scheduled',
        content: `Hi ${first_name}, your tour is scheduled for ${new Date(tour_date).toLocaleString()}. We are excited to meet you!`,
        status: 'pending'
      });
    }

    gymEmitter.emit('lead.created', {
      tenant_id,
      lead_id: lead.id,
      name: `${first_name} ${last_name}`,
      stage: pipeline_stage
    });

    res.status(201).json({ success: true, lead });

  } catch (error) {
    console.error('[leads-create] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/members/leads/:leadId
 * Retrieves detailed lead profile including stage transition history and logs.
 */
router.get('/leads/:leadId', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { leadId } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const authResult = await verifyAuthToken(req);
    if (authResult.error) return res.status(401).json({ error: authResult.error });

    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) return res.status(403).json({ error: tenantAccess.error });

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadId);
    if (!isUuid) {
      return res.status(400).json({ error: 'Invalid leadId parameter format' });
    }

    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('*, assigned_staff:profiles!assigned_staff_id(id, first_name, last_name), referred_by:profiles!referred_by_id(id, first_name, last_name, phone, referral_code)')
      .eq('id', leadId)
      .eq('tenant_id', tenant_id)
      .single();

    if (leadErr || !lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Fetch stage history
    const { data: stageHistory } = await supabase
      .from('lead_stage_history')
      .select('*, actor:profiles!changed_by(id, first_name, last_name)')
      .eq('lead_id', leadId)
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    // Fetch communication logs safely
    const cleanPhone = String(lead.phone || '').replace(/[,.()%\\/]/g, '').trim();
    let commQuery = supabase
      .from('communications_log')
      .select('*')
      .eq('tenant_id', tenant_id);

    if (cleanPhone) {
      commQuery = commQuery.or(`profile_id.eq.${leadId},content.ilike.%${cleanPhone}%`);
    } else {
      commQuery = commQuery.eq('profile_id', leadId);
    }

    const { data: communications } = await commQuery
      .order('created_at', { ascending: false })
      .limit(20);

    res.json({
      lead,
      stage_history: stageHistory || [],
      communications: communications || []
    });

  } catch (error) {
    console.error('[lead-detail] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/members/leads/:leadId
 * Updates sales lead information.
 */
router.put('/leads/:leadId', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { leadId } = req.params;
    const { tenant_id, ...updateFields } = req.body;

    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const authResult = await verifyAuthToken(req);
    if (authResult.error) return res.status(401).json({ error: authResult.error });

    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) return res.status(403).json({ error: tenantAccess.error });

    const allowedUpdates = [
      'first_name', 'last_name', 'email', 'phone', 'assigned_staff_id',
      'source', 'tour_date', 'trial_start_date', 'trial_end_date', 'notes', 'custom_fields'
    ];

    const safeUpdates = { updated_at: new Date().toISOString() };
    for (const key of Object.keys(updateFields)) {
      if (allowedUpdates.includes(key)) {
        safeUpdates[key] = updateFields[key];
      }
    }

    const { data: updatedLead, error: updErr } = await supabase
      .from('leads')
      .update(safeUpdates)
      .eq('id', leadId)
      .eq('tenant_id', tenant_id)
      .select('*, assigned_staff:profiles!assigned_staff_id(id, first_name, last_name)')
      .single();

    if (updErr) {
      console.error('[lead-update] error:', updErr);
      return res.status(500).json({ error: updErr.message });
    }

    res.json({ success: true, lead: updatedLead });

  } catch (error) {
    console.error('[lead-update] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/members/leads/:leadId/stage
 * Advances or changes lead pipeline stage with automated trigger actions.
 */
router.post('/leads/:leadId/stage', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { leadId } = req.params;
    const {
      tenant_id,
      stage,
      tour_date,
      trial_days = 7,
      lost_reason,
      notes
    } = req.body;

    const validStages = ['inquiry', 'tour_scheduled', 'trial_active', 'trial_expired', 'closed_won', 'closed_lost'];
    if (!tenant_id || !stage || !validStages.includes(stage)) {
      return res.status(400).json({ error: `Invalid or missing stage. Must be one of: ${validStages.join(', ')}` });
    }

    const authResult = await verifyAuthToken(req);
    if (authResult.error) return res.status(401).json({ error: authResult.error });

    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) return res.status(403).json({ error: tenantAccess.error });

    // Fetch existing lead
    const { data: currentLead, error: fetchErr } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('tenant_id', tenant_id)
      .single();

    if (fetchErr || !currentLead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const oldStage = currentLead.pipeline_stage;
    const now = new Date().toISOString();
    const updatePayload = {
      pipeline_stage: stage,
      stage_entered_at: now,
      updated_at: now
    };

    // Automated trigger logic per stage
    let triggerNotes = notes || `Stage transitioned from ${oldStage} to ${stage}`;

    if (stage === 'tour_scheduled') {
      const tourTimestamp = tour_date ? new Date(tour_date).toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      updatePayload.tour_date = tourTimestamp;

      // Queue tour reminder
      await supabase.from('notification_queue').insert({
        tenant_id,
        profile_id: null,
        channel: 'sms',
        recipient: currentLead.phone,
        subject: 'Tour Scheduled',
        content: `Hi ${currentLead.first_name}! Your gym tour is scheduled for ${new Date(tourTimestamp).toLocaleString()}. See you then!`,
        status: 'pending'
      });
      triggerNotes += ` (Tour set for ${new Date(tourTimestamp).toLocaleString()})`;

    } else if (stage === 'trial_active') {
      const startDate = now.split('T')[0];
      const endDate = new Date(Date.now() + (parseInt(trial_days) || 7) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      updatePayload.trial_start_date = startDate;
      updatePayload.trial_end_date = endDate;

      // Queue trial activation SMS
      await supabase.from('notification_queue').insert({
        tenant_id,
        profile_id: null,
        channel: 'sms',
        recipient: currentLead.phone,
        subject: 'VIP Trial Activated',
        content: `Welcome ${currentLead.first_name}! Your ${trial_days}-day VIP trial is active through ${endDate}. Enjoy full access!`,
        status: 'pending'
      });
      triggerNotes += ` (${trial_days}-day trial active until ${endDate})`;

    } else if (stage === 'trial_expired') {
      // Queue special conversion discount offer
      await supabase.from('notification_queue').insert({
        tenant_id,
        profile_id: null,
        channel: 'sms',
        recipient: currentLead.phone,
        subject: 'Special Membership Offer',
        content: `Hi ${currentLead.first_name}, your trial has ended! Join this week and get 15% off your first month. Visit reception to claim!`,
        status: 'pending'
      });

    } else if (stage === 'closed_lost') {
      updatePayload.lost_reason = lost_reason || 'No response / Not interested';
      triggerNotes += ` (Reason: ${updatePayload.lost_reason})`;

    } else if (stage === 'closed_won') {
      // Auto conversion trigger if lead is marked closed_won (with idempotency guards)
      let profileId = currentLead.converted_profile_id;

      if (oldStage === 'closed_won' && profileId) {
        triggerNotes += ' (Lead was already closed_won; skipping duplicate profile/voucher creation)';
      } else {
        if (!profileId) {
          const newRefCode = generateReferralCode(currentLead.first_name);
          const { data: newProf, error: profErr } = await supabase
            .from('profiles')
            .insert({
              tenant_id,
              first_name: currentLead.first_name,
              last_name: currentLead.last_name,
              email: currentLead.email,
              phone: currentLead.phone,
              role: 'member',
              status: 'active',
              membership_status: 'active',
              referral_code: newRefCode,
              referred_by_id: currentLead.referred_by_id
            })
            .select()
            .single();

          if (!profErr && newProf) {
            profileId = newProf.id;
            updatePayload.converted_profile_id = profileId;

            // Create active Standard membership
            const today = now.split('T')[0];
            const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            await supabase.from('memberships').insert({
              tenant_id,
              profile_id: profileId,
              membership_type: 'STANDARD',
              start_date: today,
              end_date: nextMonth,
              status: 'active',
              price: 30000,
              billing_interval: 'monthly'
            });
          }
        }

        // Fulfill Referral Reward if lead had a referrer and not yet rewarded
        if (currentLead.referred_by_id) {
          // Check if reward was already fulfilled
          const { data: existingReward } = await supabase
            .from('referral_rewards')
            .select('id, status, reward_voucher_id')
            .eq('tenant_id', tenant_id)
            .eq('referee_lead_id', currentLead.id)
            .maybeSingle();

          const isAlreadyRewarded = existingReward && (existingReward.status === 'rewarded' || existingReward.reward_voucher_id);

          if (!isAlreadyRewarded) {
            const rewardAmount = 10000;
            const voucherCode = generateVoucherCode('REF');
            const voucherExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

            // Create gift voucher
            const { data: voucher } = await supabase
              .from('gift_vouchers')
              .insert({
                tenant_id,
                code: voucherCode,
                initial_balance_rwf: rewardAmount,
                current_balance_rwf: rewardAmount,
                expires_at: voucherExpiry
              })
              .select()
              .single();

            if (voucher) {
              // Update or insert referral_rewards
              await supabase.from('referral_rewards').upsert({
                tenant_id,
                referrer_profile_id: currentLead.referred_by_id,
                referee_lead_id: currentLead.id,
                referee_profile_id: profileId,
                referral_code: currentLead.referral_code_used || 'DIRECT',
                status: 'rewarded',
                reward_voucher_id: voucher.id,
                reward_amount_rwf: rewardAmount,
                reward_applied_at: now
              }, { onConflict: 'referrer_profile_id, referee_lead_id' });

              // Send reward notification to Referrer
              const { data: referrer } = await supabase
                .from('profiles')
                .select('phone, first_name')
                .eq('id', currentLead.referred_by_id)
                .single();

              if (referrer && referrer.phone) {
                await supabase.from('notification_queue').insert({
                  tenant_id,
                  profile_id: currentLead.referred_by_id,
                  channel: 'sms',
                  recipient: referrer.phone,
                  subject: 'Referral Reward Voucher Issued! 🎉',
                  content: `Great news ${referrer.first_name}! Your referral ${currentLead.first_name} joined GymPartner! Your RWF 10,000 credit voucher is ${voucherCode}. Present at front desk to redeem!`,
                  status: 'pending'
                });
              }
            }
          }
        }
      }
    }

    // Apply update to lead
    const { data: updatedLead, error: updErr } = await supabase
      .from('leads')
      .update(updatePayload)
      .eq('id', leadId)
      .eq('tenant_id', tenant_id)
      .select('*, assigned_staff:profiles!assigned_staff_id(id, first_name, last_name)')
      .single();

    if (updErr) {
      console.error('[lead-stage] error:', updErr);
      return res.status(500).json({ error: updErr.message });
    }

    // Log to stage history
    await supabase.from('lead_stage_history').insert({
      tenant_id,
      lead_id: leadId,
      from_stage: oldStage,
      to_stage: stage,
      changed_by: authResult.user.id,
      trigger_source: 'manual_transition',
      notes: triggerNotes
    });

    gymEmitter.emit('lead.stage_changed', {
      tenant_id,
      lead_id: leadId,
      old_stage: oldStage,
      new_stage: stage
    });

    res.json({
      success: true,
      message: `Lead transitioned to ${stage}`,
      lead: updatedLead
    });

  } catch (error) {
    console.error('[lead-stage] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/members/leads/:leadId/convert
 * Directly converts a lead into an active member profile and fulfills referral reward.
 */
router.post('/leads/:leadId/convert', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { leadId } = req.params;
    const { tenant_id, membership_type = 'STANDARD', price = 30000 } = req.body;

    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const authResult = await verifyAuthToken(req);
    if (authResult.error) return res.status(401).json({ error: authResult.error });

    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) return res.status(403).json({ error: tenantAccess.error });

    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('tenant_id', tenant_id)
      .single();

    if (leadErr || !lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Guard: Check if lead was already converted
    if (lead.pipeline_stage === 'closed_won' || lead.converted_profile_id) {
      return res.status(400).json({ error: 'Lead has already been converted to an active member' });
    }

    // 1. Create Profile
    const refCode = generateReferralCode(lead.first_name);
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .insert({
        tenant_id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        phone: lead.phone,
        role: 'member',
        status: 'active',
        membership_status: 'active',
        referral_code: refCode,
        referred_by_id: lead.referred_by_id
      })
      .select()
      .single();

    if (profErr) {
      console.error('[lead-convert] profile create error:', profErr);
      return res.status(500).json({ error: profErr.message });
    }

    // 2. Create Membership
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: membership } = await supabase
      .from('memberships')
      .insert({
        tenant_id,
        profile_id: profile.id,
        membership_type: membership_type.toUpperCase(),
        start_date: today,
        end_date: nextMonth,
        status: 'active',
        price: parseFloat(price) || 30000,
        billing_interval: 'monthly'
      })
      .select()
      .single();

    // 3. Fulfill Referral Reward Voucher if lead was referred and not yet rewarded
    let rewardVoucher = null;
    if (lead.referred_by_id) {
      const { data: existingReward } = await supabase
        .from('referral_rewards')
        .select('id, status, reward_voucher_id')
        .eq('tenant_id', tenant_id)
        .eq('referee_lead_id', lead.id)
        .maybeSingle();

      const isAlreadyRewarded = existingReward && (existingReward.status === 'rewarded' || existingReward.reward_voucher_id);

      if (!isAlreadyRewarded) {
        const rewardAmount = 10000;
        const voucherCode = generateVoucherCode('REF');
        const voucherExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

        const { data: voucher } = await supabase
          .from('gift_vouchers')
          .insert({
            tenant_id,
            code: voucherCode,
            initial_balance_rwf: rewardAmount,
            current_balance_rwf: rewardAmount,
            expires_at: voucherExpiry
          })
          .select()
          .single();

        if (voucher) {
          rewardVoucher = voucher;

          await supabase.from('referral_rewards').upsert({
            tenant_id,
            referrer_profile_id: lead.referred_by_id,
            referee_lead_id: lead.id,
            referee_profile_id: profile.id,
            referral_code: lead.referral_code_used || 'DIRECT',
            status: 'rewarded',
            reward_voucher_id: voucher.id,
            reward_amount_rwf: rewardAmount,
            reward_applied_at: now
          }, { onConflict: 'referrer_profile_id, referee_lead_id' });

          const { data: referrer } = await supabase
            .from('profiles')
            .select('phone, first_name')
            .eq('id', lead.referred_by_id)
            .single();

          if (referrer && referrer.phone) {
            await supabase.from('notification_queue').insert({
              tenant_id,
              profile_id: lead.referred_by_id,
              channel: 'sms',
              recipient: referrer.phone,
              subject: 'Referral Reward Voucher Issued! 🎉',
              content: `Congratulations ${referrer.first_name}! Your referral ${lead.first_name} has converted to a full member! Here is your RWF 10,000 voucher: ${voucherCode}.`,
              status: 'pending'
            });
          }
        }
      }
    }

    // 4. Update Lead to closed_won
    await supabase
      .from('leads')
      .update({
        pipeline_stage: 'closed_won',
        converted_profile_id: profile.id,
        stage_entered_at: now,
        updated_at: now
      })
      .eq('id', lead.id);

    // Audit stage history
    await supabase.from('lead_stage_history').insert({
      tenant_id,
      lead_id: lead.id,
      from_stage: lead.pipeline_stage,
      to_stage: 'closed_won',
      changed_by: authResult.user.id,
      trigger_source: 'manual_conversion',
      notes: `Converted to Member Profile ${profile.id}`
    });

    gymEmitter.emit('lead.converted', {
      tenant_id,
      lead_id: lead.id,
      profile_id: profile.id,
      membership_id: membership ? membership.id : null
    });

    res.json({
      success: true,
      message: 'Lead converted to member successfully',
      profile,
      membership,
      reward_voucher: rewardVoucher
    });

  } catch (error) {
    console.error('[lead-convert] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// REFERRAL ENGINE & REWARD VOUCHER API
// ==========================================

/**
 * GET /api/members/referrals/list
 * Tenant-wide directory of referral tracking, conversion rates, and reward vouchers.
 */
router.get('/referrals/list', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { tenant_id, status } = req.query;

    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const authResult = await verifyAuthToken(req);
    if (authResult.error) return res.status(401).json({ error: authResult.error });

    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) return res.status(403).json({ error: tenantAccess.error });

    let query = supabase
      .from('referral_rewards')
      .select('*, referrer:profiles!referrer_profile_id(id, first_name, last_name, phone, referral_code), referee_profile:profiles!referee_profile_id(id, first_name, last_name, phone), referee_lead:leads!referee_lead_id(id, first_name, last_name, phone, pipeline_stage), reward_voucher:gift_vouchers!reward_voucher_id(id, code, current_balance_rwf, expires_at)')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: referrals, error: refErr } = await query;

    if (refErr) {
      console.error('[referrals-list] error:', refErr);
      return res.status(500).json({ error: refErr.message });
    }

    const totalReferrals = (referrals || []).length;
    const totalRewarded = (referrals || []).filter(r => r.status === 'rewarded').length;
    const totalPending = (referrals || []).filter(r => r.status === 'pending').length;
    const totalRewardsPaidRWF = (referrals || [])
      .filter(r => r.status === 'rewarded')
      .reduce((sum, r) => sum + parseFloat(r.reward_amount_rwf || 0), 0);

    const conversionRate = totalReferrals > 0 ? ((totalRewarded / totalReferrals) * 100).toFixed(1) : '0';

    res.json({
      referrals: referrals || [],
      metrics: {
        total_referrals: totalReferrals,
        total_rewarded: totalRewarded,
        total_pending: totalPending,
        total_rewards_paid_rwf: totalRewardsPaidRWF,
        formatted_rewards_paid: formatRWF(totalRewardsPaidRWF),
        conversion_rate_pct: conversionRate
      }
    });

  } catch (error) {
    console.error('[referrals-list] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/members/referrals/validate
 * Validates a referral code and returns referrer details and reward info.
 */
router.post('/referrals/validate', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { tenant_id, code } = req.body;

    if (!tenant_id || !code) {
      return res.status(400).json({ error: 'Missing tenant_id or code' });
    }

    const authResult = await verifyAuthToken(req);
    if (authResult.error) return res.status(401).json({ error: authResult.error });

    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) return res.status(403).json({ error: tenantAccess.error });

    const cleanCode = code.trim().toUpperCase();
    const { data: referrer, error: refErr } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, referral_code')
      .eq('tenant_id', tenant_id)
      .eq('referral_code', cleanCode)
      .maybeSingle();

    if (refErr || !referrer) {
      return res.status(404).json({ valid: false, error: 'Invalid or expired referral code' });
    }

    res.json({
      valid: true,
      code: cleanCode,
      referrer: {
        id: referrer.id,
        name: `${referrer.first_name} ${referrer.last_name}`
      },
      reward_amount_rwf: 10000,
      formatted_reward: formatRWF(10000)
    });

  } catch (error) {
    console.error('[referral-validate] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/members/:id/referral
 * Retrieves member's personal referral hub data (code, share link, referees, earned rewards).
 */
router.get('/:id/referral', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const authResult = await verifyAuthToken(req);
    if (authResult.error) return res.status(401).json({ error: authResult.error });

    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) return res.status(403).json({ error: tenantAccess.error });

    // Fetch profile
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, referral_code, tenant_id')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (profErr || !profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Generate referral code if missing
    let referralCode = profile.referral_code;
    if (!referralCode) {
      referralCode = generateReferralCode(profile.first_name);
      await supabase
        .from('profiles')
        .update({ referral_code: referralCode })
        .eq('id', id);
    }

    // Fetch all referrals made by this member
    const { data: referrals } = await supabase
      .from('referral_rewards')
      .select('*, referee_profile:profiles!referee_profile_id(id, first_name, last_name), referee_lead:leads!referee_lead_id(id, first_name, last_name, pipeline_stage), voucher:gift_vouchers!reward_voucher_id(code, current_balance_rwf, expires_at)')
      .eq('tenant_id', tenant_id)
      .eq('referrer_profile_id', id)
      .order('created_at', { ascending: false });

    const totalReferrals = (referrals || []).length;
    const rewardedReferrals = (referrals || []).filter(r => r.status === 'rewarded');
    const totalEarnedRWF = rewardedReferrals.reduce((sum, r) => sum + parseFloat(r.reward_amount_rwf || 0), 0);

    const shareUrl = `https://gym-frontend-app.onrender.com/join?ref=${referralCode}&tenant=${tenant_id}`;

    res.json({
      profile_id: id,
      referral_code: referralCode,
      share_url: shareUrl,
      metrics: {
        total_referrals: totalReferrals,
        converted_count: rewardedReferrals.length,
        pending_count: (referrals || []).filter(r => r.status === 'pending').length,
        total_earned_rwf: totalEarnedRWF,
        formatted_earned: formatRWF(totalEarnedRWF)
      },
      referrals: referrals || []
    });

  } catch (error) {
    console.error('[member-referral] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/members/:id/referral/generate
 * Generates or regenerates a unique referral code for a member.
 */
router.post('/:id/referral/generate', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id } = req.body;

    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const authResult = await verifyAuthToken(req);
    if (authResult.error) return res.status(401).json({ error: authResult.error });

    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) return res.status(403).json({ error: tenantAccess.error });

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    const newCode = generateReferralCode(profile ? profile.first_name : 'MEMBER');

    const { data: updated, error: updErr } = await supabase
      .from('profiles')
      .update({ referral_code: newCode })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select('id, first_name, last_name, referral_code')
      .single();

    if (updErr) {
      console.error('[referral-gen] error:', updErr);
      return res.status(500).json({ error: updErr.message });
    }

    res.json({
      success: true,
      referral_code: newCode,
      profile: updated
    });

  } catch (error) {
    console.error('[referral-gen] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// MEMBER PROFILE API
// ==========================================

// Get full member profile with membership details, billing, waiver status, dependents
router.get('/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'Missing tenant_id' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    // Fetch profile with all related data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Member profile not found' });
    }

    // Fetch memberships
    const { data: memberships, error: membershipsError } = await supabase
      .from('memberships')
      .select('*')
      .eq('profile_id', id)
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    // Fetch billing information
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('*')
      .eq('profile_id', id)
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false })
      .limit(20);

    // Fetch member tab balance
    const { data: memberTab, error: tabError } = await supabase
      .from('member_tabs')
      .select('*')
      .eq('profile_id', id)
      .eq('tenant_id', tenant_id)
      .single();

    // Fetch family links (dependents)
    const { data: familyLinks, error: familyError } = await supabase
      .from('family_links')
      .select('*, master:profiles!master_account_id(*), dependent:profiles!dependent_account_id(*)')
      .or(`master_account_id.eq.${id},dependent_account_id.eq.${id}`)
      .eq('tenant_id', tenant_id);

    // Calculate outstanding balance
    let outstandingBalance = 0;
    if (invoices) {
      outstandingBalance = invoices
        .filter(inv => inv.status === 'unpaid' || inv.status === 'overdue')
        .reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0);
    }

    // Add member tab balance if exists
    if (memberTab && memberTab.balance) {
      outstandingBalance += parseFloat(memberTab.balance);
    }

    res.json({
      profile,
      memberships: memberships || [],
      billing: {
        invoices: invoices || [],
        outstanding_balance: outstandingBalance,
        formatted_balance: formatRWF(outstandingBalance),
        member_tab: memberTab || null
      },
      waiver: {
        signed: profile.waiver_signed || false,
        signed_at: profile.waiver_signed_at || null,
        is_valid: profile.waiver_signed ? 
          (!profile.waiver_signed_at || new Date(profile.waiver_signed_at) > new Date(Date.now() - 365*24*60*60*1000)) : false
      },
      dependents: familyLinks || [],
      check_in_count: 0 // Could be fetched if needed
    });

  } catch (error) {
    console.error('Member profile fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update member information
router.put('/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id, ...updateData } = req.body;

    if (!tenant_id) {
      return res.status(400).json({ error: 'Missing tenant_id' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    // Validate update data
    const allowedFields = [
      'first_name', 'last_name', 'email', 'phone', 'date_of_birth',
      'address', 'emergency_contact_name', 'emergency_contact_phone',
      'status', 'notes'
    ];

    const invalidFields = Object.keys(updateData).filter(field => !allowedFields.includes(field));
    if (invalidFields.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid fields', 
        invalid_fields: invalidFields 
      });
    }

    // Update profile
    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    if (!profile) {
      return res.status(404).json({ error: 'Member profile not found' });
    }

    res.json(profile);

  } catch (error) {
    console.error('Member profile update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get membership history
router.get('/:id/membership-history', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'Missing tenant_id' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    // Fetch membership history
    const { data: memberships, error } = await supabase
      .from('memberships')
      .select('*')
      .eq('profile_id', id)
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch related holds for each membership
    const membershipIds = memberships?.map(m => m.id) || [];
    const { data: holds } = await supabase
      .from('membership_holds')
      .select('*')
      .in('membership_id', membershipIds)
      .eq('tenant_id', tenant_id);

    res.json({
      memberships: memberships || [],
      holds: holds || []
    });

  } catch (error) {
    console.error('Membership history fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// MEMBERSHIP HOLDS API
// ==========================================

// List active holds for a member
router.get('/:id/holds', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id, status } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'Missing tenant_id' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    let query = supabase
      .from('membership_holds')
      .select('*, memberships:memberships(membership_type, price, billing_interval)')
      .eq('profile_id', id)
      .eq('tenant_id', tenant_id);

    if (status) {
      query = query.eq('status', status);
    } else {
      query = query.in('status', ['pending', 'active']);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    res.json(data || []);

  } catch (error) {
    console.error('Holds fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create membership hold
router.post('/:id/holds', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id, membership_id, hold_reason, start_date, end_date, notes, created_by } = req.body;

    if (!tenant_id || !membership_id || !hold_reason || !start_date || !created_by) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    // Validate dates
    if (end_date && new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    // Get membership details
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('price, billing_interval')
      .eq('id', membership_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (membershipError || !membership) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    // Calculate proration
    const dailyRate = membership.price / 30; // Simplified daily rate
    const holdDays = end_date ? 
      Math.ceil((new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24)) : 30;
    const prorationAmount = dailyRate * holdDays;

    // Create hold request
    const { data: hold, error: holdError } = await supabase
      .from('membership_holds')
      .insert({
        tenant_id,
        membership_id,
        profile_id: id,
        hold_reason,
        start_date,
        end_date,
        status: 'pending',
        notes,
        created_by,
        proration_amount: prorationAmount.toFixed(2),
        is_active: false,
        billing_suspended: false
      })
      .select()
      .single();

    if (holdError) throw holdError;

    res.status(201).json({
      ...hold,
      proration_calculation: {
        daily_rate: dailyRate.toFixed(2),
        hold_days: holdDays,
        proration_amount: prorationAmount.toFixed(2),
        formatted_amount: formatRWF(prorationAmount)
      }
    });

  } catch (error) {
    console.error('Hold creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel membership
router.post('/:id/cancel', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id, membership_id, cancellation_reason, effective_date, cancelled_by } = req.body;

    if (!tenant_id || !membership_id || !cancelled_by) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    // Get current membership
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('*')
      .eq('id', membership_id)
      .eq('profile_id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (membershipError || !membership) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    // Update membership status
    const { data: updatedMembership, error: updateError } = await supabase
      .from('memberships')
      .update({
        status: 'cancelled',
        end_date: effective_date || new Date().toISOString().split('T')[0],
        cancellation_reason,
        cancelled_at: new Date().toISOString(),
        cancelled_by
      })
      .eq('id', membership_id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Cancel any active holds
    await supabase
      .from('membership_holds')
      .update({ status: 'cancelled' })
      .eq('membership_id', membership_id)
      .eq('status', 'active');

    res.json(updatedMembership);

  } catch (error) {
    console.error('Membership cancellation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reactivate membership
router.post('/:id/reactivate', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id, membership_id, reactivated_by } = req.body;

    if (!tenant_id || !membership_id || !reactivated_by) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    // Get current membership
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('*')
      .eq('id', membership_id)
      .eq('profile_id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (membershipError || !membership) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    // Update membership status
    const { data: updatedMembership, error: updateError } = await supabase
      .from('memberships')
      .update({
        status: 'active',
        cancellation_reason: null,
        cancelled_at: null,
        cancelled_by: null,
        end_date: membership.end_date || new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0]
      })
      .eq('id', membership_id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json(updatedMembership);

  } catch (error) {
    console.error('Membership reactivation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// MEMBERSHIP FREEZE API
// ==========================================

// Freeze membership with dependent impact analysis
router.post('/:id/freeze', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id, membership_id, freeze_reason, start_date, end_date, created_by } = req.body;

    if (!tenant_id || !membership_id || !freeze_reason || !start_date || !created_by) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    // Check for dependents that would be affected
    const { data: dependents, error: dependentError } = await supabase
      .from('family_links')
      .select('*, dependent:profiles!dependent_account_id(*, memberships:memberships(*))')
      .eq('master_account_id', id)
      .eq('tenant_id', tenant_id);

    const affectedDependents = [];
    if (dependents) {
      for (const link of dependents) {
        if (link.dependent && link.dependent.memberships) {
          const activeMembership = link.dependent.memberships.find(m => m.status === 'active');
          if (activeMembership) {
            affectedDependents.push({
              dependent_id: link.dependent.id,
              name: `${link.dependent.first_name} ${link.dependent.last_name}`,
              membership_id: activeMembership.id,
              relationship_type: link.relationship_type
            });
          }
        }
      }
    }

    // Get membership details for proration
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('price, billing_interval')
      .eq('id', membership_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (membershipError || !membership) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    // Calculate proration
    const dailyRate = membership.price / 30;
    const holdDays = end_date ? 
      Math.ceil((new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24)) : 30;
    const prorationAmount = dailyRate * holdDays;

    // Create freeze hold
    const { data: freeze, error: freezeError } = await supabase
      .from('membership_holds')
      .insert({
        tenant_id,
        membership_id,
        profile_id: id,
        hold_reason: freeze_reason,
        start_date,
        end_date,
        status: 'pending',
        notes: `Membership freeze. Affects ${affectedDependents.length} dependent(s).`,
        created_by,
        proration_amount: prorationAmount.toFixed(2),
        is_active: false,
        billing_suspended: false
      })
      .select()
      .single();

    if (freezeError) throw freezeError;

    res.status(201).json({
      freeze,
      affected_dependents: affectedDependents,
      proration_calculation: {
        daily_rate: dailyRate.toFixed(2),
        hold_days: holdDays,
        proration_amount: prorationAmount.toFixed(2),
        formatted_amount: formatRWF(prorationAmount)
      },
      warning: affectedDependents.length > 0 ? 
        `This freeze will affect ${affectedDependents.length} dependent membership(s)` : null
    });

  } catch (error) {
    console.error('Membership freeze error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// BILLING HISTORY API
// ==========================================

// Get comprehensive billing history
router.get('/:id/billing-history', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id, limit = 50, offset = 0 } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'Missing tenant_id' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    // Fetch billing history
    const { data: billingHistory, error: billingError } = await supabase
      .from('billing_history')
      .select('*')
      .eq('profile_id', id)
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (billingError) throw billingError;

    // Calculate totals
    const totalBilled = billingHistory?.reduce((sum, item) => sum + parseFloat(item.total_amount || 0), 0) || 0;
    const totalPaid = billingHistory?.reduce((sum, item) => sum + parseFloat(item.paid_amount || 0), 0) || 0;
    const totalOutstanding = totalBilled - totalPaid;

    res.json({
      billing_history: billingHistory || [],
      summary: {
        total_billed: totalBilled,
        total_paid: totalPaid,
        total_outstanding: totalOutstanding,
        formatted_billed: formatRWF(totalBilled),
        formatted_paid: formatRWF(totalPaid),
        formatted_outstanding: formatRWF(totalOutstanding)
      },
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: billingHistory?.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Billing history fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create billing record
router.post('/:id/billing', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { 
      tenant_id, 
      membership_id, 
      amount, 
      tax_amount = 0, 
      discount_amount = 0,
      payment_method,
      due_date,
      billing_period_start,
      billing_period_end,
      notes,
      created_by 
    } = req.body;

    if (!tenant_id || !amount || !due_date || !created_by) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    const totalAmount = parseFloat(amount) + parseFloat(tax_amount) - parseFloat(discount_amount);

    // Create billing record
    const { data: billing, error: billingError } = await supabase
      .from('billing_history')
      .insert({
        tenant_id,
        profile_id: id,
        membership_id,
        currency: 'RWF',
        exchange_rate: 1.0,
        amount: parseFloat(amount),
        tax_amount: parseFloat(tax_amount),
        discount_amount: parseFloat(discount_amount),
        total_amount: totalAmount,
        payment_status: 'unpaid',
        paid_amount: 0,
        balance_due: totalAmount,
        due_date,
        payment_method,
        billing_period_start,
        billing_period_end,
        notes,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (billingError) throw billingError;

    // Create corresponding invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        tenant_id,
        profile_id: id,
        membership_id,
        amount: totalAmount,
        currency: 'RWF',
        status: 'unpaid',
        due_date,
        billing_period_start,
        billing_period_end,
        notes,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Invoice creation error:', invoiceError);
      // Don't fail the request if invoice creation fails
    }

    res.status(201).json({
      billing,
      invoice: invoice || null,
      formatted_amount: formatRWF(totalAmount)
    });

  } catch (error) {
    console.error('Billing creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process payment on billing record
router.post('/:id/billing/:billing_id/pay', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { billing_id } = req.params;
    const { tenant_id, payment_method, amount, reference_code, processed_by } = req.body;

    if (!tenant_id || !payment_method || !amount || !processed_by) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    // Get billing record
    const { data: billing, error: billingError } = await supabase
      .from('billing_history')
      .select('*')
      .eq('id', billing_id)
      .eq('profile_id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (billingError || !billing) {
      return res.status(404).json({ error: 'Billing record not found' });
    }

    const paymentAmount = parseFloat(amount);
    const newPaidAmount = parseFloat(billing.paid_amount) + paymentAmount;
    const newBalanceDue = parseFloat(billing.balance_due) - paymentAmount;
    const newPaymentStatus = newBalanceDue <= 0 ? 'paid' : 'partial';

    // Update billing record
    const { data: updatedBilling, error: updateError } = await supabase
      .from('billing_history')
      .update({
        paid_amount: newPaidAmount,
        balance_due: newBalanceDue,
        payment_status: newPaymentStatus,
        payment_method,
        payment_reference: reference_code,
        paid_date: newBalanceDue <= 0 ? new Date().toISOString().split('T')[0] : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', billing_id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        tenant_id,
        profile_id: id,
        membership_id: billing.membership_id,
        amount: paymentAmount,
        currency: 'RWF',
        payment_method,
        reference_code: reference_code || `PAY-${Date.now()}`,
        status: 'completed',
        processed_by,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Payment record creation error:', paymentError);
    }

    res.json({
      billing: updatedBilling,
      payment: payment || null,
      formatted_paid: formatRWF(newPaidAmount),
      formatted_balance: formatRWF(newBalanceDue)
    });

  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// WAIVER MANAGEMENT API
// ==========================================

// Get waiver history
router.get('/:id/waivers', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'Missing tenant_id' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    // Fetch signed contracts/waivers from member_contracts filtered to waiver types
    const { data: contractData, error: contractError } = await supabase
      .from('member_contracts')
      .select('id, tenant_id, profile_id, title, status, signed_at, signature_image_url, pdf_url, metadata, contract_templates(contract_type)')
      .eq('profile_id', id)
      .eq('tenant_id', tenant_id)
      .order('signed_at', { ascending: false });

    const waivers = (!contractError && contractData)
      ? contractData.filter(c => 
          c.metadata?.waiver_type || 
          c.contract_templates?.contract_type === 'waiver' ||
          (c.title && c.title.toLowerCase().includes('waiver'))
        )
      : [];

    // Get current waiver status from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('waiver_signed, waiver_signed_at')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Determine if current waiver is valid
    let isCurrentValid = false;
    if (profile.waiver_signed && profile.waiver_signed_at) {
      const waiverDate = new Date(profile.waiver_signed_at);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      isCurrentValid = waiverDate > oneYearAgo;
    }

    res.json({
      current_status: {
        signed: profile.waiver_signed || false,
        signed_at: profile.waiver_signed_at,
        is_valid: isCurrentValid,
        expires_at: profile.waiver_signed_at ? 
          new Date(new Date(profile.waiver_signed_at).setFullYear(new Date(profile.waiver_signed_at).getFullYear() + 1)).toISOString() : null
      },
      history: waivers
    });

  } catch (error) {
    console.error('Waiver history fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Record waiver signature
router.post('/:id/waivers', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id, signature_data, waiver_type = 'general_liability', signed_by, guardian_name, guardian_relationship } = req.body;

    if (!tenant_id || !signature_data || !signed_by) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    const nowIso = new Date().toISOString();

    // Create detailed signed waiver record in member_contracts
    const { data: newWaiver } = await supabase
      .from('member_contracts')
      .insert({
        tenant_id,
        profile_id: id,
        title: `Liability Waiver (${waiver_type})`,
        rendered_content: `Waiver electronically signed for ${waiver_type}`,
        status: 'signed',
        signature_image_url: signature_data,
        signed_at: nowIso,
        metadata: {
          waiver_type,
          guardian_name: guardian_name || null,
          guardian_relationship: guardian_relationship || null,
          signed_by: signed_by || null,
          expires_at: expiresAt.toISOString()
        }
      })
      .select()
      .single();

    const waiverRecord = newWaiver || null;

    // Update profile waiver status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .update({
        waiver_signed: true,
        waiver_signed_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (profileError) throw profileError;

    res.status(201).json({
      profile,
      waiver_record: waiverRecord,
      expires_at: expiresAt.toISOString()
    });

  } catch (error) {
    console.error('Waiver signature error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// FAMILY/DEPENDENT MANAGEMENT API
// ==========================================

// Get family members and dependents
router.get('/:id/family', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'Missing tenant_id' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    // Fetch family links
    const { data: familyLinks, error: familyError } = await supabase
      .from('family_links')
      .select('*')
      .or(`master_account_id.eq.${id},dependent_account_id.eq.${id}`)
      .eq('tenant_id', tenant_id);

    if (familyError) throw familyError;

    // Fetch dependent profiles
    const dependentIds = familyLinks?.map(link => link.dependent_account_id) || [];
    const masterIds = familyLinks?.map(link => link.master_account_id) || [];
    const relatedProfileIds = [...new Set([...dependentIds, ...masterIds])];

    let profiles = {};
    if (relatedProfileIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, status')
        .in('id', relatedProfileIds);

      if (!profileError && profileData) {
        profiles = profileData.reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {});
      }
    }

    // Enrich family links with profile data
    const enrichedLinks = familyLinks?.map(link => ({
      ...link,
      master_profile: profiles[link.master_account_id] || null,
      dependent_profile: profiles[link.dependent_account_id] || null
    })) || [];

    res.json({
      family_links: enrichedLinks,
      total_dependents: familyLinks?.filter(link => link.master_account_id === id).length || 0,
      total_master_accounts: familyLinks?.filter(link => link.dependent_account_id === id).length || 0
    });

  } catch (error) {
    console.error('Family fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add family member/dependent
router.post('/:id/family', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id, dependent_account_id, relationship_type, billing_responsibility = 'master', created_by } = req.body;

    if (!tenant_id || !dependent_account_id || !relationship_type || !created_by) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    // Create family link
    const { data: familyLink, error: linkError } = await supabase
      .from('family_links')
      .insert({
        tenant_id,
        master_account_id: id,
        dependent_account_id,
        relationship_type,
        billing_responsibility,
        created_by,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (linkError) throw linkError;

    res.status(201).json(familyLink);

  } catch (error) {
    console.error('Family link creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove family member/dependent
router.delete('/:id/family/:link_id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { link_id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'Missing tenant_id' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    // Delete family link
    const { error: deleteError } = await supabase
      .from('family_links')
      .delete()
      .eq('id', link_id)
      .eq('tenant_id', tenant_id)
      .or(`master_account_id.eq.${id},dependent_account_id.eq.${id}`);

    if (deleteError) throw deleteError;

    res.json({ success: true, message: 'Family link removed' });

  } catch (error) {
    console.error('Family link removal error:', error);
    res.status(500).json({ error: error.message });
  }
});
// Unfreeze membership
router.post('/:id/unfreeze', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id, hold_id, unfrozen_by } = req.body;

    if (!tenant_id || !hold_id || !unfrozen_by) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    // Update hold status
    const { data: updatedHold, error: updateError } = await supabase
      .from('membership_holds')
      .update({
        status: 'ended',
        is_active: false,
        billing_suspended: false,
        end_date: new Date().toISOString().split('T')[0]
      })
      .eq('id', hold_id)
      .eq('profile_id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (updateError) throw updateError;

    if (!updatedHold) {
      return res.status(404).json({ error: 'Hold not found' });
    }

    res.json(updatedHold);

  } catch (error) {
    console.error('Membership unfreeze error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get freeze status and affected dependents
router.get('/:id/freeze-status', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'Missing tenant_id' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    // Get active freeze holds
    const { data: activeFreezes, error: freezeError } = await supabase
      .from('membership_holds')
      .select('*, memberships:memberships(membership_type, price)')
      .eq('profile_id', id)
      .eq('tenant_id', tenant_id)
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: false });

    if (freezeError) throw freezeError;

    // Get affected dependents
    const { data: dependents, error: dependentError } = await supabase
      .from('family_links')
      .select('*, dependent:profiles!dependent_account_id(*, memberships:memberships(*))')
      .eq('master_account_id', id)
      .eq('tenant_id', tenant_id);

    const affectedDependents = [];
    if (dependents) {
      for (const link of dependents) {
        if (link.dependent && link.dependent.memberships) {
          const activeMembership = link.dependent.memberships.find(m => m.status === 'active');
          if (activeMembership) {
            affectedDependents.push({
              dependent_id: link.dependent.id,
              name: `${link.dependent.first_name} ${link.dependent.last_name}`,
              membership_id: activeMembership.id,
              membership_type: activeMembership.membership_type,
              relationship_type: link.relationship_type
            });
          }
        }
      }
    }

    res.json({
      active_freezes: activeFreezes || [],
      affected_dependents: affectedDependents,
      is_frozen: (activeFreezes || []).some(f => f.status === 'active')
    });

  } catch (error) {
    console.error('Freeze status fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// BILLING API
// ==========================================

// Get payment history
router.get('/:id/billing/payments', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id, limit = 50, offset = 0 } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'Missing tenant_id' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    const { data: payments, error } = await supabase
      .from('payments')
      .select('*')
      .eq('profile_id', id)
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw error;

    // Format payments with RWF currency
    const formattedPayments = (payments || []).map(payment => ({
      ...payment,
      formatted_amount: formatRWF(payment.amount)
    }));

    res.json(formattedPayments);

  } catch (error) {
    console.error('Payment history fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get outstanding balance
router.get('/:id/billing/balance', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'Missing tenant_id' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    // Get unpaid invoices
    const { data: invoices, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('profile_id', id)
      .eq('tenant_id', tenant_id)
      .in('status', ['unpaid', 'overdue']);

    if (invoiceError) throw invoiceError;

    // Get member tab balance
    const { data: memberTab, error: tabError } = await supabase
      .from('member_tabs')
      .select('*')
      .eq('profile_id', id)
      .eq('tenant_id', tenant_id)
      .single();

    let invoiceBalance = 0;
    if (invoices) {
      invoiceBalance = invoices.reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0);
    }

    let tabBalance = 0;
    if (memberTab && memberTab.balance) {
      tabBalance = parseFloat(memberTab.balance);
    }

    const totalBalance = invoiceBalance + tabBalance;

    res.json({
      invoice_balance: invoiceBalance,
      formatted_invoice_balance: formatRWF(invoiceBalance),
      tab_balance: tabBalance,
      formatted_tab_balance: formatRWF(tabBalance),
      total_balance: totalBalance,
      formatted_total_balance: formatRWF(totalBalance),
      unpaid_invoices: invoices || [],
      overdue_invoices: (invoices || []).filter(inv => inv.status === 'overdue')
    });

  } catch (error) {
    console.error('Balance fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create invoice
router.post('/:id/billing/invoices', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { 
      tenant_id, 
      subtotal, 
      tax = 0, 
      discount = 0, 
      due_date, 
      invoice_type = 'membership',
      notes,
      items,
      created_by 
    } = req.body;

    if (!tenant_id || !subtotal || !created_by) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    const total = parseFloat(subtotal) + parseFloat(tax) - parseFloat(discount);

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        tenant_id,
        profile_id: id,
        subtotal: parseFloat(subtotal),
        tax: parseFloat(tax),
        discount: parseFloat(discount),
        total,
        due_date: due_date || new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0],
        status: 'unpaid',
        invoice_type,
        notes,
        items: items || null
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    res.status(201).json({
      ...invoice,
      formatted_subtotal: formatRWF(subtotal),
      formatted_tax: formatRWF(tax),
      formatted_discount: formatRWF(discount),
      formatted_total: formatRWF(total)
    });

  } catch (error) {
    console.error('Invoice creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process payment
router.post('/:id/billing/payments', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { 
      tenant_id, 
      amount, 
      method, 
      invoice_id,
      reference_code,
      processed_by 
    } = req.body;

    if (!tenant_id || !amount || !method || !processed_by) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    // Validate payment method
    const validMethods = ['cash', 'card', 'momo', 'bank_transfer', 'member_tab'];
    if (!validMethods.includes(method)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        tenant_id,
        profile_id: id,
        amount: parseFloat(amount),
        method,
        invoice_id: invoice_id || null,
        reference_code: reference_code || `PAY-${Date.now()}`,
        status: 'pending',
        processed_by
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    // If member tab payment, update tab balance
    if (method === 'member_tab') {
      const { data: memberTab } = await supabase
        .from('member_tabs')
        .select('balance')
        .eq('profile_id', id)
        .eq('tenant_id', tenant_id)
        .single();

      if (memberTab) {
        const newBalance = parseFloat(memberTab.balance) + parseFloat(amount);
        await supabase
          .from('member_tabs')
          .update({ balance: newBalance })
          .eq('profile_id', id)
          .eq('tenant_id', tenant_id);
      } else {
        await supabase
          .from('member_tabs')
          .insert({
            tenant_id,
            profile_id: id,
            balance: parseFloat(amount)
          });
      }
    }

    // If invoice provided, update invoice status
    if (invoice_id) {
      const { data: invoice } = await supabase
        .from('invoices')
        .select('total')
        .eq('id', invoice_id)
        .single();

      if (invoice) {
        // Check if payment covers full invoice
        if (parseFloat(amount) >= parseFloat(invoice.total)) {
          await supabase
            .from('invoices')
            .update({ status: 'paid' })
            .eq('id', invoice_id);
        }
      }
    }

    res.status(201).json({
      ...payment,
      formatted_amount: formatRWF(amount)
    });

  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// WAIVER API
// ==========================================

// Get waiver status
router.get('/:id/waiver', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'Missing tenant_id' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('waiver_signed, waiver_signed_at')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (error || !profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const isSigned = profile.waiver_signed || false;
    const signedAt = profile.waiver_signed_at;
    
    // Check if waiver is still valid (1 year from signing)
    let isValid = false;
    let expiresAt = null;
    
    if (isSigned && signedAt) {
      const signedDate = new Date(signedAt);
      const expiryDate = new Date(signedDate);
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      expiresAt = expiryDate.toISOString();
      isValid = new Date() < expiryDate;
    }

    res.json({
      signed: isSigned,
      signed_at: signedAt,
      is_valid: isValid,
      expires_at: expiresAt,
      days_until_expiry: isValid ? 
        Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24)) : null
    });

  } catch (error) {
    console.error('Waiver status fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Record waiver signature
router.post('/:id/waiver/sign', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id, signature_data, signed_by } = req.body;

    if (!tenant_id || !signed_by) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update({
        waiver_signed: true,
        waiver_signed_at: new Date().toISOString(),
        waiver_signature_data: signature_data || null
      })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (updateError) throw updateError;

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({
      ...profile,
      message: 'Waiver signed successfully'
    });

  } catch (error) {
    console.error('Waiver signature error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check waiver validity
router.get('/:id/waiver/validity', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'Missing tenant_id' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('waiver_signed, waiver_signed_at')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (error || !profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const isSigned = profile.waiver_signed || false;
    const signedAt = profile.waiver_signed_at;
    
    let validityStatus = 'not_signed';
    let daysRemaining = null;
    let expiryDate = null;

    if (isSigned && signedAt) {
      const signedDate = new Date(signedAt);
      const currentDate = new Date();
      const expiryDateObj = new Date(signedDate);
      expiryDateObj.setFullYear(expiryDateObj.getFullYear() + 1);
      expiryDate = expiryDateObj.toISOString();

      if (currentDate > expiryDateObj) {
        validityStatus = 'expired';
      } else {
        validityStatus = 'valid';
        daysRemaining = Math.ceil((expiryDateObj - currentDate) / (1000 * 60 * 60 * 24));
      }
    }

    res.json({
      validity_status: validityStatus,
      is_valid: validityStatus === 'valid',
      signed_at: signedAt,
      expires_at: expiryDate,
      days_remaining: daysRemaining,
      action_required: validityStatus !== 'valid'
    });

  } catch (error) {
    console.error('Waiver validity check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// DEPENDENTS API
// ==========================================

// List linked dependents
router.get('/:id/dependents', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'Missing tenant_id' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    const { data: familyLinks, error } = await supabase
      .from('family_links')
      .select('*, dependent:profiles!dependent_account_id(*, memberships:memberships(*))')
      .eq('master_account_id', id)
      .eq('tenant_id', tenant_id);

    if (error) throw error;

    const dependents = (familyLinks || []).map(link => ({
      link_id: link.id,
      dependent_id: link.dependent_account_id,
      name: link.dependent ? `${link.dependent.first_name} ${link.dependent.last_name}` : 'Unknown',
      email: link.dependent?.email || null,
      phone: link.dependent?.phone || null,
      relationship_type: link.relationship_type,
      membership_status: link.dependent?.memberships?.[0]?.status || 'none',
      membership_type: link.dependent?.memberships?.[0]?.membership_type || null
    }));

    res.json(dependents);

  } catch (error) {
    console.error('Dependents fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add dependent
router.post('/:id/dependents', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id } = req.params;
    const { 
      tenant_id, 
      dependent_id, 
      relationship_type,
      created_by 
    } = req.body;

    if (!tenant_id || !dependent_id || !relationship_type || !created_by) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    // Check if dependent exists and belongs to same tenant
    const { data: dependentProfile, error: dependentError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', dependent_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (dependentError || !dependentProfile) {
      return res.status(404).json({ error: 'Dependent profile not found' });
    }

    // Check if link already exists
    const { data: existingLink } = await supabase
      .from('family_links')
      .select('*')
      .eq('master_account_id', id)
      .eq('dependent_account_id', dependent_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (existingLink) {
      return res.status(400).json({ error: 'Dependent already linked to this account' });
    }

    // Create family link
    const { data: familyLink, error: linkError } = await supabase
      .from('family_links')
      .insert({
        tenant_id,
        master_account_id: id,
        dependent_account_id: dependent_id,
        relationship_type,
        created_by
      })
      .select()
      .single();

    if (linkError) throw linkError;

    res.status(201).json(familyLink);

  } catch (error) {
    console.error('Dependent addition error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove dependent
router.delete('/:id/dependents/:dependent_id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id, dependent_id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: 'Missing tenant_id' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    const { error } = await supabase
      .from('family_links')
      .delete()
      .eq('master_account_id', id)
      .eq('dependent_account_id', dependent_id)
      .eq('tenant_id', tenant_id);

    if (error) throw error;

    res.status(204).send();

  } catch (error) {
    console.error('Dependent removal error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update dependent relationship
router.put('/:id/dependents/:dependent_id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { id, dependent_id } = req.params;
    const { tenant_id, relationship_type } = req.body;

    if (!tenant_id || !relationship_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify authentication
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    // Validate tenant access
    const tenantAccess = await validateTenantAccess(authResult.user.id, tenant_id);
    if (tenantAccess.error) {
      return res.status(403).json({ error: tenantAccess.error });
    }

    const { data: familyLink, error: updateError } = await supabase
      .from('family_links')
      .update({ relationship_type })
      .eq('master_account_id', id)
      .eq('dependent_account_id', dependent_id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (updateError) throw updateError;

    if (!familyLink) {
      return res.status(404).json({ error: 'Family link not found' });
    }

    res.json(familyLink);

  } catch (error) {
    console.error('Dependent relationship update error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
// ==========================================
// GUEST PASSES & VISITOR ACCESS MANAGEMENT
// ==========================================

/**
 * GET /api/members/:id/guest-passes
 * List guest passes issued by a member.
 */
router.get('/:id/guest-passes', async (req, res) => {
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    const { id } = req.params;
    const tenant_id = req.query.tenant_id || req.headers['x-tenant-id'];
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    const { data: passes, error } = await supabase
      .from('guest_passes')
      .select('*')
      .eq('host_member_id', id)
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch member's guest pass allowance
    const { data: membership } = await supabase
      .from('memberships')
      .select('guest_pass_allowance, guest_passes_used')
      .eq('profile_id', id)
      .eq('tenant_id', tenant_id)
      .eq('status', 'active')
      .maybeSingle();

    res.json({
      success: true,
      allowance: membership?.guest_pass_allowance || 0,
      used: membership?.guest_passes_used || 0,
      remaining: Math.max(0, (membership?.guest_pass_allowance || 0) - (membership?.guest_passes_used || 0)),
      passes: passes || []
    });
  } catch (error) {
    console.error('Fetch guest passes error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/members/:id/guest-passes
 * Issue a new guest pass for a member.
 */
router.post('/:id/guest-passes', async (req, res) => {
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    const { id } = req.params;
    const { tenant_id, guest_name, guest_phone, guest_email } = req.body;
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    // Check membership and allotment
    const { data: membership, error: memError } = await supabase
      .from('memberships')
      .select('id, guest_pass_allowance, guest_passes_used')
      .eq('profile_id', id)
      .eq('tenant_id', tenant_id)
      .eq('status', 'active')
      .maybeSingle();

    if (memError || !membership) {
      return res.status(400).json({ error: 'Active membership not found for host member' });
    }

    const allowance = membership.guest_pass_allowance || 0;
    const used = membership.guest_passes_used || 0;

    if (used >= allowance) {
      return res.status(400).json({ error: 'Guest pass limit reached for this membership period' });
    }

    // Generate unique pass code
    const pass_code = 'GP-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days validity

    const { data: newPass, error: createError } = await supabase
      .from('guest_passes')
      .insert({
        tenant_id,
        host_member_id: id,
        guest_name: guest_name || null,
        guest_phone: guest_phone || null,
        guest_email: guest_email || null,
        pass_code,
        status: 'active',
        expires_at
      })
      .select()
      .single();

    if (createError) throw createError;

    // Increment guest_passes_used in membership
    await supabase
      .from('memberships')
      .update({ guest_passes_used: used + 1 })
      .eq('id', membership.id);

    res.json({
      success: true,
      pass: newPass
    });
  } catch (error) {
    console.error('Issue guest pass error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/members/guest-passes/validate
 * Validate a guest pass code.
 */
router.post('/guest-passes/validate', async (req, res) => {
  try {
    const { pass_code, tenant_id } = req.body;
    if (!pass_code || !tenant_id) {
      return res.status(400).json({ error: 'pass_code and tenant_id are required' });
    }

    const { data: pass, error } = await supabase
      .from('guest_passes')
      .select('*, profiles:host_member_id(first_name, last_name, email, phone)')
      .eq('pass_code', pass_code.toUpperCase().trim())
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (error || !pass) {
      return res.status(404).json({ error: 'Guest pass not found' });
    }

    if (pass.status !== 'active') {
      return res.status(400).json({ error: `Guest pass is already ${pass.status}` });
    }

    if (pass.expires_at && new Date(pass.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Guest pass has expired' });
    }

    res.json({
      success: true,
      pass
    });
  } catch (error) {
    console.error('Validate guest pass error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/members/guest-passes/visitor-checkin
 * Receptionist Visitor Check-In: redeems guest pass, captures visitor details, photo, signature,
 * and auto-creates a Sales Lead in `leads` table.
 */
router.post('/guest-passes/visitor-checkin', async (req, res) => {
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    const {
      tenant_id,
      guest_name,
      guest_phone,
      guest_email,
      host_member_id,
      pass_code,
      photo_url,
      waiver_signature_url,
      waiver_signed
    } = req.body;

    if (!tenant_id || !guest_name || !guest_phone) {
      return res.status(400).json({ error: 'tenant_id, guest_name, and guest_phone are required' });
    }

    let passRecord = null;
    if (pass_code) {
      const { data: foundPass } = await supabase
        .from('guest_passes')
        .select('*')
        .eq('pass_code', pass_code.toUpperCase().trim())
        .eq('tenant_id', tenant_id)
        .maybeSingle();

      if (foundPass && foundPass.status === 'active') {
        passRecord = foundPass;
      }
    }

    // Split first and last name
    const nameParts = guest_name.trim().split(' ');
    const first_name = nameParts[0];
    const last_name = nameParts.slice(1).join(' ') || 'Guest';

    // Auto-create Sales Lead in `leads` table
    const { data: newLead, error: leadError } = await supabase
      .from('leads')
      .insert({
        tenant_id,
        first_name,
        last_name,
        phone: guest_phone,
        email: guest_email || null,
        source: 'Guest Visit',
        pipeline_stage: 'New Lead',
        referred_by_id: host_member_id || passRecord?.host_member_id || null,
        notes: `Checked in as visitor on ${new Date().toISOString().split('T')[0]}. Waiver signed: ${!!waiver_signed}`
      })
      .select()
      .single();

    if (leadError) {
      console.warn('Could not auto-create lead for visitor check-in:', leadError);
    }

    const redeemed_at = new Date().toISOString();
    let updatedPass = null;

    if (passRecord) {
      const { data: uPass } = await supabase
        .from('guest_passes')
        .update({
          status: 'redeemed',
          redeemed_at,
          guest_name,
          guest_phone,
          guest_email: guest_email || passRecord.guest_email,
          photo_url: photo_url || null,
          waiver_signed: !!waiver_signed,
          waiver_signature_url: waiver_signature_url || null,
          converted_lead_id: newLead?.id || null
        })
        .eq('id', passRecord.id)
        .select()
        .single();
      updatedPass = uPass;
    } else {
      // Create a direct visitor walk-in guest pass record
      const directCode = 'VP-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: cPass } = await supabase
        .from('guest_passes')
        .insert({
          tenant_id,
          host_member_id: host_member_id || null,
          guest_name,
          guest_phone,
          guest_email: guest_email || null,
          pass_code: directCode,
          status: 'redeemed',
          redeemed_at,
          photo_url: photo_url || null,
          waiver_signed: !!waiver_signed,
          waiver_signature_url: waiver_signature_url || null,
          converted_lead_id: newLead?.id || null
        })
        .select()
        .single();
      updatedPass = cPass;
    }

    // Log check-in event in checkins or activity stream
    await supabase.from('checkins').insert({
      tenant_id,
      profile_id: host_member_id || null,
      access_method: 'guest_pass',
      status: 'granted',
      notes: `Visitor: ${guest_name} (${guest_phone})`
    }).catch(err => console.warn('Visitor checkin log failed:', err));

    res.json({
      success: true,
      message: 'Visitor checked in successfully',
      pass: updatedPass,
      lead: newLead
    });
  } catch (error) {
    console.error('Visitor check-in error:', error);
    res.status(500).json({ error: error.message });
  }
});




// ==========================================
// GUEST PASSES & VISITOR ACCESS MANAGEMENT
// ==========================================

/**
 * GET /api/members/:id/guest-passes
 * List guest passes issued by a member.
 */
router.get('/:id/guest-passes', async (req, res) => {
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    const { id } = req.params;
    const tenant_id = req.query.tenant_id || req.headers['x-tenant-id'];
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    const { data: passes, error } = await supabase
      .from('guest_passes')
      .select('*')
      .eq('host_member_id', id)
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch member's guest pass allowance
    const { data: membership } = await supabase
      .from('memberships')
      .select('guest_pass_allowance, guest_passes_used')
      .eq('profile_id', id)
      .eq('tenant_id', tenant_id)
      .eq('status', 'active')
      .maybeSingle();

    res.json({
      success: true,
      allowance: membership?.guest_pass_allowance || 0,
      used: membership?.guest_passes_used || 0,
      remaining: Math.max(0, (membership?.guest_pass_allowance || 0) - (membership?.guest_passes_used || 0)),
      passes: passes || []
    });
  } catch (error) {
    console.error('Fetch guest passes error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/members/:id/guest-passes
 * Issue a new guest pass for a member.
 */
router.post('/:id/guest-passes', async (req, res) => {
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    const { id } = req.params;
    const { tenant_id, guest_name, guest_phone, guest_email } = req.body;
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    // Check membership and allotment
    const { data: membership, error: memError } = await supabase
      .from('memberships')
      .select('id, guest_pass_allowance, guest_passes_used')
      .eq('profile_id', id)
      .eq('tenant_id', tenant_id)
      .eq('status', 'active')
      .maybeSingle();

    if (memError || !membership) {
      return res.status(400).json({ error: 'Active membership not found for host member' });
    }

    const allowance = membership.guest_pass_allowance || 0;
    const used = membership.guest_passes_used || 0;

    if (used >= allowance) {
      return res.status(400).json({ error: 'Guest pass limit reached for this membership period' });
    }

    // Generate unique pass code
    const pass_code = 'GP-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days validity

    const { data: newPass, error: createError } = await supabase
      .from('guest_passes')
      .insert({
        tenant_id,
        host_member_id: id,
        guest_name: guest_name || null,
        guest_phone: guest_phone || null,
        guest_email: guest_email || null,
        pass_code,
        status: 'active',
        expires_at
      })
      .select()
      .single();

    if (createError) throw createError;

    // Increment guest_passes_used in membership
    await supabase
      .from('memberships')
      .update({ guest_passes_used: used + 1 })
      .eq('id', membership.id);

    res.json({
      success: true,
      pass: newPass
    });
  } catch (error) {
    console.error('Issue guest pass error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/members/guest-passes/validate
 * Validate a guest pass code.
 */
router.post('/guest-passes/validate', async (req, res) => {
  try {
    const { pass_code, tenant_id } = req.body;
    if (!pass_code || !tenant_id) {
      return res.status(400).json({ error: 'pass_code and tenant_id are required' });
    }

    const { data: pass, error } = await supabase
      .from('guest_passes')
      .select('*, profiles:host_member_id(first_name, last_name, email, phone)')
      .eq('pass_code', pass_code.toUpperCase().trim())
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (error || !pass) {
      return res.status(404).json({ error: 'Guest pass not found' });
    }

    if (pass.status !== 'active') {
      return res.status(400).json({ error: `Guest pass is already ${pass.status}` });
    }

    if (pass.expires_at && new Date(pass.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Guest pass has expired' });
    }

    res.json({
      success: true,
      pass
    });
  } catch (error) {
    console.error('Validate guest pass error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/members/guest-passes/visitor-checkin
 * Receptionist Visitor Check-In: redeems guest pass, captures visitor details, photo, signature,
 * and auto-creates a Sales Lead in `leads` table.
 */
router.post('/guest-passes/visitor-checkin', async (req, res) => {
  try {
    const authResult = await verifyAuthToken(req);
    if (authResult.error) {
      return res.status(401).json({ error: authResult.error });
    }

    const {
      tenant_id,
      guest_name,
      guest_phone,
      guest_email,
      host_member_id,
      pass_code,
      photo_url,
      waiver_signature_url,
      waiver_signed
    } = req.body;

    if (!tenant_id || !guest_name || !guest_phone) {
      return res.status(400).json({ error: 'tenant_id, guest_name, and guest_phone are required' });
    }

    let passRecord = null;
    if (pass_code) {
      const { data: foundPass } = await supabase
        .from('guest_passes')
        .select('*')
        .eq('pass_code', pass_code.toUpperCase().trim())
        .eq('tenant_id', tenant_id)
        .maybeSingle();

      if (foundPass && foundPass.status === 'active') {
        passRecord = foundPass;
      }
    }

    // Split first and last name
    const nameParts = guest_name.trim().split(' ');
    const first_name = nameParts[0];
    const last_name = nameParts.slice(1).join(' ') || 'Guest';

    // Auto-create Sales Lead in `leads` table
    const { data: newLead, error: leadError } = await supabase
      .from('leads')
      .insert({
        tenant_id,
        first_name,
        last_name,
        phone: guest_phone,
        email: guest_email || null,
        source: 'Guest Visit',
        pipeline_stage: 'New Lead',
        referred_by_id: host_member_id || passRecord?.host_member_id || null,
        notes: `Checked in as visitor on ${new Date().toISOString().split('T')[0]}. Waiver signed: ${!!waiver_signed}`
      })
      .select()
      .single();

    if (leadError) {
      console.warn('Could not auto-create lead for visitor check-in:', leadError);
    }

    const redeemed_at = new Date().toISOString();
    let updatedPass = null;

    if (passRecord) {
      const { data: uPass } = await supabase
        .from('guest_passes')
        .update({
          status: 'redeemed',
          redeemed_at,
          guest_name,
          guest_phone,
          guest_email: guest_email || passRecord.guest_email,
          photo_url: photo_url || null,
          waiver_signed: !!waiver_signed,
          waiver_signature_url: waiver_signature_url || null,
          converted_lead_id: newLead?.id || null
        })
        .eq('id', passRecord.id)
        .select()
        .single();
      updatedPass = uPass;
    } else {
      // Create a direct visitor walk-in guest pass record
      const directCode = 'VP-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: cPass } = await supabase
        .from('guest_passes')
        .insert({
          tenant_id,
          host_member_id: host_member_id || null,
          guest_name,
          guest_phone,
          guest_email: guest_email || null,
          pass_code: directCode,
          status: 'redeemed',
          redeemed_at,
          photo_url: photo_url || null,
          waiver_signed: !!waiver_signed,
          waiver_signature_url: waiver_signature_url || null,
          converted_lead_id: newLead?.id || null
        })
        .select()
        .single();
      updatedPass = cPass;
    }

    // Log check-in event in checkins or activity stream
    await supabase.from('checkins').insert({
      tenant_id,
      profile_id: host_member_id || null,
      access_method: 'guest_pass',
      status: 'granted',
      notes: `Visitor: ${guest_name} (${guest_phone})`
    }).catch(err => console.warn('Visitor checkin log failed:', err));

    res.json({
      success: true,
      message: 'Visitor checked in successfully',
      pass: updatedPass,
      lead: newLead
    });
  } catch (error) {
    console.error('Visitor check-in error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
