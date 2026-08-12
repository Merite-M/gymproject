const express = require('express');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// Analytics endpoint to calculate churn based on visit drop
router.post('/calculate-churn', async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ error: 'Supabase not configured' });
    }

    try {
        const { tenant_id } = req.body;
        if (!tenant_id) {
            return res.status(400).json({ error: 'tenant_id is required' });
        }

        // Get all members for this tenant
        const { data: members, error: membersError } = await supabase
            .from('profiles')
            .select('id')
            .eq('tenant_id', tenant_id)
            .eq('role', 'member');

        if (membersError) throw membersError;

        let processed = 0;
        let atRisk = 0;

        for (const member of members) {
            const profile_id = member.id;

            // Calculate 4-week trailing average visits
            const fourWeeksAgo = new Date();
            fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            const { data: trailingCheckins, error: trailingError } = await supabase
                .from('check_ins')
                .select('id')
                .eq('tenant_id', tenant_id)
                .eq('profile_id', profile_id)
                .gte('created_at', fourWeeksAgo.toISOString())
                .lt('created_at', oneWeekAgo.toISOString());

            if (trailingError) {
                console.error("Error fetching trailing checkins", trailingError);
                continue;
            }

            const trailingAvg = trailingCheckins.length / 3; // baseline window is 28d -> 7d ago = 3 weeks

            // Calculate current week visits (last 7 days)
            const { data: currentCheckins, error: currentError } = await supabase
                .from('check_ins')
                .select('id')
                .eq('tenant_id', tenant_id)
                .eq('profile_id', profile_id)
                .gte('created_at', oneWeekAgo.toISOString());

            if (currentError) {
                console.error("Error fetching current checkins", currentError);
                continue;
            }

            const currentVisits = currentCheckins.length;

            // Calculate churn risk
            // "if a member's current weekly visit frequency drops by more than 60% compared to their trailing 4-week historical baseline"

            let dropPercentage = 0;
            let isAtRisk = false;

            if (trailingAvg > 0) {
                dropPercentage = ((trailingAvg - currentVisits) / trailingAvg) * 100;
                if (dropPercentage > 60) {
                    isAtRisk = true;
                }
            } else if (trailingAvg === 0 && currentVisits === 0) {
                // Not necessarily a sudden drop, they just don't go. But could be high risk.
            }

            // Insert snapshot
            const churnScore = isAtRisk ? 80 : 20; // Example scoring

            const { error: snapError } = await supabase
                .from('analytics_snapshots')
                .insert({
                    tenant_id,
                    profile_id,
                    snapshot_date: new Date().toISOString().split('T')[0],
                    trailing_4wk_avg_visits: trailingAvg,
                    current_wk_visits: currentVisits,
                    churn_risk_score: churnScore
                });

            if (snapError) console.error("Error saving snapshot", snapError);

            if (isAtRisk) {
                atRisk++;
                // Check if they are already in the retention workflow recently to avoid spam
                // Simple version: insert into workflow state and log

                // 1. Get the "Low Attendance Retention Flow" workflow for this tenant
                let { data: workflow } = await supabase
                    .from('marketing_workflows')
                    .select('id')
                    .eq('tenant_id', tenant_id)
                    .eq('name', 'Low Attendance Retention Flow')
                    .single();

                if (!workflow) {
                    // Create it if it doesn't exist for demo/initial setup
                    const { data: newWf } = await supabase
                        .from('marketing_workflows')
                        .insert({
                            tenant_id,
                            name: 'Low Attendance Retention Flow',
                            trigger_type: 'predictive_churn'
                        })
                        .select('id')
                        .single();
                    workflow = newWf;
                }

                if (workflow) {
                    // Add member to workflow
                    await supabase
                        .from('member_workflow_state')
                        .insert({
                            tenant_id,
                            profile_id,
                            workflow_id: workflow.id,
                            status: 'in_progress'
                        });

                    // Add staff outreach task to communications_log
                    await supabase
                        .from('communications_log')
                        .insert({
                            tenant_id,
                            profile_id,
                            workflow_id: workflow.id,
                            channel: 'in_app', // Using in_app to represent staff task/notification in UI
                            direction: 'outbound',
                            status: 'pending',
                            content: `SYSTEM ALERT: Predictive Churn Risk. Member visits dropped by ${dropPercentage.toFixed(0)}%. Personal staff outreach required.`
                        });
                }
            }

            processed++;
        }

        res.status(200).json({ success: true, processed, atRisk });
    } catch (error) {
        console.error("Calculate churn error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
