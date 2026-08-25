'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  getTenantSettings,
  updateBrandingSettings,
  updateGatewaySettings,
  updateHardwareSettings,
  updateRegionalSettings,
  updateMultiBranchSettings,
  testGatewayConnection,
  uploadTenantLogo,
  type HardwareZone,
} from '@/lib/api/settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Code2,
  Palette,
  Key,
  Cpu,
  Globe,
  Building2,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Save
} from 'lucide-react';
import Image from 'next/image';

export default function SettingsPage() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('branding');

  // Status feedback
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingTab, setSavingTab] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [testingGateway, setTestingGateway] = useState<string | null>(null);
  const [gatewayTestResult, setGatewayTestResult] = useState<{ gateway: string; message: string; success: boolean } | null>(null);

  // Password visibility toggles
  const [showPaypackKey, setShowPaypackKey] = useState(false);
  const [showPaypackSecret, setShowPaypackSecret] = useState(false);

  // Form states
  const [branding, setBranding] = useState({
    logoUrl: '',
    primaryColor: '#29C47A',
    secondaryColor: '#2E8BFF',
    customCss: '',
    brandingSettings: {} as Record<string, any>,
  });

  const [gateways, setGateways] = useState({
    paypackApiKey: '',
    paypackSecret: '',
    smsGatewayCredentials: '',
    hasPaypackConfigured: false,
    hasSmsConfigured: false,
  });

  const [hardware, setHardware] = useState<{
    shellyRelays: string;
    zones: HardwareZone[];
  }>({
    shellyRelays: '',
    zones: [],
  });

  const [newZoneName, setNewZoneName] = useState('');

  const [regional, setRegional] = useState({
    currency: 'RWF',
    taxRate: 18,
    latitude: '-1.9448',
    longitude: '30.0615',
    radius: 100,
  });

  const [multiBranch, setMultiBranch] = useState({
    operatingHours: '06:00 - 22:00 (Mon-Sat), 08:00 - 18:00 (Sun)',
    roamingPermissions: 'Gold, Platinum, VIP',
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /** Load current tenant and its settings */
  const loadSettings = useCallback(async () => {
    try {
      setInitialLoading(true);
      setStatusMessage(null);

      // 1. Get current tenant
      const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .select('id, name')
        .limit(1)
        .single();

      if (tenantErr || !tenant) {
        throw new Error('Tenant record could not be loaded. Please ensure you are logged in.');
      }

      setTenantId(tenant.id);
      setTenantName(tenant.name || 'GymPartner');

      // 2. Fetch full settings via API service
      const data = await getTenantSettings(tenant.id);

      if (data.branding) {
        setBranding({
          logoUrl: data.branding.logo_url || '',
          primaryColor: data.branding.primary_color || '#29C47A',
          secondaryColor: data.branding.secondary_color || '#2E8BFF',
          customCss: data.branding.custom_css || '',
          brandingSettings: data.branding.branding_settings || {},
        });
      }

      if (data.gateways) {
        setGateways(prev => ({
          ...prev,
          hasPaypackConfigured: !!data.gateways.has_paypack_configured,
          hasSmsConfigured: !!data.gateways.has_sms_configured,
        }));
      }

      if (data.hardware) {
        const relayStr = typeof data.hardware.shelly_relays_config === 'string'
          ? data.hardware.shelly_relays_config
          : JSON.stringify(data.hardware.shelly_relays_config || {}, null, 2);

        setHardware({
          shellyRelays: relayStr,
          zones: Array.isArray(data.hardware.hardware_zones) ? data.hardware.hardware_zones : [],
        });
      }

      if (data.regional) {
        setRegional({
          currency: data.regional.default_currency || 'RWF',
          taxRate: data.regional.tax_rate !== undefined ? Number(data.regional.tax_rate) * 100 : 18,
          latitude: data.regional.geofence_lat !== null ? String(data.regional.geofence_lat) : '-1.9448',
          longitude: data.regional.geofence_lon !== null ? String(data.regional.geofence_lon) : '30.0615',
          radius: data.regional.geofence_radius !== null ? Number(data.regional.geofence_radius) : 100,
        });
      }

      if (data.multibranch) {
        const roaming = data.multibranch.branch_roaming_config?.roamingPermissions;
        setMultiBranch({
          operatingHours: data.multibranch.operating_hours || '06:00 - 22:00 (Mon-Sat), 08:00 - 18:00 (Sun)',
          roamingPermissions: Array.isArray(roaming) ? roaming.join(', ') : 'Gold, Platinum, VIP',
        });
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to load tenant settings.' });
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  /** Save Branding Handler */
  const handleSaveBranding = async () => {
    if (!tenantId) return;
    try {
      setSavingTab('branding');
      setStatusMessage(null);
      await updateBrandingSettings(tenantId, {
        logo_url: branding.logoUrl || null as any,
        primary_color: branding.primaryColor,
        secondary_color: branding.secondaryColor,
        custom_css: branding.customCss,
        branding_settings: branding.brandingSettings || {},
      });
      setStatusMessage({ type: 'success', text: 'Whitelabel branding settings saved successfully!' });
    } catch (err: any) {
      console.error('Failed to save branding:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to save branding settings.' });
    } finally {
      setSavingTab(null);
    }
  };

  /** Logo File Upload Handler */
  const handleLogoFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!tenantId) return;
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate size (< 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage({ type: 'error', text: 'Logo image size must be under 5MB.' });
      return;
    }

    try {
      setUploadingLogo(true);
      setStatusMessage(null);
      const res = await uploadTenantLogo(tenantId, file);
      setBranding(prev => ({ ...prev, logoUrl: res.logo_url }));
      setStatusMessage({ type: 'success', text: 'Logo uploaded and updated successfully!' });
    } catch (err: any) {
      console.error('Logo upload error:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to upload logo.' });
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /** Save Payment Gateways Handler */
  const handleSaveGateways = async () => {
    if (!tenantId) return;
    try {
      setSavingTab('gateways');
      setStatusMessage(null);
      const res = await updateGatewaySettings(tenantId, {
        paypack_api_key: gateways.paypackApiKey || undefined,
        paypack_secret: gateways.paypackSecret || undefined,
        sms_gateway_credentials: gateways.smsGatewayCredentials || undefined,
      });
      setGateways(prev => ({
        ...prev,
        hasPaypackConfigured: res.gateways.has_paypack_configured,
        hasSmsConfigured: res.gateways.has_sms_configured,
        paypackApiKey: '',
        paypackSecret: '',
      }));
      setStatusMessage({ type: 'success', text: 'Payment gateway credentials updated securely.' });
    } catch (err: any) {
      console.error('Failed to save gateways:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update payment gateways.' });
    } finally {
      setSavingTab(null);
    }
  };

  /** Test Gateway Connection */
  const handleTestGateway = async (gatewayType: 'paypack' | 'sms') => {
    if (!tenantId) return;
    try {
      setTestingGateway(gatewayType);
      setGatewayTestResult(null);
      const res = await testGatewayConnection(tenantId, gatewayType);
      setGatewayTestResult({
        gateway: gatewayType,
        message: res.message,
        success: res.configured,
      });
    } catch (err: any) {
      setGatewayTestResult({
        gateway: gatewayType,
        message: err.message || 'Connection test failed',
        success: false,
      });
    } finally {
      setTestingGateway(null);
    }
  };

  /** Save Hardware Settings */
  const handleSaveHardware = async () => {
    if (!tenantId) return;
    try {
      setSavingTab('hardware');
      setStatusMessage(null);

      let parsedRelays: any = hardware.shellyRelays;
      try {
        parsedRelays = JSON.parse(hardware.shellyRelays || '{}');
      } catch {
        // Leave as string/object
      }

      await updateHardwareSettings(tenantId, {
        shelly_relays_config: parsedRelays,
        hardware_zones: hardware.zones,
      });
      setStatusMessage({ type: 'success', text: 'Hardware relays and zones configuration saved!' });
    } catch (err: any) {
      console.error('Failed to save hardware:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to save hardware settings.' });
    } finally {
      setSavingTab(null);
    }
  };

  /** Add Zone */
  const handleAddZone = () => {
    if (!newZoneName.trim()) return;
    const newZone: HardwareZone = {
      id: `zone_${Date.now()}`,
      name: newZoneName.trim(),
      accessRules: ['all_members'],
    };
    setHardware(prev => ({
      ...prev,
      zones: [...prev.zones, newZone],
    }));
    setNewZoneName('');
  };

  /** Remove Zone */
  const handleRemoveZone = (id: string) => {
    setHardware(prev => ({
      ...prev,
      zones: prev.zones.filter(z => z.id !== id),
    }));
  };

  /** Save Regional Settings */
  const handleSaveRegional = async () => {
    if (!tenantId) return;
    try {
      setSavingTab('regional');
      setStatusMessage(null);

      const lat = parseFloat(regional.latitude);
      const lon = parseFloat(regional.longitude);
      const radius = parseFloat(String(regional.radius));
      const taxRateDecimal = parseFloat(String(regional.taxRate)) / 100;

      await updateRegionalSettings(tenantId, {
        default_currency: regional.currency,
        tax_rate: isNaN(taxRateDecimal) ? 0.18 : taxRateDecimal,
        geofence_lat: isNaN(lat) ? null : lat,
        geofence_lon: isNaN(lon) ? null : lon,
        geofence_radius: isNaN(radius) ? 100 : radius,
      });
      setStatusMessage({ type: 'success', text: 'Regional currency and tax settings updated successfully!' });
    } catch (err: any) {
      console.error('Failed to save regional:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to save regional settings.' });
    } finally {
      setSavingTab(null);
    }
  };

  /** Save Multi-Branch Settings */
  const handleSaveMultiBranch = async () => {
    if (!tenantId) return;
    try {
      setSavingTab('multibranch');
      setStatusMessage(null);

      const roamingTiers = multiBranch.roamingPermissions
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      await updateMultiBranchSettings(tenantId, {
        operating_hours: multiBranch.operatingHours,
        branch_roaming_config: {
          roamingPermissions: roamingTiers,
        },
      });
      setStatusMessage({ type: 'success', text: 'Multi-branch operating hours and roaming settings saved!' });
    } catch (err: any) {
      console.error('Failed to save multi-branch:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to save multi-branch configuration.' });
    } finally {
      setSavingTab(null);
    }
  };

  if (initialLoading) {
    return (
      <div className="container mx-auto py-12 flex flex-col items-center justify-center min-h-[400px] text-center">
        <Loader2 className="size-8 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-heading font-semibold text-foreground">Loading Tenant Settings...</h2>
        <p className="text-sm text-muted-foreground mt-1">Retrieving branding, gateways, and hardware configuration</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Admin Settings</h1>
            <Badge variant="outline" className="text-xs bg-surface-container text-foreground">
              {tenantName}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage whitelabel branding, payment gateways, IoT relay zones, regional taxes, and multi-branch roaming.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadSettings}
          className="self-start sm:self-auto gap-2"
        >
          <RefreshCw className="size-4" />
          Refresh Settings
        </Button>
      </div>

      {/* Global Status Alert */}
      {statusMessage && (
        <div
          role="alert"
          className={`p-4 rounded-lg flex items-start gap-3 text-sm border ${
            statusMessage.type === 'success'
              ? 'bg-status-cleared/10 border-status-cleared/30 text-status-cleared'
              : 'bg-status-blocked/10 border-status-blocked/30 text-status-blocked'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="size-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="size-5 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-medium">{statusMessage.text}</div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 uppercase tracking-wider font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 gap-1 bg-surface-container p-1 rounded-lg border border-border">
          <TabsTrigger value="branding" className="flex items-center gap-2 py-2.5">
            <Palette className="size-4" />
            <span>Branding</span>
          </TabsTrigger>
          <TabsTrigger value="gateways" className="flex items-center gap-2 py-2.5">
            <Key className="size-4" />
            <span>Gateways</span>
          </TabsTrigger>
          <TabsTrigger value="hardware" className="flex items-center gap-2 py-2.5">
            <Cpu className="size-4" />
            <span>Hardware & Relays</span>
          </TabsTrigger>
          <TabsTrigger value="regional" className="flex items-center gap-2 py-2.5">
            <Globe className="size-4" />
            <span>Regional & Tax</span>
          </TabsTrigger>
          <TabsTrigger value="multibranch" className="flex items-center gap-2 py-2.5">
            <Building2 className="size-4" />
            <span>Multi-Branch</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: BRANDING */}
        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="size-5 text-primary" />
                Whitelabel Branding & Custom Identity
              </CardTitle>
              <CardDescription>
                Customize gym logo, theme palette, and inject custom CSS styling across your member and staff portals.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo section */}
              <div className="space-y-3">
                <Label htmlFor="logoUrl" className="text-sm font-semibold">Gym Logo</Label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {branding.logoUrl ? (
                    <div className="relative size-20 rounded-lg border border-border bg-surface-container flex items-center justify-center overflow-hidden p-1 shrink-0">
                      <Image
                        src={branding.logoUrl}
                        alt="Tenant Gym Logo"
                        width={72}
                        height={72}
                        className="object-contain max-h-full max-w-full"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="size-20 rounded-lg border border-dashed border-border bg-surface-container flex flex-col items-center justify-center text-xs text-muted-foreground p-2 text-center shrink-0">
                      <Palette className="size-6 mb-1 opacity-50" />
                      No Logo
                    </div>
                  )}

                  <div className="flex-1 space-y-2 w-full">
                    <div className="flex gap-2">
                      <Input
                        id="logoUrl"
                        placeholder="https://example.com/logo.png"
                        value={branding.logoUrl}
                        onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
                        className="flex-1"
                      />
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        className="hidden"
                        onChange={handleLogoFileUpload}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={uploadingLogo}
                        onClick={() => fileInputRef.current?.click()}
                        className="gap-2 shrink-0"
                      >
                        {uploadingLogo ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Upload className="size-4" />
                        )}
                        Upload File
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Upload PNG, JPG, WebP, or SVG (max 5MB) or enter a direct image URL.
                    </p>
                  </div>
                </div>
              </div>

              {/* Color pickers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor" className="text-sm font-semibold">Primary Brand Color</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="primaryColorPicker"
                      type="color"
                      value={branding.primaryColor}
                      onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                      className="w-14 h-11 p-1 cursor-pointer shrink-0"
                    />
                    <Input
                      id="primaryColor"
                      placeholder="#29C47A"
                      value={branding.primaryColor}
                      onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                      className="font-mono text-sm uppercase"
                    />
                    <div
                      className="size-11 rounded-lg border border-border shrink-0 shadow-xs"
                      style={{ backgroundColor: branding.primaryColor }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Used for primary action buttons, active tabs, and highlights.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secondaryColor" className="text-sm font-semibold">Secondary Accent Color</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="secondaryColorPicker"
                      type="color"
                      value={branding.secondaryColor}
                      onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                      className="w-14 h-11 p-1 cursor-pointer shrink-0"
                    />
                    <Input
                      id="secondaryColor"
                      placeholder="#2E8BFF"
                      value={branding.secondaryColor}
                      onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                      className="font-mono text-sm uppercase"
                    />
                    <div
                      className="size-11 rounded-lg border border-border shrink-0 shadow-xs"
                      style={{ backgroundColor: branding.secondaryColor }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Used for secondary badges, informational tags, and accents.</p>
                </div>
              </div>

              {/* Custom CSS */}
              <div className="space-y-2 pt-2">
                <Label htmlFor="customCss" className="text-sm font-semibold">Custom CSS Stylesheet</Label>
                <Textarea
                  id="customCss"
                  placeholder="/* Example: .gym-portal-banner { border-radius: 12px; } */"
                  value={branding.customCss}
                  onChange={(e) => setBranding({ ...branding, customCss: e.target.value })}
                  className="font-mono text-xs min-h-[120px]"
                />
                <p className="text-xs text-muted-foreground">
                  Custom CSS overrides for client-facing member booking portals and digital signage.
                </p>
              </div>

              <div className="pt-4 border-t border-border flex justify-end">
                <Button
                  onClick={handleSaveBranding}
                  disabled={savingTab === 'branding'}
                  className="gap-2 min-w-[160px]"
                >
                  {savingTab === 'branding' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save Branding
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: GATEWAYS */}
        <TabsContent value="gateways" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Key className="size-5 text-primary" />
                Payment Gateway & SMS Gateway Credentials
              </CardTitle>
              <CardDescription>
                Configure credentials for local Rwandan payments (Paypack aggregator for MTN MoMo & Airtel) and SMS notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Paypack status & inputs */}
              <div className="p-4 rounded-lg border border-border bg-surface-container space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">Paypack Mobile Money Gateway</span>
                    {gateways.hasPaypackConfigured ? (
                      <Badge variant="success" className="text-xs">Configured</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Not Configured</Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={testingGateway === 'paypack'}
                    onClick={() => handleTestGateway('paypack')}
                    className="gap-1.5"
                  >
                    {testingGateway === 'paypack' && <Loader2 className="size-3.5 animate-spin" />}
                    Test Paypack
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="paypackApiKey">Paypack Application ID / Client Key</Label>
                    <div className="relative">
                      <Input
                        id="paypackApiKey"
                        type={showPaypackKey ? 'text' : 'password'}
                        placeholder={gateways.hasPaypackConfigured ? '••••••••••••••••' : 'Enter Paypack Client ID'}
                        value={gateways.paypackApiKey}
                        onChange={(e) => setGateways({ ...gateways, paypackApiKey: e.target.value })}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPaypackKey(!showPaypackKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showPaypackKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paypackSecret">Paypack Client Secret / API Key</Label>
                    <div className="relative">
                      <Input
                        id="paypackSecret"
                        type={showPaypackSecret ? 'text' : 'password'}
                        placeholder={gateways.hasPaypackConfigured ? '••••••••••••••••' : 'Enter Paypack Secret'}
                        value={gateways.paypackSecret}
                        onChange={(e) => setGateways({ ...gateways, paypackSecret: e.target.value })}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPaypackSecret(!showPaypackSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showPaypackSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* SMS Gateway */}
              <div className="p-4 rounded-lg border border-border bg-surface-container space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">SMS Notification Gateway</span>
                    {gateways.hasSmsConfigured ? (
                      <Badge variant="success" className="text-xs">Configured</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Not Configured</Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={testingGateway === 'sms'}
                    onClick={() => handleTestGateway('sms')}
                    className="gap-1.5"
                  >
                    {testingGateway === 'sms' && <Loader2 className="size-3.5 animate-spin" />}
                    Test SMS Gateway
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smsGatewayCredentials">SMS API Credentials / Webhook Secret</Label>
                  <Textarea
                    id="smsGatewayCredentials"
                    placeholder={gateways.hasSmsConfigured ? '••••••••••••••••' : 'Enter SMS provider API token or JSON configuration'}
                    value={gateways.smsGatewayCredentials}
                    onChange={(e) => setGateways({ ...gateways, smsGatewayCredentials: e.target.value })}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Credentials are encrypted in transit and stored safely in the backend database.
                  </p>
                </div>
              </div>

              {/* Gateway test status card */}
              {gatewayTestResult && (
                <div
                  className={`p-3 rounded-lg border flex items-center gap-3 text-sm ${
                    gatewayTestResult.success
                      ? 'bg-status-cleared/10 border-status-cleared/30 text-status-cleared'
                      : 'bg-status-action/10 border-status-action/30 text-status-action'
                  }`}
                >
                  {gatewayTestResult.success ? (
                    <CheckCircle2 className="size-4 shrink-0" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0" />
                  )}
                  <span>
                    <strong>{gatewayTestResult.gateway.toUpperCase()}:</strong> {gatewayTestResult.message}
                  </span>
                </div>
              )}

              <div className="pt-4 border-t border-border flex justify-end">
                <Button
                  onClick={handleSaveGateways}
                  disabled={savingTab === 'gateways'}
                  className="gap-2 min-w-[160px]"
                >
                  {savingTab === 'gateways' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save Credentials
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: HARDWARE & RELAYS */}
        <TabsContent value="hardware" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Cpu className="size-5 text-primary" />
                IoT Door Relays & Hardware Zones
              </CardTitle>
              <CardDescription>
                Configure Shelly Pro Wi-Fi relays, turnstiles, and tier-based access zones for physical turnstile control.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Shelly Configuration */}
              <div className="space-y-2">
                <Label htmlFor="shellyRelays" className="text-sm font-semibold">Shelly Relay Hardware Map (JSON)</Label>
                <Textarea
                  id="shellyRelays"
                  placeholder='{\n  "front_door": { "ip": "192.168.1.100", "relay_index": 0, "timeout_ms": 3000 },\n  "turnstile_1": { "ip": "192.168.1.101", "relay_index": 0, "timeout_ms": 2000 }\n}'
                  value={hardware.shellyRelays}
                  onChange={(e) => setHardware({ ...hardware, shellyRelays: e.target.value })}
                  className="font-mono text-xs min-h-[120px]"
                />
                <p className="text-xs text-muted-foreground">
                  Define relay IP addresses and pulse triggers for access doors and turnstiles.
                </p>
              </div>

              {/* Hardware Zones */}
              <div className="space-y-3 pt-2">
                <Label className="text-sm font-semibold">Facility Access Zones</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="New zone name (e.g. VIP Recovery Lounge, Free Weights Floor)"
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddZone(); } }}
                  />
                  <Button type="button" variant="secondary" onClick={handleAddZone} className="gap-1.5 shrink-0">
                    <Plus className="size-4" />
                    Add Zone
                  </Button>
                </div>

                <div className="space-y-2 mt-3">
                  {hardware.zones.length === 0 ? (
                    <div className="p-4 rounded-lg border border-dashed border-border text-center text-sm text-muted-foreground">
                      No custom zones defined. All members have access to the main facility by default.
                    </div>
                  ) : (
                    hardware.zones.map((zone, idx) => (
                      <div
                        key={zone.id || idx}
                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface-container"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-xs">{`#${idx + 1}`}</Badge>
                          <span className="font-medium text-sm text-foreground">{zone.name}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveZone(zone.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-border flex justify-end">
                <Button
                  onClick={handleSaveHardware}
                  disabled={savingTab === 'hardware'}
                  className="gap-2 min-w-[160px]"
                >
                  {savingTab === 'hardware' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save Hardware Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: REGIONAL & TAX */}
        <TabsContent value="regional" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="size-5 text-primary" />
                Regional Currency, EBM Tax & Geofencing
              </CardTitle>
              <CardDescription>
                Configure local invoicing currency, Rwanda Revenue Authority (RRA) 18% VAT rate, and facility GPS geofence.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="currency">Default Billing Currency</Label>
                  <select
                    id="currency"
                    value={regional.currency}
                    onChange={(e) => setRegional({ ...regional, currency: e.target.value })}
                    className="flex h-11 w-full min-h-[44px] rounded-lg border border-border bg-surface-container px-3.5 py-2 text-sm text-foreground shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="RWF">RWF (Rwandan Franc)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="KES">KES (Kenyan Shilling)</option>
                    <option value="UGX">UGX (Ugandan Shilling)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxRate">VAT / Sales Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="18"
                    value={regional.taxRate}
                    onChange={(e) => setRegional({ ...regional, taxRate: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">Standard VAT in Rwanda is 18%.</p>
                </div>
              </div>

              {/* Geofence parameters */}
              <div className="p-4 rounded-lg border border-border bg-surface-container space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">Facility QR Check-in Geofence</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Validates that mobile member check-ins originate within physical range of the facility.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => setRegional(prev => ({ ...prev, latitude: '-1.9448', longitude: '30.0615', radius: 150 }))}
                  >
                    Set Kigali Center Defaults
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitude</Label>
                    <Input
                      id="latitude"
                      placeholder="-1.9448"
                      value={regional.latitude}
                      onChange={(e) => setRegional({ ...regional, latitude: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitude</Label>
                    <Input
                      id="longitude"
                      placeholder="30.0615"
                      value={regional.longitude}
                      onChange={(e) => setRegional({ ...regional, longitude: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="radius">Radius (Meters)</Label>
                    <Input
                      id="radius"
                      type="number"
                      placeholder="100"
                      value={regional.radius}
                      onChange={(e) => setRegional({ ...regional, radius: parseInt(e.target.value, 10) || 100 })}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex justify-end">
                <Button
                  onClick={handleSaveRegional}
                  disabled={savingTab === 'regional'}
                  className="gap-2 min-w-[160px]"
                >
                  {savingTab === 'regional' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save Regional Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: MULTI-BRANCH */}
        <TabsContent value="multibranch" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="size-5 text-primary" />
                Multi-Branch & Roaming Permissions
              </CardTitle>
              <CardDescription>
                Define daily facility operating hours and tiers eligible for inter-branch roaming access.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="operatingHours">Daily Operating Hours</Label>
                <Input
                  id="operatingHours"
                  placeholder="06:00 - 22:00 (Mon-Sat), 08:00 - 18:00 (Sun)"
                  value={multiBranch.operatingHours}
                  onChange={(e) => setMultiBranch({ ...multiBranch, operatingHours: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Displayed on the member mobile app and used by automated door locking schedules.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="roamingPermissions">Cross-Branch Roaming Tiers (Comma-separated)</Label>
                <Input
                  id="roamingPermissions"
                  placeholder="Gold, Platinum, VIP, All-Access"
                  value={multiBranch.roamingPermissions}
                  onChange={(e) => setMultiBranch({ ...multiBranch, roamingPermissions: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Members holding active plans in these tiers can scan into any sister branch across the network.
                </p>
              </div>

              <div className="pt-4 border-t border-border flex justify-end">
                <Button
                  onClick={handleSaveMultiBranch}
                  disabled={savingTab === 'multibranch'}
                  className="gap-2 min-w-[160px]"
                >
                  {savingTab === 'multibranch' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save Multi-Branch
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
