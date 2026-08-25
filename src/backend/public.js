const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const gymEmitter = require('./events');
const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

/**
 * Generate a random uppercase referral / voucher code.
 */
function generateCode(prefix = 'REF') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${result}`;
}

// ==========================================
// 1. PUBLIC GYM CONFIG & SCHEDULE OPTIONS
// ==========================================

/**
 * GET /api/public/config/:tenant_id
 * Returns public gym profile, branding, available tour times, classes, and membership plans.
 */
router.get('/config/:tenant_id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const { tenant_id } = req.params;

    if (!tenant_id) {
      return res.status(400).json({ error: 'Missing tenant_id parameter' });
    }

    // Fetch tenant branding & public info
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, logo_url, address, contact_email, phone_number, primary_color, secondary_color, branding_settings, operating_hours, default_currency')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenant) {
      return res.status(404).json({ error: 'Gym tenant not found' });
    }

    // Fetch upcoming public classes/schedules for trial bookings (next 7 days)
    const today = new Date().toISOString();
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: schedules } = await supabase
      .from('class_schedules')
      .select('id, category_id, trainer_id, start_time, end_time, capacity, booked_count, class_categories(name, description, color)')
      .eq('tenant_id', tenant_id)
      .gte('start_time', today)
      .lte('start_time', nextWeek)
      .order('start_time', { ascending: true })
      .limit(20);

    // Standard public plans
    const membershipPlans = [
      { id: 'standard', name: 'Standard Membership', price_rwf: 30000, interval: 'monthly', description: 'Full gym floor & cardio access' },
      { id: 'premium', name: 'Premium All-Access', price_rwf: 50000, interval: 'monthly', description: 'Gym + unlimited group fitness & sauna' },
      { id: 'vip', name: 'VIP Executive', price_rwf: 80000, interval: 'monthly', description: 'All-Access + 2x Personal Training & recovery lounge' }
    ];

    res.json({
      gym: {
        id: tenant.id,
        name: tenant.name,
        logo_url: tenant.logo_url,
        address: tenant.address || 'Kigali, Rwanda',
        contact_email: tenant.contact_email,
        phone_number: tenant.phone_number || '+250 788 000 000',
        primary_color: tenant.primary_color || '#2563eb',
        secondary_color: tenant.secondary_color || '#1e293b',
        currency: tenant.default_currency || 'RWF',
        operating_hours: tenant.operating_hours || 'Mon - Sat: 6:00 AM - 10:00 PM'
      },
      classes: schedules || [],
      plans: membershipPlans,
      referral_reward_rwf: 10000
    });

  } catch (error) {
    console.error('[public/config] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// 2. PUBLIC SCHEDULE / TOUR BOOKING
// ==========================================

/**
 * POST /api/public/schedule
 * Unauthenticated endpoint for prospective leads to schedule a gym tour or book a trial class.
 */
router.post('/schedule', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const {
      tenant_id,
      first_name,
      last_name,
      email,
      phone,
      tour_date,
      class_schedule_id,
      notes,
      referral_code
    } = req.body;

    if (!tenant_id || !first_name || !last_name || !phone) {
      return res.status(400).json({ error: 'Missing required fields: tenant_id, first_name, last_name, phone' });
    }

    // Verify tenant exists
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', tenant_id)
      .single();

    if (tenantErr || !tenant) {
      return res.status(404).json({ error: 'Invalid gym tenant ID' });
    }

    // Check referral code attribution if provided
    let referrerProfileId = null;
    if (referral_code) {
      const cleanCode = referral_code.trim().toUpperCase();
      const { data: referrer } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('tenant_id', tenant_id)
        .eq('referral_code', cleanCode)
        .maybeSingle();

      if (referrer) {
        referrerProfileId = referrer.id;
      }
    }

    // Check if lead already exists by phone & tenant_id
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id, pipeline_stage')
      .eq('tenant_id', tenant_id)
      .eq('phone', phone.trim())
      .maybeSingle();

    let leadRecord;
    const tourTimestamp = tour_date ? new Date(tour_date).toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    if (existingLead) {
      // Update existing lead with tour date & transition to tour_scheduled
      const { data: updated, error: updateErr } = await supabase
        .from('leads')
        .update({
          first_name,
          last_name,
          email: email || undefined,
          pipeline_stage: 'tour_scheduled',
          stage_entered_at: new Date().toISOString(),
          tour_date: tourTimestamp,
          referred_by_id: referrerProfileId || undefined,
          referral_code_used: referral_code ? referral_code.trim().toUpperCase() : undefined,
          notes: notes ? `Tour booked via Web Widget: ${notes}` : 'Tour booked via Web Widget',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingLead.id)
        .select()
        .single();

      if (updateErr) throw updateErr;
      leadRecord = updated;

      // Log stage transition history
      await supabase.from('lead_stage_history').insert({
        tenant_id,
        lead_id: existingLead.id,
        from_stage: existingLead.pipeline_stage,
        to_stage: 'tour_scheduled',
        trigger_source: 'widget_booking',
        notes: `Tour scheduled for ${new Date(tourTimestamp).toLocaleString()}`
      });

    } else {
      // Insert brand new lead in 'tour_scheduled'
      const { data: created, error: insertErr } = await supabase
        .from('leads')
        .insert({
          tenant_id,
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          email: email ? email.trim() : null,
          phone: phone.trim(),
          pipeline_stage: 'tour_scheduled',
          stage_entered_at: new Date().toISOString(),
          source: 'web_widget',
          tour_date: tourTimestamp,
          referred_by_id: referrerProfileId,
          referral_code_used: referral_code ? referral_code.trim().toUpperCase() : null,
          notes: notes ? `Tour booked via Web Widget: ${notes}` : 'Tour booked via Web Widget',
          custom_fields: class_schedule_id ? { class_schedule_id } : {}
        })
        .select()
        .single();

      if (insertErr) throw insertErr;
      leadRecord = created;

      // Log initial stage history
      await supabase.from('lead_stage_history').insert({
        tenant_id,
        lead_id: created.id,
        from_stage: null,
        to_stage: 'tour_scheduled',
        trigger_source: 'widget_booking',
        notes: `New lead booked tour for ${new Date(tourTimestamp).toLocaleString()}`
      });
    }

    // If referral code was used, create or update referral attribution record
    if (referrerProfileId && leadRecord) {
      await supabase.from('referral_rewards').upsert({
        tenant_id,
        referrer_profile_id: referrerProfileId,
        referee_lead_id: leadRecord.id,
        referral_code: referral_code.trim().toUpperCase(),
        status: 'pending',
        reward_amount_rwf: 10000
      }, { onConflict: 'referrer_profile_id, referee_lead_id' });
    }

    // Queue confirmation notification (SMS / Email)
    const formattedDate = new Date(tourTimestamp).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    await supabase.from('notification_queue').insert({
      tenant_id,
      profile_id: null,
      channel: 'sms',
      recipient: phone.trim(),
      subject: 'Gym Tour Confirmed',
      content: `Hello ${first_name}! Your VIP tour at ${tenant.name} is confirmed for ${formattedDate}. We look forward to welcoming you!`,
      status: 'pending'
    });

    // Log communication
    await supabase.from('communications_log').insert({
      tenant_id,
      profile_id: null,
      channel: 'sms',
      direction: 'outbound',
      status: 'pending',
      content: `[Automated] Tour Confirmation SMS dispatched for ${formattedDate}`
    });

    // Emit event for socket/dashboard listeners
    gymEmitter.emit('lead.tour_scheduled', {
      tenant_id,
      lead_id: leadRecord.id,
      name: `${first_name} ${last_name}`,
      phone,
      tour_date: tourTimestamp
    });

    res.status(201).json({
      success: true,
      message: 'Tour scheduled successfully',
      lead: {
        id: leadRecord.id,
        first_name: leadRecord.first_name,
        last_name: leadRecord.last_name,
        tour_date: leadRecord.tour_date,
        pipeline_stage: leadRecord.pipeline_stage
      }
    });

  } catch (error) {
    console.error('[public/schedule] error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ==========================================
// 3. PUBLIC JOIN / WEB SIGN-UP
// ==========================================

/**
 * POST /api/public/join
 * Unauthenticated endpoint for public web registration, free trial signup, or membership onboarding.
 */
router.post('/join', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });

  try {
    const {
      tenant_id,
      first_name,
      last_name,
      email,
      phone,
      membership_type = 'standard',
      is_free_trial = true,
      promo_code,
      referral_code,
      notes
    } = req.body;

    if (!tenant_id || !first_name || !last_name || !phone) {
      return res.status(400).json({ error: 'Missing required fields: tenant_id, first_name, last_name, phone' });
    }

    // Verify tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', tenant_id)
      .single();

    if (tenantErr || !tenant) {
      return res.status(404).json({ error: 'Gym tenant not found' });
    }

    // 1. Check referral code if provided
    let referrerProfile = null;
    if (referral_code) {
      const cleanRefCode = referral_code.trim().toUpperCase();
      const { data: refData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone')
        .eq('tenant_id', tenant_id)
        .eq('referral_code', cleanRefCode)
        .maybeSingle();

      if (refData) {
        referrerProfile = refData;
      }
    }

    // 2. If is_free_trial = true, create or update Lead in 'trial_active' stage
    if (is_free_trial) {
      const today = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Check existing lead
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id, pipeline_stage')
        .eq('tenant_id', tenant_id)
        .eq('phone', phone.trim())
        .maybeSingle();

      let lead;
      if (existingLead) {
        const { data: upd, error: updErr } = await supabase
          .from('leads')
          .update({
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            email: email ? email.trim() : undefined,
            pipeline_stage: 'trial_active',
            stage_entered_at: new Date().toISOString(),
            trial_start_date: today,
            trial_end_date: endDate,
            referred_by_id: referrerProfile ? referrerProfile.id : undefined,
            referral_code_used: referral_code ? referral_code.trim().toUpperCase() : undefined,
            notes: notes ? `Free Trial via Widget: ${notes}` : 'Free 7-Day Trial via Widget',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingLead.id)
          .select()
          .single();

        if (updErr) throw updErr;
        lead = upd;

        await supabase.from('lead_stage_history').insert({
          tenant_id,
          lead_id: existingLead.id,
          from_stage: existingLead.pipeline_stage,
          to_stage: 'trial_active',
          trigger_source: 'widget_signup',
          notes: `7-Day Free Trial activated (${today} to ${endDate})`
        });
      } else {
        const { data: ins, error: insErr } = await supabase
          .from('leads')
          .insert({
            tenant_id,
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            email: email ? email.trim() : null,
            phone: phone.trim(),
            pipeline_stage: 'trial_active',
            stage_entered_at: new Date().toISOString(),
            source: 'web_widget',
            trial_start_date: today,
            trial_end_date: endDate,
            referred_by_id: referrerProfile ? referrerProfile.id : null,
            referral_code_used: referral_code ? referral_code.trim().toUpperCase() : null,
            notes: notes ? `Free Trial via Widget: ${notes}` : 'Free 7-Day Trial via Widget'
          })
          .select()
          .single();

        if (insErr) throw insErr;
        lead = ins;

        await supabase.from('lead_stage_history').insert({
          tenant_id,
          lead_id: ins.id,
          from_stage: null,
          to_stage: 'trial_active',
          trigger_source: 'widget_signup',
          notes: `New lead started 7-Day Free Trial (${today} to ${endDate})`
        });
      }

      // Record referral attribution
      if (referrerProfile && lead) {
        await supabase.from('referral_rewards').upsert({
          tenant_id,
          referrer_profile_id: referrerProfile.id,
          referee_lead_id: lead.id,
          referral_code: referral_code.trim().toUpperCase(),
          status: 'pending',
          reward_amount_rwf: 10000
        }, { onConflict: 'referrer_profile_id, referee_lead_id' });
      }

      // Send Welcome SMS
      await supabase.from('notification_queue').insert({
        tenant_id,
        profile_id: null,
        channel: 'sms',
        recipient: phone.trim(),
        subject: 'Trial Activated',
        content: `Welcome to ${tenant.name}, ${first_name}! Your 7-day VIP pass is active through ${endDate}. Show this SMS at reception to begin.`,
        status: 'pending'
      });

      gymEmitter.emit('lead.trial_started', {
        tenant_id,
        lead_id: lead.id,
        name: `${first_name} ${last_name}`,
        phone,
        trial_end_date: endDate
      });

      return res.status(201).json({
        success: true,
        type: 'trial',
        message: '7-day trial activated successfully',
        lead: {
          id: lead.id,
          first_name: lead.first_name,
          last_name: lead.last_name,
          trial_start_date: today,
          trial_end_date: endDate,
          pipeline_stage: 'trial_active'
        }
      });
    }

    // 3. Direct Membership Join Workflow
    // Generate unique referral code for the new member
    const newMemberReferralCode = generateCode(`GP-${first_name.slice(0, 3).toUpperCase()}`);

    // Create or find Profile
    let profile;
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('phone', phone.trim())
      .maybeSingle();

    if (existingProfile) {
      profile = existingProfile;
    } else {
      const { data: newProfile, error: profErr } = await supabase
        .from('profiles')
        .insert({
          tenant_id,
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          email: email ? email.trim() : null,
          phone: phone.trim(),
          role: 'member',
          status: 'active',
          membership_status: 'active',
          referral_code: newMemberReferralCode,
          referred_by_id: referrerProfile ? referrerProfile.id : null
        })
        .select()
        .single();

      if (profErr) throw profErr;
      profile = newProfile;
    }

    // Create Membership record
    const planPrices = { standard: 30000, premium: 50000, vip: 80000 };
    const price = planPrices[membership_type.toLowerCase()] || 30000;
    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: membership, error: memErr } = await supabase
      .from('memberships')
      .insert({
        tenant_id,
        profile_id: profile.id,
        membership_type: membership_type.toUpperCase(),
        start_date: today,
        end_date: nextMonth,
        status: 'active',
        price: price,
        billing_interval: 'monthly'
      })
      .select()
      .single();

    if (memErr) console.error('Membership create error:', memErr);

    // If referee was referred by an existing member, fulfill referral reward!
    let rewardVoucher = null;
    if (referrerProfile) {
      const voucherCode = generateCode('VOUCH');
      const rewardAmount = 10000;
      const voucherExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      // Create gift voucher
      const { data: voucher, error: vouchErr } = await supabase
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

      if (!vouchErr && voucher) {
        rewardVoucher = voucher;

        // Record completed referral reward
        await supabase.from('referral_rewards').insert({
          tenant_id,
          referrer_profile_id: referrerProfile.id,
          referee_profile_id: profile.id,
          referral_code: referral_code.trim().toUpperCase(),
          status: 'rewarded',
          reward_voucher_id: voucher.id,
          reward_amount_rwf: rewardAmount,
          reward_applied_at: new Date().toISOString()
        });

        // Notify Referrer
        await supabase.from('notification_queue').insert({
          tenant_id,
          profile_id: referrerProfile.id,
          channel: 'sms',
          recipient: referrerProfile.phone || 'member@example.com',
          subject: 'Referral Reward Earned! 🎉',
          content: `Awesome news! Your friend ${first_name} just joined ${tenant.name}. You earned a RWF 10,000 credit voucher: ${voucherCode}. Present it at front desk anytime!`,
          status: 'pending'
        });
      }
    }

    // Welcome notification to new member
    await supabase.from('notification_queue').insert({
      tenant_id,
      profile_id: profile.id,
      channel: 'sms',
      recipient: phone.trim(),
      subject: 'Welcome to GymPartner',
      content: `Welcome to ${tenant.name}! Your membership is active. Share your referral code [${newMemberReferralCode}] with friends to earn RWF 10,000 for each friend who joins!`,
      status: 'pending'
    });

    gymEmitter.emit('member.registered', {
      tenant_id,
      profile_id: profile.id,
      name: `${first_name} ${last_name}`,
      membership_type
    });

    res.status(201).json({
      success: true,
      type: 'membership',
      message: 'Membership created successfully',
      profile: {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        referral_code: profile.referral_code
      },
      membership: membership || null,
      reward_applied: rewardVoucher ? true : false
    });

  } catch (error) {
    console.error('[public/join] error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ==========================================
// 4. EMBEDDABLE WIDGET JAVASCRIPT BUNDLE
// ==========================================

/**
 * GET /api/public/widget.js
 * Serves lightweight standalone JavaScript widget for gym websites.
 */
router.get('/widget.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  const widgetScript = `
(function() {
  const currentScript = document.currentScript || (function() {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  const backendOrigin = currentScript ? (new URL(currentScript.src)).origin : 'https://gym-backend-core.onrender.com';
  const tenantId = currentScript ? currentScript.getAttribute('data-tenant-id') : null;
  const mode = (currentScript ? currentScript.getAttribute('data-mode') : 'schedule') || 'schedule';
  const targetId = currentScript ? currentScript.getAttribute('data-target') : 'gympartner-widget';

  if (!tenantId) {
    console.warn('[GymPartner Widget] Missing data-tenant-id attribute on script tag.');
    return;
  }

  // Create UI Container
  function initWidget() {
    let container = document.getElementById(targetId);
    if (!container) {
      container = document.createElement('div');
      container.id = targetId;
      document.body.appendChild(container);
    }

    container.innerHTML = '<div style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; padding: 20px; border-radius: 12px; background: #ffffff; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 440px; margin: 0 auto;">' +
      '<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 16px;">' +
        '<h3 id="gp-gym-name" style="margin:0; font-size: 18px; font-weight: 700; color: #0f172a;">GymPartner</h3>' +
        '<span style="font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 999px; background: #dbeafe; color: #1e40af;">' + (mode === 'join' ? 'Online Sign-up' : 'Book Free Tour') + '</span>' +
      '</div>' +
      '<div id="gp-form-body">' +
        '<div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">' +
          '<div><label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">First Name</label><input id="gp-first-name" type="text" placeholder="John" style="width:100%; box-sizing:border-box; padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; font-size:14px;" /></div>' +
          '<div><label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Last Name</label><input id="gp-last-name" type="text" placeholder="Doe" style="width:100%; box-sizing:border-box; padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; font-size:14px;" /></div>' +
        '</div>' +
        '<div style="margin-bottom: 12px;"><label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Phone Number (WhatsApp)</label><input id="gp-phone" type="tel" placeholder="+250 788 123 456" style="width:100%; box-sizing:border-box; padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; font-size:14px;" /></div>' +
        '<div style="margin-bottom: 12px;"><label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Email (Optional)</label><input id="gp-email" type="email" placeholder="john@example.com" style="width:100%; box-sizing:border-box; padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; font-size:14px;" /></div>' +
        (mode === 'schedule' ?
          '<div style="margin-bottom: 12px;"><label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Preferred Tour Date & Time</label><input id="gp-date" type="datetime-local" style="width:100%; box-sizing:border-box; padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; font-size:14px;" /></div>' :
          '<div style="margin-bottom: 12px;"><label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Membership Option</label><select id="gp-plan" style="width:100%; box-sizing:border-box; padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; font-size:14px;"><option value="standard">Standard (RWF 30,000/mo)</option><option value="premium">Premium All-Access (RWF 50,000/mo)</option><option value="vip">VIP Executive (RWF 80,000/mo)</option></select></div>'
        ) +
        '<div style="margin-bottom: 16px;"><label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Friend Referral Code (Optional)</label><input id="gp-ref-code" type="text" placeholder="e.g. GP-ALICE88" style="width:100%; box-sizing:border-box; padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; font-size:14px; text-transform:uppercase;" /></div>' +
        '<button id="gp-submit-btn" style="width:100%; background:#2563eb; color:#ffffff; font-weight:600; padding:12px; border-radius:8px; border:none; cursor:pointer; font-size:15px; transition:background 0.2s;">' + (mode === 'join' ? 'Activate Membership' : 'Book Free Tour Pass') + '</button>' +
        '<div id="gp-msg" style="margin-top:12px; font-size:13px; text-align:center; display:none;"></div>' +
      '</div>' +
    '</div>';

    // Fetch tenant config
    fetch(backendOrigin + '/api/public/config/' + tenantId)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.gym) {
          const gymTitle = document.getElementById('gp-gym-name');
          if (gymTitle) gymTitle.textContent = data.gym.name;
          const btn = document.getElementById('gp-submit-btn');
          if (btn && data.gym.primary_color) btn.style.background = data.gym.primary_color;
        }
      })
      .catch(function(e) { console.error('[GymPartner Widget] Config fetch failed:', e); });

    // Handle submit
    const submitBtn = document.getElementById('gp-submit-btn');
    submitBtn.addEventListener('click', function() {
      const firstName = (document.getElementById('gp-first-name').value || '').trim();
      const lastName = (document.getElementById('gp-last-name').value || '').trim();
      const phone = (document.getElementById('gp-phone').value || '').trim();
      const email = (document.getElementById('gp-email').value || '').trim();
      const refCode = (document.getElementById('gp-ref-code').value || '').trim();
      const msg = document.getElementById('gp-msg');

      if (!firstName || !lastName || !phone) {
        msg.style.display = 'block';
        msg.style.color = '#dc2626';
        msg.textContent = 'Please fill in your name and phone number.';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      msg.style.display = 'none';

      const endpoint = mode === 'join' ? '/api/public/join' : '/api/public/schedule';
      const payload = {
        tenant_id: tenantId,
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        email: email || null,
        referral_code: refCode || null
      };

      if (mode === 'schedule') {
        const dateVal = document.getElementById('gp-date').value;
        payload.tour_date = dateVal ? new Date(dateVal).toISOString() : new Date().toISOString();
      } else {
        payload.membership_type = document.getElementById('gp-plan').value;
        payload.is_free_trial = false;
      }

      fetch(backendOrigin + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(function(r) { return r.json(); })
      .then(function(resData) {
        submitBtn.disabled = false;
        submitBtn.textContent = mode === 'join' ? 'Activate Membership' : 'Book Free Tour Pass';
        msg.style.display = 'block';
        if (resData.success) {
          msg.style.color = '#16a34a';
          msg.textContent = '🎉 Success! ' + (resData.message || 'Check your SMS for confirmation details.');
          document.getElementById('gp-form-body').reset ? document.getElementById('gp-form-body').reset() : null;
        } else {
          msg.style.color = '#dc2626';
          msg.textContent = resData.error || 'Submission failed. Please try again.';
        }
      })
      .catch(function(err) {
        submitBtn.disabled = false;
        submitBtn.textContent = mode === 'join' ? 'Activate Membership' : 'Book Free Tour Pass';
        msg.style.display = 'block';
        msg.style.color = '#dc2626';
        msg.textContent = 'Network error. Please try again.';
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
  `;

  res.send(widgetScript);
});

module.exports = router;
