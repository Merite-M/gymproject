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
  Layers,
  Play
} from 'lucide-react';

function clone<T>(obj: T): T {
  return typeof structuredClone === 'function'
    ? structuredClone(obj)
    : JSON.parse(JSON.stringify(obj));
}

export type NodeType = 'trigger' | 'delay' | 'condition' | 'action';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  subtype: string;
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
  const [, setLoading] = useState<boolean>(true);
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

  const currentWorkflow = useMemo(() => {
    if (workflows.length > 0 && workflows[activeWorkflowIndex]) {
      return workflows[activeWorkflowIndex];
    }
    return clone(PLAYBOOKS[0] as unknown as MarketingWorkflow);
  }, [workflows, activeWorkflowIndex]);

  const selectedNode = useMemo(() => {
    return currentWorkflow.nodes.find(n => n.id === selectedNodeId) || null;
  }, [currentWorkflow, selectedNodeId]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
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

        const { data: wfList, error: wfError } = await supabase
          .from('marketing_workflows')
          .select('*')
          .eq('tenant_id', currentTenant)
          .order('created_at', { ascending: false });

        if (wfError) throw wfError;

        if (wfList && wfList.length > 0) {
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
          setWorkflows(clone(PLAYBOOKS as unknown as MarketingWorkflow[]));
        }

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
        setWorkflows(clone(PLAYBOOKS as unknown as MarketingWorkflow[]));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleSaveWorkflow = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const wfToSave = clone(currentWorkflow);

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

      const { data: wfRow, error: wfError } = await supabase
        .from('marketing_workflows')
        .upsert({
          id: wfToSave.id,
          tenant_id: tenantId,
          name: wfToSave.name,
          trigger_type: wfToSave.trigger_type || 'predictive_churn',
          is_active: wfToSave.is_active,
          nodes: remappedNodes,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (wfError) throw wfError;

      const savedWfId = wfRow.id;

      if (wfToSave.id) {
        await supabase
          .from('workflow_nodes')
          .delete()
          .eq('workflow_id', wfToSave.id)
          .eq('tenant_id', tenantId);
      }

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

  const getNodeIcon = (type: NodeType, subtype?: string) => {
    if (type === 'trigger') return <Zap className="w-5 h-5 text-status-action" />;
    if (type === 'delay') return <Clock className="w-5 h-5 text-secondary" />;
    if (type === 'condition') return <GitFork className="w-5 h-5 text-purple-400" />;
    if (subtype === 'whatsapp') return <Smartphone className="w-5 h-5 text-status-cleared" />;
    if (subtype === 'sms') return <MessageSquare className="w-5 h-5 text-secondary" />;
    if (subtype === 'staff_task') return <PhoneCall className="w-5 h-5 text-status-blocked" />;
    return <Mail className="w-5 h-5 text-muted-foreground" />;
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-body-base">
      {/* TOP HEADER & ANALYTICS BAR */}
      <header className="flex-none bg-card border-b border-border px-4 sm:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 z-20 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 px-3 py-1.5 rounded-lg">
            <Sparkles className="w-5 h-5 text-primary animate-pulse shrink-0" />
            <span className="text-xs sm:text-sm font-headline-md font-bold text-primary">Marketing Automation Canvas</span>
          </div>

          {/* Workflow Picker */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={activeWorkflowIndex}
              onChange={(e) => {
                setActiveWorkflowIndex(Number(e.target.value));
                setSelectedNodeId(null);
              }}
              className="bg-surface-container border border-border text-foreground text-xs sm:text-sm font-medium rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary min-h-[36px]"
            >
              {workflows.map((wf, idx) => (
                <option key={wf.id || idx} value={idx}>
                  {wf.name} {wf.is_active ? '(Active)' : '(Paused)'}
                </option>
              ))}
            </select>

            <button
              onClick={handleToggleActive}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[36px] ${
                currentWorkflow.is_active
                  ? 'bg-status-cleared/20 text-status-cleared border border-status-cleared/40 hover:bg-status-cleared/30'
                  : 'bg-status-action/20 text-status-action border border-status-action/40 hover:bg-status-action/30'
              }`}
            >
              {currentWorkflow.is_active ? (
                <>
                  <Pause className="w-3.5 h-3.5" /> Paused
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> Enable Live
                </>
              )}
            </button>
          </div>
        </div>

        {/* Real-time Analytics Overlay */}
        <div className="hidden lg:flex items-center gap-6 bg-surface-container/80 border border-border rounded-xl px-4 py-1.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-status-cleared shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Delivery Rate</p>
              <p className="text-xs font-bold text-foreground font-mono-id">{analytics.deliveryRate}%</p>
            </div>
          </div>

          <div className="h-6 w-px bg-border" />

          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-secondary shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Click-Through Rate</p>
              <p className="text-xs font-bold text-foreground font-mono-id">{analytics.clickThroughRate}%</p>
            </div>
          </div>

          <div className="h-6 w-px bg-border" />

          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-status-action shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Conversion ROI</p>
              <p className="text-xs font-bold text-primary font-mono-id">{formatCurrencyDisplay(analytics.attributedRevenueRWF)}</p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            onClick={() => setShowPlaybookModal(true)}
            className="flex items-center gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/90 text-xs font-bold px-3 py-2 rounded-lg shadow-xs transition-all min-h-[36px]"
          >
            <Layers className="w-4 h-4" />
            <span>Playbooks</span>
          </button>

          <button
            onClick={handleSaveWorkflow}
            disabled={saving}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold px-3.5 py-2 rounded-lg shadow-xs transition-all disabled:opacity-50 min-h-[36px]"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save & Publish</span>
          </button>
        </div>
      </header>

      {/* STATUS BANNER */}
      {statusMessage && (
        <div
          className={`flex-none px-4 sm:px-6 py-2 text-xs font-semibold flex items-center justify-between transition-all ${
            statusMessage.type === 'success'
              ? 'bg-status-cleared/15 text-status-cleared border-b border-status-cleared/30'
              : statusMessage.type === 'error'
              ? 'bg-status-blocked/15 text-status-blocked border-b border-status-blocked/30'
              : 'bg-secondary/15 text-secondary border-b border-secondary/30'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)}>
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      )}

      {/* MAIN CONTENT WORKSPACE */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* LEFT TOOLBOX PANEL */}
        <aside className="w-full md:w-64 bg-card border-b md:border-b-0 md:border-r border-border flex flex-col p-4 z-10 max-h-[220px] md:max-h-none overflow-y-auto shrink-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" /> Add Workflow Node
          </h3>

          <div className="space-y-4">
            {/* TRIGGERS */}
            <div>
              <p className="text-[11px] font-bold text-status-action uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Triggers
              </p>
              <div className="grid grid-cols-2 md:grid-cols-1 gap-1.5">
                <button
                  onClick={() => handleAddNode('trigger', 'predictive_churn')}
                  className="text-left bg-surface-container hover:bg-surface-container-high border border-border hover:border-status-action/50 p-2 rounded-lg text-xs font-medium text-foreground transition-all flex items-center justify-between"
                >
                  <span className="truncate">Predictive Churn Risk</span>
                  <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-1" />
                </button>
                <button
                  onClick={() => handleAddNode('trigger', 'payment_failed')}
                  className="text-left bg-surface-container hover:bg-surface-container-high border border-border hover:border-status-action/50 p-2 rounded-lg text-xs font-medium text-foreground transition-all flex items-center justify-between"
                >
                  <span className="truncate">Payment Failed</span>
                  <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-1" />
                </button>
              </div>
            </div>

            {/* DELAYS */}
            <div>
              <p className="text-[11px] font-bold text-secondary uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Delays & Waiting
              </p>
              <button
                onClick={() => handleAddNode('delay', 'delay')}
                className="w-full text-left bg-surface-container hover:bg-surface-container-high border border-border hover:border-secondary/50 p-2 rounded-lg text-xs font-medium text-foreground transition-all flex items-center justify-between"
              >
                <span>Wait Duration Delay</span>
                <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </button>
            </div>

            {/* CONDITIONS */}
            <div>
              <p className="text-[11px] font-bold text-purple-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <GitFork className="w-3.5 h-3.5" /> Branching Conditions
              </p>
              <button
                onClick={() => handleAddNode('condition', 'debtor_check')}
                className="w-full text-left bg-surface-container hover:bg-surface-container-high border border-border hover:border-purple-500/50 p-2 rounded-lg text-xs font-medium text-foreground transition-all flex items-center justify-between"
              >
                <span className="truncate">Check Outstanding Debt</span>
                <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </button>
            </div>

            {/* ACTIONS */}
            <div>
              <p className="text-[11px] font-bold text-status-cleared uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Communication Actions
              </p>
              <div className="grid grid-cols-2 md:grid-cols-1 gap-1.5">
                <button
                  onClick={() => handleAddNode('action', 'whatsapp')}
                  className="text-left bg-surface-container hover:bg-surface-container-high border border-border hover:border-status-cleared/50 p-2 rounded-lg text-xs font-medium text-foreground transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Smartphone className="w-3.5 h-3.5 text-status-cleared shrink-0" />
                    <span className="truncate">WhatsApp Alert</span>
                  </div>
                  <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-1" />
                </button>

                <button
                  onClick={() => handleAddNode('action', 'sms')}
                  className="text-left bg-surface-container hover:bg-surface-container-high border border-border hover:border-secondary/50 p-2 rounded-lg text-xs font-medium text-foreground transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <MessageSquare className="w-3.5 h-3.5 text-secondary shrink-0" />
                    <span className="truncate">Rwanda SMS</span>
                  </div>
                  <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-1" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* VISUAL CANVAS WORKSPACE */}
        <main className="flex-1 bg-background p-4 sm:p-8 overflow-auto relative">
          <div className="min-h-[600px] w-full max-w-4xl mx-auto flex flex-col items-center gap-6 pb-24">
            {currentWorkflow.nodes.map((node, index) => {
              const isSelected = selectedNodeId === node.id;

              return (
                <React.Fragment key={node.id}>
                  {/* NODE CARD */}
                  <div
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`w-full max-w-md bg-card border rounded-xl p-4 shadow-md transition-all cursor-pointer relative group ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/20 bg-surface-container'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div
                      className={`absolute top-0 left-4 right-4 h-0.5 rounded-full ${
                        node.type === 'trigger'
                          ? 'bg-status-action'
                          : node.type === 'delay'
                          ? 'bg-secondary'
                          : node.type === 'condition'
                          ? 'bg-purple-500'
                          : 'bg-status-cleared'
                      }`}
                    />

                    <div className="flex items-start justify-between mb-2 pt-1">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-surface-container border border-border rounded-lg shrink-0">
                          {getNodeIcon(node.type, node.subtype)}
                        </div>
                        <div>
                          <span className="text-[10px] font-extrabold tracking-wider uppercase text-muted-foreground">
                            {node.type}
                          </span>
                          <h4 className="text-xs sm:text-sm font-headline-md font-bold text-foreground">{node.title}</h4>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNode(node.id);
                        }}
                        className="text-muted-foreground hover:text-status-blocked p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-muted-foreground mb-3">{node.description}</p>

                    {node.config && Object.keys(node.config).length > 0 && (
                      <div className="bg-surface-container border border-border rounded-lg p-2.5 text-xs text-foreground font-mono-id">
                        {node.config.template && (
                          <p className="line-clamp-2 italic text-muted-foreground">&quot;{node.config.template}&quot;</p>
                        )}
                        {node.config.delay_days && (
                          <p className="text-secondary font-sans font-semibold">⏳ Wait {node.config.delay_days} days</p>
                        )}
                        {node.config.delay_hours && (
                          <p className="text-secondary font-sans font-semibold">⏳ Wait {node.config.delay_hours} hours</p>
                        )}
                        {node.config.task_title && (
                          <p className="text-status-blocked font-sans font-semibold">📋 Task: {node.config.task_title}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CONNECTING ARROW LINE */}
                  {index < currentWorkflow.nodes.length - 1 && (
                    <div className="flex flex-col items-center gap-1 my-1">
                      <div className="w-0.5 h-6 bg-gradient-to-b from-primary to-border" />
                      <ChevronRight className="w-4 h-4 text-muted-foreground rotate-90" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </main>

        {/* RIGHT SIDE CONFIGURATION DRAWER */}
        {selectedNode && (
          <aside className="w-full md:w-80 bg-card border-t md:border-t-0 md:border-l border-border flex flex-col p-5 z-10 overflow-y-auto shrink-0">
            <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Node Configuration</h3>
              </div>
              <button onClick={() => setSelectedNodeId(null)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-muted-foreground font-medium mb-1">Node Title</label>
                <input
                  type="text"
                  value={selectedNode.title}
                  onChange={(e) => handleUpdateNodeConfig('title', e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg p-2 text-foreground focus:outline-none focus:border-primary min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={selectedNode.description}
                  onChange={(e) => handleUpdateNodeConfig('description', e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg p-2 text-foreground focus:outline-none focus:border-primary min-h-[38px]"
                />
              </div>

              {(selectedNode.subtype === 'sms' || selectedNode.subtype === 'whatsapp') && (
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Message Template</label>
                  <textarea
                    rows={4}
                    value={selectedNode.config?.template || ''}
                    onChange={(e) => handleUpdateNodeConfig('template', e.target.value)}
                    placeholder="Enter message template with placeholders like {first_name}..."
                    className="w-full bg-surface border border-border rounded-lg p-2 text-foreground focus:outline-none focus:border-primary leading-relaxed font-sans"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Available variables: <code className="text-primary">&#123;first_name&#125;</code>, <code className="text-primary">&#123;last_name&#125;</code>
                  </p>
                </div>
              )}

              {selectedNode.type === 'delay' && (
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Wait Delay (Days)</label>
                  <input
                    type="number"
                    value={selectedNode.config?.delay_days || 1}
                    onChange={(e) => handleUpdateNodeConfig('delay_days', Number(e.target.value))}
                    className="w-full bg-surface border border-border rounded-lg p-2 text-foreground focus:outline-none focus:border-primary min-h-[38px]"
                  />
                </div>
              )}

              <div className="pt-4 border-t border-border">
                <button
                  onClick={() => handleDeleteNode(selectedNode.id)}
                  className="w-full flex items-center justify-center gap-2 bg-status-blocked/10 border border-status-blocked/30 text-status-blocked hover:bg-status-blocked/20 py-2.5 rounded-lg text-xs font-semibold transition-all min-h-[40px]"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-secondary/20 border border-secondary/30 rounded-xl shrink-0">
                  <Layers className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-headline-md font-bold text-foreground">1-Click Marketing Playbook Library</h3>
                  <p className="text-xs text-muted-foreground">Pre-built, battle-tested automated retention & acquisition flows</p>
                </div>
              </div>
              <button onClick={() => setShowPlaybookModal(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {PLAYBOOKS.map((pb) => (
                <div
                  key={pb.id}
                  onClick={() => handleSelectPlaybook(pb)}
                  className="bg-surface hover:bg-surface-container border border-border hover:border-primary/50 p-4 rounded-xl cursor-pointer transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
                >
                  <div className="space-y-1.5 max-w-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 bg-secondary/20 text-secondary border border-secondary/30 rounded-full">
                        {pb.badge}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                        {pb.name}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground">{pb.description}</p>
                    <p className="text-[11px] text-muted-foreground font-mono-id">
                      Includes {pb.nodes.length} connected nodes
                    </p>
                  </div>

                  <button className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 group-hover:bg-primary/20 border border-primary/30 px-3 py-1.5 rounded-lg transition-all min-h-[36px] shrink-0 self-end sm:self-auto">
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
