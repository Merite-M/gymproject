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

// Helper function to calculate proration amount
function calculateProration(membershipPrice, startDate, endDate, billingInterval) {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;
  
  // Calculate days in billing cycle
  let daysInCycle;
  if (billingInterval === 'monthly') {
    daysInCycle = 30; // Average days in month
  } else if (billingInterval === 'annual') {
    daysInCycle = 365;
  } else if (billingInterval === 'weekly') {
    daysInCycle = 7;
  } else {
    daysInCycle = 30; // Default to monthly
  }
  
  // Calculate daily rate
  const dailyRate = membershipPrice / daysInCycle;
  
  // Calculate hold duration in days
  let holdDays;
  if (end) {
    const diffTime = Math.abs(end - start);
    holdDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } else {
    // For indefinite holds, assume 30 days for proration
    holdDays = 30;
  }
  
  // Calculate proration amount
  const prorationAmount = dailyRate * holdDays;
  
  return {
    dailyRate: dailyRate.toFixed(2),
    holdDays,
    prorationAmount: prorationAmount.toFixed(2)
  };
}

// Helper function to check abuse prevention rules
async function checkAbusePrevention(supabase, profileId, tenantId, startDate) {
  const errors = [];
  
  // Check 30-day minimum between holds
  const { data: lastHold } = await supabase
    .from('membership_holds')
    .select('end_date, last_hold_end_date')
    .eq('profile_id', profileId)
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'ended'])
    .order('end_date', { ascending: false })
    .limit(1)
    .single();
  
  if (lastHold && lastHold.end_date) {
    const lastEndDate = new Date(lastHold.end_date);
    const requestedStartDate = new Date(startDate);
    const daysSinceLastHold = Math.floor((requestedStartDate - lastEndDate) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastHold < 30) {
      errors.push(`Minimum 30 days required between holds. Last hold ended ${daysSinceLastHold} days ago.`);
    }
  }
  
  return errors;
}

// Create a new hold request
router.post('/', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
  
  try {
    const {
      tenant_id,
      membership_id,
      profile_id,
      hold_reason,
      start_date,
      end_date,
      notes,
      created_by
    } = req.body;
    
    if (!tenant_id || !membership_id || !profile_id || !hold_reason || !start_date || !created_by) {
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
    
    // Check abuse prevention rules
    const abuseErrors = await checkAbusePrevention(supabase, profile_id, tenant_id, start_date);
    if (abuseErrors.length > 0) {
      return res.status(400).json({ 
        error: 'Hold request violates abuse prevention rules',
        details: abuseErrors 
      });
    }
    
    // Get membership details for proration calculation
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
    const proration = calculateProration(
      membership.price,
      start_date,
      end_date,
      membership.billing_interval
    );
    
    // Create hold request with pending status (requires admin approval)
    const { data: hold, error: holdError } = await supabase
      .from('membership_holds')
      .insert({
        tenant_id,
        membership_id,
        profile_id,
        hold_reason,
        start_date,
        end_date,
        status: 'pending',
        notes,
        created_by,
        proration_amount: proration.prorationAmount,
        is_active: false,
        billing_suspended: false
      })
      .select()
      .single();
    
    if (holdError) throw holdError;
    
    res.status(201).json({
      ...hold,
      proration_calculation: proration
    });
    
  } catch (error) {
    console.error('Hold creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get holds for a membership or profile
router.get('/', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
  
  try {
    const { tenant_id, membership_id, profile_id, status } = req.query;
    
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
      .select('*, profiles:first_name,last_name, memberships:memberships(membership_type,price,billing_interval)')
      .eq('tenant_id', tenant_id);
    
    if (membership_id) {
      query = query.eq('membership_id', membership_id);
    }
    
    if (profile_id) {
      query = query.eq('profile_id', profile_id);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    query = query.order('created_at', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    res.json(data || []);
    
  } catch (error) {
    console.error('Hold fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific hold by ID
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

    
    const { data, error } = await supabase
      .from('membership_holds')
      .select('*, profiles:first_name,last_name, memberships:memberships(membership_type,price,billing_interval)')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();
    
    if (error) throw error;
    
    if (!data) {
      return res.status(404).json({ error: 'Hold not found' });
    }
    
    res.json(data);
    
  } catch (error) {
    console.error('Hold fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update hold (approve, deny, cancel, end early)
router.put('/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
  
  try {
    const { id } = req.params;
    const { tenant_id, status, approved_by, approval_notes, end_date } = req.body;
    
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

    
    // Get current hold
    const { data: currentHold, error: fetchError } = await supabase
      .from('membership_holds')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();
    
    if (fetchError || !currentHold) {
      return res.status(404).json({ error: 'Hold not found' });
    }
    
    const updateData = {
      updated_at: new Date().toISOString()
    };
    
    // Handle status transitions
    if (status) {
      updateData.status = status;
      
      if (status === 'approved') {
        updateData.approved_by = approved_by;
        updateData.approval_notes = approval_notes;
        // Will become active on start_date via cron job
      } else if (status === 'active') {
        updateData.is_active = true;
        updateData.billing_suspended = true;
      } else if (status === 'ended' || status === 'cancelled') {
        updateData.is_active = false;
        updateData.billing_suspended = false;
        updateData.last_hold_end_date = end_date || new Date().toISOString().split('T')[0];
      } else if (status === 'denied') {
        updateData.approved_by = approved_by;
        updateData.approval_notes = approval_notes;
        updateData.is_active = false;
      }
    }
    
    // Allow ending hold early
    if (end_date && currentHold.status === 'active') {
      updateData.end_date = end_date;
      updateData.status = 'ended';
      updateData.is_active = false;
      updateData.billing_suspended = false;
      updateData.last_hold_end_date = end_date;
    }
    
    const { data, error } = await supabase
      .from('membership_holds')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json(data);
    
  } catch (error) {
    console.error('Hold update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete hold (only pending or cancelled holds)
router.delete('/:id', async (req, res) => {
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

    
    // Check if hold can be deleted
    const { data: hold, error: fetchError } = await supabase
      .from('membership_holds')
      .select('status')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();
    
    if (fetchError || !hold) {
      return res.status(404).json({ error: 'Hold not found' });
    }
    
    if (hold.status === 'active' || hold.status === 'approved') {
      return res.status(400).json({ error: 'Cannot delete active or approved holds. Use end/cancel instead.' });
    }
    
    const { error } = await supabase
      .from('membership_holds')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant_id);
    
    if (error) throw error;
    
    res.status(204).send();
    
  } catch (error) {
    console.error('Hold delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Calculate proration for a potential hold
router.get('/:id/proration', async (req, res) => {
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

    
    // Get hold details
    const { data: hold, error: holdError } = await supabase
      .from('membership_holds')
      .select('*, memberships:memberships(price, billing_interval)')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();
    
    if (holdError || !hold) {
      return res.status(404).json({ error: 'Hold not found' });
    }
    
    // Calculate proration
    const proration = calculateProration(
      hold.memberships.price,
      hold.start_date,
      hold.end_date,
      hold.memberships.billing_interval
    );
    
    res.json(proration);
    
  } catch (error) {
    console.error('Proration calculation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Apply proration credit to billing system
router.post('/:id/apply-proration', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
  
  try {
    const { id } = req.params;
    const { tenant_id } = req.body;
    
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

    
    // Get hold details
    const { data: hold, error: holdError } = await supabase
      .from('membership_holds')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();
    
    if (holdError || !hold) {
      return res.status(404).json({ error: 'Hold not found' });
    }
    
    if (hold.proration_applied) {
      return res.status(400).json({ error: 'Proration already applied' });
    }
    
    // Create billing adjustment record
    const { data: adjustment, error: adjustmentError } = await supabase
      .from('invoices')
      .insert({
        tenant_id,
        profile_id: hold.profile_id,
        subtotal: -parseFloat(hold.proration_amount),
        total: -parseFloat(hold.proration_amount),
        status: 'applied',
        due_date: new Date().toISOString(),
        invoice_type: 'hold_proration',
        reference_id: hold.id,
        notes: `Proration credit for hold: ${hold.hold_reason} (${hold.start_date} - ${hold.end_date || 'Indefinite'})`
      })
      .select()
      .single();
    
    if (adjustmentError) throw adjustmentError;
    
    // Mark proration as applied
    const { data: updatedHold, error: updateError } = await supabase
      .from('membership_holds')
      .update({
        proration_applied: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    // Update membership end date if needed
    if (hold.end_date) {
      const holdDays = Math.ceil((new Date(hold.end_date) - new Date(hold.start_date)) / (1000 * 60 * 60 * 24));
      const { data: membership } = await supabase
        .from('memberships')
        .select('end_date')
        .eq('id', hold.membership_id)
        .single();
      
      if (membership && membership.end_date) {
        const currentEndDate = new Date(membership.end_date);
        const newEndDate = new Date(currentEndDate);
        newEndDate.setDate(newEndDate.getDate() + holdDays);
        
        await supabase
          .from('memberships')
          .update({ end_date: newEndDate.toISOString().split('T')[0] })
          .eq('id', hold.membership_id);
      }
    }
    
    res.json({
      adjustment,
      hold: updatedHold,
      message: 'Proration credit applied successfully'
    });
    
  } catch (error) {
    console.error('Proration application error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;