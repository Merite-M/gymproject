const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { dispatchMultiChannelMessage } = require('./gateways');
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
 * Execute a single node in a workflow for a member.
 */
async function executeWorkflowStep({ tenant_id, profile_id, workflow, currentNodeId, context = {} }) {
  if (!supabase || !workflow || !workflow.nodes) return null;

  const nodes = workflow.nodes || [];
  const node = nodes.find(n => n.id === currentNodeId);
  if (!node) {
    // End of workflow
    await supabase
      .from('member_workflow_state')
      .update({ status: 'completed', current_node_id: null, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenant_id)
      .eq('profile_id', profile_id)
      .eq('workflow_id', workflow.id);
    return { status: 'completed', finished: true };
  }

  // Fetch member profile details
  const { data: member } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profile_id)
    .eq('tenant_id', tenant_id)
    .single();

  const historyEntry = {
    node_id: node.id,
    node_type: node.type,
    title: node.title,
    executed_at: new Date().toISOString()
  };

  if (node.type === 'trigger') {
    // Advance to next node immediately
    return executeWorkflowStep({
      tenant_id,
      profile_id,
      workflow,
      currentNodeId: node.next_node_id,
      context
    });
  }

  if (node.type === 'action') {
    const config = node.config || {};
    const channel = config.channel || (node.subtype === 'send_whatsapp' ? 'whatsapp' : 'sms');
    const template = config.template || `Hello {{first_name}}, greeting from {{gym_name}}!`;
    const message = template
      .replace(/{{first_name}}/gi, member?.first_name || 'Member')
      .replace(/{{last_name}}/gi, member?.last_name || '')
      .replace(/{{gym_name}}/gi, 'GymPartner Kigali')
      .replace(/{{phone}}/gi, member?.phone || '');

    if (member?.phone) {
      try {
        await dispatchMultiChannelMessage({
          tenant_id,
          profile_id,
          channel,
          recipient: member.phone,
          subject: `${workflow.name} - ${node.title}`,
          message,
          metadata: { workflow_id: workflow.id, node_id: node.id },
          supabase
        });
      } catch (err) {
        console.error(`[drip_engine] Action dispatch error:`, err.message);
      }
    }

    // Advance to next node
    if (node.next_node_id) {
      return executeWorkflowStep({
        tenant_id,
        profile_id,
        workflow,
        currentNodeId: node.next_node_id,
        context
      });
    } else {
      // Completed
      await supabase
        .from('member_workflow_state')
        .upsert({
          tenant_id,
          profile_id,
          workflow_id: workflow.id,
          current_node_id: node.id,
          status: 'completed',
          updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id, profile_id, workflow_id' });
      return { status: 'completed', node_id: node.id };
    }
  }

  if (node.type === 'delay') {
    const delayHours = Number(node.config?.delay_hours || 24);
    const resumeAt = new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString();

    const { error: upsertErr } = await supabase
      .from('member_workflow_state')
      .upsert({
        tenant_id,
        profile_id,
        workflow_id: workflow.id,
        current_node_id: node.next_node_id || node.id,
        status: 'waiting_delay',
        resume_at: resumeAt,
        context,
        updated_at: new Date().toISOString()
      }, { onConflict: 'tenant_id, profile_id, workflow_id' });

    if (upsertErr) {
      console.error('[drip_engine] member_workflow_state upsert error:', upsertErr);
    }

    return { status: 'waiting_delay', resume_at: resumeAt, next_node_id: node.next_node_id };
  }

  return { status: 'in_progress', node_id: node.id };
}

/**
 * GET /api/workflows
 * Returns all visual workflows for the tenant.
 * Query: ?tenant_id=<uuid>
 */
router.get('/', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const { data: workflows, error } = await supabase
      .from('marketing_workflows')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, workflows: workflows || [] });
  } catch (error) {
    console.error('[workflows GET] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/workflows/:id
 * Single workflow details with nodes.
 */
router.get('/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    const { data: workflow, error } = await supabase
      .from('marketing_workflows')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (error || !workflow) return res.status(404).json({ error: 'Workflow not found' });

    res.json({ success: true, workflow });
  } catch (error) {
    console.error('[workflows/:id GET] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/workflows
 * Save / Create a new visual workflow.
 * Body: { tenant_id, name, trigger_type, description?, is_active?, nodes }
 */
router.post('/', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const {
      tenant_id,
      name,
      trigger_type = 'custom_event',
      description,
      is_active = true,
      nodes = []
    } = req.body;

    if (!tenant_id || !name) {
      return res.status(400).json({ error: 'Missing required parameters (tenant_id, name)' });
    }

    const { data: workflow, error } = await supabase
      .from('marketing_workflows')
      .insert({
        tenant_id,
        name,
        trigger_type,
        description: description || null,
        is_active,
        nodes: nodes || []
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, workflow });
  } catch (error) {
    console.error('[workflows POST] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/workflows/:id
 * Update an existing workflow's canvas nodes and settings.
 */
router.put('/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { id } = req.params;
    const { tenant_id, name, trigger_type, description, is_active, nodes } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (trigger_type !== undefined) updates.trigger_type = trigger_type;
    if (description !== undefined) updates.description = description;
    if (is_active !== undefined) updates.is_active = is_active;
    if (nodes !== undefined) updates.nodes = nodes;

    const { data: workflow, error } = await supabase
      .from('marketing_workflows')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, workflow });
  } catch (error) {
    console.error('[workflows/:id PUT] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/workflows/:id/trigger
 * Enroll and execute a workflow for a specific member profile.
 * Body: { tenant_id, profile_id, context? }
 */
router.post('/:id/trigger', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { id } = req.params;
    const { tenant_id, profile_id, context = {} } = req.body;

    if (!tenant_id || !profile_id) {
      return res.status(400).json({ error: 'Missing tenant_id or profile_id' });
    }

    const { data: workflow, error: wError } = await supabase
      .from('marketing_workflows')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (wError || !workflow) return res.status(404).json({ error: 'Workflow not found' });

    const nodes = workflow.nodes || [];
    const startNode = nodes.find(n => n.type === 'trigger') || nodes[0];
    if (!startNode) return res.status(400).json({ error: 'Workflow has no starting node' });

    const result = await executeWorkflowStep({
      tenant_id,
      profile_id,
      workflow,
      currentNodeId: startNode.id,
      context
    });

    res.json({
      success: true,
      message: `Enrolled profile in workflow "${workflow.name}"`,
      result
    });
  } catch (error) {
    console.error('[workflows/:id/trigger POST] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/workflows/:id/stats
 * Telemetry and progress metrics for a workflow.
 */
router.get('/:id/stats', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    const { data: states, error } = await supabase
      .from('member_workflow_state')
      .select('status')
      .eq('workflow_id', id)
      .eq('tenant_id', tenant_id);

    if (error) throw error;

    const totalEnrolled = (states || []).length;
    const activeWaiting = (states || []).filter(s => s.status === 'waiting_delay' || s.status === 'in_progress').length;
    const completed = (states || []).filter(s => s.status === 'completed').length;

    res.json({
      success: true,
      stats: {
        total_enrolled: totalEnrolled,
        active_waiting: activeWaiting,
        completed,
        conversion_rate: totalEnrolled > 0 ? Math.round((completed / totalEnrolled) * 100) : 0
      }
    });
  } catch (error) {
    console.error('[workflows/:id/stats GET] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = {
  router,
  executeWorkflowStep
};
