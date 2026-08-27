import { apiFetch } from '@/lib/api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface BroadcastCampaign {
  id: string;
  tenant_id: string;
  name: string;
  channel: 'sms' | 'whatsapp' | 'auto_fallback';
  target_audience: string;
  message_template: string;
  total_recipients: number;
  successful_deliveries: number;
  failed_deliveries: number;
  status: string;
  sent_at: string;
}

export interface CommunicationLog {
  id: string;
  tenant_id: string;
  profile_id: string | null;
  workflow_id?: string | null;
  channel: string;
  direction: 'outbound' | 'inbound';
  status: string;
  content: string;
  external_message_id?: string | null;
  error_message?: string | null;
  retry_count?: number;
  created_at: string;
  updated_at?: string;
  metadata?: {
    recipient?: string;
    provider?: string;
    cost?: string;
    subject?: string;
    simulated?: boolean;
    [key: string]: unknown;
  };
  profile?: {
    id: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
    avatar_url?: string;
  };
}

export interface NotificationLog {
  id: string;
  tenant_id: string;
  profile_id: string | null;
  channel: string;
  recipient: string;
  subject: string | null;
  content: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface GatewayConfig {
  id: string;
  provider: string;
  is_enabled: boolean;
  sender_id: string;
  environment: string;
}

export interface SendMessageResponse {
  success: boolean;
  message?: string;
  log_id?: string;
  [key: string]: unknown;
}

export interface BroadcastResponse {
  success: boolean;
  campaign_id?: string;
  total_recipients?: number;
  summary?: {
    successful?: number;
    failed?: number;
    total?: number;
  };
  [key: string]: unknown;
}

export interface ResendResponse {
  success: boolean;
  status?: string;
  message?: string;
  [key: string]: unknown;
}

/**
 * Send an instant transactional SMS / WhatsApp message.
 */
export async function sendSingleMessage(params: {
  tenantId: string;
  profileId?: string;
  channel: 'sms' | 'whatsapp' | 'auto_fallback';
  recipient: string;
  message: string;
  subject?: string;
}): Promise<SendMessageResponse> {
  return apiFetch(`${API_BASE_URL}/api/communications/send-single`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: params.tenantId,
      profile_id: params.profileId || null,
      channel: params.channel,
      recipient: params.recipient,
      message: params.message,
      subject: params.subject || null
    })
  });
}

/**
 * Send a mass segmented broadcast campaign.
 */
export async function sendBroadcastCampaign(params: {
  tenantId: string;
  name: string;
  channel: 'sms' | 'whatsapp' | 'auto_fallback';
  targetAudience: string;
  messageTemplate: string;
}): Promise<BroadcastResponse> {
  return apiFetch(`${API_BASE_URL}/api/communications/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: params.tenantId,
      name: params.name,
      channel: params.channel,
      target_audience: params.targetAudience,
      message_template: params.messageTemplate
    })
  });
}

/**
 * Fetch past broadcast campaigns.
 */
export async function getBroadcastCampaigns(tenantId: string): Promise<BroadcastCampaign[]> {
  const data = await apiFetch<{ campaigns: BroadcastCampaign[] }>(`${API_BASE_URL}/api/communications/campaigns?tenant_id=${encodeURIComponent(tenantId)}`);
  return data.campaigns || [];
}

/**
 * Fetch real-time delivery logs.
 */
export async function getCommunicationLogs(
  tenantId: string,
  channel?: string,
  limit = 50
): Promise<NotificationLog[]> {
  const query = new URLSearchParams({ tenant_id: tenantId, limit: String(limit) });
  if (channel && channel !== 'all') query.append('channel', channel);

  const data = await apiFetch<{ logs: NotificationLog[] }>(`${API_BASE_URL}/api/communications/logs?${query.toString()}`);
  return data.logs || [];
}

/**
 * Fetch gateway configuration status.
 */
export async function getGatewayConfigs(tenantId: string): Promise<GatewayConfig[]> {
  const data = await apiFetch<{ configs: GatewayConfig[] }>(`${API_BASE_URL}/api/communications/config?tenant_id=${encodeURIComponent(tenantId)}`);
  return data.configs || [];
}

/**
 * Resend a failed communication message.
 */
export async function resendFailedMessage(tenantId: string, logId: string): Promise<ResendResponse> {
  return apiFetch(`${API_BASE_URL}/api/communications/resend/${logId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId })
  });
}

/**
 * Fetch detailed communication logs with filtering.
 */
export async function getEnhancedCommunicationLogs(params: {
  tenantId: string;
  channel?: string;
  status?: string;
  profileId?: string;
  search?: string;
  limit?: number;
}): Promise<CommunicationLog[]> {
  const query = new URLSearchParams({ tenant_id: params.tenantId, limit: String(params.limit || 100) });
  if (params.channel && params.channel !== 'all') query.append('channel', params.channel);
  if (params.status && params.status !== 'all') query.append('status', params.status);
  if (params.profileId) query.append('profile_id', params.profileId);
  if (params.search) query.append('search', params.search);

  const data = await apiFetch<{ logs: CommunicationLog[] }>(`${API_BASE_URL}/api/communications/logs?${query.toString()}`);
  return data.logs || [];
}
