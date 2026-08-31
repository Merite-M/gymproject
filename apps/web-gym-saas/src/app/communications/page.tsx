'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTenantId } from '@/contexts/AuthContext';
import {
  sendSingleMessage,
  sendBroadcastCampaign,
  getBroadcastCampaigns,
  getEnhancedCommunicationLogs,
  resendFailedMessage,
  getGatewayConfigs,
  type BroadcastCampaign,
  type CommunicationLog,
  type GatewayConfig
} from '@/lib/api/communications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Send,
  Radio,
  History,
  Settings2,
  CheckCircle2,
  AlertCircle,
  Users,
  Sparkles,
  RotateCw,
  Search,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Bell
} from 'lucide-react';

export default function CommunicationsPage() {
  const tenantId = useTenantId();
  const [activeTab, setActiveTab] = useState('logs');
  const [loading, setLoading] = useState(true);

  // Filter States for Logs
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Data States
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([]);
  const [, setConfigs] = useState<GatewayConfig[]>([]);

  // Single Dispatch Form
  const [singlePhone, setSinglePhone] = useState('');
  const [singleChannel, setSingleChannel] = useState<'sms' | 'whatsapp' | 'auto_fallback'>('sms');
  const [singleMessage, setSingleMessage] = useState('');
  const [sendingSingle, setSendingSingle] = useState(false);

  // Broadcast Form
  const [campaignName, setCampaignName] = useState('');
  const [campaignAudience, setCampaignAudience] = useState('all_active');
  const [campaignChannel, setCampaignChannel] = useState<'sms' | 'whatsapp' | 'auto_fallback'>('sms');
  const [campaignTemplate, setCampaignTemplate] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Action Banner Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!tenantId) return;
    try {
      const logData = await getEnhancedCommunicationLogs({
        tenantId,
        channel: channelFilter,
        status: statusFilter,
        search: searchQuery
      });
      setLogs(logData);
    } catch (err: any) {
      console.error('Failed to load communication logs:', err);
    }
  }, [tenantId, channelFilter, statusFilter, searchQuery]);

  const loadAllData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [logData, campaignData, configData] = await Promise.all([
        getEnhancedCommunicationLogs({
          tenantId,
          channel: channelFilter,
          status: statusFilter,
          search: searchQuery
        }),
        getBroadcastCampaigns(tenantId),
        getGatewayConfigs(tenantId)
      ]);

      setLogs(logData);
      setCampaigns(campaignData);
      setConfigs(configData);
    } catch (err: any) {
      console.error('Failed to load communications hub data:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, channelFilter, statusFilter, searchQuery]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleResend = async (logId: string) => {
    if (!tenantId) return;
    setResendingId(logId);
    setFeedback(null);
    try {
      await resendFailedMessage(tenantId, logId);
      setFeedback({ type: 'success', message: 'Message resend triggered successfully!' });
      await fetchLogs();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Resend failed' });
    } finally {
      setResendingId(null);
    }
  };

  const handleSendSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !singlePhone || !singleMessage) return;
    setSendingSingle(true);
    setFeedback(null);

    try {
      await sendSingleMessage({
        tenantId,
        recipient: singlePhone,
        channel: singleChannel,
        message: singleMessage
      });

      setSinglePhone('');
      setSingleMessage('');
      setFeedback({ type: 'success', message: 'Direct message dispatched successfully!' });
      setActiveTab('logs');
      await fetchLogs();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Dispatch failed' });
    } finally {
      setSendingSingle(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !campaignName || !campaignTemplate) return;
    setSendingBroadcast(true);
    setFeedback(null);

    try {
      const res = await sendBroadcastCampaign({
        tenantId,
        name: campaignName,
        channel: campaignChannel,
        targetAudience: campaignAudience,
        messageTemplate: campaignTemplate
      });

      setCampaignName('');
      setCampaignTemplate('');
      setFeedback({
        type: 'success',
        message: `Broadcast completed! Sent to ${res.summary?.successful || 0} members.`
      });
      setActiveTab('campaigns');
      await loadAllData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Broadcast failed' });
    } finally {
      setSendingBroadcast(false);
    }
  };

  const totalSent = logs.filter(l => l.status === 'sent' || l.status === 'delivered').length;
  const totalFailed = logs.filter(l => l.status === 'failed').length;
  const totalInApp = logs.filter(l => l.channel === 'in_app').length;

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto min-h-screen pb-24">

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-foreground tracking-tight">
              Staff Communication Hub
            </h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs font-mono">
              Omnichannel Gateway
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Centralized outbound/inbound log stream, automated SMS/WhatsApp retry policies & member in-app feed
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAllData}
            disabled={loading}
            className="text-xs gap-1.5 min-h-[36px]"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Telemetry</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setActiveTab('send')}
            className="text-xs gap-1.5 bg-primary text-primary-foreground font-semibold min-h-[36px]"
          >
            <Send className="size-3.5" />
            <span>New Direct Message</span>
          </Button>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-status-cleared/10 text-status-cleared border-status-cleared/30'
              : 'bg-status-blocked/10 text-status-blocked border-status-blocked/30'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="size-4 shrink-0 text-status-cleared" />
            ) : (
              <AlertCircle className="size-4 shrink-0 text-status-blocked" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="opacity-70 hover:opacity-100 text-xs font-bold p-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* STAT METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Logged Messages</span>
            <Radio className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">{logs.length}</div>
          <p className="text-[11px] text-muted-foreground">Logged across all active channels</p>
        </Card>

        <Card className="border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Successfully Delivered</span>
            <CheckCircle2 className="size-4 text-status-cleared" />
          </div>
          <div className="text-2xl font-bold font-mono text-status-cleared">{totalSent}</div>
          <p className="text-[11px] text-muted-foreground">Verified receipt from gateways</p>
        </Card>

        <Card className="border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Delivery Failures</span>
            <AlertCircle className="size-4 text-status-blocked" />
          </div>
          <div className="text-2xl font-bold font-mono text-status-blocked">{totalFailed}</div>
          <p className="text-[11px] text-muted-foreground">Requires resend or retry policy</p>
        </Card>

        <Card className="border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">In-App Member Feed</span>
            <Bell className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">{totalInApp}</div>
          <p className="text-[11px] text-muted-foreground">Class & billing notifications</p>
        </Card>
      </div>

      {/* NAVIGATION TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto pb-1">
          <TabsList className="bg-surface border border-border p-1 rounded-xl min-w-max flex">
            <TabsTrigger value="logs" className="text-xs gap-1.5 py-2 px-3 min-h-[36px]">
              <History className="size-3.5" />
              <span>Communication Logs</span>
            </TabsTrigger>
            <TabsTrigger value="send" className="text-xs gap-1.5 py-2 px-3 min-h-[36px]">
              <Send className="size-3.5" />
              <span>Direct Message</span>
            </TabsTrigger>
            <TabsTrigger value="broadcast" className="text-xs gap-1.5 py-2 px-3 min-h-[36px]">
              <Sparkles className="size-3.5" />
              <span>Mass Broadcast</span>
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="text-xs gap-1.5 py-2 px-3 min-h-[36px]">
              <Users className="size-3.5" />
              <span>Campaign History</span>
            </TabsTrigger>
            <TabsTrigger value="gateways" className="text-xs gap-1.5 py-2 px-3 min-h-[36px]">
              <Settings2 className="size-3.5" />
              <span>Gateway Health</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: COMMUNICATION LOGS */}
        <TabsContent value="logs" className="space-y-4 outline-none">
          <Card className="border-border bg-card overflow-hidden">
            <CardHeader className="pb-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-heading font-bold">Outbound & Inbound Message Stream</CardTitle>
                <CardDescription className="text-xs">
                  Real-time history of SMS, WhatsApp, Email, and In-App messages per member
                </CardDescription>
              </div>

              {/* FILTER BAR */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 text-xs pl-8 w-full sm:w-44 bg-surface border-border"
                  />
                </div>

                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="h-8 bg-surface border border-border text-foreground text-xs rounded-lg px-2.5 outline-none"
                >
                  <option value="all">All Channels</option>
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="in_app">In-App</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-8 bg-surface border border-border text-foreground text-xs rounded-lg px-2.5 outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="delivered">Delivered / Sent</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                  <option value="read">Read (In-App)</option>
                </select>
              </div>
            </CardHeader>

            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-surface-container/50">
                  <TableRow>
                    <TableHead className="text-xs">Dir</TableHead>
                    <TableHead className="text-xs">Channel</TableHead>
                    <TableHead className="text-xs">Member / Recipient</TableHead>
                    <TableHead className="text-xs">Content Excerpt</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Timestamp</TableHead>
                    <TableHead className="text-right text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                        No communication logs match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => {
                      const recipientName = log.profile
                        ? `${log.profile.first_name || ''} ${log.profile.last_name || ''}`.trim() || log.profile.phone
                        : log.metadata?.recipient || log.profile_id || 'Member';

                      const recipientPhone = log.profile?.phone || log.metadata?.recipient || 'N/A';

                      return (
                        <TableRow key={log.id} className="hover:bg-surface-container/30">
                          <TableCell className="w-8">
                            {log.direction === 'inbound' ? (
                              <ArrowDownLeft className="size-4 text-primary" />
                            ) : (
                              <ArrowUpRight className="size-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase font-mono ${
                                log.channel === 'whatsapp'
                                  ? 'bg-status-cleared/10 text-status-cleared border-status-cleared/30'
                                  : log.channel === 'email'
                                  ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                                  : log.channel === 'in_app'
                                  ? 'bg-purple-500/10 text-purple-500 border-purple-500/30'
                                  : 'bg-primary/10 text-primary border-primary/30'
                              }`}
                            >
                              {log.channel}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-semibold text-foreground">{recipientName}</div>
                            <div className="text-[11px] font-mono text-muted-foreground">{recipientPhone}</div>
                          </TableCell>
                          <TableCell className="max-w-xs sm:max-w-md text-xs text-muted-foreground truncate">
                            {log.content}
                            {log.error_message && (
                              <div className="text-[10px] text-status-blocked mt-0.5 truncate font-mono">
                                Error: {log.error_message}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] capitalize ${
                                log.status === 'sent' || log.status === 'delivered' || log.status === 'read'
                                  ? 'bg-status-cleared/10 text-status-cleared border-status-cleared/30'
                                  : log.status === 'failed'
                                  ? 'bg-status-blocked/10 text-status-blocked border-status-blocked/30'
                                  : 'bg-status-warning/10 text-status-warning border-status-warning/30'
                              }`}
                            >
                              {log.status}
                              {log.retry_count && log.retry_count > 0 ? ` (${log.retry_count} retries)` : ''}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            {log.status === 'failed' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={resendingId === log.id}
                                onClick={() => handleResend(log.id)}
                                className="h-7 text-[11px] px-2.5 gap-1 text-status-blocked border-status-blocked/30 hover:bg-status-blocked/10"
                              >
                                {resendingId === log.id ? (
                                  <RotateCw className="size-3 animate-spin" />
                                ) : (
                                  <RotateCw className="size-3" />
                                )}
                                <span>Resend</span>
                              </Button>
                            ) : (
                              <span className="text-[11px] text-muted-foreground font-mono">
                                {log.external_message_id ? log.external_message_id.substring(0, 10) : 'ACK'}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: DIRECT SINGLE MESSAGE */}
        <TabsContent value="send" className="space-y-4 outline-none">
          <Card className="border-border bg-card max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base font-heading font-bold">Dispatch Single Direct Message</CardTitle>
              <CardDescription className="text-xs">
                Instant SMS or WhatsApp notification to a member or phone number
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendSingle} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-bold text-muted-foreground">Recipient Mobile Number</Label>
                    <Input
                      type="text"
                      required
                      placeholder="+250788123456 or 0788123456"
                      value={singlePhone}
                      onChange={(e) => setSinglePhone(e.target.value)}
                      className="bg-surface border-border text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-muted-foreground">Delivery Channel</Label>
                    <select
                      value={singleChannel}
                      onChange={(e) => setSingleChannel(e.target.value as any)}
                      className="w-full bg-surface border border-border text-foreground text-xs rounded-lg px-3 py-2 outline-none mt-1 h-9"
                    >
                      <option value="sms">Africa&apos;s Talking SMS</option>
                      <option value="whatsapp">Meta WhatsApp API</option>
                      <option value="auto_fallback">⚡ Auto-Fallback (WhatsApp → SMS)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold text-muted-foreground">Message Body</Label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Type member message or alert..."
                    value={singleMessage}
                    onChange={(e) => setSingleMessage(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg p-3 text-xs text-foreground outline-none mt-1 font-mono"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={sendingSingle}
                    className="text-xs gap-1.5 bg-primary text-primary-foreground font-semibold min-h-[40px]"
                  >
                    {sendingSingle ? <RotateCw className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                    <span>Send Direct Message</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: MASS BROADCAST CAMPAIGN */}
        <TabsContent value="broadcast" className="space-y-4 outline-none">
          <Card className="border-border bg-card max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base font-heading font-bold">Mass Segmented Broadcast Campaign</CardTitle>
              <CardDescription className="text-xs">
                Send personalized messages to active members, leads, VIP tiers, or churn risks with merge tags
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendBroadcast} className="space-y-4">
                <div>
                  <Label className="text-xs font-bold text-muted-foreground">Campaign Title / Name</Label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. Weekend Class Blitz or Churn Win-Back"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="bg-surface border-border text-xs mt-1"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-bold text-muted-foreground">Target Audience Segment</Label>
                    <select
                      value={campaignAudience}
                      onChange={(e) => setCampaignAudience(e.target.value)}
                      className="w-full bg-surface border border-border text-foreground text-xs rounded-lg px-3 py-2 outline-none mt-1 h-9"
                    >
                      <option value="all_active">All Active Members</option>
                      <option value="at_risk_churn">At-Risk Churn (14+ Days Inactive)</option>
                      <option value="vip_tier">VIP / Gold / Platinum Tiers</option>
                      <option value="leads">Leads & Prospects</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-muted-foreground">Channel</Label>
                    <select
                      value={campaignChannel}
                      onChange={(e) => setCampaignChannel(e.target.value as any)}
                      className="w-full bg-surface border border-border text-foreground text-xs rounded-lg px-3 py-2 outline-none mt-1 h-9"
                    >
                      <option value="sms">Africa&apos;s Talking SMS</option>
                      <option value="whatsapp">Meta WhatsApp API</option>
                      <option value="auto_fallback">⚡ Auto-Fallback</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold text-muted-foreground">Message Template</Label>
                  <p className="text-[11px] text-muted-foreground mb-1">
                    Available merge tags: <code className="text-primary font-mono">{`{{first_name}}`}</code>, <code className="text-primary font-mono">{`{{last_name}}`}</code>, <code className="text-primary font-mono">{`{{gym_name}}`}</code>
                  </p>
                  <textarea
                    rows={4}
                    required
                    placeholder="Hi {{first_name}}, don't miss our weekend HIIT bootcamp at {{gym_name}}!"
                    value={campaignTemplate}
                    onChange={(e) => setCampaignTemplate(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg p-3 text-xs text-foreground outline-none mt-1 font-mono"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={sendingBroadcast}
                    className="text-xs gap-1.5 bg-primary text-primary-foreground font-semibold min-h-[40px]"
                  >
                    {sendingBroadcast ? <RotateCw className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                    <span>Launch Broadcast Campaign</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: CAMPAIGN HISTORY */}
        <TabsContent value="campaigns" className="space-y-4 outline-none">
          <Card className="border-border bg-card overflow-hidden">
            <CardHeader className="pb-4 border-b border-border">
              <CardTitle className="text-base font-heading font-bold">Past Broadcast Campaigns</CardTitle>
              <CardDescription className="text-xs">Summary of mass dispatches, delivery counts, and target segments</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-surface-container/50">
                  <TableRow>
                    <TableHead className="text-xs">Campaign Name</TableHead>
                    <TableHead className="text-xs">Segment</TableHead>
                    <TableHead className="text-xs">Channel</TableHead>
                    <TableHead className="text-xs">Recipients</TableHead>
                    <TableHead className="text-xs">Success / Fail</TableHead>
                    <TableHead className="text-xs">Sent At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                        No broadcast campaigns recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    campaigns.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-semibold text-xs text-foreground">{c.name}</TableCell>
                        <TableCell className="text-xs capitalize">{c.target_audience.replace('_', ' ')}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">
                            {c.channel}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{c.total_recipients}</TableCell>
                        <TableCell className="text-xs">
                          <span className="text-status-cleared font-semibold">{c.successful_deliveries}</span> /{' '}
                          <span className="text-status-blocked font-semibold">{c.failed_deliveries}</span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {new Date(c.sent_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: GATEWAY HEALTH */}
        <TabsContent value="gateways" className="space-y-4 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    AT
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">Africa&apos;s Talking SMS Gateway</h4>
                    <p className="text-xs text-muted-foreground">Primary East Africa SMS & USSD aggregator</p>
                  </div>
                </div>
                <Badge className="bg-status-cleared/15 text-status-cleared border-status-cleared/30 text-[10px]">
                  Connected
                </Badge>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Sender ID:</span>
                  <span className="font-mono text-foreground font-semibold">GYMPARTNER</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Rate:</span>
                  <span className="font-mono text-foreground">12.00 RWF / SMS</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Webhook Callback:</span>
                  <span className="font-mono text-primary font-semibold">/api/communications/webhook/sms</span>
                </div>
              </div>
            </Card>

            <Card className="border-border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-lg bg-status-cleared/10 text-status-cleared flex items-center justify-center font-bold text-xs">
                    WA
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">Meta WhatsApp Cloud API</h4>
                    <p className="text-xs text-muted-foreground">Direct Business WhatsApp Messaging</p>
                  </div>
                </div>
                <Badge className="bg-status-cleared/15 text-status-cleared border-status-cleared/30 text-[10px]">
                  Connected
                </Badge>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>API Version:</span>
                  <span className="font-mono text-foreground font-semibold">v19.0 Cloud API</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Automatic Fallback:</span>
                  <span className="font-mono text-primary font-semibold">Enabled to Africa&apos;s Talking</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Webhook Callback:</span>
                  <span className="font-mono text-primary font-semibold">/api/communications/webhook/whatsapp</span>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

    </div>
  );
}
