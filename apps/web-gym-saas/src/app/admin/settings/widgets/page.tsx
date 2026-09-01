'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Code2,
  Copy,
  ArrowLeft,
  Sparkles,
  Calendar,
  UserPlus,
  Palette,
  Eye,
  ExternalLink,
  CheckCircle2,
  Layout
} from 'lucide-react';

export default function WidgetCustomizerPage() {
  const [tenantSlug, setTenantSlug] = useState<string>('test-gym');
  const [tenantName, setTenantName] = useState<string>('Test Gym');

  // Widget customizer states
  const [widgetType, setWidgetType] = useState<'schedule' | 'join'>('schedule');
  const [primaryColor, setPrimaryColor] = useState<string>('#29C47A');
  const [embedType, setEmbedType] = useState<'script' | 'iframe'>('script');
  const [buttonText, setButtonText] = useState<string>('Schedule Free VIP Tour');
  const [targetId, setTargetId] = useState<string>('polyfit-widget');
  const [copied, setCopied] = useState<boolean>(false);

  // Live preview mockup state
  const [previewName, setPreviewName] = useState('');
  const [previewPhone, setPreviewPhone] = useState('');
  const [previewSubmitted, setPreviewSubmitted] = useState(false);
  const handlePreviewSubmit = async (mode: 'schedule' | 'join') => {
    setPreviewSubmitted(false);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      await fetch(`${backendUrl}/api/public/${tenantSlug}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: previewName || "Demo",
          last_name: "Member",
          phone: previewPhone || "+250788000000",
          email: "demo@polyfit.africa",
          membership_type: mode === 'schedule' ? 'VIP Tour Pass' : 'Trial Signup'
        })
      });
    } catch (e) {
      console.error("Preview submit error:", e);
    }
    setPreviewSubmitted(true);
  };

  useEffect(() => {
    async function loadTenantInfo() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        let tenantId = session?.user?.user_metadata?.tenant_id;

        if (!tenantId) {
          const { data: tenant } = await supabase.from('tenants').select('id, name, slug, primary_color').limit(1).maybeSingle();
          if (tenant) {
            setTenantSlug(tenant.slug || tenant.id);
            setTenantName(tenant.name);
            if (tenant.primary_color) setPrimaryColor(tenant.primary_color);
          }
        } else {
          const { data: tenant } = await supabase.from('tenants').select('id, name, slug, primary_color').eq('id', tenantId).single();
          if (tenant) {
            setTenantSlug(tenant.slug || tenant.id);
            setTenantName(tenant.name);
            if (tenant.primary_color) setPrimaryColor(tenant.primary_color);
          }
        }
      } catch (err) {
        console.error('Failed to load tenant details for widgets:', err);
      }
    }
    loadTenantInfo();
  }, []);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://polyfit-backend.onrender.com';

  const scriptCodeSnippet = `<script
  src="${backendUrl}/widgets/${widgetType}.js"
  data-tenant-slug="${tenantSlug}"
  data-primary-color="${primaryColor}"
  data-target="${targetId}">
</script>
<div id="${targetId}"></div>`;

  const iframeCodeSnippet = `<iframe
  src="${backendUrl}/api/public/${tenantSlug}/embed/${widgetType}"
  width="100%"
  height="620"
  className="border-none rounded-xl overflow-hidden"
  title="${tenantName} ${widgetType === 'schedule' ? 'Schedule' : 'Join'} Widget">
</iframe>`;

  const activeSnippet = embedType === 'script' ? scriptCodeSnippet : iframeCodeSnippet;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto font-body-base">
      {/* Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/settings"
              className="inline-flex items-center justify-center size-9 rounded-lg border border-border bg-surface hover:bg-surface-container transition-colors"
            >
              <ArrowLeft className="size-4 text-muted-foreground" />
            </Link>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-headline-md font-bold tracking-tight text-foreground">
                Embeddable Web Widgets
              </h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1.5 font-mono-id text-xs">
                <Sparkles className="size-3" /> GYM-58 Parity
              </Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1.5 pl-12">
            Embed real-time class timetables, trial bookings, and online membership signup forms directly into external sites (WordPress, Squarespace, Webflow).
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto pl-12 md:pl-0">
          <Badge variant="secondary" className="px-3 py-1.5 font-mono-id text-xs">
            Slug: <span className="font-bold text-foreground ml-1">{tenantSlug}</span>
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`${backendUrl}/api/public/${tenantSlug}/schedule`, '_blank')}
            className="gap-2"
          >
            <ExternalLink className="size-3.5" /> Test Public API
          </Button>
        </div>
      </div>

      {/* Main Grid: Customizer Controls + Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Config Panel */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-headline-md">
                <Palette className="size-5 text-primary" />
                Widget Customizer
              </CardTitle>
              <CardDescription>
                Customize layout, brand colors, and interactive behaviors for your embedded web widget.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Widget Type Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Widget Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setWidgetType('schedule');
                      setButtonText('Schedule Free VIP Tour');
                    }}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all ${
                      widgetType === 'schedule'
                        ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs'
                        : 'border-border bg-surface-container text-muted-foreground hover:bg-surface-container-high'
                    }`}
                  >
                    <Calendar className="size-5 mb-1.5" />
                    <span className="text-xs">Class Timetable</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWidgetType('join');
                      setButtonText('Complete Online Registration');
                    }}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all ${
                      widgetType === 'join'
                        ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs'
                        : 'border-border bg-surface-container text-muted-foreground hover:bg-surface-container-high'
                    }`}
                  >
                    <UserPlus className="size-5 mb-1.5" />
                    <span className="text-xs">Online Join & Trial</span>
                  </button>
                </div>
              </div>

              {/* Primary Color Picker */}
              <div className="space-y-2">
                <Label htmlFor="primaryColor" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Primary Brand Color
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    id="primaryColor"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="size-10 rounded-lg border border-border cursor-pointer bg-transparent p-0.5"
                  />
                  <Input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="font-mono-id text-sm uppercase bg-background border-border"
                    placeholder="#29C47A"
                  />
                  <div className="flex gap-1.5">
                    {['#29C47A', '#2E8BFF', '#FFB547', '#fa746f', '#9333ea', '#121b18'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setPrimaryColor(c)}
                        className="size-6 rounded-full border border-border transition-transform hover:scale-110"
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Button Text */}
              <div className="space-y-2">
                <Label htmlFor="buttonText" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Action Button Label
                </Label>
                <Input
                  id="buttonText"
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  placeholder="e.g. Book VIP Tour"
                  className="bg-background border-border"
                />
              </div>

              {/* Container Element ID */}
              <div className="space-y-2">
                <Label htmlFor="targetId" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Target DOM Element ID
                </Label>
                <Input
                  id="targetId"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value || 'polyfit-widget')}
                  className="font-mono-id text-xs bg-background border-border"
                />
                <p className="text-xs text-muted-foreground">
                  The script injects the widget interface inside the container matching this ID on your website.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Interactive Preview */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="overflow-hidden border-border shadow-md bg-card">
            <CardHeader className="bg-surface-container/60 border-b border-border py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="size-4 text-primary" />
                  <CardTitle className="text-base font-semibold font-headline-md">Live Interactive Preview</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex size-2 rounded-full bg-status-cleared animate-pulse" />
                  <span className="text-xs text-muted-foreground font-mono-id">Render Mockup</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 md:p-8 bg-surface-container/40 min-h-[460px] flex items-center justify-center">
              {/* Standalone Embedded Card Mockup */}
              <div className="w-full max-w-md bg-card rounded-2xl p-6 border border-border shadow-xl text-foreground space-y-5">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <h3 className="text-lg font-bold font-headline-md text-foreground">{tenantName}</h3>
                    <p className="text-xs text-muted-foreground">
                      {widgetType === 'schedule' ? 'Weekly Class Timetable' : 'Self-Service Membership Registration'}
                    </p>
                  </div>
                  <span
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full text-primary-foreground"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {widgetType === 'schedule' ? 'Live Schedule' : 'Instant Access'}
                  </span>
                </div>

                {widgetType === 'schedule' ? (
                  <div className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Upcoming Classes</div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface-container">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="size-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                            <strong className="text-sm text-foreground">HIIT & Cardio Blitz</strong>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">📅 Tomorrow at 07:00 AM</p>
                        </div>
                        <button
                          type="button"
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all min-h-[32px]"
                          style={{ borderColor: primaryColor, color: primaryColor }}
                        >
                          Book Spot
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface-container">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="size-2.5 rounded-full bg-status-action" />
                            <strong className="text-sm text-foreground">Power Weightlifting</strong>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">📅 Tomorrow at 05:30 PM</p>
                        </div>
                        <button
                          type="button"
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all min-h-[32px]"
                          style={{ borderColor: primaryColor, color: primaryColor }}
                        >
                          Book Spot
                        </button>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border space-y-3">
                      <div className="text-xs font-semibold text-foreground">Schedule VIP Gym Tour</div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="First Name"
                          value={previewName}
                          onChange={(e) => setPreviewName(e.target.value)}
                          className="w-full text-xs px-3 py-2 border border-border rounded-lg outline-none bg-background focus:border-primary text-foreground"
                        />
                        <input
                          type="tel"
                          placeholder="Phone Number"
                          value={previewPhone}
                          onChange={(e) => setPreviewPhone(e.target.value)}
                          className="w-full text-xs px-3 py-2 border border-border rounded-lg outline-none bg-background focus:border-primary text-foreground"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePreviewSubmit(widgetType)}
                        className="w-full text-xs font-semibold py-2.5 rounded-lg text-primary-foreground shadow-xs transition-opacity hover:opacity-90 min-h-[40px]"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {buttonText}
                      </button>
                      {previewSubmitted && (
                        <p className="text-xs text-status-cleared text-center font-medium">
                          🎉 Demo Tour Request Submitted!
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">First Name *</label>
                        <input
                          type="text"
                          placeholder="Alice"
                          className="w-full text-xs px-3 py-2 border border-border rounded-lg outline-none bg-background text-foreground"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Last Name *</label>
                        <input
                          type="text"
                          placeholder="Mugabo"
                          className="w-full text-xs px-3 py-2 border border-border rounded-lg outline-none bg-background text-foreground"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Phone Number (WhatsApp) *</label>
                      <input
                        type="tel"
                        placeholder="+250 788 123 456"
                        className="w-full text-xs px-3 py-2 border border-border rounded-lg outline-none bg-background text-foreground"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Select Membership Plan</label>
                      <select className="w-full text-xs px-3 py-2 border border-border rounded-lg outline-none bg-background text-foreground">
                        <option>7-Day Free VIP Trial Pass (Free)</option>
                        <option>Standard Monthly (RWF 30,000/mo)</option>
                        <option>Premium All-Access (RWF 50,000/mo)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Friend Referral Code (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. GP-ALICE88"
                        className="w-full text-xs px-3 py-2 border border-border rounded-lg outline-none uppercase bg-background text-foreground font-mono-id"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePreviewSubmit(widgetType)}
                      className="w-full text-xs font-semibold py-2.5 rounded-lg text-primary-foreground shadow-xs transition-opacity hover:opacity-90 mt-2 min-h-[40px]"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {buttonText}
                    </button>
                    {previewSubmitted && (
                      <p className="text-xs text-status-cleared text-center font-medium">
                        🎉 Demo Registration Complete!
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Section: Code Snippet Export */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-headline-md">
              <Code2 className="size-5 text-primary" />
              Embed Code Snippet Generator
            </CardTitle>
            <CardDescription>
              Copy and paste this code snippet directly into your site&apos;s HTML editor (WordPress, Squarespace, Webflow, HTML5).
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            <Tabs value={embedType} onValueChange={(val) => setEmbedType(val as 'script' | 'iframe')}>
              <TabsList className="bg-surface-container">
                <TabsTrigger value="script" className="gap-1.5 text-xs">
                  <Code2 className="size-3.5" /> JavaScript Tag
                </TabsTrigger>
                <TabsTrigger value="iframe" className="gap-1.5 text-xs">
                  <Layout className="size-3.5" /> iFrame Embed
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Button
              onClick={handleCopyCode}
              className="gap-2 font-semibold shadow-xs transition-all text-primary-foreground"
              style={{ backgroundColor: primaryColor }}
            >
              {copied ? <CheckCircle2 className="size-4 text-primary-foreground" /> : <Copy className="size-4" />}
              {copied ? 'Copied to Clipboard!' : 'Copy Embed Code'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="relative rounded-xl border border-border bg-surface-container p-4 font-mono-id text-sm text-status-cleared shadow-inner overflow-x-auto">
            <pre className="whitespace-pre-wrap break-all leading-relaxed">{activeSnippet}</pre>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>Served directly from backend gateway at <code>{backendUrl}</code></span>
            <span>Target Tenant: <strong className="text-foreground">{tenantName} ({tenantSlug})</strong></span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
