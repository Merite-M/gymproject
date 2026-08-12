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
        // Authentication check
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Missing Authorization header' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Get user profile to determine tenant_id
        const { data: userProfile, error: profileError } = await supabase
            .from('profiles')
            .select('tenant_id, role')
            .eq('id', user.id)
            .single();

        if (profileError || !userProfile || !userProfile.tenant_id) {
            return res.status(403).json({ error: 'Profile or tenant_id not found' });
        }

        if (userProfile.role !== 'staff' && userProfile.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized role' });
        }

        const tenant_id = userProfile.tenant_id;

        // Pagination for members
        let members = [];
        let hasMore = true;
        let start = 0;
        const pageSize = 1000;

        while (hasMore) {
            const { data: page, error: membersError } = await supabase
                .from('profiles')
                .select('id')
                .eq('tenant_id', tenant_id)
                .eq('role', 'member')
                .range(start, start + pageSize - 1);

            if (membersError) throw membersError;

            if (page && page.length > 0) {
                members = members.concat(page);
                start += pageSize;
                if (page.length < pageSize) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }

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

            const trailingAvg = trailingCheckins.length / 4;

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

            let dropPercentage = 0;
            let isAtRisk = false;

            if (trailingAvg > 0) {
                dropPercentage = ((trailingAvg - currentVisits) / trailingAvg) * 100;
                if (dropPercentage > 60) {
                    isAtRisk = true;
                }
            }

            // Insert snapshot with UPSERT
            const churnScore = isAtRisk ? 80 : 20;
            const snapshotDate = new Date().toISOString().split('T')[0];

            const { error: snapError } = await supabase
                .from('analytics_snapshots')
                .upsert({
                    tenant_id,
                    profile_id,
                    snapshot_date: snapshotDate,
                    trailing_4wk_avg_visits: trailingAvg,
                    current_wk_visits: currentVisits,
                    churn_risk_score: churnScore
                }, { onConflict: 'tenant_id, profile_id, snapshot_date' });

            if (snapError) console.error("Error saving snapshot", snapError);

            if (isAtRisk) {
                atRisk++;

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
                    // Check idempotency for workflows
                    const { data: existingState } = await supabase
                        .from('member_workflow_state')
                        .select('id')
                        .eq('tenant_id', tenant_id)
                        .eq('profile_id', profile_id)
                        .eq('workflow_id', workflow.id)
                        .eq('status', 'in_progress')
                        .maybeSingle();

                    if (!existingState) {
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
