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
  metadata?: any;
}

export interface GatewayConfig {
  id: string;
  provider: string;
  is_enabled: boolean;
  sender_id: string;
  environment: string;
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
}): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/communications/send-single`, {
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
  if (!res.ok) {
    throw new Error(`[sendSingleMessage] ${res.status}: ${await res.text()}`);
  }
  return res.json();
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
}): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/communications/broadcast`, {
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
  if (!res.ok) {
    throw new Error(`[sendBroadcastCampaign] ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/**
 * Fetch past broadcast campaigns.
 */
export async function getBroadcastCampaigns(tenantId: string): Promise<BroadcastCampaign[]> {
  const res = await fetch(`${API_BASE_URL}/api/communications/campaigns?tenant_id=${encodeURIComponent(tenantId)}`);
  if (!res.ok) {
    throw new Error(`[getBroadcastCampaigns] ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
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

  const res = await fetch(`${API_BASE_URL}/api/communications/logs?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`[getCommunicationLogs] ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.logs || [];
}

/**
 * Fetch gateway configuration status.
 */
export async function getGatewayConfigs(tenantId: string): Promise<GatewayConfig[]> {
  const res = await fetch(`${API_BASE_URL}/api/communications/config?tenant_id=${encodeURIComponent(tenantId)}`);
  if (!res.ok) {
    throw new Error(`[getGatewayConfigs] ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.configs || [];
}
