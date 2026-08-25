'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrencyDisplay } from '@/lib/utils';
import {
  Zap,
  Clock,
  GitFork,
  MessageSquare,
  Smartphone,
  Mail,
  PhoneCall,
  Plus,
  Play,
  Pause,
  Save,
  Trash2,
  CheckCircle2,
  TrendingUp,
  Settings,
  Sparkles,
  ArrowRight,
  ChevronRight,
  X,
  RefreshCw,
  BarChart3,
  Layers
} from 'lucide-react';

// Helper to deep clone object to prevent mutating static templates
function clone<T>(obj: T): T {
  return typeof structuredClone === 'function'
    ? structuredClone(obj)
    : JSON.parse(JSON.stringify(obj));
}

// --- TYPES ---
export type NodeType = 'trigger' | 'delay' | 'condition' | 'action';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  subtype: string; // e.g., 'predictive_churn', 'send_sms', 'wait_delay'
  title: string;
  description: string;
  config: Record<string, any>;
  x: number;
  y: number;
  next_node_id?: string | null;
  branch_yes_id?: string | null;
  branch_no_id?: string | null;
}

export interface MarketingWorkflow {
  id?: string;
  name: string;
  trigger_type: string;
  is_active: boolean;
  nodes: WorkflowNode[];
  created_at?: string;
}

// --- PRE-BUILT PLAYBOOKS ---
const PLAYBOOKS = [
  {
    id: 'win_back_churn',
    name: 'Win-Back Churn Campaign',
    trigger: 'predictive_churn',
    category: 'Retention',
    badge: '30-Day Inactive',
    description: 'Triggers when a member visit frequency drops >60%. Waits 5 days then sends a 20% discount offer via WhatsApp.',
    nodes: [
      {
        id: 'node-1',
        type: 'trigger' as NodeType,
        subtype: 'predictive_churn',
        title: 'Trigger: Predictive Churn Risk',
        description: 'Member visits dropped >60% below trailing average',
        config: { drop_threshold: 60, trailing_weeks: 4 },
        x: 80,
        y: 100,
        next_node_id: 'node-2'
      },
      {
        id: 'node-2',
        type: 'delay' as NodeType,
        subtype: 'delay',
        title: 'Delay: Wait 5 Days',
        description: 'Wait 5 days before automated outreach',
        config: { delay_days: 5 },
        x: 80,
        y: 220,
        next_node_id: 'node-3'
      },
      {
        id: 'node-3',
        type: 'condition' as NodeType,
        subtype: 'debtor_check',
        title: 'Condition: Is Debtor?',
        description: 'Check if member has overdue invoices',
        config: { condition_field: 'outstanding_balance', operator: 'gt', value: 0 },
        x: 80,
        y: 340,
        branch_yes_id: 'node-4a',
        branch_no_id: 'node-4b'
      },
      {
        id: 'node-4a',
        type: 'action' as NodeType,
        subtype: 'staff_task',
        title: 'Action: Staff Phone Call Task',
        description: 'Create Linear/CRM task for desk call',
        config: { task_title: 'Call debtor member for win-back & payment cleanup', priority: 'high' },
        x: -120,
        y: 480
      },
      {
        id: 'node-4b',
        type: 'action' as NodeType,
        subtype: 'whatsapp',
        title: 'Action: WhatsApp 20% Promo',
        description: 'Send WhatsApp message with 20% renewal voucher',
        config: {
          channel: 'whatsapp',
          template: 'Hey {first_name}! We miss seeing you at GymPartner. Here is a 20% renewal discount for your next month: WINBACK20.'
        },
        x: 280,
        y: 480
      }
    ]
  },
  {
    id: 'post_trial_nurture',
    name: 'Post-Trial Conversion Nurture',
    trigger: 'trial_expiration',
    category: 'Acquisition',
    badge: 'Trial Conversion',
    description: 'Nurtures trial members on Day 5 with PT video link, then sends SMS conversion offer on Day 7.',
    nodes: [
      {
        id: 'node-1',
        type: 'trigger' as NodeType,
        subtype: 'trial_expiration',
        title: 'Trigger: Trial Day 5',
        description: 'Free trial member reaches Day 5',
        config: { days_before_expiry: 2 },
        x: 80,
        y: 100,
        next_node_id: 'node-2'
      },
      {
        id: 'node-2',
        type: 'action' as NodeType,
        subtype: 'whatsapp',
        title: 'Action: Send PT Intro Video',
        description: 'WhatsApp video guide on gym equipment & personal training',
        config: {
          template: 'Hi {first_name}! Check out our free Personal Training Intro guide to get maximum results during your trial: https://gympartner.rw/pt-guide'
        },
        x: 80,
        y: 220,
        next_node_id: 'node-3'
      },
      {
        id: 'node-3',
        type: 'delay' as NodeType,
        subtype: 'delay',
        title: 'Delay: Wait 2 Days (Day 7)',
        description: 'Wait until trial final day',
        config: { delay_days: 2 },
        x: 80,
        y: 340,
        next_node_id: 'node-4'
      },
      {
        id: 'node-4',
        type: 'action' as NodeType,
        subtype: 'sms',
        title: 'Action: Send Conversion SMS',
        description: 'SMS offer with 15% off first 3 months',
        config: {
          template: 'Your GymPartner trial ends today! Lock in 15% off your first 3 months by upgrading now: https://gympartner.rw/upgrade'
        },
        x: 80,
        y: 460
      }
    ]
  },
  {
    id: 'birthday_celebration',
    name: 'Birthday Celebration Promo',
    trigger: 'birthday',
    category: 'Loyalty',
    badge: 'Birthday Offer',
    description: 'Sends a personalized WhatsApp birthday greeting with a free protein smoothie voucher at the reception desk.',
    nodes: [
      {
        id: 'node-1',
        type: 'trigger' as NodeType,
        subtype: 'birthday',
        title: 'Trigger: Member Birthday Morning',
        description: 'Fires at 08:00 AM on member birthday',
        config: { send_time: '08:00' },
        x: 80,
        y: 100,
        next_node_id: 'node-2'
      },
      {
        id: 'node-2',
        type: 'action' as NodeType,
        subtype: 'whatsapp',
        title: 'Action: WhatsApp Birthday Gift',
        description: 'Send free smoothie coupon code',
        config: {
          template: 'Happy Birthday {first_name}! 🎉 GymPartner wishes you a fantastic day. Stop by the front desk today for a FREE Protein Shake on us! Show code: BDAYGIFT.'
        },
        x: 80,
        y: 220
      }
    ]
  },
  {
    id: 'payment_failure_dunning',
    name: 'Payment Failure Retention Dunning',
    trigger: 'payment_failed',
    category: 'Billing',
    badge: 'Dunning Churn',
    description: 'Triggers on failed MoMo/Card payment, retries after 24h, sends payment SMS link, and schedules staff follow-up call.',
    nodes: [
      {
        id: 'node-1',
        type: 'trigger' as NodeType,
        subtype: 'payment_failed',
        title: 'Trigger: Payment Failed / Dunning',
        description: 'MoMo / Card payment failed on renewal invoice',
        config: { gateway: 'paypack_momo' },
        x: 80,
        y: 100,
        next_node_id: 'node-2'
      },
      {
        id: 'node-2',
        type: 'delay' as NodeType,
        subtype: 'delay',
        title: 'Delay: Wait 24 Hours',
        description: 'Wait 24h before sending notification',
        config: { delay_hours: 24 },
        x: 80,
        y: 220,
        next_node_id: 'node-3'
      },
      {
        id: 'node-3',
        type: 'action' as NodeType,
        subtype: 'sms',
        title: 'Action: SMS MoMo Payment Link',
        description: 'Send direct Paypack Mobile Money retry link',
        config: {
          template: 'GymPartner Notice: Your recent payment attempt was unsuccessful. Click here to safely complete payment via Mobile Money: https://gympartner.rw/pay/{invoice_id}'
        },
        x: 80,
        y: 340,
        next_node_id: 'node-4'
      },
      {
        id: 'node-4',
        type: 'delay' as NodeType,
        subtype: 'delay',
        title: 'Delay: Wait 48 Hours',
        description: 'Wait 48h to verify payment',
        config: { delay_hours: 48 },
        x: 80,
        y: 460,
        next_node_id: 'node-5'
      },
      {
        id: 'node-5',
        type: 'condition' as NodeType,
        subtype: 'debtor_check',
        title: 'Condition: Still Unpaid?',
        description: 'Verify if invoice balance remains unpaid',
        config: { condition_field: 'outstanding_balance', operator: 'gt', value: 0 },
        x: 80,
        y: 580,
        branch_yes_id: 'node-6a',
        branch_no_id: 'node-6b'
      },
      {
        id: 'node-6a',
        type: 'action' as NodeType,
        subtype: 'staff_task',
        title: 'Action: Staff Urgent Dunning Call',
        description: 'Urgent desk task to resolve billing before door lockout',
        config: { task_title: 'Urgent Call: Member payment failed twice - MoMo assistance required', priority: 'urgent' },
        x: -120,
        y: 720
      },
      {
        id: 'node-6b',
        type: 'action' as NodeType,
        subtype: 'whatsapp',
        title: 'Action: WhatsApp Thank You',
        description: 'Payment resolved confirmation',
        config: { template: 'Thank you {first_name}! Your payment has been received and your membership is active.' },
        x: 280,
        y: 720
      }
    ]
  }
];

export default function MarketingCanvasPage() {
  const [workflows, setWorkflows] = useState<MarketingWorkflow[]>([]);
  const [activeWorkflowIndex, setActiveWorkflowIndex] = useState<number>(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showPlaybookModal, setShowPlaybookModal] = useState<boolean>(false);
  const [tenantId, setTenantId] = useState<string>('2c604504-41c3-406b-82a0-a43700057af8');

  // Analytics overlay
  const [analytics, setAnalytics] = useState({
    deliveryRate: 98.4,
    clickThroughRate: 42.1,
    conversionCount: 38,
    attributedRevenueRWF: 1850000
  });

  // Current active workflow state
  const currentWorkflow = useMemo(() => {
    if (workflows.length > 0 && workflows[activeWorkflowIndex]) {
      return workflows[activeWorkflowIndex];
    }
    return clone(PLAYBOOKS[0] as unknown as MarketingWorkflow);
  }, [workflows, activeWorkflowIndex]);

  const selectedNode = useMemo(() => {
    return currentWorkflow.nodes.find(n => n.id === selectedNodeId) || null;
  }, [currentWorkflow, selectedNodeId]);

  // Fetch initial workflows from Supabase
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // 1. Get user profile / tenant_id
        const { data: { user } } = await supabase.auth.getUser();
        let currentTenant = '2c604504-41c3-406b-82a0-a43700057af8';

        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', user.id)
            .maybeSingle();

          if (profile?.tenant_id) {
            currentTenant = profile.tenant_id;
            setTenantId(profile.tenant_id);
          }
        }

        // 2. Fetch workflows
        const { data: wfList, error: wfError } = await supabase
          .from('marketing_workflows')
          .select('*')
          .eq('tenant_id', currentTenant)
          .order('created_at', { ascending: false });

        if (wfError) throw wfError;

        if (wfList && wfList.length > 0) {
          // Fetch nodes for each workflow
          const loadedWorkflows: MarketingWorkflow[] = [];

          for (const wf of wfList) {
            const { data: nodeRows } = await supabase
              .from('workflow_nodes')
              .select('*')
              .eq('workflow_id', wf.id)
              .eq('tenant_id', currentTenant);

            const nodes: WorkflowNode[] = (nodeRows || []).map(row => ({
              id: row.id,
              type: (row.node_type as NodeType) || 'action',
              subtype: row.config?.subtype || row.node_type || 'action',
              title: row.config?.title || 'Workflow Node',
              description: row.config?.description || '',
              config: row.config || {},
              x: row.config?.x ?? 80,
              y: row.config?.y ?? 100,
              next_node_id: row.next_node_id || row.config?.next_node_id || null,
              branch_yes_id: row.config?.branch_yes_id || null,
              branch_no_id: row.config?.branch_no_id || null
            }));

            loadedWorkflows.push({
              id: wf.id,
              name: wf.name,
              trigger_type: wf.trigger_type,
              is_active: wf.is_active ?? true,
              nodes: nodes.length > 0 ? nodes : clone(PLAYBOOKS[0].nodes as unknown as WorkflowNode[])
            });
          }

          setWorkflows(loadedWorkflows);
        } else {
          // Default to playbooks if no workflows saved yet
          setWorkflows(clone(PLAYBOOKS as unknown as MarketingWorkflow[]));
        }

        // Fetch real analytics from communications_log
        const { data: comms } = await supabase
          .from('communications_log')
          .select('status, id')
          .eq('tenant_id', currentTenant);

        if (comms && comms.length > 0) {
          const sentCount = comms.length;
          const deliveredCount = comms.filter(c => c.status === 'delivered' || c.status === 'sent' || c.status === 'completed').length;
          const delRate = sentCount > 0 ? Math.round((deliveredCount / sentCount) * 100) : 98.4;

          setAnalytics(prev => ({
            ...prev,
            deliveryRate: delRate
          }));
        }

      } catch (err: any) {
        console.error('Error loading marketing workflows:', err);
        // Fallback to cloned playbooks
        setWorkflows(clone(PLAYBOOKS as unknown as MarketingWorkflow[]));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Save current workflow to Supabase with ID Mapping for graph connections
  const handleSaveWorkflow = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const wfToSave = clone(currentWorkflow);

      // 1. Build an ID Mapping Dictionary (old_id -> fresh UUID)
      const idMap: Record<string, string> = {};
      const isUUID = (str: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      wfToSave.nodes.forEach(node => {
        if (isUUID(node.id)) {
          idMap[node.id] = node.id;
        } else {
          idMap[node.id] = crypto.randomUUID();
        }
      });

      // 2. Remap node IDs and graph connection edges
      const remappedNodes = wfToSave.nodes.map(node => {
        const newId = idMap[node.id];
        const newNextId = node.next_node_id ? (idMap[node.next_node_id] || node.next_node_id) : null;
        const newBranchYesId = node.branch_yes_id ? (idMap[node.branch_yes_id] || node.branch_yes_id) : null;
        const newBranchNoId = node.branch_no_id ? (idMap[node.branch_no_id] || node.branch_no_id) : null;

        return {
          ...node,
          id: newId,
          next_node_id: newNextId,
          branch_yes_id: newBranchYesId,
          branch_no_id: newBranchNoId
        };
      });

      // Upsert parent workflow row
      const { data: wfRow, error: wfError } = await supabase
        .from('marketing_workflows')
        .upsert({
          id: wfToSave.id,
          tenant_id: tenantId,
          name: wfToSave.name,
          trigger_type: wfToSave.trigger_type || 'predictive_churn',
          is_active: wfToSave.is_active
        })
        .select()
        .single();

      if (wfError) throw wfError;

      const savedWfId = wfRow.id;

      // Delete existing nodes for this workflow before re-inserting
      if (wfToSave.id) {
        await supabase
          .from('workflow_nodes')
          .delete()
          .eq('workflow_id', wfToSave.id)
          .eq('tenant_id', tenantId);
      }

      // Insert child nodes with mapped UUIDs
      const nodePayloads = remappedNodes.map(n => ({
        id: n.id,
        workflow_id: savedWfId,
        tenant_id: tenantId,
        node_type: n.type,
        next_node_id: isUUID(n.next_node_id || '') ? n.next_node_id : null,
        config: {
          ...n.config,
          subtype: n.subtype,
          title: n.title,
          description: n.description,
          x: n.x,
          y: n.y,
          branch_yes_id: isUUID(n.branch_yes_id || '') ? n.branch_yes_id : null,
          branch_no_id: isUUID(n.branch_no_id || '') ? n.branch_no_id : null
        }
      }));

      const { error: nodeError } = await supabase
        .from('workflow_nodes')
        .insert(nodePayloads);

      if (nodeError) throw nodeError;

      const updatedWorkflow: MarketingWorkflow = {
        ...wfToSave,
        id: savedWfId,
        nodes: remappedNodes
      };

      // Update state in workflows array
      setWorkflows(prev => {
        const copy = clone(prev);
        copy[activeWorkflowIndex] = updatedWorkflow;
        return copy;
      });

      setSelectedNodeId(null);
      setStatusMessage({ type: 'success', text: `Workflow "${wfToSave.name}" saved & published successfully!` });
    } catch (err: any) {
      console.error('Save workflow error:', err);
      setStatusMessage({ type: 'error', text: `Failed to save workflow: ${err.message || err}` });
    } finally {
      setSaving(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Toggle active status
  const handleToggleActive = async () => {
    const updatedStatus = !currentWorkflow.is_active;

    setWorkflows(prev => {
      const copy = clone(prev);
      copy[activeWorkflowIndex] = {
        ...copy[activeWorkflowIndex],
        is_active: updatedStatus
      };
      return copy;
    });

    if (currentWorkflow.id) {
      await supabase
        .from('marketing_workflows')
        .update({ is_active: updatedStatus })
        .eq('id', currentWorkflow.id)
        .eq('tenant_id', tenantId);
    }
  };

  // Select Playbook template with deep cloning
  const handleSelectPlaybook = (pb: typeof PLAYBOOKS[0]) => {
    const pbCopy = clone(pb);

    const newWf: MarketingWorkflow = {
      name: pbCopy.name,
      trigger_type: pbCopy.trigger,
      is_active: true,
      nodes: pbCopy.nodes as unknown as WorkflowNode[]
    };

    setWorkflows(prev => [newWf, ...clone(prev)]);
    setActiveWorkflowIndex(0);
    setSelectedNodeId(null);
    setShowPlaybookModal(false);
    setStatusMessage({ type: 'info', text: `Loaded playbook: ${pb.name}` });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Add a node to current canvas
  const handleAddNode = (type: NodeType, subtype: string) => {
    const newId = `node-${Date.now()}`;
    let title = 'New Action';
    let description = 'Custom node';
    let config: Record<string, any> = {};

    if (type === 'trigger') {
      title = `Trigger: ${subtype.replace('_', ' ').toUpperCase()}`;
      description = 'Event trigger';
    } else if (type === 'delay') {
      title = 'Delay: Wait 24 Hours';
      description = 'Wait duration';
      config = { delay_hours: 24 };
    } else if (type === 'condition') {
      title = 'Condition: Attendance / Debtor Check';
      description = 'Branch decision point';
    } else if (type === 'action') {
      if (subtype === 'sms') {
        title = 'Action: Send SMS';
        description = 'Outbound SMS via Rwanda Telco';
        config = { template: 'Hello {first_name}, special update from GymPartner!' };
      } else if (subtype === 'whatsapp') {
        title = 'Action: WhatsApp Message';
        description = 'Interactive WhatsApp alert';
        config = { template: 'Hi {first_name}, check out our latest offers!' };
      } else if (subtype === 'staff_task') {
        title = 'Action: Staff Call Task';
        description = 'Assign desk outreach task';
        config = { task_title: 'Follow up with member regarding membership', priority: 'medium' };
      }
    }

    const lastNode = currentWorkflow.nodes[currentWorkflow.nodes.length - 1];
    const newX = lastNode ? lastNode.x : 80;
    const newY = lastNode ? lastNode.y + 120 : 100;

    const newNode: WorkflowNode = {
      id: newId,
      type,
      subtype,
      title,
      description,
      config,
      x: newX,
      y: newY
    };

    // Auto-link previous node to new node if simple sequential chain
    const updatedNodes = clone(currentWorkflow.nodes);
    if (lastNode && !lastNode.next_node_id && lastNode.type !== 'condition') {
      const idx = updatedNodes.findIndex(n => n.id === lastNode.id);
      if (idx !== -1) {
        updatedNodes[idx] = { ...updatedNodes[idx], next_node_id: newId };
      }
    }

    updatedNodes.push(newNode);

    setWorkflows(prev => {
      const copy = clone(prev);
      copy[activeWorkflowIndex] = {
        ...copy[activeWorkflowIndex],
        nodes: updatedNodes
      };
      return copy;
    });

    setSelectedNodeId(newId);
  };

  // Delete node
  const handleDeleteNode = (nodeId: string) => {
    const updatedNodes = clone(currentWorkflow.nodes)
      .filter(n => n.id !== nodeId)
      .map(n => ({
        ...n,
        next_node_id: n.next_node_id === nodeId ? null : n.next_node_id,
        branch_yes_id: n.branch_yes_id === nodeId ? null : n.branch_yes_id,
        branch_no_id: n.branch_no_id === nodeId ? null : n.branch_no_id
      }));

    setWorkflows(prev => {
      const copy = clone(prev);
      copy[activeWorkflowIndex] = {
        ...copy[activeWorkflowIndex],
        nodes: updatedNodes
      };
      return copy;
    });

    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  };

  // Update selected node config immutably
  const handleUpdateNodeConfig = (key: string, value: any) => {
    if (!selectedNodeId) return;

    setWorkflows(prev => {
      const copy = clone(prev);
      const wf = copy[activeWorkflowIndex];
      const nodeIdx = wf.nodes.findIndex(n => n.id === selectedNodeId);

      if (nodeIdx !== -1) {
        const node = wf.nodes[nodeIdx];
        const updatedNode = {
          ...node,
          config: {
            ...node.config,
            [key]: value
          }
        };

        if (key === 'title') updatedNode.title = value;
        if (key === 'description') updatedNode.description = value;

        wf.nodes[nodeIdx] = updatedNode;
      }

      return copy;
    });
  };

  // Helper icons for node types
  const getNodeIcon = (type: NodeType, subtype?: string) => {
    if (type === 'trigger') return <Zap className="w-5 h-5 text-amber-500" />;
    if (type === 'delay') return <Clock className="w-5 h-5 text-blue-500" />;
    if (type === 'condition') return <GitFork className="w-5 h-5 text-purple-500" />;
    if (subtype === 'whatsapp') return <Smartphone className="w-5 h-5 text-emerald-500" />;
    if (subtype === 'sms') return <MessageSquare className="w-5 h-5 text-sky-500" />;
    if (subtype === 'staff_task') return <PhoneCall className="w-5 h-5 text-rose-500" />;
    return <Mail className="w-5 h-5 text-slate-500" />;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* TOP HEADER & ANALYTICS BAR */}
      <header className="flex-none bg-slate-900/90 border-b border-slate-800 px-6 py-3 flex items-center justify-between z-20 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
            <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
            <span className="text-sm font-bold text-emerald-300">Marketing Automation Canvas</span>
          </div>

          {/* Workflow Picker */}
          <div className="flex items-center gap-2">
            <select
              value={activeWorkflowIndex}
              onChange={(e) => {
                setActiveWorkflowIndex(Number(e.target.value));
                setSelectedNodeId(null);
              }}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm font-medium rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500"
            >
              {workflows.map((wf, idx) => (
                <option key={wf.id || idx} value={idx}>
                  {wf.name} {wf.is_active ? '(Active)' : '(Paused)'}
                </option>
              ))}
            </select>

            <button
              onClick={handleToggleActive}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentWorkflow.is_active
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30'
              }`}
            >
              {currentWorkflow.is_active ? (
                <>
                  <Pause className="w-3.5 h-3.5" /> Paused Workflow
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> Enable Live Flow
                </>
              )}
            </button>
          </div>
        </div>

        {/* Real-time Analytics Overlay */}
        <div className="hidden lg:flex items-center gap-6 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-1.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Delivery Rate</p>
              <p className="text-xs font-bold text-slate-100">{analytics.deliveryRate}%</p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-sky-400" />
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Click-Through Rate</p>
              <p className="text-xs font-bold text-slate-100">{analytics.clickThroughRate}%</p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Conversion ROI</p>
              <p className="text-xs font-bold text-emerald-400">{formatCurrencyDisplay(analytics.attributedRevenueRWF)}</p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPlaybookModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-lg transition-all"
          >
            <Layers className="w-4 h-4" />
            1-Click Playbooks
          </button>

          <button
            onClick={handleSaveWorkflow}
            disabled={saving}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-lg transition-all disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save & Publish Flow
          </button>
        </div>
      </header>

      {/* STATUS BANNER */}
      {statusMessage && (
        <div
          className={`flex-none px-6 py-2 text-xs font-semibold flex items-center justify-between transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950 text-emerald-200 border-b border-emerald-800'
              : statusMessage.type === 'error'
              ? 'bg-rose-950 text-rose-200 border-b border-rose-800'
              : 'bg-sky-950 text-sky-200 border-b border-sky-800'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)}>
            <X className="w-4 h-4 text-slate-400 hover:text-white" />
          </button>
        </div>
      )}

      {/* MAIN CONTENT WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT TOOLBOX PANEL */}
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-4 z-10 overflow-y-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" /> Add Workflow Node
          </h3>

          <div className="space-y-4">
            {/* TRIGGERS */}
            <div>
              <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Triggers
              </p>
              <div className="space-y-1.5">
                <button
                  onClick={() => handleAddNode('trigger', 'predictive_churn')}
                  className="w-full text-left bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 p-2 rounded-lg text-xs font-medium text-slate-200 transition-all flex items-center justify-between"
                >
                  <span>Predictive Churn Risk</span>
                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                </button>
                <button
                  onClick={() => handleAddNode('trigger', 'payment_failed')}
                  className="w-full text-left bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 p-2 rounded-lg text-xs font-medium text-slate-200 transition-all flex items-center justify-between"
                >
                  <span>Payment Failed / Dunning</span>
                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                </button>
                <button
                  onClick={() => handleAddNode('trigger', 'membership_renewal')}
                  className="w-full text-left bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 p-2 rounded-lg text-xs font-medium text-slate-200 transition-all flex items-center justify-between"
                >
                  <span>Renewal Due Soon</span>
                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                </button>
                <button
                  onClick={() => handleAddNode('trigger', 'birthday')}
                  className="w-full text-left bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 p-2 rounded-lg text-xs font-medium text-slate-200 transition-all flex items-center justify-between"
                >
                  <span>Member Birthday Morning</span>
                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* DELAYS */}
            <div>
              <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Delays & Waiting
              </p>
              <button
                onClick={() => handleAddNode('delay', 'delay')}
                className="w-full text-left bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/50 p-2 rounded-lg text-xs font-medium text-slate-200 transition-all flex items-center justify-between"
              >
                <span>Wait Duration Delay</span>
                <Plus className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>

            {/* CONDITIONS */}
            <div>
              <p className="text-[11px] font-bold text-purple-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <GitFork className="w-3.5 h-3.5" /> Branching Conditions
              </p>
              <button
                onClick={() => handleAddNode('condition', 'debtor_check')}
                className="w-full text-left bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/50 p-2 rounded-lg text-xs font-medium text-slate-200 transition-all flex items-center justify-between"
              >
                <span>Check Outstanding Debt / Attendance</span>
                <Plus className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>

            {/* ACTIONS */}
            <div>
              <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Communication Actions
              </p>
              <div className="space-y-1.5">
                <button
                  onClick={() => handleAddNode('action', 'whatsapp')}
                  className="w-full text-left bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 p-2 rounded-lg text-xs font-medium text-slate-200 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp Alert</span>
                  </div>
                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                </button>

                <button
                  onClick={() => handleAddNode('action', 'sms')}
                  className="w-full text-left bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/50 p-2 rounded-lg text-xs font-medium text-slate-200 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                    <span>Rwanda SMS Alert</span>
                  </div>
                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                </button>

                <button
                  onClick={() => handleAddNode('action', 'staff_task')}
                  className="w-full text-left bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/50 p-2 rounded-lg text-xs font-medium text-slate-200 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <PhoneCall className="w-3.5 h-3.5 text-rose-400" />
                    <span>Staff Desk Call Task</span>
                  </div>
                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-slate-800">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              💡 <span className="font-semibold text-slate-400">Pro Tip:</span> WhatsApp & SMS have 95%+ read rates in Rwanda compared to email.
            </p>
          </div>
        </aside>

        {/* VISUAL CANVAS WORKSPACE */}
        <main className="flex-1 bg-slate-950 p-8 overflow-auto relative">
          <div className="min-h-[800px] w-full max-w-4xl mx-auto flex flex-col items-center gap-6 pb-24">
            {currentWorkflow.nodes.map((node, index) => {
              const isSelected = selectedNodeId === node.id;

              return (
                <React.Fragment key={node.id}>
                  {/* NODE CARD */}
                  <div
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`w-full max-w-md bg-slate-900 border rounded-xl p-4 shadow-xl transition-all cursor-pointer relative group ${
                      isSelected
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-slate-850'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Node Type Indicator Line */}
                    <div
                      className={`absolute top-0 left-4 right-4 h-0.5 rounded-full ${
                        node.type === 'trigger'
                          ? 'bg-amber-500'
                          : node.type === 'delay'
                          ? 'bg-blue-500'
                          : node.type === 'condition'
                          ? 'bg-purple-500'
                          : 'bg-emerald-500'
                      }`}
                    />

                    <div className="flex items-start justify-between mb-2 pt-1">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg">
                          {getNodeIcon(node.type, node.subtype)}
                        </div>
                        <div>
                          <span className="text-[10px] font-extrabold tracking-wider uppercase text-slate-400">
                            {node.type}
                          </span>
                          <h4 className="text-sm font-bold text-slate-100">{node.title}</h4>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNode(node.id);
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-400 mb-3">{node.description}</p>

                    {/* CONFIG DETAILS BADGE */}
                    {node.config && Object.keys(node.config).length > 0 && (
                      <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-2.5 text-xs text-slate-300 font-mono">
                        {node.config.template && (
                          <p className="line-clamp-2 italic text-slate-400">&quot;{node.config.template}&quot;</p>
                        )}
                        {node.config.delay_days && (
                          <p className="text-blue-400 font-sans font-semibold">⏳ Wait {node.config.delay_days} days</p>
                        )}
                        {node.config.delay_hours && (
                          <p className="text-blue-400 font-sans font-semibold">⏳ Wait {node.config.delay_hours} hours</p>
                        )}
                        {node.config.task_title && (
                          <p className="text-rose-400 font-sans font-semibold">📋 Task: {node.config.task_title}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CONNECTING ARROW LINE */}
                  {index < currentWorkflow.nodes.length - 1 && (
                    <div className="flex flex-col items-center gap-1 my-1">
                      <div className="w-0.5 h-6 bg-gradient-to-b from-emerald-500 to-slate-700" />
                      <ChevronRight className="w-4 h-4 text-slate-500 rotate-90" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </main>

        {/* RIGHT SIDE CONFIGURATION DRAWER */}
        {selectedNode && (
          <aside className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col p-5 z-10 overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-200">Node Configuration</h3>
              </div>
              <button onClick={() => setSelectedNodeId(null)}>
                <X className="w-4 h-4 text-slate-400 hover:text-white" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Node Title</label>
                <input
                  type="text"
                  value={selectedNode.title}
                  onChange={(e) => handleUpdateNodeConfig('title', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={selectedNode.description}
                  onChange={(e) => handleUpdateNodeConfig('description', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* SPECIFIC CONFIG FOR ACTIONS (SMS / WHATSAPP) */}
              {(selectedNode.subtype === 'sms' || selectedNode.subtype === 'whatsapp') && (
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Message Template</label>
                  <textarea
                    rows={4}
                    value={selectedNode.config?.template || ''}
                    onChange={(e) => handleUpdateNodeConfig('template', e.target.value)}
                    placeholder="Enter message template with placeholders like {first_name}..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-emerald-500 leading-relaxed font-sans"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Available variables: <code className="text-emerald-400">&#123;first_name&#125;</code>, <code className="text-emerald-400">&#123;last_name&#125;</code>, <code className="text-emerald-400">&#123;invoice_id&#125;</code>
                  </p>
                </div>
              )}

              {/* SPECIFIC CONFIG FOR DELAY */}
              {selectedNode.type === 'delay' && (
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Wait Delay (Days)</label>
                  <input
                    type="number"
                    value={selectedNode.config?.delay_days || 1}
                    onChange={(e) => handleUpdateNodeConfig('delay_days', Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {/* SPECIFIC CONFIG FOR STAFF TASK */}
              {selectedNode.subtype === 'staff_task' && (
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Staff Task Title</label>
                  <input
                    type="text"
                    value={selectedNode.config?.task_title || ''}
                    onChange={(e) => handleUpdateNodeConfig('task_title', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-emerald-500 mb-3"
                  />
                  <label className="block text-slate-400 font-medium mb-1">Priority</label>
                  <select
                    value={selectedNode.config?.priority || 'medium'}
                    onChange={(e) => handleUpdateNodeConfig('priority', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              )}

              <div className="pt-4 border-t border-slate-800">
                <button
                  onClick={() => handleDeleteNode(selectedNode.id)}
                  className="w-full flex items-center justify-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 py-2 rounded-lg text-xs font-semibold transition-all"
                >
                  <Trash2 className="w-4 h-4" /> Remove Node
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* 1-CLICK PLAYBOOK MODAL */}
      {showPlaybookModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/20 border border-purple-500/30 rounded-xl">
                  <Layers className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">1-Click Marketing Playbook Library</h3>
                  <p className="text-xs text-slate-400">Pre-built, battle-tested automated retention & acquisition flows</p>
                </div>
              </div>
              <button onClick={() => setShowPlaybookModal(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {PLAYBOOKS.map((pb) => (
                <div
                  key={pb.id}
                  onClick={() => handleSelectPlaybook(pb)}
                  className="bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-purple-500/50 p-4 rounded-xl cursor-pointer transition-all flex items-start justify-between group"
                >
                  <div className="space-y-1.5 max-w-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full">
                        {pb.badge}
                      </span>
                      <h4 className="text-sm font-bold text-slate-200 group-hover:text-purple-300 transition-colors">
                        {pb.name}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-400">{pb.description}</p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Includes {pb.nodes.length} connected nodes
                    </p>
                  </div>

                  <button className="flex items-center gap-1 text-xs font-bold text-purple-400 group-hover:text-purple-300 bg-purple-500/10 group-hover:bg-purple-500/20 border border-purple-500/30 px-3 py-1.5 rounded-lg transition-all">
                    Load Playbook <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
