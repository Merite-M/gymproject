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
  payments: any[];
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

// ----------------------------------------------------
// POS API Functions
// ----------------------------------------------------

export async function fetchProducts(tenantId: string): Promise<ProductItem[]> {
  const res = await fetch(`${BACKEND_URL}/api/pos/products?tenant_id=${tenantId}`);
  if (!res.ok) throw new Error(`[pos/products] ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function fetchShiftStatus(tenantId: string) {
  const res = await fetch(`${BACKEND_URL}/api/pos/shift/status?tenant_id=${tenantId}`);
  if (!res.ok) throw new Error(`[pos/shift/status] ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function startShift(tenantId: string, staffId: string, startingCash: number) {
  const res = await fetch(`${BACKEND_URL}/api/pos/shift/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId, staff_id: staffId, starting_cash: startingCash })
  });
  if (!res.ok) throw new Error(`[pos/shift/start] ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function endShift(shiftId: string, actualCash: number) {
  const res = await fetch(`${BACKEND_URL}/api/pos/shift/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shift_id: shiftId, actual_cash: actualCash })
  });
  if (!res.ok) throw new Error(`[pos/shift/end] ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function fetchXReport(shiftId: string, tenantId: string) {
  const res = await fetch(`${BACKEND_URL}/api/pos/shift/${shiftId}/x-report?tenant_id=${tenantId}`);
  if (!res.ok) throw new Error(`[pos/shift/x-report] ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function checkoutPOS(payload: CheckoutPayload): Promise<CheckoutResponse> {
  const res = await fetch(`${BACKEND_URL}/api/pos/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `[pos/checkout] failed with status ${res.status}`);
  }
  return res.json();
}

export async function fetchMemberTab(profileId: string, tenantId: string): Promise<MemberTabInfo> {
  const res = await fetch(`${BACKEND_URL}/api/pos/member_tab/${profileId}?tenant_id=${tenantId}`);
  if (!res.ok) throw new Error(`[pos/member_tab] ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function updateCreditLimit(profileId: string, tenantId: string, creditLimit: number) {
  const res = await fetch(`${BACKEND_URL}/api/pos/member_tab/${profileId}/limit`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId, credit_limit: creditLimit })
  });
  if (!res.ok) throw new Error(`[pos/member_tab/limit] ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function creditMemberTab(tenantId: string, profileId: string, amount: number) {
  const res = await fetch(`${BACKEND_URL}/api/pos/member-tab/credit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId, profile_id: profileId, amount })
  });
  if (!res.ok) throw new Error(`[pos/member-tab/credit] ${res.status}: ${await res.text()}`);
  return res.json();
}

// ----------------------------------------------------
// Suppliers API Functions
// ----------------------------------------------------

export async function fetchSuppliers(tenantId: string): Promise<Supplier[]> {
  const res = await fetch(`${BACKEND_URL}/api/pos/suppliers?tenant_id=${tenantId}`);
  if (!res.ok) throw new Error(`[pos/suppliers] ${res.status}: ${await res.text()}`);
  return res.json();
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
  const res = await fetch(`${BACKEND_URL}/api/pos/suppliers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`[pos/suppliers/create] ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function getSupplier(id: string, tenantId: string): Promise<Supplier & { purchase_orders: PurchaseOrder[] }> {
  const res = await fetch(`${BACKEND_URL}/api/pos/suppliers/${id}?tenant_id=${tenantId}`);
  if (!res.ok) throw new Error(`[pos/suppliers/get] ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function updateSupplier(id: string, payload: Partial<Supplier>): Promise<Supplier> {
  const res = await fetch(`${BACKEND_URL}/api/pos/suppliers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`[pos/suppliers/update] ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function deleteSupplier(id: string, tenantId: string) {
  const res = await fetch(`${BACKEND_URL}/api/pos/suppliers/${id}?tenant_id=${tenantId}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error(`[pos/suppliers/delete] ${res.status}: ${await res.text()}`);
  return res.json();
}

// ----------------------------------------------------
// Purchase Orders API Functions
// ----------------------------------------------------

export async function fetchPurchaseOrders(tenantId: string, status?: string): Promise<PurchaseOrder[]> {
  const url = `${BACKEND_URL}/api/pos/purchase-orders?tenant_id=${tenantId}${status ? `&status=${status}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[pos/purchase-orders] ${res.status}: ${await res.text()}`);
  return res.json();
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
  const res = await fetch(`${BACKEND_URL}/api/pos/purchase-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`[pos/purchase-orders/create] ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function getPurchaseOrder(id: string, tenantId: string): Promise<PurchaseOrder> {
  const res = await fetch(`${BACKEND_URL}/api/pos/purchase-orders/${id}?tenant_id=${tenantId}`);
  if (!res.ok) throw new Error(`[pos/purchase-orders/get] ${res.status}: ${await res.text()}`);
  return res.json();
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
}) {
  const res = await fetch(`${BACKEND_URL}/api/pos/purchase-orders/${id}/receive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`[pos/purchase-orders/receive] ${res.status}: ${await res.text()}`);
  return res.json();
}

// ----------------------------------------------------
// Receipt Formatting API
// ----------------------------------------------------

export async function fetchInvoiceReceipt(invoiceId: string, tenantId: string): Promise<ReceiptData> {
  const res = await fetch(`${BACKEND_URL}/api/pos/invoices/${invoiceId}/receipt?tenant_id=${tenantId}`);
  if (!res.ok) throw new Error(`[pos/invoices/receipt] ${res.status}: ${await res.text()}`);
  return res.json();
}

// ----------------------------------------------------
// Promos & Vouchers API
// ----------------------------------------------------

export async function validatePromoCode(tenantId: string, code: string, subtotal: number, apply = false) {
  const res = await fetch(`${BACKEND_URL}/api/payments/validate-promo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId, code, subtotal, apply })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || 'Invalid promo code');
  }
  return res.json();
}

export async function validateGiftVoucher(tenantId: string, code: string, subtotal: number) {
  const res = await fetch(`${BACKEND_URL}/api/payments/validate-voucher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId, code, subtotal })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || 'Invalid gift voucher');
  }
  return res.json();
}

export async function applyGiftVoucher(tenantId: string, code: string, amountToUse: number) {
  const res = await fetch(`${BACKEND_URL}/api/payments/apply-gift-voucher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId, code, amount_to_use: amountToUse })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || 'Failed to apply voucher');
  }
  return res.json();
}
