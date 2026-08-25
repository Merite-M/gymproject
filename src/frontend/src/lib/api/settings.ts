import { supabase } from '@/lib/supabase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface BrandingSettings {
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  custom_css: string;
  branding_settings?: Record<string, any>;
}

export interface GatewaySettings {
  paypack_api_key?: string;
  paypack_secret?: string;
  sms_gateway_credentials?: string;
}

export interface GatewayStatus {
  has_paypack_configured: boolean;
  has_sms_configured: boolean;
}

export interface HardwareZone {
  id: string;
  name: string;
  accessRules?: string[];
}

export interface HardwareSettings {
  shelly_relays_config: Record<string, any> | string;
  hardware_zones: HardwareZone[];
}

export interface RegionalSettings {
  default_currency: string;
  tax_rate: number;
  geofence_lat: number | null;
  geofence_lon: number | null;
  geofence_radius: number | null;
}

export interface MultiBranchSettings {
  operating_hours: string;
  branch_roaming_config: {
    roamingPermissions?: string[];
    [key: string]: any;
  };
}

export interface TenantSettingsResponse {
  branding: BrandingSettings;
  gateways: GatewayStatus;
  hardware: HardwareSettings;
  regional: RegionalSettings;
  multibranch: MultiBranchSettings;
}

export interface TestGatewayResponse {
  success: boolean;
  gateway_type: 'paypack' | 'sms';
  configured: boolean;
  message: string;
  timestamp: string;
}

/** Helper to retrieve the current user's session JWT token */
async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('User not authenticated. Please log in first.');
  }
  return session.access_token;
}

/**
 * Fetch all tenant settings from the backend admin settings endpoint.
 */
export async function getTenantSettings(tenantId: string): Promise<TenantSettingsResponse> {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE_URL}/api/admin/settings?tenant_id=${encodeURIComponent(tenantId)}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!res.ok) {
    throw new Error(`[getTenantSettings] ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

/**
 * Update tenant whitelabel branding settings (logo, colors, custom CSS).
 */
export async function updateBrandingSettings(
  tenantId: string,
  branding: Partial<BrandingSettings>
): Promise<{ success: boolean; branding: BrandingSettings }> {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE_URL}/api/admin/settings/branding`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      logo_url: branding.logo_url ?? null,
      primary_color: branding.primary_color ?? '#000000',
      secondary_color: branding.secondary_color ?? '#ffffff',
      custom_css: branding.custom_css ?? null,
      branding_settings: branding.branding_settings ?? {}
    })
  });

  if (!res.ok) {
    throw new Error(`[updateBrandingSettings] ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

/**
 * Update tenant payment gateway credentials.
 */
export async function updateGatewaySettings(
  tenantId: string,
  gateways: GatewaySettings
): Promise<{ success: boolean; gateways: GatewayStatus }> {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE_URL}/api/admin/settings/gateways`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      paypack_api_key: gateways.paypack_api_key || null,
      paypack_secret: gateways.paypack_secret || null,
      sms_gateway_credentials: gateways.sms_gateway_credentials || null
    })
  });

  if (!res.ok) {
    throw new Error(`[updateGatewaySettings] ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

/**
 * Update hardware relay configurations and zone definitions.
 */
export async function updateHardwareSettings(
  tenantId: string,
  hardware: HardwareSettings
): Promise<{ success: boolean; hardware: HardwareSettings }> {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE_URL}/api/admin/settings/hardware`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      shelly_relays_config: hardware.shelly_relays_config ?? {},
      hardware_zones: hardware.hardware_zones ?? []
    })
  });

  if (!res.ok) {
    throw new Error(`[updateHardwareSettings] ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

/**
 * Update regional settings (default currency, tax rate, and geofence coordinates).
 */
export async function updateRegionalSettings(
  tenantId: string,
  regional: RegionalSettings
): Promise<{ success: boolean; regional: RegionalSettings }> {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE_URL}/api/admin/settings/regional`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      default_currency: regional.default_currency || 'RWF',
      tax_rate: regional.tax_rate !== undefined ? regional.tax_rate : 0.18,
      geofence_lat: regional.geofence_lat ?? null,
      geofence_lon: regional.geofence_lon ?? null,
      geofence_radius: regional.geofence_radius ?? null
    })
  });

  if (!res.ok) {
    throw new Error(`[updateRegionalSettings] ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

/**
 * Update multi-branch settings (operating hours, roaming tiers).
 */
export async function updateMultiBranchSettings(
  tenantId: string,
  multiBranch: MultiBranchSettings
): Promise<{ success: boolean; multibranch: MultiBranchSettings }> {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE_URL}/api/admin/settings/multibranch`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      operating_hours: multiBranch.operating_hours || '',
      branch_roaming_config: multiBranch.branch_roaming_config || {}
    })
  });

  if (!res.ok) {
    throw new Error(`[updateMultiBranchSettings] ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

/**
 * Test connectivity and presence of configured payment gateway credentials.
 */
export async function testGatewayConnection(
  tenantId: string,
  gatewayType: 'paypack' | 'sms'
): Promise<TestGatewayResponse> {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE_URL}/api/admin/settings/test-gateway`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      gateway_type: gatewayType
    })
  });

  if (!res.ok) {
    throw new Error(`[testGatewayConnection] ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

/**
 * Upload tenant gym logo to Supabase Storage bucket and update tenant profile.
 */
export async function uploadTenantLogo(
  tenantId: string,
  file: File
): Promise<{ success: boolean; logo_url: string }> {
  const token = await getAuthToken();
  const formData = new FormData();
  formData.append('tenant_id', tenantId);
  formData.append('logo', file);

  const res = await fetch(`${API_BASE_URL}/api/admin/settings/logo`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  if (!res.ok) {
    throw new Error(`[uploadTenantLogo] ${res.status}: ${await res.text()}`);
  }

  return res.json();
}
