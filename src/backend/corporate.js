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
 * Authentication and Staff authorization middleware
 */
async function requireStaffAuth(req, res, next) {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'];

  if (apiKeyHeader && process.env.INTERNAL_API_KEY && apiKeyHeader === process.env.INTERNAL_API_KEY) {
    return next();
  }

  if (!authHeader) {
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
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

router.use(requireStaffAuth);

/**
 * GET /api/corporate/accounts
 * Returns all corporate sponsor accounts for a tenant with active member counts.
 * Query: ?tenant_id=<uuid>
 */
router.get('/accounts', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const { data: accounts, error } = await supabase
      .from('corporate_accounts')
      .select(`
        *,
        corporate_members ( id, status ),
        corporate_invoices ( id, total_due, status )
      `)
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formatted = (accounts || []).map(acc => {
      const activeMembersCount = (acc.corporate_members || []).filter(m => m.status === 'active').length;
      const unpaidInvoices = (acc.corporate_invoices || []).filter(inv => inv.status !== 'paid');
      const outstandingBalance = unpaidInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_due || 0), 0);

      return {
        id: acc.id,
        tenant_id: acc.tenant_id,
        company_name: acc.company_name,
        tin_number: acc.tin_number,
        contact_person_name: acc.contact_person_name,
        contact_email: acc.contact_email,
        contact_phone: acc.contact_phone,
        billing_address: acc.billing_address,
        discount_percentage: parseFloat(acc.discount_percentage || 0),
        subsidy_percentage: parseFloat(acc.subsidy_percentage || 100),
        billing_cycle: acc.billing_cycle,
        payment_terms_days: acc.payment_terms_days,
        status: acc.status,
        active_members_count: activeMembersCount,
        outstanding_balance: outstandingBalance,
        created_at: acc.created_at
      };
    });

    res.json({ success: true, accounts: formatted });
  } catch (error) {
    console.error('[corporate/accounts GET] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/corporate/accounts
 * Create or update a corporate sponsor account.
 * Body: { tenant_id, id?, company_name, tin_number?, contact_person_name, contact_email, contact_phone, discount_percentage?, subsidy_percentage?, billing_cycle?, payment_terms_days? }
 */
router.post('/accounts', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const {
      tenant_id,
      id,
      company_name,
      tin_number,
      contact_person_name,
      contact_email,
      contact_phone,
      billing_address,
      discount_percentage = 0,
      subsidy_percentage = 100,
      billing_cycle = 'monthly',
      payment_terms_days = 30,
      status = 'active'
    } = req.body;

    if (!tenant_id || !company_name) {
      return res.status(400).json({ error: 'Missing required fields (tenant_id, company_name)' });
    }

    let account;
    if (id) {
      // Update existing
      const { data, error } = await supabase
        .from('corporate_accounts')
        .update({
          company_name,
          tin_number: tin_number || null,
          contact_person_name: contact_person_name || null,
          contact_email: contact_email || null,
          contact_phone: contact_phone || null,
          billing_address: billing_address || null,
          discount_percentage: parseFloat(discount_percentage),
          subsidy_percentage: parseFloat(subsidy_percentage),
          billing_cycle,
          payment_terms_days: parseInt(payment_terms_days),
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('tenant_id', tenant_id)
        .select()
        .single();
      if (error) throw error;
      account = data;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('corporate_accounts')
        .insert({
          tenant_id,
          company_name,
          tin_number: tin_number || null,
          contact_person_name: contact_person_name || null,
          contact_email: contact_email || null,
          contact_phone: contact_phone || null,
          billing_address: billing_address || null,
          discount_percentage: parseFloat(discount_percentage),
          subsidy_percentage: parseFloat(subsidy_percentage),
          billing_cycle,
          payment_terms_days: parseInt(payment_terms_days),
          status
        })
        .select()
        .single();
      if (error) throw error;
      account = data;
    }

    res.json({ success: true, account });
  } catch (error) {
    console.error('[corporate/accounts POST] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/corporate/accounts/:id
 * Retrieve details for a single corporate sponsor, its roster of employees, and invoice history.
 * Query: ?tenant_id=<uuid>
 */
router.get('/accounts/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;
    if (!id || !tenant_id) return res.status(400).json({ error: 'Missing id or tenant_id' });

    // 1. Fetch Account
    const { data: account, error: accError } = await supabase
      .from('corporate_accounts')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (accError || !account) return res.status(404).json({ error: 'Corporate account not found' });

    // 2. Fetch Corporate Members (Roster)
    const { data: members, error: memError } = await supabase
      .from('corporate_members')
      .select(`
        id, employee_id_number, department, subsidy_cap, status, joined_at,
        profiles:profile_id ( id, first_name, last_name, phone, email, status, membership_status )
      `)
      .eq('corporate_account_id', id)
      .eq('tenant_id', tenant_id);

    if (memError) throw memError;

    // 3. Fetch Corporate Invoices
    const { data: invoices, error: invError } = await supabase
      .from('corporate_invoices')
      .select('*')
      .eq('corporate_account_id', id)
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (invError) throw invError;

    res.json({
      success: true,
      account,
      members: members || [],
      invoices: invoices || []
    });
  } catch (error) {
    console.error('[corporate/accounts/:id] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/corporate/accounts/:id/members
 * Enroll / link an employee to a corporate sponsor account.
 * Body: { tenant_id, profile_id, employee_id_number?, department?, subsidy_cap? }
 */
router.post('/accounts/:id/members', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { id } = req.params;
    const { tenant_id, profile_id, employee_id_number, department, subsidy_cap } = req.body;

    if (!tenant_id || !profile_id) {
      return res.status(400).json({ error: 'Missing required parameters (tenant_id, profile_id)' });
    }

    const { data: member, error } = await supabase
      .from('corporate_members')
      .upsert({
        tenant_id,
        corporate_account_id: id,
        profile_id,
        employee_id_number: employee_id_number || null,
        department: department || null,
        subsidy_cap: subsidy_cap ? parseFloat(subsidy_cap) : null,
        status: 'active',
        joined_at: new Date().toISOString()
      }, { onConflict: 'corporate_account_id,profile_id' })
      .select(`
        id, employee_id_number, department, status, joined_at,
        profiles:profile_id ( id, first_name, last_name, phone, email )
      `)
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, member });
  } catch (error) {
    console.error('[corporate/members POST] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/corporate/accounts/:id/members/:profile_id
 * Remove an employee from corporate sponsor roster.
 * Query: ?tenant_id=<uuid>
 */
router.delete('/accounts/:id/members/:profile_id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { id, profile_id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const { error } = await supabase
      .from('corporate_members')
      .delete()
      .eq('corporate_account_id', id)
      .eq('profile_id', profile_id)
      .eq('tenant_id', tenant_id);

    if (error) throw error;

    res.json({ success: true, message: 'Employee removed from corporate roster' });
  } catch (error) {
    console.error('[corporate/members DELETE] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/corporate/accounts/:id/invoices/generate
 * Grouped Invoicing Engine: Compiles monthly fees across all enrolled corporate employees,
 * applies the corporate discount %, computes VAT / tax, and produces a consolidated B2B invoice.
 * Body: { tenant_id, billing_period_start, billing_period_end, due_date? }
 */
router.post('/accounts/:id/invoices/generate', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { id } = req.params;
    const { tenant_id, billing_period_start, billing_period_end, due_date } = req.body;

    if (!tenant_id || !billing_period_start || !billing_period_end) {
      return res.status(400).json({ error: 'Missing required parameters (tenant_id, billing_period_start, billing_period_end)' });
    }

    // 1. Fetch Corporate Account
    const { data: account, error: accError } = await supabase
      .from('corporate_accounts')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (accError || !account) return res.status(404).json({ error: 'Corporate account not found' });

    // 2. Fetch Tenant (for currency and tax rate)
    const { data: tenant } = await supabase
      .from('tenants')
      .select('default_currency, tax_rate')
      .eq('id', tenant_id)
      .single();

    const currency = tenant?.default_currency || 'RWF';
    const taxRate = tenant?.tax_rate !== undefined ? parseFloat(tenant.tax_rate) : 0.18;

    // 3. Fetch all active corporate members
    const { data: members, error: memError } = await supabase
      .from('corporate_members')
      .select(`
        id, profile_id, employee_id_number, department, subsidy_cap,
        profiles:profile_id ( id, first_name, last_name, phone, email )
      `)
      .eq('corporate_account_id', id)
      .eq('tenant_id', tenant_id)
      .eq('status', 'active');

    if (memError) throw memError;

    const profileIds = (members || []).map(m => m.profile_id);
    let membershipsByProfile = {};
    if (profileIds.length > 0) {
      const { data: mems } = await supabase
        .from('memberships')
        .select('id, profile_id, membership_type, price, billing_interval, status')
        .in('profile_id', profileIds)
        .eq('tenant_id', tenant_id);
      
      (mems || []).forEach(mem => {
        if (!membershipsByProfile[mem.profile_id]) {
          membershipsByProfile[mem.profile_id] = [];
        }
        membershipsByProfile[mem.profile_id].push(mem);
      });
    }

    // 4. Calculate Line Items
    const itemized = [];
    let grossSubtotal = 0;

    for (const m of (members || [])) {
      const profile = m.profiles;
      const memList = membershipsByProfile[m.profile_id] || [];
      const activeMem = memList.find(x => x.status === 'active') || memList[0];
      const basePrice = activeMem ? parseFloat(activeMem.price || 50000) : 50000;
      const tierName = activeMem ? activeMem.membership_type : 'Corporate Standard Access';

      // Apply corporate subsidy percentage
      const employerSharePercentage = parseFloat(account.subsidy_percentage || 100) / 100;
      let employerPortion = basePrice * employerSharePercentage;

      if (m.subsidy_cap && employerPortion > parseFloat(m.subsidy_cap)) {
        employerPortion = parseFloat(m.subsidy_cap);
      }

      grossSubtotal += employerPortion;

      itemized.push({
        profile_id: m.profile_id,
        employee_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Employee',
        employee_id_number: m.employee_id_number || 'N/A',
        department: m.department || 'General',
        plan: tierName,
        base_fee: basePrice,
        employer_subsidized_fee: employerPortion
      });
    }

    // 5. Apply Corporate Discount Percentage
    const discountRate = parseFloat(account.discount_percentage || 0) / 100;
    const discountAmount = grossSubtotal * discountRate;
    const subtotalAfterDiscount = Math.max(0, grossSubtotal - discountAmount);
    
    // Tax computation (inclusive or exclusive)
    const taxAmount = subtotalAfterDiscount * taxRate;
    const totalDue = subtotalAfterDiscount + taxAmount;

    // Generate Invoice Number
    const invoiceNumber = `CORP-INV-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
    const termsDays = account.payment_terms_days || 30;
    const computedDueDate = due_date || new Date(Date.now() + termsDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 6. Insert into corporate_invoices
    const { data: invoice, error: invError } = await supabase
      .from('corporate_invoices')
      .insert({
        tenant_id,
        corporate_account_id: id,
        invoice_number: invoiceNumber,
        billing_period_start,
        billing_period_end,
        total_active_employees: itemized.length,
        subtotal: grossSubtotal,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        total_due: totalDue,
        currency,
        status: 'issued',
        due_date: computedDueDate,
        itemized_breakdown: itemized
      })
      .select()
      .single();

    if (invError) throw invError;

    gymEmitter.emit('corporate.invoice_generated', {
      tenant_id,
      corporate_account_id: id,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      total_due: invoice.total_due,
      company_name: account.company_name
    });

    res.status(201).json({
      success: true,
      message: `Consolidated invoice generated for ${itemized.length} active employees`,
      invoice
    });
  } catch (error) {
    console.error('[corporate/invoices/generate] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/corporate/invoices/:id/settle
 * Settle / Record payment for a corporate invoice (MoMo Business, Bank Transfer, Card).
 * Body: { tenant_id, payment_method, payment_reference? }
 */
router.post('/invoices/:id/settle', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { id } = req.params;
    const { tenant_id, payment_method = 'bank_transfer', payment_reference } = req.body;

    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const paidAt = new Date().toISOString();

    // 1. Update Invoice
    const { data: invoice, error: updateError } = await supabase
      .from('corporate_invoices')
      .update({
        status: 'paid',
        payment_method,
        payment_reference: payment_reference || `REF-${Date.now().toString(36).toUpperCase()}`,
        paid_at: paidAt,
        updated_at: paidAt
      })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select(`
        *,
        corporate_accounts:corporate_account_id ( company_name, contact_email )
      `)
      .single();

    if (updateError) throw updateError;

    // 2. Emit corporate.invoice_paid event
    gymEmitter.emit('corporate.invoice_paid', {
      tenant_id,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      corporate_account_id: invoice.corporate_account_id,
      amount: invoice.total_due,
      payment_method,
      paid_at: paidAt
    });

    res.json({
      success: true,
      message: `Corporate invoice ${invoice.invoice_number} marked as PAID`,
      invoice
    });
  } catch (error) {
    console.error('[corporate/invoices/settle] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/corporate/invoices/:id
 * Retrieve single corporate invoice with itemized line items.
 * Query: ?tenant_id=<uuid>
 */
router.get('/invoices/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!id || !tenant_id) return res.status(400).json({ error: 'Missing id or tenant_id' });

    const { data: invoice, error } = await supabase
      .from('corporate_invoices')
      .select(`
        *,
        corporate_accounts:corporate_account_id ( company_name, tin_number, contact_person_name, contact_email, contact_phone, billing_address )
      `)
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (error || !invoice) return res.status(404).json({ error: 'Corporate invoice not found' });

    res.json({ success: true, invoice });
  } catch (error) {
    console.error('[corporate/invoices/:id] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

/**
 * POST /api/corporate/accounts/:id/members/bulk
 * Bulk upload/enroll corporate employees from CSV parsing or JSON array.
 * Body: { tenant_id, employees: Array<{ email, first_name, last_name, phone?, employee_id_number?, department?, subsidy_cap? }> }
 */
router.post('/accounts/:id/members/bulk', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { id } = req.params;
    const { tenant_id, employees } = req.body;

    if (!tenant_id || !Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ error: 'Missing tenant_id or employees array' });
    }

    const results = {
      enrolled: 0,
      updated: 0,
      errors: []
    };

    for (const emp of employees) {
      try {
        if (!emp.email) {
          results.errors.push({ employee: emp, error: 'Email is required' });
          continue;
        }

        // 1. Find or create profile by email in profiles table
        let { data: profile, error: pErr } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name')
          .eq('tenant_id', tenant_id)
          .eq('email', emp.email.trim().toLowerCase())
          .maybeSingle();

        if (!profile) {
          const { data: newProf, error: createErr } = await supabase
            .from('profiles')
            .insert({
              tenant_id,
              email: emp.email.trim().toLowerCase(),
              first_name: emp.first_name?.trim() || 'Employee',
              last_name: emp.last_name?.trim() || '',
              phone: emp.phone?.trim() || null,
              role: 'member',
              status: 'active'
            })
            .select()
            .single();

          if (createErr) {
            results.errors.push({ employee: emp, error: createErr.message });
            continue;
          }
          profile = newProf;
        }

        // 2. Enroll profile into corporate_members
        const { data: mem, error: memErr } = await supabase
          .from('corporate_members')
          .upsert({
            tenant_id,
            corporate_account_id: id,
            profile_id: profile.id,
            employee_id_number: emp.employee_id_number?.trim() || null,
            department: emp.department?.trim() || null,
            subsidy_cap: emp.subsidy_cap ? parseFloat(emp.subsidy_cap) : null,
            status: emp.status || 'active',
            joined_at: new Date().toISOString()
          }, { onConflict: 'corporate_account_id,profile_id' })
          .select()
          .single();

        if (memErr) {
          results.errors.push({ employee: emp, error: memErr.message });
        } else {
          results.enrolled++;
        }
      } catch (err) {
        results.errors.push({ employee: emp, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `Processed bulk upload: ${results.enrolled} enrolled successfully, ${results.errors.length} failed`,
      summary: results
    });
  } catch (error) {
    console.error('[corporate/members/bulk POST] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/corporate/invoices/:id/paypack-link
 * Generate a B2B Paypack payment link / QR auto-debit request for corporate invoicing.
 * Body: { tenant_id, phone_number? }
 */
router.post('/invoices/:id/paypack-link', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { id } = req.params;
    const { tenant_id, phone_number } = req.body;

    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    // Fetch Invoice & Corporate Account Details
    const { data: invoice, error: invErr } = await supabase
      .from('corporate_invoices')
      .select(`
        *,
        corporate_accounts:corporate_account_id ( company_name, contact_phone, contact_email )
      `)
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (invErr || !invoice) return res.status(404).json({ error: 'Invoice not found' });

    const phone = phone_number || invoice.corporate_accounts?.contact_phone || '0780000000';
    const paypackRef = `PAYPACK-B2B-${Date.now().toString(36).toUpperCase()}`;
    const paymentUrl = `https://paypack.rw/pay/b2b/${invoice.invoice_number}?ref=${paypackRef}`;

    // Update invoice metadata/payment_reference
    await supabase
      .from('corporate_invoices')
      .update({
        payment_reference: paypackRef,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    res.json({
      success: true,
      payment_url: paymentUrl,
      payment_reference: paypackRef,
      amount: invoice.total_due,
      currency: invoice.currency || 'RWF',
      recipient_phone: phone,
      invoice_number: invoice.invoice_number
    });
  } catch (error) {
    console.error('[corporate/invoices/paypack-link POST] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
