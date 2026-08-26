const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

const upload = multer({ storage: multer.memoryStorage() });

/**
 * Helper to validate that the authenticated user belongs to the requested tenant
 * and possesses an authorized administrative role.
 */
async function validateAdminTenantAccess(userId, tenantId, allowedRoles = ['admin', 'manager', 'owner', 'super_admin']) {
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('tenant_id, role')
        .eq('id', userId)
        .single();

    if (error || !profile) {
        return { error: 'User profile not found', status: 401 };
    }

    if (profile.tenant_id !== tenantId && profile.role !== 'super_admin') {
        return { error: 'Access denied: You do not belong to this tenant', status: 403 };
    }

    if (!allowedRoles.includes(profile.role)) {
        return { error: 'Access denied: Insufficient permissions for administrative settings', status: 403 };
    }

    return { profile };
}

/**
 * Sanitize custom CSS to prevent XSS, HTML injection, javascript expressions,
 * external dangerous URLs, and data exfiltration.
 */
function sanitizeCustomCss(css) {
    if (!css || typeof css !== 'string') return null;
    let sanitized = css;

    // 1. Remove HTML tags / script tags
    sanitized = sanitized.replace(/<[^>]*>/gi, '');

    // 2. Remove JavaScript / VBScript / expression protocols and bindings
    sanitized = sanitized.replace(/javascript\s*:/gi, '');
    sanitized = sanitized.replace(/vbscript\s*:/gi, '');
    sanitized = sanitized.replace(/expression\s*\([^)]*\)/gi, '');
    sanitized = sanitized.replace(/behavior\s*:/gi, '');
    sanitized = sanitized.replace(/-moz-binding\s*:/gi, '');

    // 3. Remove @import rules (prevents loading malicious external stylesheets)
    sanitized = sanitized.replace(/@import\s+[^;]+;/gi, '');

    // 4. Sanitize url(...) references to disallow non-http/https/data URLs
    sanitized = sanitized.replace(/url\s*\(\s*['"]?\s*([^'")]+?)\s*['"]?\s*\)/gi, (match, url) => {
        const trimmedUrl = url.trim().toLowerCase();
        if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://') || trimmedUrl.startsWith('data:image/')) {
            return `url("${url.trim()}")`;
        }
        return 'none';
    });

    return sanitized.trim();
}

// Z-Report (Aggregated across shifts for a date range)
router.get('/reports/z-report', async (req, res) => {
    if (!supabase) return res.status(500).json({error: "Supabase config missing"});
    try {
        const { tenant_id, start_date, end_date } = req.query;

        if (!tenant_id || !start_date || !end_date) {
            return res.status(400).json({ error: 'Missing tenant_id, start_date, or end_date' });
        }

        // Ensure authentication
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Missing Authorization header' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Validate tenant binding and administrative permissions (staff allowed for report viewing)
        const tenantAccess = await validateAdminTenantAccess(user.id, tenant_id, ['admin', 'manager', 'owner', 'super_admin', 'staff']);
        if (tenantAccess.error) {
            return res.status(tenantAccess.status).json({ error: tenantAccess.error });
        }

        const { data: shifts, error: shiftsError } = await supabase
            .from('shift_ledgers')
            .select('id, starting_cash, expected_cash, actual_cash, status, shift_start, shift_end, staff_id')
            .eq('tenant_id', tenant_id)
            .gte('shift_start', new Date(start_date).toISOString())
            .lte('shift_end', new Date(end_date).toISOString());

        if (shiftsError) throw shiftsError;

        if (!shifts || shifts.length === 0) {
            return res.json({ shifts: [], totals: { cash: 0, card: 0, momo: 0, member_tab: 0, bank_transfer: 0 }, summary: { expected_cash: 0, actual_cash: 0, discrepancies: 0 } });
        }

        const shiftIds = shifts.map(s => s.id);

        const { data: payments, error: paymentsError } = await supabase
            .from('payments')
            .select('amount, method, status')
            .in('shift_id', shiftIds)
            .eq('tenant_id', tenant_id);


        if (paymentsError) throw paymentsError;

        const totals = {
            completed: {
                cash: 0,
                card: 0,
                momo: 0,
                member_tab: 0,
                bank_transfer: 0
            },
            pending: {
                cash: 0,
                card: 0,
                momo: 0,
                member_tab: 0,
                bank_transfer: 0
            }
        };

        payments.forEach(p => {
            const statusKey = p.status === 'completed' ? 'completed' : 'pending';
            if (totals[statusKey][p.method] !== undefined) {
                totals[statusKey][p.method] += parseFloat(p.amount);
            } else {
                totals[statusKey][p.method] = parseFloat(p.amount);
            }
        });

        // Sum total revenue that is fully completed vs total expected
        let summaryExpectedCash = 0;
        let summaryActualCash = 0;
        let discrepancies = 0;

        shifts.forEach(s => {
            summaryExpectedCash += parseFloat(s.expected_cash || 0);
            summaryActualCash += parseFloat(s.actual_cash || 0);
            if(s.status === 'discrepancy') {
                discrepancies += Math.abs(parseFloat(s.expected_cash || 0) - parseFloat(s.actual_cash || 0));
            }
        });

        res.json({
            shifts,
            totals,
            summary: {
                expected_cash: summaryExpectedCash,
                actual_cash: summaryActualCash,
                discrepancies: discrepancies
            }
        });
    } catch (error) {
        console.error("Z-report error:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/reports/kpi-dashboard
 * Returns today's financial clearing, utilization metrics, and 30-day KPI trends.
 * Query params: tenant_id (required)
 */
router.get('/reports/kpi-dashboard', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
    try {
        const { tenant_id } = req.query;

        if (!tenant_id) {
            return res.status(400).json({ error: 'Missing tenant_id' });
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

        // Validate tenant binding and administrative permissions (staff allowed for report viewing)
        const tenantAccess = await validateAdminTenantAccess(user.id, tenant_id, ['admin', 'manager', 'owner', 'super_admin', 'staff']);
        if (tenantAccess.error) {
            return res.status(tenantAccess.status).json({ error: tenantAccess.error });
        }

        const today = new Date().toISOString().split('T')[0];

        // Today's tenant snapshot
        const { data: todaySnap, error: snapError } = await supabase
            .from('analytics_snapshots')
            .select('*')
            .eq('tenant_id', tenant_id)
            .eq('snapshot_type', 'tenant')
            .eq('snapshot_date', today)
            .maybeSingle();

        if (snapError) throw snapError;

        // 30-day trend
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

        const { data: trend, error: trendError } = await supabase
            .from('analytics_snapshots')
            .select('snapshot_date, gross_revenue, net_revenue, gateway_fees, mrr, arpu, churn_rate_pct, total_check_ins, active_members, peak_hour, peak_hour_count, avg_occupancy_pct')
            .eq('tenant_id', tenant_id)
            .eq('snapshot_type', 'tenant')
            .gte('snapshot_date', thirtyDaysAgoStr)
            .lte('snapshot_date', today)
            .order('snapshot_date', { ascending: true });

        if (trendError) throw trendError;

        // Today's revenue breakdown by payment method
        const todayStart = `${today}T00:00:00.000Z`;
        const todayEnd = `${today}T23:59:59.999Z`;

        const { data: todayPayments, error: payError } = await supabase
            .from('payments')
            .select('amount, method, status')
            .eq('tenant_id', tenant_id)
            .eq('status', 'completed')
            .gte('created_at', todayStart)
            .lte('created_at', todayEnd);

        if (payError) throw payError;

        const revenueByMethod = {};
        for (const p of (todayPayments || [])) {
            const method = p.method || 'other';
            revenueByMethod[method] = (revenueByMethod[method] || 0) + (parseFloat(p.amount) || 0);
        }

        res.json({
            today: todaySnap || {
                gross_revenue: 0,
                gateway_fees: 0,
                net_revenue: 0,
                total_check_ins: 0,
                peak_hour: null,
                peak_hour_count: 0,
                avg_occupancy_pct: 0,
                active_members: 0,
                mrr: 0,
                arpu: 0,
                churn_rate_pct: 0,
                digest_sent_at: null
            },
            trend: trend || [],
            revenueByMethod
        });
    } catch (error) {
        console.error("[kpi-dashboard] error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/admin/reports/financial-history
 * Returns daily financial snapshots for a date range.
 * Query params: tenant_id, start_date, end_date (all required)
 */
router.get('/reports/financial-history', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
    try {
        const { tenant_id, start_date, end_date } = req.query;

        if (!tenant_id || !start_date || !end_date) {
            return res.status(400).json({ error: 'Missing tenant_id, start_date, or end_date' });
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

        // Validate tenant binding and administrative permissions (staff allowed for report viewing)
        const tenantAccess = await validateAdminTenantAccess(user.id, tenant_id, ['admin', 'manager', 'owner', 'super_admin', 'staff']);
        if (tenantAccess.error) {
            return res.status(tenantAccess.status).json({ error: tenantAccess.error });
        }

        const { data: snapshots, error: snapError } = await supabase
            .from('analytics_snapshots')
            .select('snapshot_date, gross_revenue, gateway_fees, net_revenue, total_check_ins, peak_hour, peak_hour_count, avg_occupancy_pct, active_members, mrr, arpu, churn_rate_pct')
            .eq('tenant_id', tenant_id)
            .eq('snapshot_type', 'tenant')
            .gte('snapshot_date', start_date)
            .lte('snapshot_date', end_date)
            .order('snapshot_date', { ascending: true });

        if (snapError) throw snapError;

        // Calculate totals for the period
        let totalGross = 0;
        let totalFees = 0;
        let totalNet = 0;
        let totalCheckIns = 0;

        for (const s of (snapshots || [])) {
            totalGross += parseFloat(s.gross_revenue) || 0;
            totalFees += parseFloat(s.gateway_fees) || 0;
            totalNet += parseFloat(s.net_revenue) || 0;
            totalCheckIns += s.total_check_ins || 0;
        }

        res.json({
            snapshots: snapshots || [],
            periodTotals: {
                gross_revenue: Math.round(totalGross * 100) / 100,
                gateway_fees: Math.round(totalFees * 100) / 100,
                net_revenue: Math.round(totalNet * 100) / 100,
                total_check_ins: totalCheckIns,
                days: (snapshots || []).length
            }
        });
    } catch (error) {
        console.error("[financial-history] error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/admin/settings
 * Returns all tenant settings (branding, gateways, hardware, regional, multibranch).
 * Query params: tenant_id (required)
 */
router.get('/settings', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
    try {
        const { tenant_id } = req.query;

        if (!tenant_id) {
            return res.status(400).json({ error: 'Missing tenant_id' });
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

        // Validate tenant binding and administrative permissions
        const tenantAccess = await validateAdminTenantAccess(user.id, tenant_id);
        if (tenantAccess.error) {
            return res.status(tenantAccess.status).json({ error: tenantAccess.error });
        }

        const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', tenant_id)
            .single();

        if (tenantError || !tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        // Return all settings, excluding sensitive credentials from the response
        const { paypack_api_key, paypack_secret, sms_gateway_credentials, ...safeSettings } = tenant;

        res.json({
            branding: {
                logo_url: tenant.logo_url || '',
                primary_color: tenant.primary_color || '#000000',
                secondary_color: tenant.secondary_color || '#ffffff',
                custom_css: tenant.custom_css || '',
                branding_settings: tenant.branding_settings || {}
            },
            gateways: {
                has_paypack_configured: !!(tenant.paypack_api_key && tenant.paypack_secret),
                has_sms_configured: !!tenant.sms_gateway_credentials
            },
            hardware: {
                shelly_relays_config: tenant.shelly_relays_config || {},
                hardware_zones: tenant.hardware_zones || []
            },
            regional: {
                default_currency: tenant.default_currency || 'RWF',
                tax_rate: tenant.tax_rate || 0.18,
                geofence_lat: tenant.geofence_lat,
                geofence_lon: tenant.geofence_lon,
                geofence_radius: tenant.geofence_radius
            },
            multibranch: {
                operating_hours: tenant.operating_hours || '',
                branch_roaming_config: tenant.branch_roaming_config || {}
            }
        });
    } catch (error) {
        console.error("[settings] error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/admin/settings/branding
 * Update whitelabel branding settings.
 * Body: tenant_id, logo_url, primary_color, secondary_color, custom_css, branding_settings
 */
router.put('/settings/branding', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
    try {
        const { tenant_id, logo_url, primary_color, secondary_color, custom_css, branding_settings } = req.body;

        if (!tenant_id) {
            return res.status(400).json({ error: 'Missing tenant_id' });
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

        const tenantAccess = await validateAdminTenantAccess(user.id, tenant_id, ['admin', 'manager', 'owner', 'super_admin']);
        if (tenantAccess.error) {
            return res.status(tenantAccess.status).json({ error: tenantAccess.error });
        }

        const updateData = {
            updated_at: new Date().toISOString()
        };

        if (logo_url !== undefined) updateData.logo_url = logo_url || null;
        if (primary_color !== undefined) updateData.primary_color = primary_color || '#000000';
        if (secondary_color !== undefined) updateData.secondary_color = secondary_color || '#ffffff';
        if (custom_css !== undefined) updateData.custom_css = sanitizeCustomCss(custom_css);
        if (branding_settings !== undefined) updateData.branding_settings = branding_settings;

        const { data: tenant, error: updateError } = await supabase
            .from('tenants')
            .update(updateData)
            .eq('id', tenant_id)
            .select()
            .single();

        if (updateError) throw updateError;

        res.json({
            success: true,
            branding: {
                logo_url: tenant.logo_url,
                primary_color: tenant.primary_color,
                secondary_color: tenant.secondary_color,
                custom_css: tenant.custom_css,
                branding_settings: tenant.branding_settings
            }
        });
    } catch (error) {
        console.error("[settings/branding] error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/admin/settings/gateways
 * Update payment gateway credentials.
 * Body: tenant_id, paypack_api_key, paypack_secret, sms_gateway_credentials
 */
router.put('/settings/gateways', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
    try {
        const { tenant_id, paypack_api_key, paypack_secret, sms_gateway_credentials } = req.body;

        if (!tenant_id) {
            return res.status(400).json({ error: 'Missing tenant_id' });
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

        // Privileged write: restrict payment credentials to admin, owner, and super_admin only
        const tenantAccess = await validateAdminTenantAccess(user.id, tenant_id, ['admin', 'owner', 'super_admin']);
        if (tenantAccess.error) {
            return res.status(tenantAccess.status).json({ error: tenantAccess.error });
        }

        const updateData = {
            updated_at: new Date().toISOString()
        };

        if (paypack_api_key !== undefined) updateData.paypack_api_key = paypack_api_key;
        if (paypack_secret !== undefined) updateData.paypack_secret = paypack_secret;
        if (sms_gateway_credentials !== undefined) updateData.sms_gateway_credentials = sms_gateway_credentials;

        const { data: tenant, error: updateError } = await supabase
            .from('tenants')
            .update(updateData)
            .eq('id', tenant_id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Return safe response without credentials
        res.json({
            success: true,
            gateways: {
                has_paypack_configured: !!(tenant.paypack_api_key && tenant.paypack_secret),
                has_sms_configured: !!tenant.sms_gateway_credentials
            }
        });
    } catch (error) {
        console.error("[settings/gateways] error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/admin/settings/hardware
 * Update hardware relay and zone configuration.
 * Body: tenant_id, shelly_relays_config, hardware_zones
 */
router.put('/settings/hardware', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
    try {
        const { tenant_id, shelly_relays_config, hardware_zones } = req.body;

        if (!tenant_id) {
            return res.status(400).json({ error: 'Missing tenant_id' });
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

        const tenantAccess = await validateAdminTenantAccess(user.id, tenant_id);
        if (tenantAccess.error) {
            return res.status(tenantAccess.status).json({ error: tenantAccess.error });
        }

        const { data: tenant, error: updateError } = await supabase
            .from('tenants')
            .update({
                shelly_relays_config: shelly_relays_config || {},
                hardware_zones: hardware_zones || [],
                updated_at: new Date().toISOString()
            })
            .eq('id', tenant_id)
            .select()
            .single();

        if (updateError) throw updateError;

        res.json({
            success: true,
            hardware: {
                shelly_relays_config: tenant.shelly_relays_config,
                hardware_zones: tenant.hardware_zones
            }
        });
    } catch (error) {
        console.error("[settings/hardware] error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/admin/settings/regional
 * Update regional tax/currency/geofence settings.
 * Body: tenant_id, default_currency, tax_rate, geofence_lat, geofence_lon, geofence_radius
 */
router.put('/settings/regional', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
    try {
        const { tenant_id, default_currency, tax_rate, geofence_lat, geofence_lon, geofence_radius } = req.body;

        if (!tenant_id) {
            return res.status(400).json({ error: 'Missing tenant_id' });
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

        const tenantAccess = await validateAdminTenantAccess(user.id, tenant_id);
        if (tenantAccess.error) {
            return res.status(tenantAccess.status).json({ error: tenantAccess.error });
        }

        const { data: tenant, error: updateError } = await supabase
            .from('tenants')
            .update({
                default_currency: default_currency || 'RWF',
                tax_rate: tax_rate !== undefined ? tax_rate : 0.18,
                geofence_lat: geofence_lat !== undefined ? geofence_lat : null,
                geofence_lon: geofence_lon !== undefined ? geofence_lon : null,
                geofence_radius: geofence_radius !== undefined ? geofence_radius : null,
                updated_at: new Date().toISOString()
            })
            .eq('id', tenant_id)
            .select()
            .single();

        if (updateError) throw updateError;

        res.json({
            success: true,
            regional: {
                default_currency: tenant.default_currency,
                tax_rate: tenant.tax_rate,
                geofence_lat: tenant.geofence_lat,
                geofence_lon: tenant.geofence_lon,
                geofence_radius: tenant.geofence_radius
            }
        });
    } catch (error) {
        console.error("[settings/regional] error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/admin/settings/multibranch
 * Update multi-branch configuration.
 * Body: tenant_id, operating_hours, branch_roaming_config
 */
router.put('/settings/multibranch', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
    try {
        const { tenant_id, operating_hours, branch_roaming_config } = req.body;

        if (!tenant_id) {
            return res.status(400).json({ error: 'Missing tenant_id' });
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

        const tenantAccess = await validateAdminTenantAccess(user.id, tenant_id);
        if (tenantAccess.error) {
            return res.status(tenantAccess.status).json({ error: tenantAccess.error });
        }

        const { data: tenant, error: updateError } = await supabase
            .from('tenants')
            .update({
                operating_hours: operating_hours || '',
                branch_roaming_config: branch_roaming_config || {},
                updated_at: new Date().toISOString()
            })
            .eq('id', tenant_id)
            .select()
            .single();

        if (updateError) throw updateError;

        res.json({
            success: true,
            multibranch: {
                operating_hours: tenant.operating_hours,
                branch_roaming_config: tenant.branch_roaming_config
            }
        });
    } catch (error) {
        console.error("[settings/multibranch] error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/admin/settings/test-gateway
 * Test payment gateway connection.
 * Body: tenant_id, gateway_type ('paypack' or 'sms')
 */
router.post('/settings/test-gateway', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
    try {
        const { tenant_id, gateway_type } = req.body;

        if (!tenant_id || !gateway_type) {
            return res.status(400).json({ error: 'Missing tenant_id or gateway_type' });
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

        // Privileged operation: restrict testing payment credentials to admin, owner, and super_admin only
        const tenantAccess = await validateAdminTenantAccess(user.id, tenant_id, ['admin', 'owner', 'super_admin']);
        if (tenantAccess.error) {
            return res.status(tenantAccess.status).json({ error: tenantAccess.error });
        }

        const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .select('paypack_api_key, paypack_secret, sms_gateway_credentials')
            .eq('id', tenant_id)
            .single();

        if (tenantError || !tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        let configured = false;
        let message = '';

        if (gateway_type === 'paypack') {
            configured = !!(tenant.paypack_api_key && tenant.paypack_secret);
            message = configured ? 'Paypack credentials are configured' : 'Paypack credentials are missing';
        } else if (gateway_type === 'sms') {
            configured = !!tenant.sms_gateway_credentials;
            message = configured ? 'SMS gateway credentials are configured' : 'SMS gateway credentials are missing';
        } else {
            return res.status(400).json({ error: 'Invalid gateway_type. Use "paypack" or "sms"' });
        }

        // In a real implementation, you would make actual API calls to test the connections
        // For now, we'll just check if credentials are present
        res.json({
            success: true,
            gateway_type,
            configured,
            message,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("[settings/test-gateway] error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/admin/settings/logo
 * Upload tenant logo to Supabase Storage bucket ('tenant-logos') and update tenant record.
 * Body (multipart/form-data): tenant_id, logo (file)
 * Response: { success: true, logo_url: string }
 */
router.post('/settings/logo', upload.single('logo'), async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
    try {
        const { tenant_id } = req.body;
        if (!tenant_id) {
            return res.status(400).json({ error: 'Missing tenant_id' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No logo file provided' });
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

        const tenantAccess = await validateAdminTenantAccess(user.id, tenant_id);
        if (tenantAccess.error) {
            return res.status(tenantAccess.status).json({ error: tenantAccess.error });
        }

        const fileExt = req.file.originalname?.split('.').pop() || 'png';
        const fileName = `${tenant_id}/logo_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase
            .storage
            .from('tenant-logos')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype || 'image/png',
                upsert: true
            });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase
            .storage
            .from('tenant-logos')
            .getPublicUrl(fileName);

        const { data: tenant, error: updateError } = await supabase
            .from('tenants')
            .update({
                logo_url: publicUrl,
                updated_at: new Date().toISOString()
            })
            .eq('id', tenant_id)
            .select('id, logo_url')
            .single();

        if (updateError) throw updateError;

        res.json({
            success: true,
            logo_url: tenant.logo_url
        });
    } catch (error) {
        console.error("[settings/logo] error:", error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

module.exports = router;
