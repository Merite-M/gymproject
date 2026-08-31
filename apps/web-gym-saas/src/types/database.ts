/**
 * GymPartner Database Types
 * Fully-typed entity models corresponding to Supabase schema.
 */

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'staff' | 'trainer' | 'member';
export type MemberStatus = 'active' | 'inactive' | 'expired' | 'canceled' | 'debtor' | 'suspended';
export type HoldStatus = 'pending' | 'active' | 'approved' | 'rejected' | 'completed' | 'canceled';
export type CheckInStatus = 'approved' | 'warning' | 'denied' | 'denied_debt' | 'denied_geofence' | 'denied_capacity' | 'denied_not_found';
export type TaxCategory = 'standard' | 'exempt' | 'zero_rated';
export type PaymentMethod = 'cash' | 'mtn_momo' | 'airtel_money' | 'paypack' | 'member_tab' | 'card';
export type ShiftStatus = 'open' | 'closed' | 'discrepancy';
export type LeadStage = 'inquiry' | 'tour_scheduled' | 'trial_active' | 'trial_expired' | 'closed_won' | 'closed_lost';

export interface Tenant {
  id: string;
  name: string;
  subdomain?: string | null;
  currency?: string | null;
  tax_identifier?: string | null;
  vat_rate?: number;
  latitude?: number | null;
  longitude?: number | null;
  geofence_radius_meters?: number;
  max_occupancy_limit?: number;
  auto_checkout_minutes?: number;
  capacity_policy?: 'soft' | 'hard';
  staff_roster_enabled?: boolean;
  kiosk_admin_pin?: string | null;
  branding_settings?: Record<string, unknown> | null;
  shelly_relays_config?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface Profile {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  role: UserRole;
  status: MemberStatus;
  membership_status?: MemberStatus | null;
  avatar_url?: string | null;
  qr_code?: string | null;
  referral_code?: string | null;
  referred_by_id?: string | null;
  waiver_signed?: boolean;
  waiver_signed_at?: string | null;
  notes?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Membership {
  id: string;
  tenant_id: string;
  profile_id: string;
  plan_id?: string | null;
  tier_name?: string | null;
  status: MemberStatus;
  start_date: string;
  end_date: string;
  auto_renew?: boolean;
  guest_pass_allowance?: number;
  guest_passes_used?: number;
  created_at: string;
  updated_at?: string;
}

export interface MembershipHold {
  id: string;
  tenant_id: string;
  profile_id: string;
  membership_id?: string | null;
  start_date: string;
  end_date?: string | null;
  reason?: string | null;
  status: HoldStatus;
  created_by?: string | null;
  approved_by?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CheckIn {
  id: string;
  tenant_id: string;
  profile_id: string;
  device_id?: string | null;
  access_method: string;
  status: CheckInStatus;
  checkout_at?: string | null;
  created_at: string;
}

export interface FamilyLink {
  id: string;
  tenant_id: string;
  master_account_id: string;
  dependent_account_id: string;
  relationship_type?: string | null;
  created_at: string;
  master?: Profile;
  dependent?: Profile;
}

export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  cost_price?: number | null;
  sell_price: number;
  stock_quantity: number;
  min_stock_alert?: number;
  supplier?: string | null;
  supplier_id?: string | null;
  vat_rate?: number;
  tax_category?: TaxCategory;
  category?: string | null;
  description?: string | null;
  image?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  profile_id?: string | null;
  total_amount: number;
  subtotal_ex_vat?: number;
  vat_amount?: number;
  status: 'draft' | 'paid' | 'unpaid' | 'voided';
  invoice_number?: string | null;
  due_date?: string | null;
  created_at: string;
  updated_at?: string;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  tenant_id: string;
  invoice_id: string;
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_category?: TaxCategory;
  vat_rate?: number;
  total_amount: number;
  created_at?: string;
}

export interface ShiftLedger {
  id: string;
  tenant_id: string;
  staff_id: string;
  shift_start: string;
  shift_end?: string | null;
  starting_cash: number;
  expected_cash: number;
  actual_cash?: number | null;
  status: ShiftStatus;
  notes?: string | null;
  created_at?: string;
  staff?: Pick<Profile, 'first_name' | 'last_name'>;
  tasks?: ShiftTask[];
}

export interface TaskTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description?: string | null;
  role_target?: string | null;
  is_mandatory: boolean;
  requires_photo_evidence: boolean;
  created_at?: string;
}

export interface ShiftTask {
  id: string;
  tenant_id: string;
  shift_id: string;
  task_template_id: string;
  status: 'pending' | 'completed' | 'skipped';
  notes?: string | null;
  photo_url?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  created_at?: string;
  task_template?: TaskTemplate;
  template?: Pick<TaskTemplate, 'name' | 'is_mandatory'>;
}

export interface Lead {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone: string;
  source?: string | null;
  pipeline_stage: LeadStage;
  lead_score?: number;
  assigned_staff_id?: string | null;
  referred_by_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  assigned_staff?: Pick<Profile, 'id' | 'first_name' | 'last_name'> | null;
  referred_by?: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'referral_code'> | null;
}

export interface Promotion {
  id: string;
  tenant_id: string;
  code: string;
  description?: string | null;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  min_spend?: number;
  max_discount?: number;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  usage_count?: number;
  usage_limit?: number | null;
  created_at?: string;
}

export interface GiftVoucher {
  id: string;
  tenant_id: string;
  code: string;
  initial_value: number;
  current_balance: number;
  purchaser_id?: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  recipient_email?: string | null;
  is_active: boolean;
  expires_at?: string | null;
  created_at?: string;
}

export interface CorporateAccount {
  id: string;
  tenant_id: string;
  company_name: string;
  contact_person?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  copay_percentage?: number;
  max_members?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FacilityRental {
  id: string;
  tenant_id: string;
  facility_id: string;
  profile_id: string;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  total_price: number;
  status: 'booked' | 'in_use' | 'completed' | 'canceled';
  created_at: string;
}

export interface ContractTemplate {
  id: string;
  tenant_id: string;
  title: string;
  body_markdown: string;
  is_active: boolean;
  version: number;
  created_at?: string;
}

export interface MemberContract {
  id: string;
  tenant_id: string;
  profile_id: string;
  template_id: string;
  signed_at: string;
  signature_url?: string | null;
  status: 'signed' | 'expired' | 'revoked';
  created_at?: string;
}

export interface StaffTaskItem {
  id: string;
  tenant_id: string;
  title: string;
  description?: string | null;
  assigned_to?: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'done';
  due_date?: string | null;
  created_at?: string;
}

export type PlanTier = 'Standard' | 'Premium' | 'Elite';
export type CorporateEmployeeStatus = 'Active' | 'Suspended' | 'Terminated';
export type WellnessCategory = 'Gym' | 'Swimming Pool' | 'Sauna/Steam' | 'Sports Club' | 'Yoga Studio';
export type ProviderTierLevel = 'Standard' | 'Premium' | 'Luxury';
export type NetworkPayoutStatus = 'Pending' | 'Approved' | 'Capped_Zero_Rate' | 'Settled' | 'Denied';

export interface CorporateEmployer {
  id: string;
  tenant_id: string;
  company_name: string;
  tax_id_ebm: string;
  plan_tier: PlanTier;
  monthly_budget_rwf: number;
  employer_subsidy_percentage: number;
  billing_cycle_day: number;
  status: 'active' | 'suspended' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface CorporateEmployee {
  id: string;
  tenant_id: string;
  employer_id: string;
  user_id?: string | null;
  profile_id?: string | null;
  employee_code: string;
  department?: string | null;
  status: CorporateEmployeeStatus;
  monthly_co_pay_limit_rwf: number;
  created_at: string;
  updated_at: string;
  employer?: CorporateEmployer;
  profile?: Profile | null;
}

export interface WellnessProvider {
  id: string;
  tenant_id: string;
  provider_name: string;
  category: WellnessCategory;
  tier_level: ProviderTierLevel;
  payout_bank_account?: string | null;
  spenn_wallet_msisdn?: string | null;
  status: 'active' | 'suspended' | 'inactive';
  created_at: string;
  updated_at: string;
  facilities?: ProviderFacility[];
}

export interface ProviderFacility {
  id: string;
  tenant_id: string;
  provider_id: string;
  facility_name: string;
  category: WellnessCategory;
  tier_level: ProviderTierLevel;
  base_payout_per_visit_rwf: number;
  monthly_visit_cap_per_user: number;
  geofence_lat?: number | null;
  geofence_lng?: number | null;
  geofence_radius_meters: number;
  payout_bank_account?: string | null;
  spenn_wallet_msisdn?: string | null;
  status: 'active' | 'suspended' | 'inactive';
  created_at: string;
  updated_at: string;
  provider?: WellnessProvider;
}

export interface NetworkCheckin {
  id: string;
  tenant_id: string;
  employee_id: string;
  facility_id: string;
  verified_at: string;
  totp_token_used?: string | null;
  payout_amount_rwf: number;
  payout_status: NetworkPayoutStatus;
  is_co_pay_triggered: boolean;
  created_at: string;
  employee?: CorporateEmployee;
  facility?: ProviderFacility;
}

export interface NetworkCheckinVerificationResult {
  success: boolean;
  checkin_id?: string;
  employee_id?: string;
  facility_id?: string;
  facility_name?: string;
  visit_count_this_month?: number;
  monthly_visit_cap?: number;
  payout_amount_rwf?: number;
  payout_status?: NetworkPayoutStatus;
  is_co_pay_triggered?: boolean;
  verified_at?: string;
  error?: string;
  code?: string;
  last_checkin_at?: string;
}

export interface MonthlyProviderPayoutSummary {
  success: boolean;
  facility_id: string;
  facility_name: string;
  provider_id: string;
  period_year: number;
  period_month: number;
  total_visits: number;
  payable_visits: number;
  capped_zero_rate_visits: number;
  base_payout_per_visit_rwf: number;
  total_payout_due_rwf: number;
  payout_bank_account?: string | null;
  spenn_wallet_msisdn?: string | null;
  error?: string;
  code?: string;
}

