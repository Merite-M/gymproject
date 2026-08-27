const cron = require('node-cron');
const fetch = require('node-fetch');
const { dispatchMultiChannelMessage } = require('./gateways');

let isRunning = false;
let isDailyRunning = false;
let isNightlyRunning = false;

/** Gateway fee rates */
const PAYPACK_FEE_RATE = 0.0236;
const MTN_MOMO_FEE_RATE = 0.0177;

function initCron(supabase) {

    // ─── Automated Communications Failure Retry Engine (every 5 minutes) ───────
    let isRetryRunning = false;
    cron.schedule('*/5 * * * *', async () => {
        if (isRetryRunning) return;
        isRetryRunning = true;
        try {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const { data: failedLogs, error } = await supabase
                .from('communications_log')
                .select('*, profile:profiles(id, phone)')
                .eq('status', 'failed')
                .lt('retry_count', 3)
                .lte('created_at', fiveMinutesAgo)
                .limit(20);

            if (error) {
                console.error('[Comm Retry Cron] Fetch error:', error.message);
                return;
            }

            for (const item of (failedLogs || [])) {
                try {
                    const recipient = item.metadata?.recipient || item.profile?.phone;
                    if (!recipient || !item.content) continue;

                    console.log('[Comm Retry Cron] Retrying failed msg ' + item.id + ' for recipient ' + recipient + '...');

                    const result = await dispatchMultiChannelMessage({
                        tenant_id: item.tenant_id,
                        profile_id: item.profile_id,
                        channel: item.channel === 'auto_fallback' ? 'sms' : item.channel,
                        recipient,
                        subject: item.metadata?.subject || 'Retry Notification',
                        message: item.content,
                        metadata: { ...item.metadata, is_auto_retry: true, retry_attempt: (item.retry_count || 0) + 1 },
                        supabase
                    });

                    await supabase
                        .from('communications_log')
                        .update({
                            status: result?.status || 'delivered',
                            retry_count: (item.retry_count || 0) + 1,
                            updated_at: new Date().toISOString(),
                            error_message: null
                        })
                        .eq('id', item.id);
                } catch (err) {
                    console.error('[Comm Retry Cron] Failed attempt for ' + item.id + ':', err.message);
                    await supabase
                        .from('communications_log')
                        .update({
                            retry_count: (item.retry_count || 0) + 1,
                            updated_at: new Date().toISOString(),
                            error_message: err.message
                        })
                        .eq('id', item.id);
                }
            }
        } catch (e) {
            console.error('[Comm Retry Cron] Exception:', e);
        } finally {
            isRetryRunning = false;
        }
    });
    if (!supabase) {
        console.warn("Supabase not available, skipping cron init.");
        return;
    }

    // Run every minute
    cron.schedule('* * * * *', async () => {
        if (isRunning) {
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
                        const controller = new AbortController();
                        const timeout = setTimeout(() => controller.abort(), 5000);
                        try {
                            const response = await fetch('https://api.linear.app/graphql', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': linearApiKey
                                },
                                signal: controller.signal,
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
                            clearTimeout(timeout);
                            const data = await response.json();
                            if (data.errors) {
                                 console.error("Linear API error:", data.errors);
                            } else {
                                 console.log("Created Linear Issue:", data.data?.issueCreate?.issue?.id);
                            }
                        } catch (err) {
                            clearTimeout(timeout);
                            console.error("Linear integration failed or timed out:", err.message);
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

    // ─── Auto-Checkout Cron (every 15 minutes) ───────────────────────────────
    // Closes orphaned check-in sessions where a member never checked out
    // and the session exceeds the tenant's auto_checkout_minutes threshold.
    let isAutoCheckoutRunning = false;
    cron.schedule('*/15 * * * *', async () => {
        if (isAutoCheckoutRunning) return;
        isAutoCheckoutRunning = true;

        try {
            // Fetch all tenants with their auto-checkout config
            const { data: tenants, error: tenantError } = await supabase
                .from('tenants')
                .select('id, auto_checkout_minutes');

            if (tenantError || !tenants) {
                console.error('[auto-checkout] tenant fetch error:', tenantError);
                return;
            }

            let totalClosed = 0;

            for (const tenant of tenants) {
                const autoMinutes = tenant.auto_checkout_minutes || 120;
                const cutoffTime = new Date(Date.now() - autoMinutes * 60 * 1000).toISOString();

                const { data: orphaned, error: orphanError } = await supabase
                    .from('check_ins')
                    .select('id')
                    .eq('tenant_id', tenant.id)
                    .in('status', ['approved', 'warning'])
                    .is('checkout_at', null)
                    .lt('created_at', cutoffTime);

                if (orphanError || !orphaned || orphaned.length === 0) continue;

                const orphanIds = orphaned.map(o => o.id);
                const { error: updateError } = await supabase
                    .from('check_ins')
                    .update({
                        checkout_at: new Date().toISOString(),
                        checkout_method: 'auto_timeout'
                    })
                    .in('id', orphanIds);

                if (updateError) {
                    console.error(`[auto-checkout] update error for tenant ${tenant.id}:`, updateError);
                } else {
                    totalClosed += orphanIds.length;
                }
            }

            if (totalClosed > 0) {
                console.log(`[auto-checkout] Closed ${totalClosed} orphaned sessions.`);
            }
        } catch (e) {
            console.error('[auto-checkout] exception:', e);
        } finally {
            isAutoCheckoutRunning = false;
        }
    });

    // ─── Drip Workflow Delay Step Resume Engine (Runs every minute) ────────────
    let isDripRunning = false;
    cron.schedule('* * * * *', async () => {
        if (isDripRunning) return;
        isDripRunning = true;
        try {
            const now = new Date().toISOString();
            const { data: waitingMembers, error: waitErr } = await supabase
                .from('member_workflow_state')
                .select('*, marketing_workflows(*)')
                .eq('status', 'waiting_delay')
                .lte('resume_at', now)
                .limit(20);

            if (!waitErr && waitingMembers && waitingMembers.length > 0) {
                const { executeWorkflowStep } = require('./drip_engine');
                for (const state of waitingMembers) {
                    if (state.marketing_workflows) {
                        console.log(`[Drip Engine] Resuming delayed workflow "${state.marketing_workflows.name}" for member ${state.profile_id}...`);
                        await executeWorkflowStep({
                            tenant_id: state.tenant_id,
                            profile_id: state.profile_id,
                            workflow: state.marketing_workflows,
                            currentNodeId: state.current_node_id,
                            context: state.context || {}
                        });
                    }
                }
            }
        } catch (dripErr) {
            console.error('[Drip Engine Cron] error:', dripErr);
        } finally {
            isDripRunning = false;
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

                                // Create automated staff follow-up task
                                const { data: existingTask } = await supabase
                                    .from('staff_tasks')
                                    .select('id')
                                    .eq('profile_id', profile.id)
                                    .eq('trigger_event', 'member.churn_risk')
                                    .eq('status', 'pending')
                                    .limit(1);

                                if (!existingTask || existingTask.length === 0) {
                                    await supabase.from('staff_tasks').insert({
                                        tenant_id: profile.tenant_id,
                                        profile_id: profile.id,
                                        title: `⚠️ Churn Risk Follow-up: Member inactive 14+ days`,
                                        description: `Member has not checked in recently. Contact via WhatsApp or Call to check in on their fitness goals.`,
                                        trigger_event: 'member.churn_risk',
                                        task_type: 'retention_check',
                                        priority: 'high',
                                        status: 'pending',
                                        due_date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
                                        assigned_role: 'reception'
                                    });
                                }
                            }
                        } catch (e) {
                            console.error(`Error processing churn risk for ${profile.id}:`, e);
                        }
                    }
                }
            }

            // 3. Lead CRM Automation: Trial Expiration Engine
            try {
                await processTrialExpirations(supabase);
            } catch (err) {
                console.error("[cron-leads] Trial expiration error:", err);
            }

            // 4. Lead CRM Automation: Automated Drip Sequences
            try {
                await processLeadDripSequences(supabase);
            } catch (err) {
                console.error("[cron-leads] Lead drip sequence error:", err);
            }

            // 5. Referral Engine: Automated Reward Fulfillment
            try {
                await processReferralRewardFulfillment(supabase);
            } catch (err) {
                console.error("[cron-referrals] Referral reward fulfillment error:", err);
            }

        } catch (e) {
            console.error("Daily cron job exception:", e);
        } finally {
            isDailyRunning = false;
        }
    });
function getTenantDayBounds(timezone = 'Africa/Kigali') {
    try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const localDate = formatter.format(now); // "YYYY-MM-DD"

        // Compute local timezone offset relative to UTC
        const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
        const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
        const offsetMs = tzDate.getTime() - utcDate.getTime();

        const todayStart = new Date(new Date(`${localDate}T00:00:00.000Z`).getTime() - offsetMs).toISOString();
        const todayEnd = new Date(new Date(`${localDate}T23:59:59.999Z`).getTime() - offsetMs).toISOString();

        const monthStartStr = `${localDate.substring(0, 7)}-01`;
        const monthStartISO = new Date(new Date(`${monthStartStr}T00:00:00.000Z`).getTime() - offsetMs).toISOString();

        return { localDate, todayStart, todayEnd, monthStartISO, monthStartStr };
    } catch (e) {
        const today = new Date().toISOString().split('T')[0];
        return {
            localDate: today,
            todayStart: `${today}T00:00:00.000Z`,
            todayEnd: `${today}T23:59:59.999Z`,
            monthStartISO: `${today.substring(0, 7)}-01T00:00:00.000Z`,
            monthStartStr: `${today.substring(0, 7)}-01`
        };
    }
}

    // Nightly financial clearing, utilization & owner digest (23:59)
    cron.schedule('59 23 * * *', async () => {
        if (isNightlyRunning) {
            console.log("Nightly clearing cron is already running. Skipping.");
            return;
        }

        isNightlyRunning = true;
        console.log("Running nightly financial clearing & utilization cron...");
        try {
            // Get all tenants with timezone
            const { data: tenants, error: tenantError } = await supabase
                .from('tenants')
                .select('id, name, contact_email, timezone');

            if (tenantError) {
                console.error("[nightly-clearing] Error fetching tenants:", tenantError);
                return;
            }

            if (!tenants || tenants.length === 0) {
                console.log("[nightly-clearing] No tenants found.");
                return;
            }

            for (const tenant of tenants) {
                try {
                    const bounds = getTenantDayBounds(tenant.timezone || 'Africa/Kigali');
                    const today = bounds.localDate;
                    const todayStart = bounds.todayStart;
                    const todayEnd = bounds.todayEnd;
                    const monthStartISO = bounds.monthStartISO;
                    const monthStartStr = bounds.monthStartStr;

                    console.log(`[nightly-clearing] Processing tenant: ${tenant.name} (${tenant.id}) [TZ: ${tenant.timezone || 'Africa/Kigali'}, Day: ${today}]`);

                    // ─── 1. Financial Clearing ───
                    const { data: todayPayments, error: payError } = await supabase
                        .from('payments')
                        .select('amount, method, status')
                        .eq('tenant_id', tenant.id)
                        .eq('status', 'completed')
                        .gte('created_at', todayStart)
                        .lte('created_at', todayEnd);

                    if (payError) {
                        console.error(`[nightly-clearing] Payment fetch error for ${tenant.id}:`, payError);
                    }

                    let grossRevenue = 0;
                    let gatewayFees = 0;

                    if (todayPayments && todayPayments.length > 0) {
                        for (const p of todayPayments) {
                            const amount = parseFloat(p.amount) || 0;
                            grossRevenue += amount;

                            // Calculate gateway fees based on payment method
                            const method = (p.method || '').toLowerCase();
                            if (method === 'momo' || method === 'mtn_momo' || method === 'airtel_money') {
                                gatewayFees += amount * MTN_MOMO_FEE_RATE;
                            } else if (method === 'paypack') {
                                gatewayFees += amount * PAYPACK_FEE_RATE;
                            }
                            // cash, card, bank_transfer, member_tab have no gateway fee
                        }
                    }

                    const netRevenue = grossRevenue - gatewayFees;

                    // ─── 2. Utilization Matrix ───
                    const { data: todayCheckins, error: checkinError } = await supabase
                        .from('check_ins')
                        .select('created_at')
                        .eq('tenant_id', tenant.id)
                        .gte('created_at', todayStart)
                        .lte('created_at', todayEnd);

                    if (checkinError) {
                        console.error(`[nightly-clearing] Check-in fetch error for ${tenant.id}:`, checkinError);
                    }

                    const totalCheckIns = (todayCheckins || []).length;

                    // Calculate peak hour
                    const hourCounts = {};
                    for (const ci of (todayCheckins || [])) {
                        const hour = new Date(ci.created_at).getUTCHours();
                        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
                    }

                    let peakHour = null;
                    let peakHourCount = 0;
                    for (const [hour, count] of Object.entries(hourCounts)) {
                        if (count > peakHourCount) {
                            peakHour = parseInt(hour);
                            peakHourCount = count;
                        }
                    }

                    // ─── 3. KPI Calculations ───
                    // Active members count
                    const { count: activeMemberCount, error: memberCountError } = await supabase
                        .from('profiles')
                        .select('id', { count: 'exact', head: true })
                        .eq('tenant_id', tenant.id)
                        .eq('role', 'member')
                        .eq('status', 'active');

                    if (memberCountError) {
                        console.error(`[nightly-clearing] Member count error for ${tenant.id}:`, memberCountError);
                    }

                    const activeMembers = activeMemberCount || 0;

                    // MRR: sum of active membership prices
                    const { data: activeMemberships, error: mrrError } = await supabase
                        .from('memberships')
                        .select('price, billing_interval')
                        .eq('tenant_id', tenant.id)
                        .eq('status', 'active');

                    if (mrrError) {
                        console.error(`[nightly-clearing] MRR fetch error for ${tenant.id}:`, mrrError);
                    }

                    let mrr = 0;
                    if (activeMemberships) {
                        for (const m of activeMemberships) {
                            const price = parseFloat(m.price) || 0;
                            const interval = (m.billing_interval || 'monthly').toLowerCase();
                            if (interval === 'yearly' || interval === 'annual') {
                                mrr += price / 12;
                            } else if (interval === 'quarterly') {
                                mrr += price / 3;
                            } else if (interval === 'weekly') {
                                mrr += price * 4.33;
                            } else {
                                // monthly (default)
                                mrr += price;
                            }
                        }
                    }

                    const arpu = activeMembers > 0 ? mrr / activeMembers : 0;

                    // Churn rate: members cancelled this month / active at start of month
                    // 1. Primary check on cancelled_at (full ISO timestamp populated by member-crm.js)
                    const { count: cancelledByTimestamp, error: churnError1 } = await supabase
                        .from('memberships')
                        .select('id', { count: 'exact', head: true })
                        .eq('tenant_id', tenant.id)
                        .eq('status', 'cancelled')
                        .gte('cancelled_at', monthStartISO)
                        .lte('cancelled_at', todayEnd);

                    let cancelledCount = cancelledByTimestamp || 0;

                    // 2. Fallback check: legacy records where cancelled_at is null, check end_date
                    if (!churnError1) {
                        const { count: cancelledByEndDate, error: churnError2 } = await supabase
                            .from('memberships')
                            .select('id', { count: 'exact', head: true })
                            .eq('tenant_id', tenant.id)
                            .eq('status', 'cancelled')
                            .is('cancelled_at', null)
                            .gte('end_date', monthStartStr)
                            .lte('end_date', today);

                        if (!churnError2 && cancelledByEndDate) {
                            cancelledCount += cancelledByEndDate;
                        }
                    } else {
                        console.error(`[nightly-clearing] Churn calculation error for ${tenant.id}:`, churnError1);
                    }

                    const totalMemberBase = activeMembers + (cancelledCount || 0);
                    const churnRatePct = totalMemberBase > 0
                        ? ((cancelledCount || 0) / totalMemberBase) * 100
                        : 0;

                    // Average occupancy: check-ins / (active_members * operating_hours ~16h)
                    const operatingHours = 16;
                    const avgOccupancyPct = activeMembers > 0
                        ? Math.min(100, (totalCheckIns / (activeMembers * operatingHours)) * 100)
                        : 0;

                    // ─── 4. Store Tenant Snapshot ───
                    const { error: snapError } = await supabase
                        .from('analytics_snapshots')
                        .upsert({
                            tenant_id: tenant.id,
                            profile_id: null,
                            snapshot_date: today,
                            snapshot_type: 'tenant',
                            gross_revenue: Math.round(grossRevenue * 100) / 100,
                            gateway_fees: Math.round(gatewayFees * 100) / 100,
                            net_revenue: Math.round(netRevenue * 100) / 100,
                            total_check_ins: totalCheckIns,
                            peak_hour: peakHour,
                            peak_hour_count: peakHourCount,
                            avg_occupancy_pct: Math.round(avgOccupancyPct * 100) / 100,
                            active_members: activeMembers,
                            mrr: Math.round(mrr * 100) / 100,
                            arpu: Math.round(arpu * 100) / 100,
                            churn_rate_pct: Math.round(churnRatePct * 100) / 100,
                            trailing_4wk_avg_visits: 0,
                            current_wk_visits: 0
                        }, { onConflict: 'tenant_id,snapshot_date,snapshot_type' })
                        .eq('snapshot_type', 'tenant');

                    if (snapError) {
                        // Fallback: try insert (upsert may fail without unique constraint)
                        console.warn(`[nightly-clearing] Upsert failed for ${tenant.id}, falling back to insert:`, snapError.message);
                        const { error: insertError } = await supabase
                            .from('analytics_snapshots')
                            .insert({
                                tenant_id: tenant.id,
                                profile_id: null,
                                snapshot_date: today,
                                snapshot_type: 'tenant',
                                gross_revenue: Math.round(grossRevenue * 100) / 100,
                                gateway_fees: Math.round(gatewayFees * 100) / 100,
                                net_revenue: Math.round(netRevenue * 100) / 100,
                                total_check_ins: totalCheckIns,
                                peak_hour: peakHour,
                                peak_hour_count: peakHourCount,
                                avg_occupancy_pct: Math.round(avgOccupancyPct * 100) / 100,
                                active_members: activeMembers,
                                mrr: Math.round(mrr * 100) / 100,
                                arpu: Math.round(arpu * 100) / 100,
                                churn_rate_pct: Math.round(churnRatePct * 100) / 100,
                                trailing_4wk_avg_visits: 0,
                                current_wk_visits: 0
                            });

                        if (insertError) {
                            console.error(`[nightly-clearing] Insert snapshot error for ${tenant.id}:`, insertError);
                        }
                    }

                    // ─── 5. Queue Owner Digest Email ───
                    const ownerEmail = tenant.contact_email;
                    if (ownerEmail) {
                        const peakHourLabel = peakHour !== null ? `${peakHour}:00–${peakHour + 1}:00` : 'N/A';
                        const digestContent = [
                            `📊 Daily Executive Summary — ${tenant.name}`,
                            `Date: ${today}`,
                            ``,
                            `💰 FINANCIAL CLEARING`,
                            `  Gross Revenue: ${grossRevenue.toFixed(2)} RWF`,
                            `  Gateway Fees:  ${gatewayFees.toFixed(2)} RWF`,
                            `  Net Revenue:   ${netRevenue.toFixed(2)} RWF`,
                            ``,
                            `🏋️ FACILITY UTILIZATION`,
                            `  Total Check-Ins: ${totalCheckIns}`,
                            `  Peak Hour: ${peakHourLabel} (${peakHourCount} check-ins)`,
                            `  Avg Occupancy: ${avgOccupancyPct.toFixed(1)}%`,
                            ``,
                            `📈 KEY PERFORMANCE INDICATORS`,
                            `  MRR: ${mrr.toFixed(0)} RWF`,
                            `  ARPU: ${arpu.toFixed(0)} RWF`,
                            `  Active Members: ${activeMembers}`,
                            `  Monthly Churn Rate: ${churnRatePct.toFixed(1)}%`,
                        ].join('\n');

                        const { error: notifError } = await supabase
                            .from('notification_queue')
                            .insert({
                                tenant_id: tenant.id,
                                profile_id: null,
                                channel: 'email',
                                recipient: ownerEmail,
                                subject: `Daily Summary — ${tenant.name} — ${today}`,
                                content: digestContent,
                                status: 'pending'
                            });

                        if (notifError) {
                            console.error(`[nightly-clearing] Digest queue error for ${tenant.id}:`, notifError);
                        } else {
                            // Mark digest as sent in snapshot
                            await supabase
                                .from('analytics_snapshots')
                                .update({ digest_sent_at: new Date().toISOString() })
                                .eq('tenant_id', tenant.id)
                                .eq('snapshot_date', today)
                                .eq('snapshot_type', 'tenant');

                            console.log(`[nightly-clearing] Digest queued for ${tenant.name} → ${ownerEmail}`);
                        }
                    } else {
                        console.log(`[nightly-clearing] No contact_email for tenant ${tenant.name}, skipping digest.`);
                    }

                    console.log(`[nightly-clearing] ✓ ${tenant.name}: gross=${grossRevenue.toFixed(2)}, fees=${gatewayFees.toFixed(2)}, net=${netRevenue.toFixed(2)}, checkins=${totalCheckIns}, MRR=${mrr.toFixed(0)}, churn=${churnRatePct.toFixed(1)}%`);

                } catch (tenantError) {
                    console.error(`[nightly-clearing] Error processing tenant ${tenant.id}:`, tenantError);
                }
            }

        } catch (e) {
            console.error("[nightly-clearing] Cron job exception:", e);
        } finally {
            isNightlyRunning = false;
        }
    });

}

/**
 * Automatically transitions expired trials from 'trial_active' to 'trial_expired'
 * and dispatches win-back conversion offers.
 */
async function processTrialExpirations(supabase) {
    const today = new Date().toISOString().split('T')[0];
    const { data: expiredLeads, error } = await supabase
        .from('leads')
        .select('id, tenant_id, first_name, last_name, phone, email, trial_end_date')
        .eq('pipeline_stage', 'trial_active')
        .lte('trial_end_date', today);

    if (error) {
        console.error("[cron-trial-expirations] Fetch error:", error);
        return;
    }

    if (!expiredLeads || expiredLeads.length === 0) return;

    console.log(`[cron-trial-expirations] Found ${expiredLeads.length} expired trials to transition.`);

    for (const lead of expiredLeads) {
        try {
            const now = new Date().toISOString();
            // Update stage to trial_expired
            await supabase
                .from('leads')
                .update({
                    pipeline_stage: 'trial_expired',
                    stage_entered_at: now,
                    updated_at: now
                })
                .eq('id', lead.id);

            // Audit stage history
            await supabase.from('lead_stage_history').insert({
                tenant_id: lead.tenant_id,
                lead_id: lead.id,
                from_stage: 'trial_active',
                to_stage: 'trial_expired',
                trigger_source: 'automated_cron',
                notes: `Trial ended on ${lead.trial_end_date}. Auto-transitioned to trial_expired.`
            });

            // Dispatch special conversion discount SMS
            if (lead.phone) {
                await supabase.from('notification_queue').insert({
                    tenant_id: lead.tenant_id,
                    profile_id: null,
                    channel: 'sms',
                    recipient: lead.phone,
                    subject: 'Your Free Trial Has Ended',
                    content: `Hi ${lead.first_name}, your 7-day GymPartner VIP trial has concluded! Join this week to receive a 15% discount on your first month. Sign up online or visit the front desk.`,
                    status: 'pending'
                });
            }

            // Log communication
            await supabase.from('communications_log').insert({
                tenant_id: lead.tenant_id,
                profile_id: null,
                channel: 'sms',
                direction: 'outbound',
                status: 'pending',
                content: `[Automated Drip] Trial Expiration Notice & 15% Conversion Offer sent to ${lead.phone}`
            });

        } catch (e) {
            console.error(`[cron-trial-expirations] Error processing lead ${lead.id}:`, e);
        }
    }
}

/**
 * Processes automated drip communication sequences based on lead stage duration.
 */
async function processLeadDripSequences(supabase) {
    const now = Date.now();
    const twoDaysAgo = new Date(now - 48 * 60 * 60 * 1000).toISOString();
    const tomorrowStart = new Date(now + 20 * 60 * 60 * 1000).toISOString();
    const tomorrowEnd = new Date(now + 30 * 60 * 60 * 1000).toISOString();

    // 1. Inquiry Stage 48-Hour Drip: Leads waiting in 'inquiry' for > 48 hours
    const { data: stagnantInquiries } = await supabase
        .from('leads')
        .select('id, tenant_id, first_name, phone')
        .eq('pipeline_stage', 'inquiry')
        .lte('stage_entered_at', twoDaysAgo)
        .limit(30);

    for (const lead of (stagnantInquiries || [])) {
        try {
            // Check if reminder was already sent in communications_log
            const { data: existingLogs } = await supabase
                .from('communications_log')
                .select('id')
                .eq('tenant_id', lead.tenant_id)
                .ilike('content', `%Inquiry Drip%${lead.phone}%`)
                .limit(1);

            if (!existingLogs || existingLogs.length === 0) {
                await supabase.from('notification_queue').insert({
                    tenant_id: lead.tenant_id,
                    profile_id: null,
                    channel: 'sms',
                    recipient: lead.phone,
                    subject: 'Free VIP Gym Pass',
                    content: `Hi ${lead.first_name}! Are you still looking to reach your fitness goals? Book a free gym tour and workout pass here: https://gym-frontend-app.onrender.com/join`,
                    status: 'pending'
                });

                await supabase.from('communications_log').insert({
                    tenant_id: lead.tenant_id,
                    profile_id: null,
                    channel: 'sms',
                    direction: 'outbound',
                    status: 'pending',
                    content: `[Automated Drip] 48h Inquiry Follow-up dispatched to ${lead.phone}`
                });
            }
        } catch (e) {
            console.error(`[cron-drip] Inquiry drip error for ${lead.id}:`, e);
        }
    }

    // 2. Tour Scheduled 24-Hour Reminder Drip
    const { data: upcomingTours } = await supabase
        .from('leads')
        .select('id, tenant_id, first_name, phone, tour_date')
        .eq('pipeline_stage', 'tour_scheduled')
        .gte('tour_date', tomorrowStart)
        .lte('tour_date', tomorrowEnd)
        .limit(30);

    for (const lead of (upcomingTours || [])) {
        try {
            const { data: existingLogs } = await supabase
                .from('communications_log')
                .select('id')
                .eq('tenant_id', lead.tenant_id)
                .ilike('content', `%24h Tour Reminder%${lead.phone}%`)
                .limit(1);

            if (!existingLogs || existingLogs.length === 0) {
                const tourTimeStr = new Date(lead.tour_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                await supabase.from('notification_queue').insert({
                    tenant_id: lead.tenant_id,
                    profile_id: null,
                    channel: 'sms',
                    recipient: lead.phone,
                    subject: 'Gym Tour Tomorrow',
                    content: `Hi ${lead.first_name}! Friendly reminder that your VIP gym tour is scheduled for tomorrow at ${tourTimeStr}. Free parking is available!`,
                    status: 'pending'
                });

                await supabase.from('communications_log').insert({
                    tenant_id: lead.tenant_id,
                    profile_id: null,
                    channel: 'sms',
                    direction: 'outbound',
                    status: 'pending',
                    content: `[Automated Drip] 24h Tour Reminder dispatched for ${lead.phone} at ${tourTimeStr}`
                });
            }
        } catch (e) {
            console.error(`[cron-drip] Tour reminder error for ${lead.id}:`, e);
        }
    }
}

/**
 * Automatically creates and issues gift vouchers for converted referrals.
 * Processes referral rewards that are 'converted' or 'pending' where the referee
 * has converted (lead is 'closed_won' or profile has active membership) and no voucher has been minted yet.
 */
async function processReferralRewardFulfillment(supabase) {
    // 1. Fetch rewards with status 'converted' or 'pending' without voucher
    const { data: candidateRewards, error } = await supabase
        .from('referral_rewards')
        .select(`
            id,
            tenant_id,
            referrer_profile_id,
            referee_lead_id,
            referee_profile_id,
            reward_amount_rwf,
            status,
            referral_code,
            profiles:referrer_profile_id(id, first_name, phone),
            referee_lead:referee_lead_id(id, pipeline_stage, converted_profile_id),
            referee_profile:referee_profile_id(id, membership_status)
        `)
        .in('status', ['converted', 'pending'])
        .is('reward_voucher_id', null);

    if (error || !candidateRewards || candidateRewards.length === 0) return;

    for (const reward of candidateRewards) {
        try {
            // Check if conversion condition is satisfied
            const isLeadWon = reward.referee_lead && reward.referee_lead.pipeline_stage === 'closed_won';
            const isProfileActive = reward.referee_profile && reward.referee_profile.membership_status === 'active';
            const isExplicitlyConverted = reward.status === 'converted';

            if (!isLeadWon && !isProfileActive && !isExplicitlyConverted) {
                // Referee hasn't converted yet, keep pending
                continue;
            }

            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let rand = '';
            for (let i = 0; i < 6; i++) {
                rand += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            const voucherCode = `REF-${rand}`;
            const amount = parseFloat(reward.reward_amount_rwf || 10000);
            const expiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

            // Create Gift Voucher
            const { data: voucher, error: vError } = await supabase
                .from('gift_vouchers')
                .insert({
                    tenant_id: reward.tenant_id,
                    code: voucherCode,
                    initial_balance_rwf: amount,
                    current_balance_rwf: amount,
                    expires_at: expiry
                })
                .select()
                .single();

            if (!vError && voucher) {
                // Update referral reward to rewarded
                await supabase
                    .from('referral_rewards')
                    .update({
                        status: 'rewarded',
                        reward_voucher_id: voucher.id,
                        reward_applied_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', reward.id);

                // Dispatch celebratory SMS to Referrer
                if (reward.profiles && reward.profiles.phone) {
                    await supabase.from('notification_queue').insert({
                        tenant_id: reward.tenant_id,
                        profile_id: reward.referrer_profile_id,
                        channel: 'sms',
                        recipient: reward.profiles.phone,
                        subject: 'Referral Reward Voucher Issued! 🎉',
                        content: `Hi ${reward.profiles.first_name}! Your referral bonus voucher is ready: ${voucherCode} (RWF ${amount.toLocaleString()}). Use it towards your next membership renewal or smoothie bar tab!`,
                        status: 'pending'
                    });
                }

                console.log(`[cron-referral-fulfillment] Successfully issued voucher ${voucherCode} for referral ${reward.id}`);
            }
        } catch (err) {
            console.error(`[cron-referral-fulfillment] Error fulfilling reward ${reward.id}:`, err);
        }
    }
}

module.exports = initCron;


