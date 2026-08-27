import { apiFetch } from '@/lib/api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface CorporateAccount {
  id: string;
  tenant_id: string;
  company_name: string;
  tin_number: string | null;
  contact_person_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  billing_address: string | null;
  discount_percentage: number;
  subsidy_percentage: number;
  billing_cycle: string;
  payment_terms_days: number;
  status: 'active' | 'suspended' | 'cancelled';
  active_members_count?: number;
  outstanding_balance?: number;
  created_at: string;
}

export interface CorporateMember {
  id: string;
  employee_id_number: string | null;
  department: string | null;
  subsidy_cap: number | null;
  status: string;
  joined_at: string;
  profiles?: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
    status: string;
    membership_status?: string;
  };
}

export interface InvoiceLineItem {
  profile_id: string;
  employee_name: string;
  employee_id_number: string;
  department: string;
  plan: string;
  base_fee: number;
  employer_subsidized_fee: number;
}

export interface CorporateInvoice {
  id: string;
  tenant_id: string;
  corporate_account_id: string;
  invoice_number: string;
  billing_period_start: string;
  billing_period_end: string;
  total_active_employees: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_due: number;
  currency: string;
  status: 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';
  payment_method: string | null;
  payment_reference: string | null;
  due_date: string;
  paid_at: string | null;
  itemized_breakdown: InvoiceLineItem[];
  created_at: string;
  corporate_accounts?: {
    company_name: string;
    tin_number?: string;
    contact_person_name?: string;
    contact_email?: string;
    contact_phone?: string;
    billing_address?: string;
  };
}

/**
 * Fetch all corporate sponsor accounts for a tenant.
 */
export async function getCorporateAccounts(tenantId: string): Promise<CorporateAccount[]> {
  const data = await apiFetch<{ accounts: CorporateAccount[] }>(
    `${API_BASE_URL}/api/corporate/accounts?tenant_id=${encodeURIComponent(tenantId)}`
  );
  return data.accounts || [];
}

/**
 * Create or update a corporate sponsor account.
 */
export async function saveCorporateAccount(params: {
  tenantId: string;
  id?: string;
  companyName: string;
  tinNumber?: string;
  contactPersonName?: string;
  contactEmail?: string;
  contactPhone?: string;
  billingAddress?: string;
  discountPercentage?: number;
  subsidyPercentage?: number;
  billingCycle?: string;
  paymentTermsDays?: number;
  status?: string;
}): Promise<CorporateAccount> {
  const data = await apiFetch<{ account: CorporateAccount }>(`${API_BASE_URL}/api/corporate/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: params.tenantId,
      id: params.id,
      company_name: params.companyName,
      tin_number: params.tinNumber || null,
      contact_person_name: params.contactPersonName || null,
      contact_email: params.contactEmail || null,
      contact_phone: params.contactPhone || null,
      billing_address: params.billingAddress || null,
      discount_percentage: params.discountPercentage ?? 0,
      subsidy_percentage: params.subsidyPercentage ?? 100,
      billing_cycle: params.billingCycle || 'monthly',
      payment_terms_days: params.paymentTermsDays ?? 30,
      status: params.status || 'active'
    })
  });
  return data.account;
}

/**
 * Fetch single corporate sponsor account details, employee roster, and invoice history.
 */
export async function getCorporateAccountDetails(
  tenantId: string,
  accountId: string
): Promise<{
  account: CorporateAccount;
  members: CorporateMember[];
  invoices: CorporateInvoice[];
}> {
  return apiFetch<{
    account: CorporateAccount;
    members: CorporateMember[];
    invoices: CorporateInvoice[];
  }>(`${API_BASE_URL}/api/corporate/accounts/${encodeURIComponent(accountId)}?tenant_id=${encodeURIComponent(tenantId)}`);
}

/**
 * Link an employee profile to a corporate sponsor.
 */
export async function enrollCorporateMember(params: {
  tenantId: string;
  accountId: string;
  profileId: string;
  employeeIdNumber?: string;
  department?: string;
  subsidyCap?: number;
}): Promise<CorporateMember> {
  const data = await apiFetch<{ member: CorporateMember }>(
    `${API_BASE_URL}/api/corporate/accounts/${encodeURIComponent(params.accountId)}/members`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: params.tenantId,
        profile_id: params.profileId,
        employee_id_number: params.employeeIdNumber || null,
        department: params.department || null,
        subsidy_cap: params.subsidyCap || null
      })
    }
  );
  return data.member;
}

/**
 * Remove an employee from corporate sponsor roster.
 */
export async function removeCorporateMember(
  tenantId: string,
  accountId: string,
  profileId: string
): Promise<void> {
  await apiFetch(
    `${API_BASE_URL}/api/corporate/accounts/${encodeURIComponent(accountId)}/members/${encodeURIComponent(profileId)}?tenant_id=${encodeURIComponent(tenantId)}`,
    {
      method: 'DELETE'
    }
  );
}

/**
 * Generate a grouped consolidated monthly B2B invoice across all enrolled employees.
 */
export async function generateCorporateInvoice(params: {
  tenantId: string;
  accountId: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  dueDate?: string;
}): Promise<CorporateInvoice> {
  const data = await apiFetch<{ invoice: CorporateInvoice }>(
    `${API_BASE_URL}/api/corporate/accounts/${encodeURIComponent(params.accountId)}/invoices/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: params.tenantId,
        billing_period_start: params.billingPeriodStart,
        billing_period_end: params.billingPeriodEnd,
        due_date: params.dueDate || null
      })
    }
  );
  return data.invoice;
}

/**
 * Record B2B payment / settle corporate invoice (MoMo Business, Bank Transfer, Card).
 */
export async function settleCorporateInvoice(params: {
  tenantId: string;
  invoiceId: string;
  paymentMethod: string;
  paymentReference?: string;
}): Promise<CorporateInvoice> {
  const data = await apiFetch<{ invoice: CorporateInvoice }>(
    `${API_BASE_URL}/api/corporate/invoices/${encodeURIComponent(params.invoiceId)}/settle`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: params.tenantId,
        payment_method: params.paymentMethod,
        payment_reference: params.paymentReference || null
      })
    }
  );
  return data.invoice;
}

/**
 * Bulk enroll corporate employees from CSV parsing or JSON array.
 */
export async function bulkEnrollCorporateMembers(params: {
  tenantId: string;
  accountId: string;
  employees: Array<{
    email: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    employee_id_number?: string;
    department?: string;
    subsidy_cap?: number;
    status?: string;
  }>;
}): Promise<{
  success: boolean;
  message: string;
  summary: {
    enrolled: number;
    updated: number;
    errors: Array<{ employee: any; error: string }>;
  };
}> {
  return apiFetch(
    `${API_BASE_URL}/api/corporate/accounts/${encodeURIComponent(params.accountId)}/members/bulk`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: params.tenantId,
        employees: params.employees
      })
    }
  );
}

/**
 * Generate a B2B Paypack payment link / MoMo auto-debit reference for a corporate invoice.
 */
export async function generateCorporatePaypackLink(params: {
  tenantId: string;
  invoiceId: string;
  phoneNumber?: string;
}): Promise<{
  success: boolean;
  payment_url: string;
  payment_reference: string;
  amount: number;
  currency: string;
  recipient_phone: string;
  invoice_number: string;
}> {
  return apiFetch(
    `${API_BASE_URL}/api/corporate/invoices/${encodeURIComponent(params.invoiceId)}/paypack-link`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: params.tenantId,
        phone_number: params.phoneNumber || null
      })
    }
  );
}
