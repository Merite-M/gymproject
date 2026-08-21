const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// Helper function to verify JWT token and extract user
async function verifyAuthToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return { error: 'Missing Authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { error: 'Invalid or expired token' };
  }

  return { user };
}

// Helper function to format RWF currency
function formatRWF(amount) {
  return `RWF ${parseFloat(amount).toLocaleString('en-RW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
}

// Helper function to validate tenant access
async function validateTenantAccess(userId, tenantId) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    return { error: 'User profile not found' };
  }

  if (profile.tenant_id !== tenantId && profile.role !== 'super_admin') {
    return { error: 'Access denied: Invalid tenant' };
  }

  return { profile };
}

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

    // Fetch waiver signatures if table exists
    let waivers = [];
    try {
      const { data: waiverData, error: waiverError } = await supabase
        .from('waiver_signatures')
        .select('*')
        .eq('profile_id', id)
        .eq('tenant_id', tenant_id)
        .order('signed_at', { ascending: false });

      if (!waiverError && waiverData) {
        waivers = waiverData;
      }
    } catch (err) {
      // Table might not exist yet, use profile data
    }

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

    // Try to create detailed waiver record if table exists
    let waiverRecord = null;
    try {
      const { data: newWaiver, error: waiverError } = await supabase
        .from('waiver_signatures')
        .insert({
          tenant_id,
          profile_id: id,
          waiver_version: '1.0',
          waiver_type,
          signature_data,
          signed_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          guardian_name,
          guardian_relationship,
          verified_by: signed_by,
          verified_at: new Date().toISOString()
        })
        .select()
        .single();

      if (!waiverError && newWaiver) {
        waiverRecord = newWaiver;
      }
    } catch (err) {
      // Table might not exist, continue with profile update
    }

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