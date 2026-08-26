const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const gymEmitter = require('./events');
require('dotenv').config();

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

/**
 * GET /api/tiers/plans
 * Query: ?tenant_id=<uuid>
 * Returns all active tier plans for the tenant.
 */
router.get('/plans', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const { data: plans, error } = await supabase
      .from('membership_plans')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .order('tier_level', { ascending: true });

    if (error) throw error;

    res.json({ success: true, plans: plans || [] });
  } catch (error) {
    console.error('[tiers/plans GET] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tiers/calculate-proration
 * Calculates mid-cycle proration breakdown between current membership and target plan.
 * Body: { tenant_id, profile_id, target_plan_id, as_of_date? }
 */
router.post('/calculate-proration', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { tenant_id, profile_id, target_plan_id, as_of_date } = req.body;

    if (!tenant_id || !profile_id || !target_plan_id) {
      return res.status(400).json({ error: 'Missing required parameters (tenant_id, profile_id, target_plan_id)' });
    }

    // 1. Fetch current active membership
    const { data: membership, error: memError } = await supabase
      .from('memberships')
      .select('*')
      .eq('profile_id', profile_id)
      .eq('tenant_id', tenant_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (memError || !membership) {
      return res.status(404).json({ error: 'No active membership found for profile' });
    }

    // 2. Fetch target plan
    const { data: targetPlan, error: planError } = await supabase
      .from('membership_plans')
      .select('*')
      .eq('id', target_plan_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (planError || !targetPlan) {
      return res.status(404).json({ error: 'Target membership plan not found' });
    }

    // 3. Compute Dates and Days
    const today = as_of_date ? new Date(as_of_date) : new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(membership.start_date);
    startDate.setHours(0, 0, 0, 0);

    // If end_date is null or past, default cycle to 30 days from start_date
    let endDate = membership.end_date ? new Date(membership.end_date) : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    endDate.setHours(0, 0, 0, 0);

    if (endDate <= startDate) {
      endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const totalCycleDays = Math.max(1, Math.round((endDate - startDate) / MS_PER_DAY));
    
    // Days elapsed so far
    let daysElapsed = Math.round((today - startDate) / MS_PER_DAY);
    daysElapsed = Math.max(0, Math.min(totalCycleDays, daysElapsed));

    // Days remaining in cycle
    const daysRemaining = Math.max(0, totalCycleDays - daysElapsed);

    // 4. Financial Calculations
    const currentPrice = parseFloat(membership.price || 0);
    const targetPrice = parseFloat(targetPlan.price || 0);

    const currentDailyRate = currentPrice / totalCycleDays;
    const unconsumedCredit = Math.round(currentDailyRate * daysRemaining * 100) / 100;

    const targetDailyRate = targetPrice / totalCycleDays;
    const newTierCostRemaining = Math.round(targetDailyRate * daysRemaining * 100) / 100;

    // Delta due
    const netDelta = Math.round((newTierCostRemaining - unconsumedCredit) * 100) / 100;
    const changeType = targetPrice >= currentPrice ? 'upgrade' : 'downgrade';

    res.json({
      success: true,
      current_membership: {
        id: membership.id,
        tier: membership.membership_type,
        price: currentPrice,
        start_date: membership.start_date,
        end_date: membership.end_date,
        billing_interval: membership.billing_interval || 'monthly'
      },
      target_plan: {
        id: targetPlan.id,
        name: targetPlan.name,
        code: targetPlan.code,
        price: targetPrice,
        tier_level: targetPlan.tier_level,
        access_features: targetPlan.access_features || [],
        currency: targetPlan.currency || 'RWF'
      },
      proration: {
        total_cycle_days: totalCycleDays,
        days_elapsed: daysElapsed,
        days_remaining: daysRemaining,
        current_daily_rate: Math.round(currentDailyRate * 100) / 100,
        unconsumed_credit: unconsumedCredit,
        target_daily_rate: Math.round(targetDailyRate * 100) / 100,
        new_tier_cost_remaining: newTierCostRemaining,
        net_delta_amount: netDelta,
        change_type: changeType,
        currency: targetPlan.currency || 'RWF'
      }
    });
  } catch (error) {
    console.error('[tiers/calculate-proration POST] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tiers/apply-tier-change
 * Executes the membership tier upgrade/downgrade with immediate gate access & delta invoice.
 * Body: { tenant_id, profile_id, target_plan_id, proration_mode?, payment_method?, reason?, notes? }
 */
router.post('/apply-tier-change', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const {
      tenant_id,
      profile_id,
      target_plan_id,
      proration_mode = 'immediate_prorated',
      payment_method = 'momo',
      reason = 'Member requested plan change',
      notes
    } = req.body;

    if (!tenant_id || !profile_id || !target_plan_id) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // 1. Fetch current active membership
    const { data: membership, error: memError } = await supabase
      .from('memberships')
      .select('*')
      .eq('profile_id', profile_id)
      .eq('tenant_id', tenant_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (memError || !membership) {
      return res.status(404).json({ error: 'No active membership found for profile' });
    }

    // 2. Fetch target plan
    const { data: targetPlan, error: planError } = await supabase
      .from('membership_plans')
      .select('*')
      .eq('id', target_plan_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (planError || !targetPlan) {
      return res.status(404).json({ error: 'Target plan not found' });
    }

    // 3. Compute Proration
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(membership.start_date);
    startDate.setHours(0, 0, 0, 0);

    let endDate = membership.end_date ? new Date(membership.end_date) : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    endDate.setHours(0, 0, 0, 0);
    if (endDate <= startDate) endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const totalCycleDays = Math.max(1, Math.round((endDate - startDate) / MS_PER_DAY));
    let daysElapsed = Math.max(0, Math.min(totalCycleDays, Math.round((today - startDate) / MS_PER_DAY)));
    const daysRemaining = Math.max(0, totalCycleDays - daysElapsed);

    const currentPrice = parseFloat(membership.price || 0);
    const targetPrice = parseFloat(targetPlan.price || 0);

    const unconsumedCredit = Math.round((currentPrice / totalCycleDays) * daysRemaining * 100) / 100;
    const newTierCostRemaining = Math.round((targetPrice / totalCycleDays) * daysRemaining * 100) / 100;
    const netDelta = Math.round((newTierCostRemaining - unconsumedCredit) * 100) / 100;
    const changeType = targetPrice >= currentPrice ? 'upgrade' : 'downgrade';

    let createdInvoice = null;

    // 4. Handle Delta Invoicing & Membership Update
    if (proration_mode === 'immediate_prorated') {
      // If there is a positive delta charge (upgrade), create invoice
      if (netDelta > 0) {
        const { data: inv, error: invErr } = await supabase
          .from('invoices')
          .insert({
            tenant_id,
            profile_id,
            status: 'paid',
            subtotal: netDelta,
            tax: 0,
            total: netDelta,
            due_date: new Date().toISOString().split('T')[0],
            paid_at: new Date().toISOString()
          })
          .select()
          .single();
        if (invErr) console.error('Invoice creation error:', invErr);
        createdInvoice = inv;
      }

      // Update membership immediately to target plan
      const { error: updateMemErr } = await supabase
        .from('memberships')
        .update({
          membership_type: targetPlan.name,
          price: targetPlan.price,
          billing_interval: targetPlan.billing_interval || membership.billing_interval,
          updated_at: new Date().toISOString()
        })
        .eq('id', membership.id);

      if (updateMemErr) throw updateMemErr;
    }

    // 5. Record Tier Change Audit
    const { data: tierChange, error: tcError } = await supabase
      .from('membership_tier_changes')
      .insert({
        tenant_id,
        membership_id: membership.id,
        profile_id,
        previous_tier: membership.membership_type,
        previous_price: currentPrice,
        new_tier: targetPlan.name,
        new_price: targetPrice,
        change_type: changeType,
        proration_mode,
        total_cycle_days: totalCycleDays,
        days_elapsed: daysElapsed,
        days_remaining: daysRemaining,
        unconsumed_credit: unconsumedCredit,
        new_tier_cost_remaining: newTierCostRemaining,
        delta_amount: netDelta,
        invoice_id: createdInvoice ? createdInvoice.id : null,
        status: 'completed',
        effective_date: proration_mode === 'scheduled_next_cycle' ? membership.end_date : new Date().toISOString().split('T')[0],
        reason: reason || null,
        notes: notes || null
      })
      .select()
      .single();

    if (tcError) throw tcError;

    // 6. Emit Tier Change Event
    gymEmitter.emit('membership.tier_changed', {
      tenant_id,
      profile_id,
      membership_id: membership.id,
      change_type: changeType,
      previous_tier: membership.membership_type,
      new_tier: targetPlan.name,
      delta_amount: netDelta,
      proration_mode
    });

    res.json({
      success: true,
      message: `Membership successfully changed from ${membership.membership_type} to ${targetPlan.name}`,
      tier_change: tierChange,
      invoice: createdInvoice
    });
  } catch (error) {
    console.error('[tiers/apply-tier-change POST] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/tiers/history/:profile_id
 * Returns tier change history for a member.
 * Query: ?tenant_id=<uuid>
 */
router.get('/history/:profile_id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { profile_id } = req.params;
    const { tenant_id } = req.query;

    if (!profile_id || !tenant_id) {
      return res.status(400).json({ error: 'Missing profile_id or tenant_id' });
    }

    const { data: history, error } = await supabase
      .from('membership_tier_changes')
      .select('*')
      .eq('profile_id', profile_id)
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, history: history || [] });
  } catch (error) {
    console.error('[tiers/history GET] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
