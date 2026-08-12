const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}


// Get current shift status
router.get('/shift/status', async (req, res) => {
    if (!supabase) return res.status(500).json({error: "Supabase config missing"});
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
        res.status(500).json({ error: error.message });
    }
});

// Fetch products
router.get('/products', async (req, res) => {
  if (!supabase) return res.status(500).json({error: "Supabase config missing"});
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenant_id)
      .is('deleted_at', null);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process POS transaction
router.post('/checkout', async (req, res) => {
  if (!supabase) return res.status(500).json({error: "Supabase config missing"});
  try {
    const { tenant_id, profile_id, items, method, shift_id, staff_id } = req.body;

    if (!tenant_id || !items || items.length === 0 || !method) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (method === 'cash' && !shift_id) {
       return res.status(400).json({ error: 'shift_id is required for cash transactions to prevent staff pocketing.' });
    }

    // Start a simulated transaction
    let totalAmount = 0;
    const validatedItems = [];

    for (const item of items) {
      const { product_id, quantity } = item;

      // Get product
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('sell_price, stock_quantity, min_stock_alert')
        .eq('id', product_id)
        .eq('tenant_id', tenant_id)
        .single();

      if (productError || !product) {
        return res.status(400).json({ error: `Product ${product_id} not found` });
      }

      if (product.stock_quantity < quantity) {
        return res.status(400).json({ error: `Insufficient stock for product ${product_id}` });
      }

      totalAmount += product.sell_price * quantity;

      // Keep validated details
      validatedItems.push({
          product_id,
          quantity,
          sell_price: product.sell_price,
          name: item.name || 'Product',
          min_stock_alert: product.min_stock_alert,
          current_stock: product.stock_quantity
      });
    }

    // Process based on method
    if (method === 'member_tab') {
      if (!profile_id) {
        return res.status(400).json({ error: 'profile_id required for member tab' });
      }

      // Check if primary card is declined (simulated edge case logic based on profile status or tags)
      const { data: profile, error: profileError } = await supabase.from('profiles').select('status').eq('id', profile_id).single();
      if (profileError) {
          return res.status(400).json({ error: 'Profile lookup failed' });
      }

      if (profile && profile.status === 'debtor') {
        return res.status(403).json({ error: 'Cannot charge to tab: Account is in debtor status. Please update payment method.' });
      }

      // Upsert member tab
      const { data: existingTab, error: existingTabError } = await supabase
        .from('member_tabs')
        .select('balance, id')
        .eq('profile_id', profile_id)
        .eq('tenant_id', tenant_id)
        .single();

      if (existingTab) {
        const newBalance = parseFloat(existingTab.balance) + totalAmount;
        const { error: updateTabError } = await supabase.from('member_tabs').update({ balance: newBalance }).eq('id', existingTab.id);
        if (updateTabError) throw updateTabError;
      } else {
        const { error: insertTabError } = await supabase.from('member_tabs').insert({
          tenant_id,
          profile_id,
          balance: totalAmount
        });
        if (insertTabError) throw insertTabError;
      }
    }

    // Create Invoice
    const isUnpaid = method === 'member_tab' || method === 'momo';
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        tenant_id,
        profile_id,
        subtotal: totalAmount,
        total: totalAmount,
        status: isUnpaid ? 'unpaid' : 'paid',
        due_date: new Date().toISOString()
      }).select().single();

    if (invoiceError) throw invoiceError;

    // Create Invoice Items and Deduct Stock
    for (const item of validatedItems) {
      const { product_id, quantity, sell_price, name, min_stock_alert, current_stock } = item;

      const { error: itemError } = await supabase.from('invoice_items').insert({
        tenant_id,
        invoice_id: invoice.id,
        product_id,
        quantity,
        unit_price: sell_price,
        total_price: sell_price * quantity,
        description: name
      });
      if (itemError) throw itemError;

      // Deduct stock and record in ledger
      const newStock = current_stock - quantity;

      const { error: stockError } = await supabase.from('products').update({ stock_quantity: newStock }).eq('id', product_id);
      if (stockError) throw stockError;

      const { error: ledgerError } = await supabase.from('inventory_ledger').insert({
        tenant_id,
        product_id,
        change_amount: -quantity,
        reason: 'sale',
        reference_id: invoice.id,
        performed_by: staff_id
      });
      if (ledgerError) throw ledgerError;

      // Low stock alert
      if (newStock < min_stock_alert) {
         const { error: notifError } = await supabase.from('notification_queue').insert({
            tenant_id,
            channel: 'email', // Or SMS/WhatsApp
            recipient: 'admin@gym.com', // Would normally be fetched from tenant settings
            subject: 'Low Stock Alert',
            content: `Product ${product_id} is low on stock (${newStock} remaining).`
         });
         if (notifError) throw notifError;
      }
    }


    // Record Payment
    const paymentStatus = (method === 'momo' || method === 'member_tab') ? 'pending' : 'completed';

    const { error: paymentError } = await supabase.from('payments').insert({
      tenant_id,
      invoice_id: invoice.id,
      profile_id,
      shift_id: (method === 'cash' || method === 'member_tab' || method === 'momo') ? shift_id : null, // Record shift for tab to show in X-report
      amount: totalAmount,
      method: method,
      status: paymentStatus
    });
    if (paymentError) throw paymentError;

    // If cash, update shift ledger expected cash
    if (method === 'cash' && shift_id) {
       const { data: shift, error: shiftFetchError } = await supabase.from('shift_ledgers').select('expected_cash').eq('id', shift_id).single();
       if (shiftFetchError) throw shiftFetchError;

       if (shift) {
           const newExpected = parseFloat(shift.expected_cash || 0) + totalAmount;
           const { error: shiftUpdateError } = await supabase.from('shift_ledgers').update({ expected_cash: newExpected }).eq('id', shift_id);
           if (shiftUpdateError) throw shiftUpdateError;
       }
    }

    res.json({ success: true, invoice_id: invoice.id, total: totalAmount });
  } catch (error) {
    console.error("Checkout error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Shift management (Till Audit)
router.post('/shift/start', async (req, res) => {
    if (!supabase) return res.status(500).json({error: "Supabase config missing"});
    try {
        const { tenant_id, staff_id, starting_cash } = req.body;
        const { data, error } = await supabase.from('shift_ledgers').insert({
            tenant_id,
            staff_id,
            shift_start: new Date().toISOString(),
            starting_cash,
            expected_cash: starting_cash,
            status: 'open'
        }).select().single();
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/shift/end', async (req, res) => {
    if (!supabase) return res.status(500).json({error: "Supabase config missing"});
    try {
        const { shift_id, actual_cash } = req.body;
        const { data: shift, error: shiftFetchError } = await supabase.from('shift_ledgers').select('expected_cash, tenant_id').eq('id', shift_id).single();

        if (shiftFetchError) throw shiftFetchError;


        let status = 'closed';
        const expected = parseFloat(shift.expected_cash);
        const actual = parseFloat(actual_cash);
        if (Math.abs(expected - actual) > 0.01) {

            status = 'discrepancy';
            // Alert logic here
            const { error: auditError } = await supabase.from('audit_logs').insert({
                tenant_id: shift.tenant_id,
                action_type: 'till_discrepancy',
                entity_name: 'shift_ledgers',
                entity_id: shift_id,
                new_values: { expected: shift.expected_cash, actual: actual_cash }
            });
            if (auditError) throw auditError;
        }

        const { data, error } = await supabase.from('shift_ledgers').update({
            shift_end: new Date().toISOString(),
            actual_cash,
            status
        }).eq('id', shift_id).select().single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Fetch member tab balance
router.get('/member_tab/:profile_id', async (req, res) => {
  if (!supabase) return res.status(500).json({error: "Supabase config missing"});
  try {
    const { profile_id } = req.params;
    const { tenant_id } = req.query;

    if (!profile_id || !tenant_id) {
       return res.status(400).json({ error: 'Missing profile_id or tenant_id' });
    }

    const { data, error } = await supabase
      .from('member_tabs')
      .select('balance')
      .eq('profile_id', profile_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is no rows returned
        throw error;
    }

    res.json({ balance: data ? parseFloat(data.balance) : 0 });
  } catch (error) {
    console.error("Tab fetch error:", error);
    res.status(500).json({ error: error.message });
  }
});


// Shift X-Report
router.get('/shift/:shift_id/x-report', async (req, res) => {
    if (!supabase) return res.status(500).json({error: "Supabase config missing"});
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
            .select('amount, method')
            .eq('shift_id', shift_id)
            .eq('tenant_id', tenant_id);


        if (paymentsError) throw paymentsError;

        const totals = {
            cash: 0,
            card: 0,
            momo: 0,
            member_tab: 0,
            bank_transfer: 0
        };

        payments.forEach(p => {
            if (totals[p.method] !== undefined) {
                totals[p.method] += parseFloat(p.amount);
            }
        });

        res.json({
            shift,
            totals,
            expected_cash: parseFloat(shift.expected_cash)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;
