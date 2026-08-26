import { apiFetch } from '@/lib/api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface StaffTask {
  id: string;
  tenant_id: string;
  profile_id: string | null;
  title: string;
  description: string | null;
  trigger_event: string;
  task_type: 'billing_recovery' | 'tour_feedback' | 'retention_check' | 'call' | 'whatsapp' | 'follow_up';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  due_date: string;
  assigned_role: 'reception' | 'sales' | 'manager' | 'trainer';
  assigned_to: string | null;
  completed_at: string | null;
  completed_by: string | null;
  resolution_notes: string | null;
  outcome: string | null;
  metadata?: any;
  created_at: string;
  profiles?: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
    status: string;
  };
}

export interface TaskSummary {
  urgent: number;
  pending: number;
  completed: number;
  overdue: number;
  total: number;
}

/**
 * Fetch staff operational tasks with filters.
 */
export async function getStaffTasks(params: {
  tenantId: string;
  status?: string;
  assignedRole?: string;
  priority?: string;
}): Promise<StaffTask[]> {
  const query = new URLSearchParams({ tenant_id: params.tenantId });
  if (params.status) query.append('status', params.status);
  if (params.assignedRole) query.append('assigned_role', params.assignedRole);
  if (params.priority) query.append('priority', params.priority);

  const data = await apiFetch<{ tasks: StaffTask[] }>(`${API_BASE_URL}/api/tasks?${query.toString()}`);
  return data.tasks || [];
}

/**
 * Fetch task KPI counts.
 */
export async function getStaffTasksSummary(tenantId: string): Promise<TaskSummary> {
  const data = await apiFetch<{ summary: TaskSummary }>(`${API_BASE_URL}/api/tasks/summary?tenant_id=${encodeURIComponent(tenantId)}`);
  return data.summary || { urgent: 0, pending: 0, completed: 0, overdue: 0, total: 0 };
}

/**
 * Create a staff task.
 */
export async function createStaffTask(params: {
  tenantId: string;
  profileId?: string;
  title: string;
  description?: string;
  triggerEvent?: string;
  taskType?: string;
  priority?: string;
  dueDate?: string;
  assignedRole?: string;
}): Promise<StaffTask> {
  const data = await apiFetch<{ task: StaffTask }>(`${API_BASE_URL}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: params.tenantId,
      profile_id: params.profileId || null,
      title: params.title,
      description: params.description || null,
      trigger_event: params.triggerEvent || 'manual_created',
      task_type: params.taskType || 'follow_up',
      priority: params.priority || 'medium',
      due_date: params.dueDate || null,
      assigned_role: params.assignedRole || 'reception'
    })
  });
  return data.task;
}

/**
 * Resolve or update task status.
 */
export async function updateTaskStatus(params: {
  tenantId: string;
  taskId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  outcome?: string;
  resolutionNotes?: string;
  completedBy?: string;
}): Promise<StaffTask> {
  const data = await apiFetch<{ task: StaffTask }>(`${API_BASE_URL}/api/tasks/${encodeURIComponent(params.taskId)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: params.tenantId,
      status: params.status,
      outcome: params.outcome || null,
      resolution_notes: params.resolutionNotes || null,
      completed_by: params.completedBy || null
    })
  });
  return data.task;
}

/**
 * Trigger automated churn risk detection scan.
 */
export async function triggerChurnRiskScan(tenantId: string, inactivityDays = 21): Promise<{ tasks_created: number; message: string }> {
  return apiFetch<{ tasks_created: number; message: string }>(`${API_BASE_URL}/api/tasks/scan-churn-risks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId, inactivity_days: inactivityDays })
  });
}
