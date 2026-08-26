'use client';

import React, { useState, useEffect } from 'react';
import { useTenantId } from '@/contexts/AuthContext';
import {
  sendSingleMessage,
  sendBroadcastCampaign,
  getBroadcastCampaigns,
  getCommunicationLogs,
  getGatewayConfigs,
  type BroadcastCampaign,
  type NotificationLog,
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
  MessageSquare,
  Send,
  Radio,
  History,
  Settings2,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Users,
  Sparkles,
  Zap,
  Loader2,
  PhoneCall,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

export default function CommunicationsHubPage() {
  const tenantId = useTenantId() || '2c604504-41c3-406b-82a0-a43700057af8';

  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [configs, setConfigs] = useState<GatewayConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // Broadcast state
  const [campaignName, setCampaignName] = useState('');
  const [broadcastChannel, setBroadcastChannel] = useState<'sms' | 'whatsapp' | 'auto_fallback'>('sms');
  const [targetAudience, setTargetAudience] = useState('all_active');
  const [messageTemplate, setMessageTemplate] = useState('Hello {{first_name}}, this is a special update from {{gym_name}}! Come check out our new HIIT & spinning classes this week.');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Single Message state
  const [singleRecipient, setSingleRecipient] = useState('');
  const [singleChannel, setSingleChannel] = useState<'sms' | 'whatsapp' | 'auto_fallback'>('sms');
  const [singleMessage, setSingleMessage] = useState('');
  const [sendingSingle, setSendingSingle] = useState(false);

  // Status message
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const [campList, logList, confList] = await Promise.all([
        getBroadcastCampaigns(tenantId),
        getCommunicationLogs(tenantId, 'all', 40),
        getGatewayConfigs(tenantId)
      ]);
      setCampaigns(campList);
      setLogs(logList);
      setConfigs(confList);
    } catch (err) {
      console.error('Failed to load communication data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName.trim() || !messageTemplate.trim()) return;

    try {
      setSendingBroadcast(true);
      setStatusFeedback(null);
      const res = await sendBroadcastCampaign({
        tenantId,
        name: campaignName,
        channel: broadcastChannel,
        targetAudience,
        messageTemplate
      });

      setStatusFeedback({
        type: 'success',
        text: `Broadcast sent! Delivered to ${res.summary.successful} members (${res.summary.failed} failed).`
      });
      setCampaignName('');
      loadData();
    } catch (err: any) {
      setStatusFeedback({ type: 'error', text: err.message || 'Failed to dispatch broadcast' });
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleSendSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleRecipient.trim() || !singleMessage.trim()) return;

    try {
      setSendingSingle(true);
      setStatusFeedback(null);
      await sendSingleMessage({
        tenantId,
        recipient: singleRecipient,
        channel: singleChannel,
        message: singleMessage
      });

      setStatusFeedback({
        type: 'success',
        text: `Message dispatched successfully to ${singleRecipient} via ${singleChannel.toUpperCase()}`
      });
      setSingleMessage('');
      setSingleRecipient('');
      loadData();
    } catch (err: any) {
      setStatusFeedback({ type: 'error', text: err.message || 'Failed to send message' });
    } finally {
      setSendingSingle(false);
    }
  };

  const insertTag = (tag: string) => {
    setMessageTemplate((prev) => `${prev} {{${tag}}}`);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background text-foreground overflow-hidden font-body-base">
      
      {/* Top Header */}
      <div className="bg-surface border-b border-border px-8 py-5 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
            <Radio className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">
              Multi-Channel Gateways Center
            </h1>
            <p className="text-xs text-muted-foreground">
              Africa&apos;s Talking SMS & Meta WhatsApp Business Cloud API with Auto-Fallback Routing
            </p>
          </div>
        </div>

        {/* Live Provider Health Chips */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs">
            <span className="size-2 rounded-full bg-status-cleared animate-pulse" />
            <span className="font-mono text-[11px] text-foreground font-semibold">Africa&apos;s Talking SMS</span>
            <span className="text-[10px] text-muted-foreground font-mono">(GYMPARTNER)</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs">
            <span className="size-2 rounded-full bg-status-cleared animate-pulse" />
            <span className="font-mono text-[11px] text-foreground font-semibold">Meta WhatsApp Cloud</span>
            <span className="text-[10px] text-primary font-mono">(v19.0)</span>
          </div>

          <Button variant="outline" size="sm" onClick={loadData} className="text-xs h-8 px-2.5">
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Main Tabs Container */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        
        {/* Feedback Alert */}
        {statusFeedback && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
              statusFeedback.type === 'success'
                ? 'bg-status-cleared/10 border-status-cleared/30 text-status-cleared'
                : 'bg-status-blocked/10 border-status-blocked/30 text-status-blocked'
            }`}
          >
            {statusFeedback.type === 'success' ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
            <span>{statusFeedback.text}</span>
          </div>
        )}

        <Tabs defaultValue="broadcast" className="w-full space-y-6">
          <TabsList className="bg-surface-container p-1 rounded-lg border border-border">
            <TabsTrigger value="broadcast" className="text-xs gap-1.5">
              <Users className="size-3.5" /> Mass Broadcast Studio
            </TabsTrigger>
            <TabsTrigger value="single" className="text-xs gap-1.5">
              <Send className="size-3.5" /> Instant Direct Dispatch
            </TabsTrigger>
            <TabsTrigger value="logs" className="text-xs gap-1.5">
              <History className="size-3.5" /> Real-Time Delivery Stream
            </TabsTrigger>
            <TabsTrigger value="providers" className="text-xs gap-1.5">
              <Settings2 className="size-3.5" /> Gateway Providers
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: MASS BROADCAST STUDIO */}
          <TabsContent value="broadcast" className="mt-0 space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Campaign Composer (7 cols) */}
              <Card className="lg:col-span-7 border-border bg-card">
                <CardHeader className="pb-3 border-b border-border bg-surface-container/30">
                  <CardTitle className="text-sm font-heading font-bold text-foreground">
                    Compose Broadcast Campaign
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Target segmented member audiences via Africa&apos;s Talking SMS or Meta WhatsApp.
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-6">
                  <form onSubmit={handleSendBroadcast} className="space-y-4 text-xs">
                    <div>
                      <Label className="text-xs font-bold text-muted-foreground">Campaign Name</Label>
                      <Input
                        required
                        placeholder="e.g. Weekend Bootcamp Promotion & Spinning Class"
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        className="bg-surface border-border mt-1 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-bold text-muted-foreground">Gateway Channel</Label>
                        <select
                          value={broadcastChannel}
                          onChange={(e) => setBroadcastChannel(e.target.value as any)}
                          className="w-full bg-surface border border-border text-foreground text-xs rounded-lg px-3 py-2 outline-none mt-1"
                        >
                          <option value="sms">Africa&apos;s Talking SMS</option>
                          <option value="whatsapp">Meta WhatsApp Business API</option>
                          <option value="auto_fallback">⚡ Auto-Fallback (WhatsApp → SMS)</option>
                        </select>
                      </div>

                      <div>
                        <Label className="text-xs font-bold text-muted-foreground">Target Segment</Label>
                        <select
                          value={targetAudience}
                          onChange={(e) => setTargetAudience(e.target.value)}
                          className="w-full bg-surface border border-border text-foreground text-xs rounded-lg px-3 py-2 outline-none mt-1"
                        >
                          <option value="all_active">All Active Gym Members</option>
                          <option value="at_risk_churn">At-Risk Members (Inactive 14+ Days)</option>
                          <option value="vip_tier">VIP & Platinum Plan Members</option>
                          <option value="leads">New Tour & Trial Leads</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs font-bold text-muted-foreground">Personalized Message Template</Label>
                        <div className="flex gap-1 text-[10px]">
                          <span className="text-muted-foreground">Merge tags:</span>
                          {['first_name', 'gym_name', 'phone'].map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => insertTag(tag)}
                              className="px-1.5 py-0.5 rounded bg-surface hover:bg-surface-container border border-border font-mono text-primary"
                            >
                              +{tag}
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea
                        rows={4}
                        required
                        value={messageTemplate}
                        onChange={(e) => setMessageTemplate(e.target.value)}
                        className="w-full bg-surface border border-border rounded-lg p-3 text-xs text-foreground outline-none font-mono"
                      />
                      <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                        <span>Characters: {messageTemplate.length}</span>
                        <span>SMS Segments: {Math.ceil(Math.max(1, messageTemplate.length) / 160)} Part(s)</span>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <Button
                        type="submit"
                        disabled={sendingBroadcast}
                        className="text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
                      >
                        {sendingBroadcast ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                        <span>Launch Mass Broadcast</span>
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Live Preview Device (5 cols) */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <Card className="border-border bg-card p-5 space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Smartphone className="size-3.5 text-primary" /> Recipient Handset Preview
                  </span>

                  <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pb-2 border-b border-border/50">
                      <span className="font-semibold text-foreground">
                        {broadcastChannel === 'whatsapp' ? '💬 WhatsApp Business' : '📱 SMS Sender'}
                      </span>
                      <span className="font-mono text-primary">GYMPARTNER</span>
                    </div>

                    <div className="bg-surface-container/70 p-3 rounded-lg text-xs leading-relaxed text-foreground font-body-base">
                      {messageTemplate
                        .replace(/{{first_name}}/gi, 'David')
                        .replace(/{{gym_name}}/gi, 'GymPartner Kigali')
                        .replace(/{{phone}}/gi, '+250 788 123 456')}
                    </div>

                    <div className="text-right text-[10px] text-muted-foreground font-mono">
                      Just now • Delivered via {broadcastChannel.toUpperCase()}
                    </div>
                  </div>
                </Card>

                {/* Past Broadcast History */}
                <Card className="border-border bg-card overflow-hidden">
                  <div className="p-4 border-b border-border bg-surface-container/30 flex justify-between items-center">
                    <h4 className="text-xs font-bold text-foreground">Recent Campaigns</h4>
                    <span className="text-[11px] text-muted-foreground font-mono">{campaigns.length} Sent</span>
                  </div>
                  <div className="divide-y divide-border max-h-56 overflow-y-auto">
                    {campaigns.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">No broadcast campaigns yet.</div>
                    ) : (
                      campaigns.map((c) => (
                        <div key={c.id} className="p-3 text-xs flex items-center justify-between hover:bg-surface-container/30">
                          <div>
                            <div className="font-semibold text-foreground">{c.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              {new Date(c.sent_at).toLocaleDateString()} • {c.total_recipients} Recipients
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] bg-status-cleared/10 text-status-cleared border-status-cleared/30">
                            {c.successful_deliveries} Delivered
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>

            </div>
          </TabsContent>

          {/* TAB 2: INSTANT DIRECT DISPATCH */}
          <TabsContent value="single" className="mt-0 max-w-2xl outline-none">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3 border-b border-border bg-surface-container/30">
                <CardTitle className="text-sm font-heading font-bold text-foreground">
                  Send Direct Transactional Message
                </CardTitle>
                <CardDescription className="text-xs">
                  Instant SMS or WhatsApp message to a specific phone number or member.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6">
                <form onSubmit={handleSendSingle} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-bold text-muted-foreground">Recipient Phone Number</Label>
                      <Input
                        required
                        placeholder="e.g. 0788123456 or +250..."
                        value={singleRecipient}
                        onChange={(e) => setSingleRecipient(e.target.value)}
                        className="bg-surface border-border mt-1 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-bold text-muted-foreground">Channel</Label>
                      <select
                        value={singleChannel}
                        onChange={(e) => setSingleChannel(e.target.value as any)}
                        className="w-full bg-surface border border-border text-foreground text-xs rounded-lg px-3 py-2 outline-none mt-1"
                      >
                        <option value="sms">Africa&apos;s Talking SMS</option>
                        <option value="whatsapp">Meta WhatsApp API</option>
                        <option value="auto_fallback">⚡ Auto-Fallback</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-muted-foreground">Message Body</Label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Type direct message..."
                      value={singleMessage}
                      onChange={(e) => setSingleMessage(e.target.value)}
                      className="w-full bg-surface border border-border rounded-lg p-3 text-xs text-foreground outline-none mt-1 font-mono"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="submit"
                      disabled={sendingSingle}
                      className="text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
                    >
                      {sendingSingle ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                      <span>Send Direct Message</span>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: REAL-TIME DELIVERY STREAM */}
          <TabsContent value="logs" className="mt-0 outline-none">
            <Card className="border-border bg-card overflow-hidden">
              <div className="p-4 border-b border-border bg-surface-container/30 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-heading font-bold text-foreground">Delivery Stream & Telemetry</h3>
                  <p className="text-xs text-muted-foreground">Outbound transactional and broadcast gateway logs</p>
                </div>
                <Badge variant="outline" className="text-xs font-mono bg-primary/10 text-primary border-primary/20">
                  {logs.length} Messages Logged
                </Badge>
              </div>

              <div className="p-0">
                <Table>
                  <TableHeader className="bg-surface-container/50">
                    <TableRow>
                      <TableHead className="text-xs">Channel</TableHead>
                      <TableHead className="text-xs">Recipient</TableHead>
                      <TableHead className="text-xs">Message Excerpt</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Sent Timestamp</TableHead>
                      <TableHead className="text-right text-xs">Gateway Ref</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                          No communication logs found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((l) => (
                        <TableRow key={l.id} className="hover:bg-surface-container/30">
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase font-mono ${
                                l.channel === 'whatsapp'
                                  ? 'bg-status-cleared/10 text-status-cleared border-status-cleared/30'
                                  : 'bg-primary/10 text-primary border-primary/30'
                              }`}
                            >
                              {l.channel}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-foreground">
                            {l.recipient}
                          </TableCell>
                          <TableCell className="max-w-md text-xs text-muted-foreground truncate">
                            {l.content}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] capitalize ${
                                l.status === 'sent' || l.status === 'delivered'
                                  ? 'bg-status-cleared/10 text-status-cleared border-status-cleared/30'
                                  : 'bg-status-blocked/10 text-status-blocked border-status-blocked/30'
                              }`}
                            >
                              {l.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {new Date(l.created_at).toLocaleTimeString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                            {l.metadata?.message_id || 'ACK_OK'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* TAB 4: GATEWAY PROVIDERS CONFIG */}
          <TabsContent value="providers" className="mt-0 outline-none">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Africa's Talking Card */}
              <Card className="border-border bg-card p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                      AT
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">Africa&apos;s Talking SMS</h4>
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
                    <span>Target Rate:</span>
                    <span className="font-mono text-foreground">12.00 RWF / SMS</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Supported Networks:</span>
                    <span className="font-mono text-foreground">MTN Rwanda, Airtel-Tigo</span>
                  </div>
                </div>
              </Card>

              {/* Meta WhatsApp Card */}
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
                    <span>Templates:</span>
                    <span className="font-mono text-foreground">Enabled (utility & marketing)</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Fallback Mode:</span>
                    <span className="font-mono text-primary font-semibold">Automatic to Africa&apos;s Talking</span>
                  </div>
                </div>
              </Card>

            </div>
          </TabsContent>

        </Tabs>
      </div>

    </div>
  );
}
