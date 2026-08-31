const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const router = express.Router();
const authMiddleware = require('./authMiddleware');
const { validateTenantAccess } = require('@gym-partner/shared-utils');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

const upload = multer({ storage: multer.memoryStorage() });

/**
 * GET /api/staff/shift
 * Retrieves active shift and associated checklist tasks for a staff member.
 */
router.get('/shift', authMiddleware, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase config missing' });
  try {
    const { tenant_id, staff_id } = req.query;
    if (!tenant_id || !staff_id) {
      return res.status(400).json({ error: 'Missing tenant_id or staff_id' });
    }

    const accessRes = await validateTenantAccess(supabase, req.user.id, tenant_id);
    if (!accessRes.authorized) {
      return res.status(accessRes.status || 403).json({ error: accessRes.error });
    }

    // Ensure user is acting on their own behalf, unless they are admin/manager
    if (staff_id !== req.user.id && accessRes.role !== 'admin' && accessRes.role !== 'manager' && accessRes.role !== 'super_admin') {
      return res.status(403).json({ error: 'Not authorized to view this staff shift' });
    }

    // Get tenant feature flags
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('staff_roster_enabled')
      .eq('id', tenant_id)
      .single();

    if (tenantError) throw tenantError;

    if (!tenant.staff_roster_enabled) {
      return res.status(403).json({ error: 'Staff roster feature is disabled for this tenant' });
    }

    // Get active shift
    const { data: activeShift, error: shiftError } = await supabase
      .from('shift_ledgers')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('staff_id', staff_id)
      .eq('status', 'open')
      .order('shift_start', { ascending: false })
      .limit(1)
      .single();

    if (shiftError && shiftError.code !== 'PGRST116') throw shiftError;

    if (!activeShift) {
      return res.json({ shift: null, tasks: [] });
    }

    // Get tasks for this shift, including template details
    const { data: tasks, error: tasksError } = await supabase
      .from('shift_tasks')
      .select(`
        *,
        task_template:task_templates(name, description, is_mandatory, requires_photo_evidence)
      `)
      .eq('shift_id', activeShift.id);

    if (tasksError) throw tasksError;

    res.json({ shift: activeShift, tasks });
  } catch (error) {
    console.error('[staff/shift] error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/staff/shift/start
 * Starts a new staff shift and initializes assigned tasks from templates.
 */
router.post('/shift/start', authMiddleware, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase config missing' });
  try {
    const { tenant_id, staff_id, starting_cash } = req.body;
    if (!tenant_id || !staff_id) {
      return res.status(400).json({ error: 'Missing tenant_id or staff_id' });
    }

    const accessRes = await validateTenantAccess(supabase, req.user.id, tenant_id);
    if (!accessRes.authorized) {
      return res.status(accessRes.status || 403).json({ error: accessRes.error });
    }

    // Ensure user is acting on their own behalf, unless they are admin/manager
    if (staff_id !== req.user.id && accessRes.role !== 'admin' && accessRes.role !== 'manager' && accessRes.role !== 'super_admin') {
      return res.status(403).json({ error: 'Not authorized to start shift for this staff' });
    }

    // Check if already active
    const { data: existing } = await supabase
      .from('shift_ledgers')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('staff_id', staff_id)
      .eq('status', 'open')
      .single();

    if (existing) return res.status(400).json({ error: 'Shift already active' });

    // Start shift
    const { data: shift, error: shiftError } = await supabase
      .from('shift_ledgers')
      .insert({
        tenant_id,
        staff_id,
        starting_cash: starting_cash || 0,
        expected_cash: starting_cash || 0,
        shift_start: new Date().toISOString(),
        status: 'open',
      })
      .select()
      .single();

    if (shiftError) throw shiftError;

    // Get staff role to assign appropriate tasks
    const { data: staffData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', staff_id)
      .single();
    const role = staffData ? staffData.role : 'staff';

    // Auto-assign tasks based on templates
    const { data: templates } = await supabase
      .from('task_templates')
      .select('*')
      .eq('tenant_id', tenant_id)
      .or(`role_target.eq.${role},role_target.is.null`);

    if (templates && templates.length > 0) {
      const tasksToInsert = templates.map((t) => ({
        tenant_id,
        shift_id: shift.id,
        task_template_id: t.id,
        status: 'pending',
      }));
      await supabase.from('shift_tasks').insert(tasksToInsert);
    }

    res.json(shift);
  } catch (e) {
    console.error('[staff/shift/start] error:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/staff/task/complete
 * Completes a specific shift task with optional photo upload.
 */
router.post('/task/complete', authMiddleware, upload.single('photo'), async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase config missing' });
  try {
    const { task_id, tenant_id, staff_id, notes } = req.body;
    if (!task_id || !tenant_id || !staff_id) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    const accessRes = await validateTenantAccess(supabase, req.user.id, tenant_id);
    if (!accessRes.authorized) {
      return res.status(accessRes.status || 403).json({ error: accessRes.error });
    }

    // Ensure user is acting on their own behalf, unless they are admin/manager
    if (staff_id !== req.user.id && accessRes.role !== 'admin' && accessRes.role !== 'manager' && accessRes.role !== 'super_admin') {
      return res.status(403).json({ error: 'Not authorized to complete task for this staff' });
    }

    // Verify task exists and needs photo
    const { data: task, error: taskError } = await supabase
      .from('shift_tasks')
      .select(`*, task_template:task_templates(requires_photo_evidence)`)
      .eq('id', task_id)
      .single();

    if (taskError) throw taskError;

    let photo_url = null;

    if (task.task_template?.requires_photo_evidence) {
      if (!req.file) return res.status(400).json({ error: 'Photo evidence is required for this task' });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${tenant_id}/${staff_id}/task_${task_id}_${timestamp}.jpg`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('shift_photos')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;
      photo_url = uploadData.path;
    }

    // Update task
    const { data: updatedTask, error: updateError } = await supabase
      .from('shift_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: staff_id,
        notes: notes || null,
        photo_url: photo_url,
      })
      .eq('id', task_id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json(updatedTask);
  } catch (error) {
    console.error('[staff/task/complete] error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/staff/shift/end
 * Ends active shift and checks for mandatory tasks and cash discrepancy.
 */
router.post('/shift/end', authMiddleware, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase config missing' });
  try {
    const { shift_id, tenant_id, actual_cash } = req.body;

    if (!shift_id || !tenant_id) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    const accessRes = await validateTenantAccess(supabase, req.user.id, tenant_id);
    if (!accessRes.authorized) {
      return res.status(accessRes.status || 403).json({ error: accessRes.error });
    }

    const { data: shiftToCheck, error: shiftFetchCheckError } = await supabase
      .from('shift_ledgers')
      .select('staff_id, expected_cash')
      .eq('id', shift_id)
      .single();
    if (shiftFetchCheckError) return res.status(404).json({ error: 'Shift not found' });

    // Ensure user is acting on their own behalf, unless they are admin/manager
    if (shiftToCheck.staff_id !== req.user.id && accessRes.role !== 'admin' && accessRes.role !== 'manager' && accessRes.role !== 'super_admin') {
      return res.status(403).json({ error: 'Not authorized to end shift for this staff' });
    }

    // Check for incomplete mandatory tasks
    const { data: incompleteTasks, error: incError } = await supabase
      .from('shift_tasks')
      .select('id, task_template:task_templates(is_mandatory)')
      .eq('shift_id', shift_id)
      .eq('status', 'pending');

    if (incError) throw incError;

    const hasMandatoryIncomplete = incompleteTasks.some((t) => t.task_template?.is_mandatory);

    if (hasMandatoryIncomplete) {
      return res.status(400).json({ error: 'Cannot end shift: Mandatory tasks are incomplete.' });
    }

    let status = 'closed';
    if (actual_cash !== undefined && parseFloat(actual_cash) !== parseFloat(shiftToCheck.expected_cash)) {
      status = 'discrepancy';
    }

    const { data, error } = await supabase
      .from('shift_ledgers')
      .update({
        shift_end: new Date().toISOString(),
        actual_cash: actual_cash || shiftToCheck.expected_cash, // fallback if not providing cash
        status,
      })
      .eq('id', shift_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('[staff/shift/end] error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/staff/manager/review
 * Manager view for shift ledger logs and completed checklist audits.
 */
router.get('/manager/review', authMiddleware, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase config missing' });
  try {
    const { tenant_id, date } = req.query;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const accessRes = await validateTenantAccess(supabase, req.user.id, tenant_id, ['admin', 'manager']);
    if (!accessRes.authorized) {
      return res.status(accessRes.status || 403).json({ error: accessRes.error });
    }

    let query = supabase
      .from('shift_ledgers')
      .select(`
        *,
        staff:profiles(first_name, last_name),
        tasks:shift_tasks(
          id, status, completed_at, photo_url, notes,
          template:task_templates(name, is_mandatory)
        )
      `)
      .eq('tenant_id', tenant_id)
      .order('shift_start', { ascending: false })
      .limit(50);

    if (date) {
      const startOfDay = new Date(date).toISOString();
      const endOfDay = new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('shift_start', startOfDay).lt('shift_start', endOfDay);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (e) {
    console.error('[staff/manager/review] error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
