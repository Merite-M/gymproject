'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTenantId } from '@/contexts/AuthContext';
import {
  getStaffTasks,
  getStaffTasksSummary,
  createStaffTask,
  updateTaskStatus,
  triggerChurnRiskScan,
  type StaffTask,
  type TaskSummary
} from '@/lib/api/tasks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CheckSquare,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Plus,
  RefreshCw,
  Phone,
  MessageSquare,
  Search,
  Filter,
  User,
  Zap,
  Calendar,
  Sparkles,
  Loader2,
  X
} from 'lucide-react';

export default function StaffTasksPage() {
  const tenantId = useTenantId() || '2c604504-41c3-406b-82a0-a43700057af8';

  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [summary, setSummary] = useState<TaskSummary>({
    urgent: 0,
    pending: 0,
    completed: 0,
    overdue: 0,
    total: 0
  });

  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<StaffTask | null>(null);

  // Form states
  const [creating, setCreating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [scanning, setScanning] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('high');
  const [newTaskType, setNewTaskType] = useState('follow_up');
  const [newRole, setNewRole] = useState('reception');

  const [resolutionOutcome, setResolutionOutcome] = useState('contacted_resolved');
  const [resolutionNotes, setResolutionNotes] = useState('');

  const loadData = async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const [taskList, summaryData] = await Promise.all([
        getStaffTasks({
          tenantId,
          status: filterStatus,
          assignedRole: filterRole !== 'all' ? filterRole : undefined,
          priority: filterPriority !== 'all' ? filterPriority : undefined
        }),
        getStaffTasksSummary(tenantId)
      ]);
      setTasks(taskList);
      setSummary(summaryData);
    } catch (err) {
      console.error('Error loading tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId, filterStatus, filterRole, filterPriority]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      setCreating(true);
      await createStaffTask({
        tenantId,
        title: newTitle,
        description: newDescription,
        priority: newPriority,
        taskType: newTaskType,
        assignedRole: newRole
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewDescription('');
      loadData();
    } catch (err: any) {
      console.error('Error creating task:', err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleResolveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    try {
      setResolving(true);
      await updateTaskStatus({
        tenantId,
        taskId: selectedTask.id,
        status: 'completed',
        outcome: resolutionOutcome,
        resolutionNotes
      });
      setShowResolveModal(false);
      setSelectedTask(null);
      setResolutionNotes('');
      loadData();
    } catch (err: any) {
      console.error('Error resolving task:', err.message);
    } finally {
      setResolving(false);
    }
  };

  const handleRunChurnScan = async () => {
    try {
      setScanning(true);
      const res = await triggerChurnRiskScan(tenantId, 21);
      alert(`Automated Churn Scan: ${res.message}`);
      loadData();
    } catch (err: any) {
      alert('Scan error: ' + err.message);
    } finally {
      setScanning(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const matchTitle = t.title.toLowerCase().includes(query);
    const matchMember = t.profiles
      ? `${t.profiles.first_name} ${t.profiles.last_name}`.toLowerCase().includes(query)
      : false;
    return matchTitle || matchMember;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-background text-foreground overflow-hidden font-body-base">
      
      {/* Top Header */}
      <div className="bg-surface border-b border-border px-8 py-5 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
            <CheckSquare className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">
              Event-Driven Staff Task Engine
            </h1>
            <p className="text-xs text-muted-foreground">
              Automated operational follow-ups for failed billing, facility tour conversions, and churn retention
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunChurnScan}
            disabled={scanning}
            className="text-xs gap-1.5"
          >
            {scanning ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5 text-primary" />}
            <span>Run Churn Scanner</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
          >
            <Plus className="size-3.5" />
            <span>New Task</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Urgent Actions</span>
                <h3 className="text-2xl font-bold font-mono text-status-blocked">{summary.urgent}</h3>
                <p className="text-[11px] text-muted-foreground">Failed billing & critical alerts</p>
              </div>
              <div className="size-10 rounded-xl bg-status-blocked/10 text-status-blocked flex items-center justify-center">
                <AlertTriangle className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pending Tasks</span>
                <h3 className="text-2xl font-bold font-mono text-status-action">{summary.pending}</h3>
                <p className="text-[11px] text-muted-foreground">Active in queue</p>
              </div>
              <div className="size-10 rounded-xl bg-status-action/10 text-status-action flex items-center justify-center">
                <Clock className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Overdue (SLA)</span>
                <h3 className="text-2xl font-bold font-mono text-foreground">{summary.overdue}</h3>
                <p className="text-[11px] text-muted-foreground">Past scheduled due time</p>
              </div>
              <div className="size-10 rounded-xl bg-surface-container text-muted-foreground flex items-center justify-center">
                <Calendar className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Resolved Tasks</span>
                <h3 className="text-2xl font-bold font-mono text-status-cleared">{summary.completed}</h3>
                <p className="text-[11px] text-muted-foreground">Successfully closed</p>
              </div>
              <div className="size-10 rounded-xl bg-status-cleared/10 text-status-cleared flex items-center justify-center">
                <CheckCircle2 className="size-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar & Table Card */}
        <Card className="border-border bg-card overflow-hidden">
          
          {/* Filters Bar */}
          <div className="p-4 border-b border-border bg-surface-container/30 flex flex-wrap items-center justify-between gap-4">
            
            {/* Status Tabs */}
            <div className="flex space-x-1.5">
              {['pending', 'in_progress', 'completed', 'all'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                    filterStatus === st
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Right side role filter and search */}
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="size-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search task or member..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-foreground placeholder-muted-foreground outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="bg-surface border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 outline-none"
              >
                <option value="all">All Roles</option>
                <option value="reception">Reception</option>
                <option value="sales">Sales</option>
                <option value="manager">Manager</option>
                <option value="trainer">Trainer</option>
              </select>

              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="bg-surface border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 outline-none"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
              </select>
            </div>
          </div>

          {/* Tasks Table */}
          <div className="p-0">
            <Table>
              <TableHeader className="bg-surface-container/50">
                <TableRow>
                  <TableHead className="text-xs">Task & Trigger</TableHead>
                  <TableHead className="text-xs">Associated Member</TableHead>
                  <TableHead className="text-xs">Priority</TableHead>
                  <TableHead className="text-xs">Role Target</TableHead>
                  <TableHead className="text-xs">Due Timing</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-right text-xs">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                      <Loader2 className="size-5 animate-spin mx-auto text-primary mb-2" />
                      Loading operational tasks...
                    </TableCell>
                  </TableRow>
                ) : filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                      No tasks found matching criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((t) => {
                    const isOverdue = new Date(t.due_date) < new Date() && t.status === 'pending';
                    return (
                      <TableRow key={t.id} className="hover:bg-surface-container/30">
                        <TableCell className="max-w-xs">
                          <div className="font-semibold text-xs text-foreground">{t.title}</div>
                          {t.description && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{t.description}</p>
                          )}
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                              {t.trigger_event}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          {t.profiles ? (
                            <div>
                              <Link
                                href={`/members/${t.profiles.id}`}
                                className="text-xs font-semibold text-foreground hover:text-primary transition-colors"
                              >
                                {t.profiles.first_name} {t.profiles.last_name}
                              </Link>
                              <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                                {t.profiles.phone || t.profiles.email || '—'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">General Task</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize ${
                              t.priority === 'urgent'
                                ? 'bg-status-blocked/10 text-status-blocked border-status-blocked/30'
                                : t.priority === 'high'
                                ? 'bg-status-action/10 text-status-action border-status-action/30'
                                : 'bg-surface-container text-muted-foreground border-border'
                            }`}
                          >
                            {t.priority}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline" className="text-[10px] bg-surface-container uppercase text-muted-foreground">
                            {t.assigned_role}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className={`text-xs font-mono ${isOverdue ? 'text-status-blocked font-bold' : 'text-muted-foreground'}`}>
                            {new Date(t.due_date).toLocaleDateString()}
                          </div>
                          {isOverdue && (
                            <span className="text-[10px] text-status-blocked flex items-center gap-0.5">
                              ⚠️ Overdue SLA
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize ${
                              t.status === 'completed'
                                ? 'bg-status-cleared/10 text-status-cleared border-status-cleared/30'
                                : t.status === 'in_progress'
                                ? 'bg-primary/10 text-primary border-primary/30'
                                : 'bg-status-action/10 text-status-action border-status-action/30'
                            }`}
                          >
                            {t.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {t.profiles?.phone && (
                              <a
                                href={`tel:${t.profiles.phone}`}
                                title="Call Member"
                                className="p-1.5 rounded-md bg-surface hover:bg-surface-container text-muted-foreground hover:text-foreground"
                              >
                                <Phone className="size-3.5" />
                              </a>
                            )}
                            {t.status !== 'completed' && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedTask(t);
                                  setShowResolveModal(true);
                                }}
                                className="text-[11px] h-7 px-2.5 bg-primary text-primary-foreground"
                              >
                                Resolve
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* CREATE TASK MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
              <h3 className="font-heading font-bold text-base text-foreground">Create Staff Follow-Up Task</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="p-6 space-y-4 text-xs">
              <div>
                <Label className="text-xs font-bold text-muted-foreground">Task Title</Label>
                <Input
                  required
                  placeholder="e.g. Call John Doe regarding membership renewal"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="bg-surface border-border mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-muted-foreground">Description & Instructions</Label>
                <textarea
                  rows={3}
                  placeholder="Provide context or script for reception staff..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg p-2.5 text-xs text-foreground outline-none mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-bold text-muted-foreground">Priority</Label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full bg-surface border border-border text-foreground text-xs rounded-lg px-3 py-2 outline-none mt-1"
                  >
                    <option value="urgent">Urgent (Immediate)</option>
                    <option value="high">High (+24h)</option>
                    <option value="medium">Medium (+48h)</option>
                    <option value="low">Low (+7d)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-bold text-muted-foreground">Assigned Role</Label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full bg-surface border border-border text-foreground text-xs rounded-lg px-3 py-2 outline-none mt-1"
                  >
                    <option value="reception">Reception</option>
                    <option value="sales">Sales</option>
                    <option value="manager">Manager</option>
                    <option value="trainer">Trainer</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={creating} className="bg-primary text-primary-foreground font-semibold">
                  {creating ? <Loader2 className="size-3.5 animate-spin" /> : 'Create Task'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESOLVE TASK MODAL */}
      {showResolveModal && selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
              <h3 className="font-heading font-bold text-base text-foreground">Resolve Staff Task</h3>
              <button onClick={() => setShowResolveModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>
            <form onSubmit={handleResolveTask} className="p-6 space-y-4 text-xs">
              <div className="p-3.5 rounded-lg bg-surface border border-border">
                <h4 className="font-bold text-sm text-foreground">{selectedTask.title}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedTask.description}</p>
              </div>

              <div>
                <Label className="text-xs font-bold text-muted-foreground">Resolution Outcome</Label>
                <select
                  value={resolutionOutcome}
                  onChange={(e) => setResolutionOutcome(e.target.value)}
                  className="w-full bg-surface border border-border text-foreground text-xs rounded-lg px-3 py-2 outline-none mt-1"
                >
                  <option value="payment_recovered">Payment Recovered / Succeeded</option>
                  <option value="tour_converted">Tour Converted to Membership</option>
                  <option value="contacted_resolved">Member Contacted & Resolved</option>
                  <option value="unreachable">Member Unreachable (Left Message)</option>
                  <option value="cancelled">Cancelled / Invalid Alert</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold text-muted-foreground">Staff Notes</Label>
                <textarea
                  rows={3}
                  required
                  placeholder="Record outcome of call / WhatsApp conversation..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg p-2.5 text-xs text-foreground outline-none mt-1"
                />
              </div>

              <div className="pt-4 border-t border-border flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowResolveModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={resolving} className="bg-primary text-primary-foreground font-semibold">
                  {resolving ? <Loader2 className="size-3.5 animate-spin" /> : 'Mark Completed'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
