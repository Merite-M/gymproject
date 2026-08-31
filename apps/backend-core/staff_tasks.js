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
 * GET /api/tasks
 * Returns staff tasks filtered by status, priority, role, etc.
 * Query: ?tenant_id=<uuid>&status=<pending|in_progress|completed|all>&assigned_role=<reception|sales>&priority=<urgent|high|all>
 */
router.get('/', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { tenant_id, status = 'pending', assigned_role, priority } = req.query;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    let query = supabase
      .from('staff_tasks')
      .select(`
        *,
        profiles:profile_id ( id, first_name, last_name, phone, email, status )
      `)
      .eq('tenant_id', tenant_id)
      .order('due_date', { ascending: true });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (assigned_role && assigned_role !== 'all') {
      query = query.eq('assigned_role', assigned_role);
    }

    if (priority && priority !== 'all') {
      query = query.eq('priority', priority);
    }

    const { data: tasks, error } = await query;
    if (error) throw error;

    res.json({ success: true, tasks: tasks || [] });
  } catch (error) {
    console.error('[tasks GET] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/tasks/summary
 * Returns KPI counts of tasks (urgent, pending today, completed today, overdue).
 * Query: ?tenant_id=<uuid>
 */
router.get('/summary', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const { data: allTasks, error } = await supabase
      .from('staff_tasks')
      .select('id, priority, status, due_date')
      .eq('tenant_id', tenant_id);

    if (error) throw error;

    const now = new Date();
    const urgentCount = (allTasks || []).filter(t => t.priority === 'urgent' && t.status === 'pending').length;
    const pendingCount = (allTasks || []).filter(t => t.status === 'pending').length;
    const completedCount = (allTasks || []).filter(t => t.status === 'completed').length;
    const overdueCount = (allTasks || []).filter(t => t.status === 'pending' && new Date(t.due_date) < now).length;

    res.json({
      success: true,
      summary: {
        urgent: urgentCount,
        pending: pendingCount,
        completed: completedCount,
        overdue: overdueCount,
        total: (allTasks || []).length
      }
    });
  } catch (error) {
    console.error('[tasks/summary GET] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tasks
 * Create a staff task manually or via automation.
 * Body: { tenant_id, profile_id?, title, description?, trigger_event?, task_type?, priority?, due_date?, assigned_role?, assigned_to? }
 */
router.post('/', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const {
      tenant_id,
      profile_id,
      title,
      description,
      trigger_event = 'manual_created',
      task_type = 'follow_up',
      priority = 'medium',
      due_date,
      assigned_role = 'reception',
      assigned_to
    } = req.body;

    if (!tenant_id || !title) {
      return res.status(400).json({ error: 'Missing required parameters (tenant_id, title)' });
    }

    const computedDueDate = due_date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data: task, error } = await supabase
      .from('staff_tasks')
      .insert({
        tenant_id,
        profile_id: profile_id || null,
        title,
        description: description || null,
        trigger_event,
        task_type,
        priority,
        status: 'pending',
        due_date: computedDueDate,
        assigned_role,
        assigned_to: assigned_to || null
      })
      .select(`
        *,
        profiles:profile_id ( id, first_name, last_name, phone, email )
      `)
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, task });
  } catch (error) {
    console.error('[tasks POST] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tasks/:id/status
 * Resolve or update task progress.
 * Body: { tenant_id, status, outcome?, resolution_notes?, completed_by? }
 */
router.post('/:id/status', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { id } = req.params;
    const { tenant_id, status = 'completed', outcome, resolution_notes, completed_by } = req.body;

    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const updates = {
      status,
      resolution_notes: resolution_notes || null,
      outcome: outcome || null,
      updated_at: new Date().toISOString()
    };

    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
      updates.completed_by = completed_by || null;
    }

    const { data: task, error } = await supabase
      .from('staff_tasks')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select(`
        *,
        profiles:profile_id ( id, first_name, last_name, phone, email )
      `)
      .single();

    if (error) throw error;

    gymEmitter.emit('task.resolved', {
      tenant_id,
      task_id: id,
      title: task.title,
      status,
      outcome
    });

    res.json({ success: true, task });
  } catch (error) {
    console.error('[tasks/:id/status POST] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tasks/scan-churn-risks
 * Automated background scanner: looks for inactive members and generates staff tasks.
 * Body: { tenant_id, inactivity_days? }
 */
router.post('/scan-churn-risks', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { tenant_id, inactivity_days = 21 } = req.body;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const cutoffDate = new Date(Date.now() - inactivity_days * 24 * 60 * 60 * 1000).toISOString();

    // 1. Fetch active profiles
    const { data: profiles, error: pError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, phone, email')
      .eq('tenant_id', tenant_id)
      .eq('status', 'active');

    if (pError) throw pError;

    let tasksCreated = 0;

    for (const p of (profiles || [])) {
      // Check latest check-in
      const { data: checkIns } = await supabase
        .from('check_ins')
        .select('created_at')
        .eq('profile_id', p.id)
        .eq('tenant_id', tenant_id)
        .order('created_at', { ascending: false })
        .limit(1);

      const lastCheckIn = checkIns?.[0]?.created_at;
      const isInactive = !lastCheckIn || new Date(lastCheckIn) < new Date(cutoffDate);

      if (isInactive) {
        // Check if a pending task already exists for this member to avoid duplicate tasks
        const { data: existingTask } = await supabase
          .from('staff_tasks')
          .select('id')
          .eq('profile_id', p.id)
          .eq('tenant_id', tenant_id)
          .eq('trigger_event', 'member.churn_risk')
          .eq('status', 'pending')
          .limit(1);

        if (!existingTask || existingTask.length === 0) {
          await supabase.from('staff_tasks').insert({
            tenant_id,
            profile_id: p.id,
            title: `⚠️ Churn Risk: ${p.first_name} ${p.last_name}`,
            description: `Member has not checked in for over ${inactivity_days} days (Last visit: ${lastCheckIn ? new Date(lastCheckIn).toLocaleDateString() : 'Never'}). Call or WhatsApp to re-engage.`,
            trigger_event: 'member.churn_risk',
            task_type: 'retention_check',
            priority: 'high',
            status: 'pending',
            due_date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            assigned_role: 'reception'
          });
          tasksCreated++;
        }
      }
    }

    res.json({
      success: true,
      message: `Churn risk scan completed. ${tasksCreated} automated follow-up tasks created.`,
      tasks_created: tasksCreated
    });
  } catch (error) {
    console.error('[tasks/scan-churn-risks POST] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
