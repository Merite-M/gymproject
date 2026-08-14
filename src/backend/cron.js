const cron = require('node-cron');
const fetch = require('node-fetch');

let isRunning = false;
let isDailyRunning = false;

function initCron(supabase) {
    if (!supabase) {
        console.warn("Supabase not available, skipping cron init.");
        return;
    }

    // Run every minute
    cron.schedule('* * * * *', async () => {
        if (isRunning) {
            console.log("Cron job is already running. Skipping this tick.");
            return;
        }

        isRunning = true;
        console.log("Running notification queue cron job...");
        try {
            const { data: notifications, error } = await supabase
                .from('notification_queue')
                .select('*')

                .eq('status', 'pending')
                .is('sent_at', null)
                .limit(50);

            if (error) {
                console.error("Cron fetch error:", error);
                return;
            }

            if (!notifications || notifications.length === 0) {
                return;
            }

            for (const notif of notifications) {
                try {
                    console.log(`Processing notification [${notif.subject}] for tenant ${notif.tenant_id}: ${notif.content}`);

                    // Simulate SMS API Call
                    console.log(`[SMS Gateway Mock] Sending SMS to ${notif.recipient}: ${notif.subject} - ${notif.content}`);

                    // Create explicitly in Linear (if configured)
                    const linearApiKey = process.env.LINEAR_API_KEY;
                    const linearTeamId = process.env.LINEAR_TEAM_ID;
                    if (linearApiKey && linearTeamId) {
                        try {
                            const response = await fetch('https://api.linear.app/graphql', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': linearApiKey
                                },
                                body: JSON.stringify({
                                    query: `
                                        mutation IssueCreate($title: String!, $teamId: String!, $description: String!) {
                                            issueCreate(input: {
                                                title: $title,
                                                teamId: $teamId,
                                                description: $description
                                            }) {
                                                success
                                                issue {
                                                    id
                                                    title
                                                }
                                            }
                                        }
                                    `,
                                    variables: {
                                        title: `[${notif.subject}] ${notif.tenant_id}`,
                                        teamId: linearTeamId,
                                        description: notif.content
                                    }
                                })
                            });
                            const data = await response.json();
                            if (data.errors) {
                                 console.error("Linear API error:", data.errors);
                            } else {
                                 console.log("Created Linear Issue:", data.data?.issueCreate?.issue?.id);
                            }
                        } catch (err) {
                            console.error("Linear integration failed:", err);
                        }
                    } else {
                        console.log("No Linear API Key/Team ID configured. Skipping explicit issue creation.");
                    }

                    // Mark as sent
                    const { error: updateError } = await supabase.from('notification_queue')
                        .update({ status: 'sent', sent_at: new Date().toISOString() })
                        .eq('id', notif.id);

                    if (updateError) {
                         console.error("Failed to update notification status:", updateError);
                    }
                } catch (innerError) {
                    console.error(`Failed to process notification ${notif.id}:`, innerError);
                }
            }


        } catch (e) {
            console.error("Cron job exception:", e);
        } finally {
            isRunning = false;
        }
    });

    // Daily tasks (e.g. run at midnight)
    cron.schedule('0 0 * * *', async () => {
        if (isDailyRunning) {
            console.log("Daily cron job is already running. Skipping this tick.");
            return;
        }

        isDailyRunning = true;
        console.log("Running daily background workers (Dunning & Churn Engine)...");
        try {
            // 1. Renewal Logic
            const today = new Date().toISOString().split('T')[0];
            const { data: dueMemberships, error: memError } = await supabase
                .from('memberships')
                .select('id, profile_id, tenant_id, price, profiles!inner(email)')
                .eq('status', 'active')
                .lte('end_date', today);

            if (memError) {
                console.error("Error fetching due memberships:", memError);
            } else if (dueMemberships && dueMemberships.length > 0) {
                console.log(`Found ${dueMemberships.length} memberships due for renewal.`);
                for (const membership of dueMemberships) {
                    try {
                        // Create unpaid invoice
                        const { data: invoice, error: invError } = await supabase
                            .from('invoices')
                            .insert({
                                tenant_id: membership.tenant_id,
                                profile_id: membership.profile_id,
                                status: 'unpaid',
                                subtotal: membership.price || 0,
                                total: membership.price || 0,
                                due_date: today
                            })
                            .select()
                            .single();

                        if (invError) throw invError;

                        // Insert notification
                        const { error: notifError } = await supabase
                            .from('notification_queue')
                            .insert({
                                tenant_id: membership.tenant_id,
                                profile_id: membership.profile_id,
                                channel: 'email',
                                recipient: membership.profiles?.email || 'member@example.com',
                                subject: 'Membership Renewal Due',
                                content: `Your membership is due for renewal. Please pay the invoice for ${membership.price || 0}.`,
                                status: 'pending'
                            });
                        if (notifError) throw notifError;

                        // Update membership status
                        const { error: updateError } = await supabase
                            .from('memberships')
                            .update({ status: 'pending' })
                            .eq('id', membership.id);

                        if (updateError) throw updateError;

                        console.log(`Successfully processed renewal for membership ${membership.id}`);
                    } catch (e) {
                        console.error(`Error processing renewal for membership ${membership.id}:`, e);
                    }
                }
            }

            // 2. Churn Logic
            // Avoid N+1 by querying the check_ins table for max created_at grouped by profile_id for all active members.
            // Since Supabase JS lacks a clean GROUP BY, we can either use RPC or fetch check_ins sorted.
            // Because we can't create an RPC easily, we will do what we can.
            // Wait, we can fetch active profiles and then fetch check_ins for all those profiles at once.

            const { data: activeProfiles, error: profError } = await supabase
                .from('profiles')
                .select('id, tenant_id, email')
                .eq('role', 'member')
                .eq('status', 'active');

            if (profError) {
                console.error("Error fetching active profiles:", profError);
            } else if (activeProfiles && activeProfiles.length > 0) {
                console.log(`Evaluating churn risk for ${activeProfiles.length} active members...`);

                const fourteenDaysAgo = new Date();
                fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

                const profileIds = activeProfiles.map(p => p.id);
                let recentCheckins = [];
                let checkinError = null;

                const chunkSize = 50;
                for (let i = 0; i < profileIds.length; i += chunkSize) {
                    const chunk = profileIds.slice(i, i + chunkSize);
                    const { data, error } = await supabase
                        .from('check_ins')
                        .select('profile_id')
                        .in('profile_id', chunk)
                        .gte('created_at', fourteenDaysAgo.toISOString());

                    if (error) {
                        checkinError = error;
                        break;
                    }
                    if (data) {
                        recentCheckins = recentCheckins.concat(data);
                    }
                }

                if (checkinError) {
                    console.error("Error fetching recent check-ins:", checkinError);
                } else {
                    const activeProfileIdsSet = new Set(recentCheckins.map(c => c.profile_id));

                    const atRiskProfiles = activeProfiles.filter(p => !activeProfileIdsSet.has(p.id));

                    console.log(`Found ${atRiskProfiles.length} at-risk members.`);

                    for (const profile of atRiskProfiles) {
                        try {
                            // Update analytics - check if exists first to avoid overwriting visits
                            const { data: existingSnap } = await supabase
                                .from('analytics_snapshots')
                                .select('id')
                                .eq('profile_id', profile.id)
                                .eq('snapshot_date', today)
                                .single();

                            let snapError = null;
                            if (existingSnap) {
                                const { error } = await supabase
                                    .from('analytics_snapshots')
                                    .update({ churn_risk_score: 80 })
                                    .eq('id', existingSnap.id);
                                snapError = error;
                            } else {
                                const { error } = await supabase
                                    .from('analytics_snapshots')
                                    .insert({
                                        tenant_id: profile.tenant_id,
                                        profile_id: profile.id,
                                        snapshot_date: today,
                                        churn_risk_score: 80,
                                        trailing_4wk_avg_visits: 0,
                                        current_wk_visits: 0
                                    });
                                snapError = error;
                            }

                            if (snapError) {
                                console.error(`Error updating analytics for ${profile.id}:`, snapError);
                            }

                            // Check if a "we miss you" notification was already queued recently
                            const { data: recentNotifs, error: fetchNotifError } = await supabase
                                .from('notification_queue')
                                .select('id')
                                .eq('profile_id', profile.id)
                                .eq('subject', 'We miss you!')
                                .gte('created_at', fourteenDaysAgo.toISOString())
                                .limit(1);

                            if (!fetchNotifError && (!recentNotifs || recentNotifs.length === 0)) {
                                // Send "we miss you" notification
                                const { error: notifError } = await supabase
                                    .from('notification_queue')
                                    .insert({
                                        tenant_id: profile.tenant_id,
                                        profile_id: profile.id,
                                        channel: 'email',
                                        recipient: profile.email || 'member@example.com',
                                        subject: 'We miss you!',
                                        content: `We haven't seen you at the gym in a while. Come back and crush your goals!`,
                                        status: 'pending'
                                    });
                                if (notifError) {
                                    console.error(`Error queueing miss you notif for ${profile.id}:`, notifError);
                                }
                            }
                        } catch (e) {
                            console.error(`Error processing churn risk for ${profile.id}:`, e);
                        }
                    }
                }
            }

        } catch (e) {
            console.error("Daily cron job exception:", e);
        } finally {
            isDailyRunning = false;
        }
    });

}

module.exports = initCron;
