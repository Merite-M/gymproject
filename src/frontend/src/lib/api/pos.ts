import { apiFetch } from '@/lib/api-client';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ProductItem {
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
  tax_category?: 'standard' | 'exempt' | 'zero_rated';
  category?: string | null;
  description?: string | null;
  image?: string | null;
}

export interface PaymentTender {
  method: 'cash' | 'momo' | 'airtel' | 'member_tab' | 'card';
  amount: number;
  reference_code?: string;
}

export interface CheckoutPayload {
  tenant_id: string;
  profile_id?: string | null;
  items: {
    product_id: string;
    quantity: number;
    sell_price?: number;
    name?: string;
  }[];
  payments: PaymentTender[];
  shift_id?: string | null;
  staff_id?: string | null;
  applied_promo_code?: string | null;
  applied_voucher_code?: string | null;
}

export interface CheckoutResponse {
  success: boolean;
  invoice_id: string;
  subtotal_gross: number;
  subtotal_ex_vat: number;
  vat_amount: number;
  total_incl_vat: number;
  tax_category_breakdown: {
    standard: { gross: number; ex_vat: number; vat: number; rate: number };
    exempt: { gross: number; ex_vat: number; vat: number; rate: number };
    zero_rated: { gross: number; ex_vat: number; vat: number; rate: number };
  };
  payments: PaymentTender[];
  discounts: {
    promo_code: string | null;
    promo_discount: number;
    voucher_code: string | null;
    voucher_discount: number;
  };
}

export interface MemberTabInfo {
  profile_id: string;
  balance: number;
  credit_limit: number;
  remaining_credit: number;
  formatted_balance: string;
  formatted_credit_limit: string;
  formatted_remaining_credit: string;
}

export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
  purchase_orders_count?: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id?: string;
  product_id: string;
  quantity_ordered: number;
  quantity_received?: number;
  unit_cost: number;
  total_cost?: number;
  products?: ProductItem;
}

export interface PurchaseOrder {
  id: string;
  tenant_id: string;
  supplier_id?: string | null;
  po_number: string;
  status: 'pending' | 'ordered' | 'partially_received' | 'received' | 'cancelled';
  order_date: string;
  expected_delivery_date?: string | null;
  received_date?: string | null;
  total_cost: number;
  notes?: string | null;
  suppliers?: Supplier;
  items?: PurchaseOrderItem[];
  created_at: string;
  updated_at: string;
}

export interface ReceiptData {
  invoice_id: string;
  receipt_number: string;
  plain_text: string;
  escpos_base64: string;
  tax_summary: {
    subtotal_ex_vat: number;
    vat_amount: number;
    total_incl_vat: number;
  };
}

export interface ShiftStatusInfo {
  id: string;
  tenant_id: string;
  staff_id: string;
  starting_cash: number;
  expected_cash: number;
  actual_cash?: number | null;
  status: string;
  shift_start: string;
  shift_end?: string | null;
  [key: string]: unknown;
}

export interface ValidatePromoResponse {
  success: boolean;
  valid: boolean;
  discount_amount?: number;
  promotion?: {
    id: string;
    code: string;
    discount_type: 'percentage' | 'fixed_amount';
    discount_value: number;
    max_discount_amount?: number;
    description?: string;
  };
  error?: string;
}

export interface ValidateVoucherResponse {
  success: boolean;
  valid: boolean;
  current_balance?: number;
  voucher?: {
    id: string;
    code: string;
    current_balance: number;
    initial_value?: number;
  };
  error?: string;
}

// ----------------------------------------------------
// POS API Functions
// ----------------------------------------------------

export async function fetchProducts(tenantId: string): Promise<ProductItem[]> {
  return apiFetch<ProductItem[]>(`${BACKEND_URL}/api/pos/products?tenant_id=${tenantId}`);
}

export async function fetchShiftStatus(tenantId: string): Promise<ShiftStatusInfo | null> {
  return apiFetch<ShiftStatusInfo | null>(`${BACKEND_URL}/api/pos/shift/status?tenant_id=${tenantId}`);
}

export async function startShift(tenantId: string, staffId: string, startingCash: number): Promise<ShiftStatusInfo> {
  return apiFetch<ShiftStatusInfo>(`${BACKEND_URL}/api/pos/shift/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId, staff_id: staffId, starting_cash: startingCash })
  });
}

export async function endShift(shiftId: string, actualCash: number) {
  return apiFetch(`${BACKEND_URL}/api/pos/shift/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shift_id: shiftId, actual_cash: actualCash })
  });
}

export async function fetchXReport(shiftId: string, tenantId: string) {
  return apiFetch(`${BACKEND_URL}/api/pos/shift/${shiftId}/x-report?tenant_id=${tenantId}`);
}

export async function checkoutPOS(payload: CheckoutPayload): Promise<CheckoutResponse> {
  return apiFetch<CheckoutResponse>(`${BACKEND_URL}/api/pos/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fetchMemberTab(profileId: string, tenantId: string): Promise<MemberTabInfo> {
  return apiFetch<MemberTabInfo>(`${BACKEND_URL}/api/pos/member_tab/${profileId}?tenant_id=${tenantId}`);
}

export async function updateCreditLimit(profileId: string, tenantId: string, creditLimit: number) {
  return apiFetch(`${BACKEND_URL}/api/pos/member_tab/${profileId}/limit`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId, credit_limit: creditLimit })
  });
}

export async function creditMemberTab(tenantId: string, profileId: string, amount: number) {
  return apiFetch(`${BACKEND_URL}/api/pos/member-tab/credit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId, profile_id: profileId, amount })
  });
}

// ----------------------------------------------------
// Suppliers API Functions
// ----------------------------------------------------

export async function fetchSuppliers(tenantId: string): Promise<Supplier[]> {
  return apiFetch<Supplier[]>(`${BACKEND_URL}/api/pos/suppliers?tenant_id=${tenantId}`);
}

export async function createSupplier(payload: {
  tenant_id: string;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
}): Promise<Supplier> {
  return apiFetch<Supplier>(`${BACKEND_URL}/api/pos/suppliers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function getSupplier(id: string, tenantId: string): Promise<Supplier & { purchase_orders: PurchaseOrder[] }> {
  return apiFetch<Supplier & { purchase_orders: PurchaseOrder[] }>(`${BACKEND_URL}/api/pos/suppliers/${id}?tenant_id=${tenantId}`);
}

export async function updateSupplier(id: string, payload: Partial<Supplier>): Promise<Supplier> {
  return apiFetch<Supplier>(`${BACKEND_URL}/api/pos/suppliers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function deleteSupplier(id: string, tenantId: string) {
  return apiFetch(`${BACKEND_URL}/api/pos/suppliers/${id}?tenant_id=${tenantId}`, {
    method: 'DELETE'
  });
}

// ----------------------------------------------------
// Purchase Orders API Functions
// ----------------------------------------------------

export async function fetchPurchaseOrders(tenantId: string, status?: string): Promise<PurchaseOrder[]> {
  const url = `${BACKEND_URL}/api/pos/purchase-orders?tenant_id=${tenantId}${status ? `&status=${status}` : ''}`;
  return apiFetch<PurchaseOrder[]>(url);
}

export async function createPurchaseOrder(payload: {
  tenant_id: string;
  supplier_id?: string | null;
  po_number?: string | null;
  expected_delivery_date?: string | null;
  notes?: string | null;
  items: {
    product_id: string;
    quantity_ordered: number;
    unit_cost: number;
  }[];
}): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`${BACKEND_URL}/api/pos/purchase-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function getPurchaseOrder(id: string, tenantId: string): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`${BACKEND_URL}/api/pos/purchase-orders/${id}?tenant_id=${tenantId}`);
}

export interface ReceivePurchaseOrderResponse {
  success: boolean;
  message?: string;
  cogs_updates?: Array<{ product_id: string; new_cogs: number }>;
  purchase_order?: PurchaseOrder;
  [key: string]: unknown;
}

export async function receivePurchaseOrder(id: string, payload: {
  tenant_id: string;
  received_items: {
    item_id: string;
    product_id: string;
    quantity_received: number;
  }[];
  staff_id?: string | null;
  notes?: string | null;
}): Promise<ReceivePurchaseOrderResponse> {
  return apiFetch<ReceivePurchaseOrderResponse>(`${BACKEND_URL}/api/pos/purchase-orders/${id}/receive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

// ----------------------------------------------------
// Receipt Formatting API
// ----------------------------------------------------

export async function fetchInvoiceReceipt(invoiceId: string, tenantId: string): Promise<ReceiptData> {
  return apiFetch<ReceiptData>(`${BACKEND_URL}/api/pos/invoices/${invoiceId}/receipt?tenant_id=${tenantId}`);
}

// ----------------------------------------------------
// Promos & Vouchers API
// ----------------------------------------------------

export async function validatePromoCode(
  tenantId: string,
  code: string,
  subtotal: number,
  apply = false
): Promise<ValidatePromoResponse> {
  return apiFetch<ValidatePromoResponse>(`${BACKEND_URL}/api/payments/validate-promo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId, code, subtotal, apply })
  });
}

export async function validateGiftVoucher(
  tenantId: string,
  code: string,
  subtotal: number
): Promise<ValidateVoucherResponse> {
  return apiFetch<ValidateVoucherResponse>(`${BACKEND_URL}/api/payments/validate-voucher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId, code, subtotal })
  });
}

export async function applyGiftVoucher(
  tenantId: string,
  code: string,
  amountToUse: number
): Promise<{ success: boolean; applied_amount: number; remaining_balance: number }> {
  return apiFetch<{ success: boolean; applied_amount: number; remaining_balance: number }>(`${BACKEND_URL}/api/payments/apply-gift-voucher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId, code, amount_to_use: amountToUse })
  });
}
