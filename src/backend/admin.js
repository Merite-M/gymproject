const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// Z-Report (Aggregated across shifts for a date range)
router.get('/reports/z-report', async (req, res) => {
    if (!supabase) return res.status(500).json({error: "Supabase config missing"});
    try {
        const { tenant_id, start_date, end_date } = req.query;

        if (!tenant_id || !start_date || !end_date) {
            return res.status(400).json({ error: 'Missing tenant_id, start_date, or end_date' });
        }

        const { data: shifts, error: shiftsError } = await supabase
            .from('shift_ledgers')
            .select('id, starting_cash, expected_cash, actual_cash, status, shift_start, shift_end, staff_id')
            .eq('tenant_id', tenant_id)
            .gte('shift_start', new Date(start_date).toISOString())
            .lte('shift_start', new Date(end_date).toISOString());

        if (shiftsError) throw shiftsError;

        if (!shifts || shifts.length === 0) {
            return res.json({ shifts: [], totals: { cash: 0, card: 0, momo: 0, member_tab: 0, bank_transfer: 0 }, summary: { expected_cash: 0, actual_cash: 0, discrepancies: 0 } });
        }

        const shiftIds = shifts.map(s => s.id);

        const { data: payments, error: paymentsError } = await supabase
            .from('payments')
            .select('amount, method')
            .in('shift_id', shiftIds)
            .eq('tenant_id', tenant_id);


        if (paymentsError) throw paymentsError;

        const totals = {
            cash: 0,
            card: 0,
            momo: 0,
            member_tab: 0,
            bank_transfer: 0
        };

        payments.forEach(p => {
            if (totals[p.method] !== undefined) {
                totals[p.method] += parseFloat(p.amount);
            }
        });

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


module.exports = router;
