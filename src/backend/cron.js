const cron = require('node-cron');
const fetch = require('node-fetch');

function initCron(supabase) {
    if (!supabase) {
        console.warn("Supabase not available, skipping cron init.");
        return;
    }

    // Run every minute
    cron.schedule('* * * * *', async () => {
        console.log("Running low-stock notification cron job...");
        try {
            const { data: notifications, error } = await supabase
                .from('notification_queue')
                .select('*')
                .eq('subject', 'Low Stock Alert')
                .eq('status', 'pending')
                .is('sent_at', null);

            if (error) {
                console.error("Cron fetch error:", error);
                return;
            }

            if (!notifications || notifications.length === 0) {
                return;
            }

            for (const notif of notifications) {
                console.log(`Processing low stock alert for tenant ${notif.tenant_id}: ${notif.content}`);

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
                                    title: `[Low Stock] ${notif.tenant_id}`,
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
                await supabase.from('notification_queue')
                    .update({ status: 'sent', sent_at: new Date().toISOString() })
                    .eq('id', notif.id);
            }

        } catch (e) {
            console.error("Cron job exception:", e);
        }
    });
}

module.exports = initCron;
