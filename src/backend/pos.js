const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();
const gymEmitter = require("./events");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// Helper: Format RWF Currency
function formatRWF(amount) {
  return new Intl.NumberFormat('rw-RW', {
    style: 'currency',
    currency: 'RWF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ==========================================
// 1. SHIFTS & TILL AUDIT
// ==========================================

/**
 * GET /api/pos/shift/status
 * Get current open shift for tenant
 */
router.get('/shift/status', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
    try {
        const { tenant_id } = req.query;
        if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

        const { data, error } = await supabase
            .from('shift_ledgers')
            .select('*')
            .eq('tenant_id', tenant_id)
            .eq('status', 'open')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        res.json(data || null);
    } catch (error) {
        console.error('[pos/shift/status] error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/pos/shift/start
 * Open a new shift with starting cash
 */
router.post('/shift/start', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
    try {
        const { tenant_id, staff_id, starting_cash } = req.body;
        if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

        const startCash = parseFloat(starting_cash) || 0;

        const { data, error } = await supabase.from('shift_ledgers').insert({
            tenant_id,
            staff_id,
            shift_start: new Date().toISOString(),
            starting_cash: startCash,
            expected_cash: startCash,
            status: 'open'
        }).select().single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('[pos/shift/start] error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/pos/shift/end
 * Close shift and audit cash discrepancy
 */
router.post('/shift/end', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
    try {
        const { shift_id, actual_cash } = req.body;
        if (!shift_id) return res.status(400).json({ error: 'Missing shift_id' });

        const { data: shift, error: shiftFetchError } = await supabase
            .from('shift_ledgers')
            .select('expected_cash, tenant_id')
            .eq('id', shift_id)
            .single();

        if (shiftFetchError) throw shiftFetchError;

        let status = 'closed';
        const expected = parseFloat(shift.expected_cash || 0);
        const actual = parseFloat(actual_cash || 0);

        if (Math.abs(expected - actual) > 0.01) {
            status = 'discrepancy';
            const { error: auditError } = await supabase.from('audit_logs').insert({
                tenant_id: shift.tenant_id,
                action_type: 'till_discrepancy',
                entity_name: 'shift_ledgers',
                entity_id: shift_id,
                new_values: { expected: shift.expected_cash, actual: actual_cash }
            });
            if (auditError) console.error("Audit log error:", auditError);
        }

        const { data, error } = await supabase.from('shift_ledgers').update({
            shift_end: new Date().toISOString(),
            actual_cash: actual,
            status
        }).eq('id', shift_id).select().single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('[pos/shift/end] error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/pos/shift/:shift_id/x-report
 * X-Report summary for till reconciliation
 */
router.get('/shift/:shift_id/x-report', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
    try {
        const { shift_id } = req.params;
        const { tenant_id } = req.query;

        if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

        const { data: shift, error: shiftError } = await supabase
            .from('shift_ledgers')
            .select('*')
            .eq('id', shift_id)
            .eq('tenant_id', tenant_id)
            .single();

        if (shiftError) throw shiftError;

        const { data: payments, error: paymentsError } = await supabase
            .from('payments')
            .select('amount, method, allocation_amount')
            .eq('shift_id', shift_id)
            .eq('tenant_id', tenant_id);

        if (paymentsError) throw paymentsError;

        const totals = {
            cash: 0,
            card: 0,
            momo: 0,
            airtel: 0,
            member_tab: 0,
            bank_transfer: 0
        };

        (payments || []).forEach(p => {
            const val = parseFloat(p.allocation_amount || p.amount || 0);
            if (totals[p.method] !== undefined) {
                totals[p.method] += val;
            } else {
                totals[p.method] = (totals[p.method] || 0) + val;
            }
        });

        res.json({
            shift,
            totals,
            expected_cash: parseFloat(shift.expected_cash || 0)
        });
    } catch (error) {
        console.error('[pos/shift/x-report] error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 2. PRODUCTS CATALOG
// ==========================================

/**
 * GET /api/pos/products
 * Fetch products with tax category & supplier details
 */
router.get('/products', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const { data, error } = await supabase
      .from('products')
      .select('id, tenant_id, name, sku, barcode, cost_price, sell_price, stock_quantity, min_stock_alert, supplier, supplier_id, vat_rate, tax_category, description, category, created_at, updated_at')
      .eq('tenant_id', tenant_id)
      .is('deleted_at', null)
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('[pos/products] error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 3. POS CHECKOUT (EBM 18% VAT & SPLIT PAYMENTS)
// ==========================================

/**
 * POST /api/pos/checkout
 * Process POS transaction supporting RRA EBM 18% VAT calculations,
 * multi-tender split payments, tab credit limit checks, and automated stock deductions.
 */
router.post('/checkout', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
  try {
    const {
      tenant_id,
      profile_id,
      items,
      method,
      payments: rawPayments,
      shift_id,
      staff_id,
      applied_promo_code,
      promo_discount = 0,
      applied_voucher_code,
      voucher_discount = 0
    } = req.body;

    if (!tenant_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing required parameters (tenant_id, items)' });
    }

    // 1. Validate items & calculate RRA EBM VAT Breakdown
    let grossSubtotal = 0;
    let totalExVat = 0;
    let totalVatAmount = 0;
    const validatedItems = [];

    const taxCategoryBreakdown = {
      standard: { gross: 0, ex_vat: 0, vat: 0, rate: 18.00 },
      exempt: { gross: 0, ex_vat: 0, vat: 0, rate: 0.00 },
      zero_rated: { gross: 0, ex_vat: 0, vat: 0, rate: 0.00 }
    };

    for (const item of items) {
      const { product_id, quantity } = item;
      const qty = parseInt(quantity, 10) || 1;

      // Fetch product record
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, name, sell_price, cost_price, stock_quantity, min_stock_alert, vat_rate, tax_category')
        .eq('id', product_id)
        .eq('tenant_id', tenant_id)
        .single();

      if (productError || !product) {
        return res.status(400).json({ error: `Product ${product_id} not found` });
      }

      if (product.stock_quantity < qty) {
        return res.status(400).json({ error: `Insufficient stock for product "${product.name}". Available: ${product.stock_quantity}, Requested: ${qty}` });
      }

      const sellPrice = parseFloat(product.sell_price);
      const itemGrossTotal = sellPrice * qty;
      grossSubtotal += itemGrossTotal;

      const taxCategory = (product.tax_category || 'standard').toLowerCase();
      const vatRate = taxCategory === 'standard' ? (product.vat_rate !== null && product.vat_rate !== undefined ? parseFloat(product.vat_rate) : 18.00) : 0.00;

      // RRA EBM Standard: sell_price in retail is VAT-inclusive.
      // Net (Ex-VAT) = Gross / (1 + vatRate/100)
      let itemExVat = itemGrossTotal;
      let itemVat = 0;

      if (taxCategory === 'standard' && vatRate > 0) {
        itemExVat = Math.round((itemGrossTotal / (1 + vatRate / 100)) * 100) / 100;
        itemVat = Math.round((itemGrossTotal - itemExVat) * 100) / 100;
      }

      totalExVat += itemExVat;
      totalVatAmount += itemVat;

      if (taxCategoryBreakdown[taxCategory]) {
        taxCategoryBreakdown[taxCategory].gross += itemGrossTotal;
        taxCategoryBreakdown[taxCategory].ex_vat += itemExVat;
        taxCategoryBreakdown[taxCategory].vat += itemVat;
      }

      validatedItems.push({
        product_id: product.id,
        name: product.name,
        quantity: qty,
        unit_price: sellPrice,
        gross_total: itemGrossTotal,
        ex_vat_total: itemExVat,
        vat_amount: itemVat,
        vat_rate: vatRate,
        tax_category: taxCategory,
        min_stock_alert: product.min_stock_alert,
        current_stock: product.stock_quantity
      });
    }

    // 2. Deduct Discounts
    const numericPromoDiscount = Math.min(parseFloat(promo_discount) || 0, grossSubtotal);
    const subtotalAfterPromo = Math.max(0, grossSubtotal - numericPromoDiscount);
    const numericVoucherDiscount = Math.min(parseFloat(voucher_discount) || 0, subtotalAfterPromo);
    const finalTotal = Math.max(0, subtotalAfterPromo - numericVoucherDiscount);

    // Adjusted VAT after proportional discounts (RRA EBM Compliance)
    const discountRatio = grossSubtotal > 0 ? finalTotal / grossSubtotal : 1;
    const finalExVat = Math.round(totalExVat * discountRatio * 100) / 100;
    const finalVat = Math.round((finalTotal - finalExVat) * 100) / 100;

    // 3. Prepare Payment Tenders (Split Payments)
    let paymentTenders = [];
    if (Array.isArray(rawPayments) && rawPayments.length > 0) {
      paymentTenders = rawPayments.map(p => ({
        method: p.method,
        amount: parseFloat(p.amount) || 0,
        reference_code: p.reference_code || null
      })).filter(p => p.amount > 0);
    } else if (method) {
      paymentTenders = [{
        method,
        amount: finalTotal,
        reference_code: null
      }];
    } else {
      return res.status(400).json({ error: 'Payment method or split payment allocations required' });
    }

    // Validate allocation sum
    const totalAllocated = paymentTenders.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(totalAllocated - finalTotal) > 1.0) {
      return res.status(400).json({
        error: `Payment allocation sum (${formatRWF(totalAllocated)}) does not match required total (${formatRWF(finalTotal)})`
      });
    }

    // Check if cash tender is used and shift_id is present
    const cashTender = paymentTenders.find(p => p.method === 'cash');
    if (cashTender && !shift_id) {
      return res.status(400).json({ error: 'shift_id is required for cash transactions to reconcile till ledger.' });
    }

    // 4. Validate Member Tab Charges & Credit Limits
    const tabTender = paymentTenders.find(p => p.method === 'member_tab');
    if (tabTender && tabTender.amount > 0) {
      if (!profile_id) {
        return res.status(400).json({ error: 'profile_id is required when charging to member tab' });
      }

      // Check profile debtor status
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, status, email, full_name')
        .eq('id', profile_id)
        .single();

      if (profileError || !profile) {
        return res.status(400).json({ error: 'Member profile lookup failed' });
      }

      if (profile.status === 'debtor') {
        gymEmitter.emit('payment.failed', {
          tenant_id,
          profile_id,
          email: profile.email,
          amount: tabTender.amount,
          reason: 'Account is in debtor status.'
        });
        return res.status(403).json({ error: 'Cannot charge to tab: Member account is in debtor status.' });
      }

      // Fetch member tab & credit limit
      const { data: existingTab, error: tabError } = await supabase
        .from('member_tabs')
        .select('id, balance, credit_limit')
        .eq('profile_id', profile_id)
        .eq('tenant_id', tenant_id)
        .single();

      const currentBalance = existingTab ? parseFloat(existingTab.balance || 0) : 0;
      const creditLimit = existingTab && existingTab.credit_limit !== null && existingTab.credit_limit !== undefined
        ? parseFloat(existingTab.credit_limit)
        : 50000.00;

      const requestedNewBalance = currentBalance + tabTender.amount;
      if (requestedNewBalance > creditLimit) {
        return res.status(400).json({
          error: `Tab credit limit of ${formatRWF(creditLimit)} exceeded. Current balance: ${formatRWF(currentBalance)}, Requested charge: ${formatRWF(tabTender.amount)} (New balance would be ${formatRWF(requestedNewBalance)}).`
        });
      }

      // Update / Upsert member tab balance
      if (existingTab) {
        const { error: updateTabError } = await supabase
          .from('member_tabs')
          .update({
            balance: requestedNewBalance,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTab.id);

        if (updateTabError) throw updateTabError;
      } else {
        const { error: insertTabError } = await supabase
          .from('member_tabs')
          .insert({
            tenant_id,
            profile_id,
            balance: requestedNewBalance,
            credit_limit: creditLimit
          });

        if (insertTabError) throw insertTabError;
      }
    }

    // 5. Create Invoice with RRA VAT Columns
    const isAllPaid = paymentTenders.every(p => p.method !== 'momo' && p.method !== 'airtel');
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        tenant_id,
        profile_id: profile_id || null,
        subtotal: grossSubtotal,
        subtotal_ex_vat: finalExVat,
        vat_amount: finalVat,
        total_incl_vat: finalTotal,
        tax: finalVat,
        total: finalTotal,
        status: isAllPaid ? 'paid' : 'unpaid',
        due_date: new Date().toISOString(),
        paid_at: isAllPaid ? new Date().toISOString() : null
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // 6. Create Invoice Items & Deduct Stock
    for (const item of validatedItems) {
      const { product_id, quantity, unit_price, gross_total, name, min_stock_alert, current_stock } = item;

      const { error: itemError } = await supabase.from('invoice_items').insert({
        tenant_id,
        invoice_id: invoice.id,
        product_id,
        quantity,
        unit_price,
        total_price: gross_total,
        description: name
      });
      if (itemError) throw itemError;

      // Deduct stock
      const newStock = current_stock - quantity;
      const { error: stockError } = await supabase
        .from('products')
        .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
        .eq('id', product_id);
      if (stockError) throw stockError;

      // Record in inventory ledger
      const { error: ledgerError } = await supabase.from('inventory_ledger').insert({
        tenant_id,
        product_id,
        change_amount: -quantity,
        reason: 'sale',
        reference_id: invoice.id,
        performed_by: staff_id || null
      });
      if (ledgerError) console.error("Inventory ledger error:", ledgerError);

      // Low stock notification
      if (newStock < min_stock_alert) {
      if (newStock < min_stock_alert) {
        const { error: notifError } = await supabase.from('notification_queue').insert({
          tenant_id,
          channel: 'email',
          recipient: 'admin@gym.com',
          subject: 'Low Stock Alert',
          content: `Product "${name}" is low on stock (${newStock} remaining).`,
          status: 'pending'
        });
        if (notifError) console.error("Notification queue error:", notifError);
      }
      }
    }

    // 7. Insert Payment Records & Reconcile Split Payments
    let masterPaymentId = null;
    const insertedPayments = [];

    for (let i = 0; i < paymentTenders.length; i++) {
      const tender = paymentTenders[i];
      const pStatus = (tender.method === 'momo' || tender.method === 'airtel') ? 'pending' : 'completed';
      const refCode = tender.reference_code || `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      const { data: paymentRecord, error: payErr } = await supabase
        .from('payments')
        .insert({
          tenant_id,
          invoice_id: invoice.id,
          profile_id: profile_id || null,
          shift_id: shift_id || null,
          amount: tender.amount,
          allocation_amount: tender.amount,
          split_payment_id: i > 0 ? masterPaymentId : null,
          method: tender.method,
          reference_code: refCode,
          status: pStatus
        })
        .select()
        .single();

      if (payErr) throw payErr;

      if (i === 0) {
        masterPaymentId = paymentRecord.id;
      }
      insertedPayments.push(paymentRecord);

      // If cash portion, increment shift ledger expected cash
      if (tender.method === 'cash' && shift_id) {
        const { data: shift } = await supabase
          .from('shift_ledgers')
          .select('expected_cash')
          .eq('id', shift_id)
          .single();

        if (shift) {
          const newExpected = parseFloat(shift.expected_cash || 0) + tender.amount;
          await supabase
            .from('shift_ledgers')
            .update({ expected_cash: newExpected })
            .eq('id', shift_id);
        }
      }
    }

    res.json({
      success: true,
      invoice_id: invoice.id,
      subtotal_gross: grossSubtotal,
      subtotal_ex_vat: finalExVat,
      vat_amount: finalVat,
      total_incl_vat: finalTotal,
      tax_category_breakdown: taxCategoryBreakdown,
      payments: insertedPayments,
      discounts: {
        promo_code: applied_promo_code || null,
        promo_discount: numericPromoDiscount,
        voucher_code: applied_voucher_code || null,
        voucher_discount: numericVoucherDiscount
      }
    });

  } catch (error) {
    console.error("[pos/checkout] error:", error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ==========================================
// 4. MEMBER TAB & CREDIT LIMITS
// ==========================================

/**
 * GET /api/pos/member_tab/:profile_id
 * Fetch member tab balance & credit limit
 */
router.get('/member_tab/:profile_id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
  try {
    const { profile_id } = req.params;
    const { tenant_id } = req.query;

    if (!profile_id || !tenant_id) {
       return res.status(400).json({ error: 'Missing profile_id or tenant_id' });
    }

    const { data, error } = await supabase
      .from('member_tabs')
      .select('id, balance, credit_limit, updated_at')
      .eq('profile_id', profile_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (error && error.code !== 'PGRST116') {
        throw error;
    }

    const balance = data ? parseFloat(data.balance || 0) : 0;
    const credit_limit = data && data.credit_limit !== null && data.credit_limit !== undefined ? parseFloat(data.credit_limit) : 50000.00;
    const remaining_credit = Math.max(0, credit_limit - balance);

    res.json({
      profile_id,
      balance,
      credit_limit,
      remaining_credit,
      formatted_balance: formatRWF(balance),
      formatted_credit_limit: formatRWF(credit_limit),
      formatted_remaining_credit: formatRWF(remaining_credit)
    });
  } catch (error) {
    console.error("[pos/member_tab] error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/pos/member_tab/:profile_id/limit
 * Update member's tab credit limit
 */
router.put('/member_tab/:profile_id/limit', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
  try {
    const { profile_id } = req.params;
    const { tenant_id, credit_limit } = req.body;

    if (!profile_id || !tenant_id || credit_limit === undefined) {
      return res.status(400).json({ error: 'Missing profile_id, tenant_id, or credit_limit' });
    }

    const limitVal = parseFloat(credit_limit);
    if (isNaN(limitVal) || limitVal < 0) {
      return res.status(400).json({ error: 'credit_limit must be a non-negative number' });
    }

    const { data, error } = await supabase
      .from('member_tabs')
      .upsert({
        profile_id,
        tenant_id,
        credit_limit: limitVal,
        updated_at: new Date().toISOString()
      }, { onConflict: 'profile_id' })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      profile_id,
      credit_limit: parseFloat(data.credit_limit),
      formatted_credit_limit: formatRWF(data.credit_limit)
    });
  } catch (error) {
    console.error("[pos/member_tab/limit] error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/pos/member-tab/credit
 * Pay off or credit member tab balance
 */
router.post('/member-tab/credit', async (req, res) => {
    if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
    try {
        const { tenant_id, profile_id, amount } = req.body;

        if (!tenant_id || !profile_id || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const { data: tab } = await supabase
            .from('member_tabs')
            .select('balance, credit_limit')
            .eq('tenant_id', tenant_id)
            .eq('profile_id', profile_id)
            .single();

        let currentBalance = tab ? parseFloat(tab.balance || 0) : 0;
        const newBalance = Math.max(0, currentBalance - parseFloat(amount));

        const { data, error: updateError } = await supabase
            .from('member_tabs')
            .upsert({
                profile_id,
                tenant_id,
                balance: newBalance,
                credit_limit: tab?.credit_limit || 50000.00,
                updated_at: new Date().toISOString()
            }, { onConflict: 'profile_id' })
            .select()
            .single();

        if (updateError) throw updateError;

        res.json({
          success: true,
          new_balance: parseFloat(data.balance),
          formatted_balance: formatRWF(data.balance)
        });
    } catch (error) {
        console.error('[pos/member-tab/credit] error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 5. SUPPLIERS MANAGEMENT
// ==========================================

/**
 * GET /api/pos/suppliers
 * List all suppliers for a tenant with PO count
 */
router.get('/suppliers', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const { data: suppliers, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('name');

    if (error) throw error;

    // Fetch PO counts for each supplier
    const { data: poCounts } = await supabase
      .from('purchase_orders')
      .select('supplier_id')
      .eq('tenant_id', tenant_id);

    const countsMap = {};
    (poCounts || []).forEach(po => {
      countsMap[po.supplier_id] = (countsMap[po.supplier_id] || 0) + 1;
    });

    const enriched = (suppliers || []).map(s => ({
      ...s,
      purchase_orders_count: countsMap[s.id] || 0
    }));

    res.json(enriched);
  } catch (error) {
    console.error('[pos/suppliers] error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/pos/suppliers
 * Create new supplier
 */
router.post('/suppliers', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
  try {
    const { tenant_id, name, contact_person, phone, email, address, payment_terms, notes } = req.body;

    if (!tenant_id || !name) {
      return res.status(400).json({ error: 'tenant_id and name are required' });
    }

    const { data, error } = await supabase
      .from('suppliers')
      .insert({
        tenant_id,
        name: name.trim(),
        contact_person: contact_person || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        payment_terms: payment_terms || null,
        notes: notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('[pos/suppliers/create] error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/pos/suppliers/:id
 * Get single supplier with PO history
 */
router.get('/suppliers/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const { data: supplier, error: suppErr } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (suppErr || !supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const { data: purchaseOrders } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('supplier_id', id)
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    res.json({
      ...supplier,
      purchase_orders: purchaseOrders || []
    });
  } catch (error) {
    console.error('[pos/suppliers/get] error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/pos/suppliers/:id
 * Update supplier details
 */
router.put('/suppliers/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
  try {
    const { id } = req.params;
    const { tenant_id, name, contact_person, phone, email, address, payment_terms, notes } = req.body;

    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const { data, error } = await supabase
      .from('suppliers')
      .update({
        ...(name && { name: name.trim() }),
        contact_person: contact_person !== undefined ? contact_person : null,
        phone: phone !== undefined ? phone : null,
        email: email !== undefined ? email : null,
        address: address !== undefined ? address : null,
        payment_terms: payment_terms !== undefined ? payment_terms : null,
        notes: notes !== undefined ? notes : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('[pos/suppliers/update] error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/pos/suppliers/:id
 * Delete supplier
 */
router.delete('/suppliers/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant_id);

    if (error) throw error;
    res.json({ success: true, message: 'Supplier deleted' });
  } catch (error) {
    console.error('[pos/suppliers/delete] error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/pos/suppliers/:id/purchase-orders
 * List POs for supplier
 */
router.get('/suppliers/:id/purchase-orders', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('supplier_id', id)
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('[pos/suppliers/pos] error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 6. PURCHASE ORDERS & AUTOMATED COGS UPDATES
// ==========================================

/**
 * GET /api/pos/purchase-orders
 * List purchase orders with supplier information
 */
router.get('/purchase-orders', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
  try {
    const { tenant_id, status } = req.query;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    let query = supabase
      .from('purchase_orders')
      .select('*, suppliers(id, name, contact_person, phone, email)')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('[pos/purchase-orders/list] error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/pos/purchase-orders
 * Create new purchase order with item lines
 */
router.post('/purchase-orders', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
  try {
    const {
      tenant_id,
      supplier_id,
      po_number,
      expected_delivery_date,
      notes,
      items
    } = req.body;

    if (!tenant_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'tenant_id and valid items list are required' });
    }

    // Calculate total cost
    let calculatedTotal = 0;
    const validatedPOItems = [];

    for (const itm of items) {
      const qty = parseInt(itm.quantity_ordered, 10);
      const unitCost = parseFloat(itm.unit_cost);

      if (isNaN(qty) || qty <= 0 || isNaN(unitCost) || unitCost < 0) {
        return res.status(400).json({ error: `Invalid quantity or unit cost for item ${itm.product_id}` });
      }

      calculatedTotal += qty * unitCost;
      validatedPOItems.push({
        product_id: itm.product_id,
        quantity_ordered: qty,
        unit_cost: unitCost
      });
    }

    const generatedPoNumber = po_number ? po_number.trim() : `PO-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Insert purchase order
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        tenant_id,
        supplier_id: supplier_id || null,
        po_number: generatedPoNumber,
        status: 'pending',
        order_date: new Date().toISOString(),
        expected_delivery_date: expected_delivery_date || null,
        total_cost: calculatedTotal,
        notes: notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (poError) throw poError;

    // Insert items
    const poItemInserts = validatedPOItems.map(itm => ({
      tenant_id,
      purchase_order_id: po.id,
      product_id: itm.product_id,
      quantity_ordered: itm.quantity_ordered,
      quantity_received: 0,
      unit_cost: itm.unit_cost
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(poItemInserts)
      .select();

    if (itemsError) throw itemsError;

    res.status(201).json({
      ...po,
      items: insertedItems
    });
  } catch (error) {
    console.error('[pos/purchase-orders/create] error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/pos/purchase-orders/:id
 * Get single PO with detailed item lines and product names
 */
router.get('/purchase-orders/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('*, suppliers(id, name, contact_person, phone, email)')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (poError || !po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const { data: items, error: itemsError } = await supabase
      .from('purchase_order_items')
      .select('*, products(id, name, sku, stock_quantity, cost_price, sell_price)')
      .eq('purchase_order_id', id);

    if (itemsError) throw itemsError;

    res.json({
      ...po,
      items: items || []
    });
  } catch (error) {
    console.error('[pos/purchase-orders/get] error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/pos/purchase-orders/:id/receive
 * Receive purchase order items, automatically bump stock levels,
 * update product Weighted Average Cost (COGS), and record inventory ledger entries.
 */
router.post('/purchase-orders/:id/receive', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
  try {
    const { id: poId } = req.params;
    const { tenant_id, received_items, staff_id, notes } = req.body;

    if (!tenant_id || !received_items || !Array.isArray(received_items) || received_items.length === 0) {
      return res.status(400).json({ error: 'tenant_id and received_items list required' });
    }

    // Fetch PO
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', poId)
      .eq('tenant_id', tenant_id)
      .single();

    if (poError || !po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    // Fetch existing PO items
    const { data: existingPoItems, error: poItemsErr } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('purchase_order_id', poId);

    if (poItemsErr) throw poItemsErr;

    const poItemsMap = {};
    existingPoItems.forEach(item => {
      poItemsMap[item.id] = item;
    });

    const cogsUpdateResults = [];

    // Process each received item
    for (const rec of received_items) {
      const poItem = poItemsMap[rec.item_id];
      if (!poItem) continue;

      const qtyNewlyReceived = parseInt(rec.quantity_received, 10) || 0;
      if (qtyNewlyReceived <= 0) continue;

      const totalReceivedSoFar = (poItem.quantity_received || 0) + qtyNewlyReceived;

      // Update purchase_order_items
      await supabase
        .from('purchase_order_items')
        .update({ quantity_received: totalReceivedSoFar })
        .eq('id', poItem.id);

      // Fetch current product stock & cost price
      const { data: product, error: prodErr } = await supabase
        .from('products')
        .select('id, name, stock_quantity, cost_price')
        .eq('id', poItem.product_id)
        .eq('tenant_id', tenant_id)
        .single();

      if (!prodErr && product) {
        const currentStock = parseInt(product.stock_quantity, 10) || 0;
        const currentCost = parseFloat(product.cost_price) || 0;
        const poUnitCost = parseFloat(poItem.unit_cost) || 0;

        const newStock = currentStock + qtyNewlyReceived;

        // Weighted Average Cost Calculation (COGS update):
        // new_avg_cost = ((currentStock * currentCost) + (qtyNewlyReceived * poUnitCost)) / newStock
        let newWeightedCost = poUnitCost;
        if (newStock > 0) {
          const totalValuation = (Math.max(0, currentStock) * currentCost) + (qtyNewlyReceived * poUnitCost);
          newWeightedCost = Math.round((totalValuation / newStock) * 100) / 100;
        }

        // Update product stock and cost price
        await supabase
          .from('products')
          .update({
            stock_quantity: newStock,
            cost_price: newWeightedCost,
            updated_at: new Date().toISOString()
          })
          .eq('id', product.id);

        // Record in inventory ledger
        await supabase.from('inventory_ledger').insert({
          tenant_id,
          product_id: product.id,
          change_amount: qtyNewlyReceived,
          reason: 'purchase_order_receipt',
          reference_id: poId,
          performed_by: staff_id || null
        });

        cogsUpdateResults.push({
          product_id: product.id,
          name: product.name,
          previous_stock: currentStock,
          new_stock: newStock,
          previous_cost_price: currentCost,
          new_weighted_cost_price: newWeightedCost,
          quantity_received: qtyNewlyReceived
        });
      }
    }

    // Check completion status
    const { data: updatedPoItems } = await supabase
      .from('purchase_order_items')
      .select('quantity_ordered, quantity_received')
      .eq('purchase_order_id', poId);

    let allFullyReceived = true;
    let anyReceived = false;

    (updatedPoItems || []).forEach(itm => {
      if ((itm.quantity_received || 0) < itm.quantity_ordered) {
        allFullyReceived = false;
      }
      if ((itm.quantity_received || 0) > 0) {
        anyReceived = true;
      }
    });

    const newStatus = allFullyReceived ? 'received' : (anyReceived ? 'partially_received' : po.status);

    const { data: updatedPO, error: updatePoErr } = await supabase
      .from('purchase_orders')
      .update({
        status: newStatus,
        received_date: new Date().toISOString(),
        notes: notes ? `${po.notes ? po.notes + ' | ' : ''}${notes}` : po.notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', poId)
      .select()
      .single();

    if (updatePoErr) throw updatePoErr;

    res.json({
      success: true,
      purchase_order: updatedPO,
      cogs_updates: cogsUpdateResults
    });

  } catch (error) {
    console.error('[pos/purchase-orders/receive] error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 7. ESC/POS RECEIPT FORMATTING & EBM METADATA
// ==========================================

/**
 * GET /api/pos/invoices/:id/receipt
 * Generate ESC/POS raw printable text and byte layout for thermal front-desk printers
 */
router.get('/invoices/:id/receipt', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase config missing" });
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    // Fetch tenant details
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', tenant_id)
      .single();

    // Fetch invoice
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (invErr || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Fetch invoice items
    const { data: items } = await supabase
      .from('invoice_items')
      .select('*, products(name, tax_category, vat_rate)')
      .eq('invoice_id', id);

    // Fetch payments
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('invoice_id', id);

    // Fetch member profile if present
    let memberName = 'Walk-in Customer';
    if (invoice.profile_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, phone')
        .eq('id', invoice.profile_id)
        .single();
      if (profile) memberName = profile.full_name || profile.email;
    }

    const gymName = tenant?.name || 'GYMPARTNER FITNESS';
    const receiptNo = `REC-${invoice.id.substring(0, 8).toUpperCase()}`;
    const dateStr = new Date(invoice.created_at).toLocaleString('en-GB');

    // Build plain text thermal receipt
    const lineSeparator = '------------------------------------------\n';
    const doubleSeparator = '==========================================\n';
    let textReceipt = '';

    textReceipt += '                ' + gymName.toUpperCase() + '\n';
    textReceipt += '           RRA EBM COMPLIANT RECEIPT      \n';
    textReceipt += '          TIN: 102938475 | VRN: 09876543 \n';
    textReceipt += doubleSeparator;
    textReceipt += `Receipt #: ${receiptNo}\n`;
    textReceipt += `Date:      ${dateStr}\n`;
    textReceipt += `Customer:  ${memberName}\n`;
    textReceipt += lineSeparator;
    textReceipt += 'ITEM                     QTY   PRICE     TOTAL\n';
    textReceipt += lineSeparator;

    (items || []).forEach(item => {
      const name = (item.description || item.products?.name || 'Item').substring(0, 22).padEnd(23, ' ');
      const qty = String(item.quantity || 1).padStart(3, ' ');
      const price = String(Math.round(item.unit_price)).padStart(7, ' ');
      const total = String(Math.round(item.total_price)).padStart(9, ' ');
      const taxCode = item.products?.tax_category === 'exempt' ? 'B' : (item.products?.tax_category === 'zero_rated' ? 'C' : 'A');
      textReceipt += `${name} ${qty} ${price} ${total} (${taxCode})\n`;
    });

    textReceipt += lineSeparator;
    const subtotalEx = parseFloat(invoice.subtotal_ex_vat || (invoice.total / 1.18));
    const vatAmt = parseFloat(invoice.vat_amount || (invoice.total - subtotalEx));
    const totalIncl = parseFloat(invoice.total_incl_vat || invoice.total);

    textReceipt += `SUBTOTAL (EX-VAT):           ${formatRWF(subtotalEx).padStart(14, ' ')}\n`;
    textReceipt += `VAT (18% EBM):               ${formatRWF(vatAmt).padStart(14, ' ')}\n`;
    textReceipt += doubleSeparator;
    textReceipt += `TOTAL (INCL-VAT):            ${formatRWF(totalIncl).padStart(14, ' ')}\n`;
    textReceipt += doubleSeparator;

    textReceipt += 'PAYMENT BREAKDOWN:\n';
    (payments || []).forEach(p => {
      const meth = (p.method.toUpperCase()).padEnd(20, ' ');
      const amt = formatRWF(p.allocation_amount || p.amount).padStart(20, ' ');
      textReceipt += `  ${meth} ${amt}\n`;
    });

    textReceipt += lineSeparator;
    textReceipt += 'Tax Codes: A=Standard 18% | B=Exempt | C=Zero\n';
    textReceipt += '           Thank you for your visit!          \n';
    textReceipt += '        Powered by GymPartner Cloud POS       \n\n\n';

    // ESC/POS raw initialization commands
    const ESC = '\x1B';
    const GS = '\x1D';
    const initPrinter = `${ESC}@`; // Initialize
    const centerAlign = `${ESC}a\x01`;
    const leftAlign = `${ESC}a\x00`;
    const cutPaper = `${GS}V\x41\x00`; // Cut paper

    const escposData = `${initPrinter}${centerAlign}${gymName}\n${leftAlign}${textReceipt}${cutPaper}`;
    const base64Escpos = Buffer.from(escposData).toString('base64');

    res.json({
      invoice_id: invoice.id,
      receipt_number: receiptNo,
      plain_text: textReceipt,
      escpos_base64: base64Escpos,
      tax_summary: {
        subtotal_ex_vat: subtotalEx,
        vat_amount: vatAmt,
        total_incl_vat: totalIncl
      }
    });

  } catch (error) {
    console.error('[pos/invoices/receipt] error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
