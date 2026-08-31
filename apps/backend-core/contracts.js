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
 * Authentication check middleware for contracts
 */
async function requireAuth(req, res, next) {
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

/**
 * Helper: Resolve all dynamic contract merge tags against live profile, tenant, and membership records.
 */
function resolveMergeTags(templateText, { tenant, profile, membership, customData = {} }) {
  const today = new Date().toISOString().split('T')[0];
  const memberFullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Valued Member';
  
  const tags = {
    '{{gym_name}}': tenant?.name || 'GymPartner Facility',
    '{{gym_address}}': tenant?.address || 'Kigali, Rwanda',
    '{{operating_hours}}': tenant?.operating_hours || '06:00 - 22:00 (Mon-Sat)',
    '{{currency}}': tenant?.default_currency || 'RWF',
    '{{member_name}}': memberFullName,
    '{{member_phone}}': profile?.phone || 'N/A',
    '{{member_email}}': profile?.email || 'N/A',
    '{{membership_tier}}': membership?.membership_type || customData.membership_tier || 'Standard Access',
    '{{price}}': membership?.price ? parseFloat(membership.price).toLocaleString() : (customData.price || '50,000'),
    '{{billing_interval}}': membership?.billing_interval || customData.billing_interval || 'monthly',
    '{{start_date}}': membership?.start_date || customData.start_date || today,
    '{{end_date}}': membership?.end_date || customData.end_date || '1 Year Ongoing',
    '{{min_term_months}}': String(membership?.min_term_months || customData.min_term_months || 6),
    '{{date}}': today,
    ...customData
  };

  let rendered = templateText;
  for (const [tag, value] of Object.entries(tags)) {
    // Replace all occurrences of tag
    rendered = rendered.split(tag).join(value);
  }

  return rendered;
}

/**
 * GET /api/contracts/templates
 * List contract templates for a tenant.
 * Query: ?tenant_id=<uuid>&contract_type=<optional>
 */
router.get('/templates', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { tenant_id, contract_type } = req.query;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    let query = supabase
      .from('contract_templates')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (contract_type) {
      query = query.eq('contract_type', contract_type);
    }

    const { data: templates, error } = await query;
    if (error) throw error;

    res.json({ success: true, templates: templates || [] });
  } catch (error) {
    console.error('[contracts/templates GET] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/contracts/templates
 * Create or update a contract template.
 * Body: { tenant_id, id?, name, contract_type, body_template, is_active? }
 */
router.post('/templates', requireAuth, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { tenant_id, id, name, contract_type = 'membership', body_template, is_active = true } = req.body;
    if (!tenant_id || !name || !body_template) {
      return res.status(400).json({ error: 'Missing required fields (tenant_id, name, body_template)' });
    }

    let result;
    if (id) {
      // Update existing
      const { data, error } = await supabase
        .from('contract_templates')
        .update({
          name,
          contract_type,
          body_template,
          is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('tenant_id', tenant_id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('contract_templates')
        .insert({
          tenant_id,
          name,
          contract_type,
          body_template,
          is_active
        })
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    res.json({ success: true, template: result });
  } catch (error) {
    console.error('[contracts/templates POST] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/contracts/generate
 * Dynamically resolves contract merge tags for a specific member and template.
 * Body: { tenant_id, profile_id, template_id?, contract_type?, custom_data? }
 */
router.post('/generate', requireAuth, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { tenant_id, profile_id, template_id, contract_type = 'membership', custom_data = {} } = req.body;
    if (!tenant_id || !profile_id) {
      return res.status(400).json({ error: 'Missing required parameters (tenant_id, profile_id)' });
    }

    // 1. Fetch Tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenant_id)
      .single();
    if (tenantErr || !tenant) return res.status(404).json({ error: 'Tenant not found' });

    // 2. Fetch Profile
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profile_id)
      .eq('tenant_id', tenant_id)
      .single();
    if (profileErr || !profile) return res.status(404).json({ error: 'Profile not found' });

    // 3. Fetch latest active Membership
    const { data: membership } = await supabase
      .from('memberships')
      .select('*')
      .eq('profile_id', profile_id)
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 4. Fetch Template
    let template = null;
    if (template_id) {
      const { data: tmpl } = await supabase
        .from('contract_templates')
        .select('*')
        .eq('id', template_id)
        .eq('tenant_id', tenant_id)
        .single();
      template = tmpl;
    }

    if (!template) {
      // Pick first matching active template
      const { data: tmpl } = await supabase
        .from('contract_templates')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('contract_type', contract_type)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      template = tmpl;
    }

    if (!template) {
      return res.status(404).json({ error: `No contract template found for type '${contract_type}'` });
    }

    // 5. Resolve Merge Tags
    const renderedContent = resolveMergeTags(template.body_template, {
      tenant,
      profile,
      membership,
      customData: custom_data
    });

    res.json({
      success: true,
      template_id: template.id,
      template_name: template.name,
      contract_type: template.contract_type,
      title: `${template.name} — ${profile.first_name} ${profile.last_name}`,
      rendered_content: renderedContent,
      member: {
        id: profile.id,
        name: `${profile.first_name} ${profile.last_name}`,
        phone: profile.phone,
        email: profile.email
      },
      membership: membership ? {
        id: membership.id,
        tier: membership.membership_type,
        price: membership.price,
        billing_interval: membership.billing_interval,
        start_date: membership.start_date,
        end_date: membership.end_date
      } : null
    });
  } catch (error) {
    console.error('[contracts/generate] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/contracts/sign
 * Submits a digitally signed membership agreement or waiver with e-signature.
 * Body: {
 *   tenant_id, profile_id, template_id?, membership_id?,
 *   title, rendered_content, signature_data,
 *   guardian_name?, guardian_relationship?, custom_metadata?
 * }
 */
router.post('/sign', requireAuth, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const {
      tenant_id,
      profile_id,
      template_id,
      membership_id,
      title,
      rendered_content,
      signature_data,
      guardian_name,
      guardian_relationship,
      custom_metadata = {}
    } = req.body;

    if (!tenant_id || !profile_id || !rendered_content || !signature_data) {
      return res.status(400).json({
        error: 'Missing required parameters (tenant_id, profile_id, rendered_content, signature_data)'
      });
    }

    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const signedAt = new Date().toISOString();

    // 1. Insert into member_contracts
    const { data: contract, error: contractErr } = await supabase
      .from('member_contracts')
      .insert({
        tenant_id,
        profile_id,
        template_id: template_id || null,
        membership_id: membership_id || null,
        title: title || 'Membership Agreement',
        rendered_content,
        status: 'signed',
        signature_image_url: signature_data, // Data URL or storage URI
        signed_at: signedAt,
        ip_address: String(ipAddress),
        user_agent: String(userAgent),
        metadata: {
          ...custom_metadata,
          guardian_name: guardian_name || null,
          guardian_relationship: guardian_relationship || null
        }
      })
      .select()
      .single();

    if (contractErr) {
      console.error('[contracts/sign] insert error:', contractErr);
      throw contractErr;
    }

    // 2. Also update profile waiver status if this is a waiver or agreement
    await supabase
      .from('profiles')
      .update({
        waiver_signed: true,
        waiver_signed_at: signedAt
      })
      .eq('id', profile_id)
      .eq('tenant_id', tenant_id);

    // 3. Emit contract.signed event
    gymEmitter.emit('contract.signed', {
      tenant_id,
      profile_id,
      contract_id: contract.id,
      title: contract.title,
      signed_at: signedAt
    });

    res.status(201).json({
      success: true,
      message: 'Contract signed and archived successfully',
      contract
    });
  } catch (error) {
    console.error('[contracts/sign] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/contracts/member/:profile_id
 * Returns all signed contracts and legal agreements for a given member.
 * Query: ?tenant_id=<uuid>
 */
router.get('/member/:profile_id', requireAuth, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { profile_id } = req.params;
    const { tenant_id } = req.query;

    if (!profile_id || !tenant_id) {
      return res.status(400).json({ error: 'Missing profile_id or tenant_id' });
    }

    const { data: contracts, error } = await supabase
      .from('member_contracts')
      .select(`
        id, title, status, signed_at, ip_address, created_at,
        contract_templates ( name, contract_type )
      `)
      .eq('profile_id', profile_id)
      .eq('tenant_id', tenant_id)
      .order('signed_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, contracts: contracts || [] });
  } catch (error) {
    console.error('[contracts/member] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/contracts/:id
 * Returns full details for a single contract including rendered text and signature.
 * Query: ?tenant_id=<uuid>
 */
router.get('/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!id || !tenant_id) {
      return res.status(400).json({ error: 'Missing contract id or tenant_id' });
    }

    const { data: contract, error } = await supabase
      .from('member_contracts')
      .select(`
        *,
        profiles:profile_id ( first_name, last_name, phone, email ),
        contract_templates:template_id ( name, contract_type )
      `)
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (error || !contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    res.json({ success: true, contract });
  } catch (error) {
    console.error('[contracts/:id] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
