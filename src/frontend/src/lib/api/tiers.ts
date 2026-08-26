import { apiFetch } from '@/lib/api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface MembershipPlan {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  description: string | null;
  price: number;
  currency: string;
  billing_interval: string;
  tier_level: number;
  access_features: string[];
  is_active: boolean;
}

export interface ProrationCalculation {
  current_membership: {
    id: string;
    tier: string;
    price: number;
    start_date: string;
    end_date: string | null;
    billing_interval: string;
  };
  target_plan: {
    id: string;
    name: string;
    code: string;
    price: number;
    tier_level: number;
    access_features: string[];
    currency: string;
  };
  proration: {
    total_cycle_days: number;
    days_elapsed: number;
    days_remaining: number;
    current_daily_rate: number;
    unconsumed_credit: number;
    target_daily_rate: number;
    new_tier_cost_remaining: number;
    net_delta_amount: number;
    change_type: 'upgrade' | 'downgrade';
    currency: string;
  };
}

export interface TierChangeRecord {
  id: string;
  tenant_id: string;
  membership_id: string;
  profile_id: string;
  previous_tier: string;
  previous_price: number;
  new_tier: string;
  new_price: number;
  change_type: 'upgrade' | 'downgrade';
  proration_mode: 'immediate_prorated' | 'scheduled_next_cycle';
  total_cycle_days: number;
  days_elapsed: number;
  days_remaining: number;
  unconsumed_credit: number;
  new_tier_cost_remaining: number;
  delta_amount: number;
  invoice_id: string | null;
  status: string;
  effective_date: string;
  reason: string | null;
  created_at: string;
}

/**
 * Fetch all available membership plans/tiers for a gym facility.
 */
export async function getMembershipPlans(tenantId: string): Promise<MembershipPlan[]> {
  const data = await apiFetch<{ plans: MembershipPlan[] }>(
    `${API_BASE_URL}/api/tiers/plans?tenant_id=${encodeURIComponent(tenantId)}`
  );
  return data.plans || [];
}

/**
 * Calculate mid-cycle proration breakdown between current plan and target plan.
 */
export async function calculateProration(params: {
  tenantId: string;
  profileId: string;
  targetPlanId: string;
  asOfDate?: string;
}): Promise<ProrationCalculation> {
  return apiFetch<ProrationCalculation>(`${API_BASE_URL}/api/tiers/calculate-proration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: params.tenantId,
      profile_id: params.profileId,
      target_plan_id: params.targetPlanId,
      as_of_date: params.asOfDate || null
    })
  });
}

/**
 * Apply the membership tier upgrade or downgrade.
 */
export async function applyTierChange(params: {
  tenantId: string;
  profileId: string;
  targetPlanId: string;
  prorationMode?: 'immediate_prorated' | 'scheduled_next_cycle';
  paymentMethod?: string;
  reason?: string;
  notes?: string;
}): Promise<{
  success: boolean;
  message: string;
  tier_change: TierChangeRecord;
  invoice: any | null;
}> {
  return apiFetch<{
    success: boolean;
    message: string;
    tier_change: TierChangeRecord;
    invoice: any | null;
  }>(`${API_BASE_URL}/api/tiers/apply-tier-change`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: params.tenantId,
      profile_id: params.profileId,
      target_plan_id: params.targetPlanId,
      proration_mode: params.prorationMode || 'immediate_prorated',
      payment_method: params.paymentMethod || 'momo',
      reason: params.reason || null,
      notes: params.notes || null
    })
  });
}

/**
 * Fetch past tier change audit history for a member.
 */
export async function getTierChangeHistory(
  tenantId: string,
  profileId: string
): Promise<TierChangeRecord[]> {
  const data = await apiFetch<{ history: TierChangeRecord[] }>(
    `${API_BASE_URL}/api/tiers/history/${encodeURIComponent(profileId)}?tenant_id=${encodeURIComponent(tenantId)}`
  );
  return data.history || [];
}
