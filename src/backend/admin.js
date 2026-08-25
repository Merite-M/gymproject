const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

/**
 * Helper to validate that the authenticated user belongs to the requested tenant
 * and possesses an authorized administrative role (admin, manager, owner, super_admin, staff).
 */
async function validateAdminTenantAccess(userId, tenantId) {
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

    const allowedRoles = ['admin', 'manager', 'owner', 'super_admin', 'staff'];
    if (!allowedRoles.includes(profile.role)) {
        return { error: 'Access denied: Insufficient permissions for financial reports', status: 403 };
    }

    return { profile };
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

        // Validate tenant binding and administrative permissions
        const tenantAccess = await validateAdminTenantAccess(user.id, tenant_id);
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

        // Validate tenant binding and administrative permissions
        const tenantAccess = await validateAdminTenantAccess(user.id, tenant_id);
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

        // Validate tenant binding and administrative permissions
        const tenantAccess = await validateAdminTenantAccess(user.id, tenant_id);
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

module.exports = router;
