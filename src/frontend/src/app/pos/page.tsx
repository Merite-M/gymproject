"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ShoppingCart, Search, User, Package, CreditCard, Smartphone,
  Wallet, Receipt, Tag, Gift, Check, X, Printer, Plus,
  Minus, RefreshCw, AlertCircle, Truck, FileText
} from "lucide-react";
import { cn, formatCurrencyDisplay } from "@/lib/utils";
import {
  fetchProducts, checkoutPOS, fetchMemberTab,
  validatePromoCode, validateGiftVoucher,
  fetchShiftStatus, startShift, endShift,
  ProductItem, PaymentTender, MemberTabInfo, ReceiptData, fetchInvoiceReceipt
} from "@/lib/api/pos";

export default function POSPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [cart, setCart] = useState<{ product: ProductItem; quantity: number }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Member & Tab state
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string; email?: string } | null>(null);
  const [memberTab, setMemberTab] = useState<MemberTabInfo | null>(null);
  const [loadingTab, setLoadingTab] = useState(false);

  // Shift & Till state
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [startingCashInput, setStartingCashInput] = useState("10000");

  // Promo & Voucher state
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [loadingPromo, setLoadingPromo] = useState(false);

  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<any>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [loadingVoucher, setLoadingVoucher] = useState(false);

  // Split Payment Modal state
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [paymentTenders, setPaymentTenders] = useState<PaymentTender[]>([
    { method: 'cash', amount: 0 }
  ]);
  const [splitError, setSplitError] = useState<string | null>(null);

  // Receipt Modal state
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);

  // Checkout process state
  const [completingSale, setCompletingSale] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState(false);

  const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '2c604504-41c3-406b-82a0-a43700057af8';

  // Load Products & Shift on Mount
  useEffect(() => {
    loadProductsData();
    loadShiftData();
  }, []);

  const loadProductsData = async () => {
    setLoadingProducts(true);
    try {
      const data = await fetchProducts(tenantId);
      if (Array.isArray(data) && data.length > 0) {
        setProducts(data);
      } else {
        setProducts([
          { id: "1", tenant_id: tenantId, name: "Kigali Water 500ml", category: "refreshments", sell_price: 1000, stock_quantity: 45, vat_rate: 18.00, tax_category: 'standard' },
          { id: "2", tenant_id: tenantId, name: "FitAid Recovery Can", category: "refreshments", sell_price: 3500, stock_quantity: 20, vat_rate: 18.00, tax_category: 'standard' },
          { id: "3", tenant_id: tenantId, name: "Whey Protein 1kg", category: "supplements", sell_price: 45000, stock_quantity: 12, vat_rate: 18.00, tax_category: 'standard' },
          { id: "4", tenant_id: tenantId, name: "Grip Straps (Pair)", category: "merchandise", sell_price: 5000, stock_quantity: 15, vat_rate: 18.00, tax_category: 'standard' },
          { id: "5", tenant_id: tenantId, name: "Fresh Banana & Apple", category: "refreshments", sell_price: 1500, stock_quantity: 30, vat_rate: 0.00, tax_category: 'exempt' },
          { id: "6", tenant_id: tenantId, name: "1-on-1 PT Coaching (1h)", category: "services", sell_price: 25000, stock_quantity: 999, vat_rate: 0.00, tax_category: 'zero_rated' }
        ]);
      }
    } catch (err) {
      console.warn("Failed to load products from API, using catalog fallback", err);
      setProducts([
        { id: "1", tenant_id: tenantId, name: "Kigali Water 500ml", category: "refreshments", sell_price: 1000, stock_quantity: 45, vat_rate: 18.00, tax_category: 'standard' },
        { id: "2", tenant_id: tenantId, name: "FitAid Recovery Can", category: "refreshments", sell_price: 3500, stock_quantity: 20, vat_rate: 18.00, tax_category: 'standard' },
        { id: "3", tenant_id: tenantId, name: "Whey Protein 1kg", category: "supplements", sell_price: 45000, stock_quantity: 12, vat_rate: 18.00, tax_category: 'standard' },
        { id: "4", tenant_id: tenantId, name: "Grip Straps (Pair)", category: "merchandise", sell_price: 5000, stock_quantity: 15, vat_rate: 18.00, tax_category: 'standard' },
        { id: "5", tenant_id: tenantId, name: "Fresh Banana & Apple", category: "refreshments", sell_price: 1500, stock_quantity: 30, vat_rate: 0.00, tax_category: 'exempt' },
        { id: "6", tenant_id: tenantId, name: "1-on-1 PT Coaching (1h)", category: "services", sell_price: 25000, stock_quantity: 999, vat_rate: 0.00, tax_category: 'zero_rated' }
      ]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadShiftData = async () => {
    try {
      const shift = await fetchShiftStatus(tenantId);
      setCurrentShift(shift);
    } catch (err) {
      console.warn("Shift fetch failed", err);
    }
  };

  // Member Tab Lookup
  const handleSelectMember = async (member: { id: string; name: string; email?: string } | null) => {
    setSelectedMember(member);
    if (!member) {
      setMemberTab(null);
      return;
    }
    setLoadingTab(true);
    try {
      const tabInfo = await fetchMemberTab(member.id, tenantId);
      setMemberTab(tabInfo);
    } catch (err) {
      console.warn("Member tab lookup error", err);
      setMemberTab({
        profile_id: member.id,
        balance: 0,
        credit_limit: 50000,
        remaining_credit: 50000,
        formatted_balance: "RWF 0",
        formatted_credit_limit: "RWF 50,000",
        formatted_remaining_credit: "RWF 50,000"
      });
    } finally {
      setLoadingTab(false);
    }
  };

  // Categories
  const categories = [
    { id: "all", name: "All Products" },
    { id: "refreshments", name: "Refreshments" },
    { id: "supplements", name: "Supplements" },
    { id: "merchandise", name: "Merchandise" },
    { id: "services", name: "Services" },
  ];

  const filteredProducts = products.filter(product =>
    (selectedCategory === "all" || (product.category || "").toLowerCase() === selectedCategory.toLowerCase()) &&
    (searchQuery === "" || product.name.toLowerCase().includes(searchQuery.toLowerCase()) || (product.barcode && product.barcode.includes(searchQuery)))
  );

  const addToCart = (product: ProductItem) => {
    if (product.stock_quantity <= 0) return;
    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.product.id === product.id);
      if (existingIndex > -1) {
        const item = prev[existingIndex];
        if (item.quantity >= product.stock_quantity) return prev;
        const newCart = [...prev];
        newCart[existingIndex] = { ...item, quantity: item.quantity + 1 };
        return newCart;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const maxQty = item.product.stock_quantity;
        const newQty = Math.min(quantity, maxQty);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  // Cart Calculations with RRA EBM VAT Breakdown
  const grossSubtotal = cart.reduce((sum, item) => sum + (item.product.sell_price * item.quantity), 0);

  // Promo Discount Calculation
  const promoDiscount = appliedPromo
    ? appliedPromo.discount_type === 'percentage'
      ? Math.round((grossSubtotal * appliedPromo.discount_value) / 100)
      : Math.min(appliedPromo.discount_value, grossSubtotal)
    : 0;

  const subtotalAfterPromo = Math.max(0, grossSubtotal - promoDiscount);

  // Voucher Discount Calculation
  const voucherDiscount = appliedVoucher
    ? Math.min(appliedVoucher.usable_discount || appliedVoucher.current_balance_rwf || 0, subtotalAfterPromo)
    : 0;

  const finalTotal = Math.max(0, subtotalAfterPromo - voucherDiscount);

  // RRA EBM 18% Tax Calculations
  let standardGross = 0;
  cart.forEach(item => {
    const itemTotal = item.product.sell_price * item.quantity;
    const cat = item.product.tax_category || 'standard';
    if (cat === 'standard') {
      standardGross += itemTotal;
    }
  });

  const discountRatio = grossSubtotal > 0 ? finalTotal / grossSubtotal : 1;
  const standardNet = Math.round((standardGross / 1.18) * discountRatio);
  const vatAmount = Math.max(0, Math.round((standardGross * discountRatio) - standardNet));
  const subtotalExVat = Math.max(0, finalTotal - vatAmount);

  // Preview Promo (Does NOT consume on server until checkout)
  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim()) return;
    setLoadingPromo(true);
    setPromoError(null);
    try {
      const data = await validatePromoCode(tenantId, promoCodeInput.trim(), grossSubtotal, false);
      setAppliedPromo(data.promotion);
      setPromoCodeInput("");
    } catch (err: any) {
      setPromoError(err.message || "Invalid promo code");
    } finally {
      setLoadingPromo(false);
    }
  };

  // Preview Voucher (Does NOT deduct on server until checkout)
  const handleApplyVoucher = async () => {
    if (!voucherCodeInput.trim()) return;
    setLoadingVoucher(true);
    setVoucherError(null);
    try {
      const data = await validateGiftVoucher(tenantId, voucherCodeInput.trim(), subtotalAfterPromo);
      setAppliedVoucher(data.voucher);
      setVoucherCodeInput("");
    } catch (err: any) {
      setVoucherError(err.message || "Invalid gift voucher");
    } finally {
      setLoadingVoucher(false);
    }
  };

  // Open Split Payment Modal
  const handleOpenSplitModal = (initialMethod?: 'cash' | 'momo' | 'airtel' | 'member_tab' | 'card') => {
    if (cart.length === 0) return;
    setSplitError(null);
    if (initialMethod) {
      setPaymentTenders([{ method: initialMethod, amount: finalTotal }]);
    } else {
      setPaymentTenders([{ method: 'cash', amount: finalTotal }]);
    }
    setShowSplitModal(true);
  };

  // Add tender row
  const addTenderRow = () => {
    const allocated = paymentTenders.reduce((s, p) => s + p.amount, 0);
    const remainder = Math.max(0, finalTotal - allocated);
    const unusedMethods = ['cash', 'momo', 'airtel', 'member_tab', 'card'].filter(
      m => !paymentTenders.some(p => p.method === m)
    );
    const nextMethod = (unusedMethods[0] || 'cash') as any;
    setPaymentTenders(prev => [...prev, { method: nextMethod, amount: remainder }]);
  };

  // Update tender amount or method
  const updateTender = (index: number, field: 'method' | 'amount', value: any) => {
    setPaymentTenders(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: field === 'amount' ? (parseFloat(value) || 0) : value };
      return updated;
    });
  };

  // Remove tender row
  const removeTenderRow = (index: number) => {
    setPaymentTenders(prev => prev.filter((_, i) => i !== index));
  };

  // Auto-balance tenders
  const autoBalanceTenders = (targetIndex: number) => {
    const otherSum = paymentTenders.reduce((sum, p, i) => i !== targetIndex ? sum + p.amount : sum, 0);
    const remainder = Math.max(0, finalTotal - otherSum);
    updateTender(targetIndex, 'amount', remainder);
  };

  // Complete Sale (Atomic Server-side Execution)
  const handleExecuteCheckout = async (tendersToUse?: PaymentTender[]) => {
    if (cart.length === 0) return;
    setCompletingSale(true);
    setSplitError(null);

    const tenders = tendersToUse || paymentTenders;
    const totalAllocated = tenders.reduce((s, p) => s + p.amount, 0);

    if (Math.abs(totalAllocated - finalTotal) > 1) {
      setSplitError(`Tenders total (${formatCurrencyDisplay(totalAllocated)}) must match required total (${formatCurrencyDisplay(finalTotal)})`);
      setCompletingSale(false);
      return;
    }

    // Check Tab Limit
    const tabTender = tenders.find(p => p.method === 'member_tab');
    if (tabTender && tabTender.amount > 0) {
      if (!selectedMember) {
        setSplitError("Please select a member before charging to Member Tab");
        setCompletingSale(false);
        return;
      }
      if (memberTab && (memberTab.balance + tabTender.amount > memberTab.credit_limit)) {
        setSplitError(`Tab Credit limit (${memberTab.formatted_credit_limit}) exceeded. Remaining credit: ${memberTab.formatted_remaining_credit}`);
        setCompletingSale(false);
        return;
      }
    }

    // Check Cash Till Shift
    const hasCash = tenders.some(p => p.method === 'cash');
    if (hasCash && !currentShift) {
      setSplitError("No open cash shift found. Please open a shift till before accepting cash.");
      setCompletingSale(false);
      return;
    }

    try {
      // Send Atomic Checkout Request (Backend validates discounts, stock, tab limits, and deducts voucher in 1 atomic step)
      const response = await checkoutPOS({
        tenant_id: tenantId,
        profile_id: selectedMember?.id || null,
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          sell_price: item.product.sell_price,
          name: item.product.name
        })),
        payments: tenders,
        shift_id: currentShift?.id || null,
        staff_id: null,
        applied_promo_code: appliedPromo?.code || null,
        applied_voucher_code: appliedVoucher?.code || null
      });

      // Fetch receipt
      try {
        const receipt = await fetchInvoiceReceipt(response.invoice_id, tenantId);
        setLastReceipt(receipt);
        setShowReceiptModal(true);
      } catch (err) {
        console.warn("Receipt fetch error:", err);
      }

      // Reset Cart & UI
      setSaleSuccess(true);
      setShowSplitModal(false);
      setCart([]);
      setAppliedPromo(null);
      setAppliedVoucher(null);
      loadProductsData();
      if (selectedMember) {
        handleSelectMember(selectedMember);
      }

      setTimeout(() => setSaleSuccess(false), 4000);
    } catch (err: any) {
      console.error("POS Checkout error:", err);
      setSplitError(err.message || "Checkout failed. Please review items and tenders.");
    } finally {
      setCompletingSale(false);
    }
  };

  // Start Shift Till
  const handleStartShift = async () => {
    try {
      const shift = await startShift(tenantId, '00000000-0000-0000-0000-000000000000', parseFloat(startingCashInput) || 0);
      setCurrentShift(shift);
      setShowShiftModal(false);
    } catch (err: any) {
      alert("Failed to start shift: " + err.message);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Top Header */}
      <header className="border-b border-border bg-card px-6 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shadow-sm">
              <ShoppingCart className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-headline-md font-bold tracking-tight">POS Terminal</h1>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-primary/10 text-primary border border-primary/20">
                  RRA EBM 18% Compliant
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Retail checkout, multi-tender split payments & thermal receipt billing</p>
            </div>
          </div>

          {/* Quick Actions & Navigation */}
          <div className="flex items-center gap-3">
            <Link
              href="/admin/suppliers"
              className="px-3 py-1.5 bg-muted border border-border text-xs font-semibold rounded-lg hover:bg-muted/80 flex items-center gap-1.5 transition-colors min-h-[38px]"
            >
              <Truck className="w-4 h-4 text-primary" />
              <span>Suppliers</span>
            </Link>

            <Link
              href="/admin/purchase-orders"
              className="px-3 py-1.5 bg-muted border border-border text-xs font-semibold rounded-lg hover:bg-muted/80 flex items-center gap-1.5 transition-colors min-h-[38px]"
            >
              <FileText className="w-4 h-4 text-status-action" />
              <span>Purchase Orders</span>
            </Link>

            <button
              onClick={() => setShowShiftModal(true)}
              className={cn(
                "px-3 py-1.5 border text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors min-h-[38px]",
                currentShift ? "bg-status-cleared/10 border-status-cleared/30 text-status-cleared hover:bg-status-cleared/20" : "bg-status-blocked/10 border-status-blocked/30 text-status-blocked hover:bg-status-blocked/20"
              )}
            >
              <Receipt className="w-4 h-4" />
              <span>{currentShift ? `Till Open (Exp: ${formatCurrencyDisplay(currentShift.expected_cash || 0)})` : "Till Closed"}</span>
            </button>

            <button
              onClick={loadProductsData}
              title="Refresh Catalog"
              className="w-9 h-9 flex items-center justify-center bg-muted border border-border rounded-lg hover:bg-muted/80 transition-colors"
            >
              <RefreshCw className={cn("w-4 h-4", loadingProducts && "animate-spin text-primary")} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Area - Catalog & Products */}
        <div className="flex-1 flex flex-col bg-background/50 border-r border-border">
          {/* Search & Category Filter Toolbar */}
          <div className="p-4 border-b border-border bg-card flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or scan barcode..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-foreground placeholder:text-muted-foreground min-h-[40px]"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors min-h-[38px]",
                    selectedCategory === category.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-foreground hover:bg-muted/80 border border-border"
                  )}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 p-4 overflow-y-auto">
            {loadingProducts ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <Package className="w-12 h-12 opacity-30 mb-2" />
                <p className="text-sm font-medium">No products found matching &ldquo;{searchQuery}&rdquo;</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProducts.map((product) => {
                  const isOutOfStock = product.stock_quantity <= 0;
                  const inCartItem = cart.find(c => c.product.id === product.id);

                  return (
                    <div
                      key={product.id}
                      onClick={() => !isOutOfStock && addToCart(product)}
                      className={cn(
                        "bg-card border rounded-xl p-4 flex flex-col justify-between transition-all group relative select-none",
                        isOutOfStock
                          ? "opacity-50 border-border cursor-not-allowed"
                          : "border-border hover:border-primary/50 hover:shadow-md cursor-pointer active:scale-[0.98]"
                      )}
                    >
                      {/* Cart Quantity Badge */}
                      {inCartItem && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow">
                          {inCartItem.quantity}
                        </div>
                      )}

                      <div>
                        {/* Image Placeholder */}
                        <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                          {product.image ? (
                            <Image width={120} height={120} src={product.image} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <Package className="w-8 h-8 text-muted-foreground/60 group-hover:scale-110 transition-transform" />
                          )}
                        </div>

                        {/* Product Info & Tax Badge */}
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <h3 className="font-semibold text-foreground text-sm line-clamp-1 group-hover:text-primary transition-colors">
                            {product.name}
                          </h3>
                        </div>

                        <div className="flex items-center gap-1.5 mb-2">
                          {product.tax_category === 'exempt' ? (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-status-cleared/15 text-status-cleared border border-status-cleared/30">
                              0% Exempt
                            </span>
                          ) : product.tax_category === 'zero_rated' ? (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-muted text-muted-foreground border border-border">
                              0% Zero-Rated
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-primary/10 text-primary border border-primary/20">
                              18% VAT (Standard)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Pricing & Stock */}
                      <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                        <span className="text-base font-mono-id font-bold text-foreground">
                          {formatCurrencyDisplay(product.sell_price)}
                        </span>

                        <span className={cn(
                          "text-[11px] font-medium",
                          product.stock_quantity > 10 ? "text-status-cleared" :
                          product.stock_quantity > 0 ? "text-status-action" : "text-status-blocked"
                        )}>
                          {product.stock_quantity === 999 ? "Unlimited" : `${product.stock_quantity} left`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Area - Checkout Cart & Billing */}
        <div className="w-96 flex flex-col bg-card border-l border-border shrink-0">
          {/* Member Selection Header */}
          <div className="p-3 border-b border-border bg-muted/40">
            {selectedMember ? (
              <div className="bg-card border border-primary/40 rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                      {selectedMember.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground leading-none">{selectedMember.name}</h4>
                      <p className="text-[10px] text-muted-foreground">{selectedMember.email || "Registered Member"}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSelectMember(null)}
                    className="text-muted-foreground hover:text-status-blocked p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Member Tab Limit Information */}
                {loadingTab ? (
                  <p className="text-[11px] text-muted-foreground animate-pulse">Loading tab balance...</p>
                ) : memberTab && (
                  <div className="bg-muted/70 rounded p-2 text-[11px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tab Balance:</span>
                      <span className="font-mono-id font-bold text-foreground">{memberTab.formatted_balance}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Credit Limit:</span>
                      <span className="font-mono-id">{memberTab.formatted_credit_limit}</span>
                    </div>
                    <div className="flex justify-between text-primary font-semibold">
                      <span>Available Credit:</span>
                      <span className="font-mono-id">{memberTab.formatted_remaining_credit}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => handleSelectMember({ id: "1a2b3c4d-0000-0000-0000-000000000001", name: "Jean Paul Habimana", email: "jeanpaul@kigaligym.rw" })}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-card border border-dashed border-border rounded-lg text-xs font-semibold text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors min-h-[38px]"
              >
                <User className="w-4 h-4" />
                <span>Assign Customer / Member Tab</span>
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {saleSuccess && (
              <div className="bg-status-cleared/10 border border-status-cleared/30 text-status-cleared p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>Transaction Complete! EBM Invoice generated.</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-xs font-headline-md font-bold text-muted-foreground uppercase tracking-wider">
                Cart Items ({cart.reduce((s, i) => s + i.quantity, 0)})
              </h2>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-[11px] text-muted-foreground hover:text-status-blocked transition-colors"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-14 text-muted-foreground">
                <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Cart is empty</p>
                <p className="text-xs text-muted-foreground/80 mt-1">Select items from the catalog to build invoice</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {cart.map(({ product, quantity }) => (
                  <div key={product.id} className="bg-muted/50 border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-xs text-foreground truncate">{product.name}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-muted-foreground font-mono-id">{formatCurrencyDisplay(product.sell_price)}</span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-background border border-border text-muted-foreground uppercase">
                            {product.tax_category || 'standard'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => removeFromCart(product.id)}
                        className="text-muted-foreground hover:text-status-blocked p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1 bg-card border border-border rounded-md p-0.5">
                        <button
                          onClick={() => updateQuantity(product.id, quantity - 1)}
                          className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground rounded hover:bg-muted"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold font-mono-id">{quantity}</span>
                        <button
                          onClick={() => updateQuantity(product.id, quantity + 1)}
                          className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground rounded hover:bg-muted"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="font-mono-id font-bold text-xs text-foreground">
                        {formatCurrencyDisplay(product.sell_price * quantity)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Summary & Checkout Footer */}
          <div className="p-4 border-t border-border bg-card space-y-3.5">
            {/* Promo Code & Voucher Section */}
            <div className="space-y-2 pb-3 border-b border-border/80">
              {/* Promo Code */}
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-primary" /> Promo Code
                </label>
                {appliedPromo ? (
                  <div className="flex items-center justify-between bg-primary/10 border border-primary/30 px-2.5 py-1.5 rounded-lg text-xs text-primary font-semibold">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      <span>{appliedPromo.code} (-{formatCurrencyDisplay(promoDiscount)})</span>
                    </div>
                    <button onClick={() => setAppliedPromo(null)} className="hover:text-status-blocked">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value)}
                      placeholder="e.g. SAVE10"
                      className="flex-1 px-2.5 py-1 text-xs bg-muted border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary uppercase text-foreground"
                    />
                    <button
                      onClick={handleApplyPromo}
                      disabled={loadingPromo || !promoCodeInput.trim() || cart.length === 0}
                      className="px-3 py-1 text-xs bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50"
                    >
                      {loadingPromo ? "..." : "Apply"}
                    </button>
                  </div>
                )}
                {promoError && <p className="text-[10px] text-status-blocked mt-0.5">{promoError}</p>}
              </div>

              {/* Gift Voucher */}
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <Gift className="w-3 h-3 text-status-cleared" /> Gift Voucher
                </label>
                {appliedVoucher ? (
                  <div className="flex items-center justify-between bg-status-cleared/10 border border-status-cleared/30 px-2.5 py-1.5 rounded-lg text-xs text-status-cleared font-semibold">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      <span>Voucher (-{formatCurrencyDisplay(voucherDiscount)})</span>
                    </div>
                    <button onClick={() => setAppliedVoucher(null)} className="hover:text-status-blocked">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={voucherCodeInput}
                      onChange={(e) => setVoucherCodeInput(e.target.value)}
                      placeholder="e.g. GV-99182"
                      className="flex-1 px-2.5 py-1 text-xs bg-muted border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary uppercase text-foreground"
                    />
                    <button
                      onClick={handleApplyVoucher}
                      disabled={loadingVoucher || !voucherCodeInput.trim() || cart.length === 0}
                      className="px-3 py-1 text-xs bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-secondary/90 disabled:opacity-50"
                    >
                      {loadingVoucher ? "..." : "Apply"}
                    </button>
                  </div>
                )}
                {voucherError && <p className="text-[10px] text-status-blocked mt-0.5">{voucherError}</p>}
              </div>
            </div>

            {/* Tax & Total Calculation Breakdown */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal (Ex-VAT):</span>
                <span className="font-mono-id">{formatCurrencyDisplay(subtotalExVat)}</span>
              </div>

              {promoDiscount > 0 && (
                <div className="flex justify-between text-primary font-medium">
                  <span>Promo Discount:</span>
                  <span className="font-mono-id">-{formatCurrencyDisplay(promoDiscount)}</span>
                </div>
              )}

              {voucherDiscount > 0 && (
                <div className="flex justify-between text-status-cleared font-medium">
                  <span>Gift Voucher:</span>
                  <span className="font-mono-id">-{formatCurrencyDisplay(voucherDiscount)}</span>
                </div>
              )}

              <div className="flex justify-between text-muted-foreground">
                <span className="flex items-center gap-1">
                  VAT (18% EBM Standard):
                </span>
                <span className="font-mono-id">{formatCurrencyDisplay(vatAmount)}</span>
              </div>

              <div className="flex justify-between text-base font-bold pt-2 border-t border-border">
                <span>Total (Incl-VAT):</span>
                <span className="font-mono-id text-primary text-lg">{formatCurrencyDisplay(finalTotal)}</span>
              </div>
            </div>

            {/* Checkout Payment Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleOpenSplitModal('cash')}
                disabled={cart.length === 0}
                className="px-3 py-2 bg-muted border border-border text-foreground rounded-lg text-xs font-semibold hover:bg-muted/80 disabled:opacity-40 flex items-center justify-center gap-1.5 min-h-[38px]"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Cash</span>
              </button>

              <button
                onClick={() => handleOpenSplitModal('momo')}
                disabled={cart.length === 0}
                className="px-3 py-2 bg-status-cleared text-status-cleared-foreground rounded-lg text-xs font-semibold hover:bg-status-cleared/90 disabled:opacity-40 flex items-center justify-center gap-1.5 min-h-[38px]"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>MTN MoMo</span>
              </button>

              <button
                onClick={() => handleOpenSplitModal('member_tab')}
                disabled={cart.length === 0}
                className="px-3 py-2 bg-muted border border-border text-foreground rounded-lg text-xs font-semibold hover:bg-muted/80 disabled:opacity-40 flex items-center justify-center gap-1.5 min-h-[38px]"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Member Tab</span>
              </button>

              <button
                onClick={() => handleOpenSplitModal()}
                disabled={cart.length === 0}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-1.5 min-h-[38px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Split Tender</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Split Payment Modal */}
      {showSplitModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base">Multi-Tender Payment</h3>
                <p className="text-xs text-muted-foreground">Allocate amounts across different payment methods</p>
              </div>
              <button onClick={() => setShowSplitModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total Required Banner */}
            <div className="bg-muted p-3 rounded-lg flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Total Amount Due:</span>
              <span className="font-mono-id font-bold text-base text-primary">{formatCurrencyDisplay(finalTotal)}</span>
            </div>

            {/* Tender Rows */}
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {paymentTenders.map((tender, index) => (
                <div key={index} className="flex items-center gap-2 bg-muted/40 p-2.5 rounded-lg border border-border">
                  <select
                    value={tender.method}
                    onChange={(e) => updateTender(index, 'method', e.target.value)}
                    className="bg-card border border-border text-foreground text-xs rounded-md px-2 py-1.5 outline-none font-medium min-w-[120px]"
                  >
                    <option value="cash">Cash (Till)</option>
                    <option value="momo">MTN MoMo</option>
                    <option value="airtel">Airtel Money</option>
                    <option value="member_tab">Member Tab</option>
                    <option value="card">Credit/Debit Card</option>
                  </select>

                  <div className="flex-1 relative">
                    <input
                      type="number"
                      value={tender.amount || ''}
                      onChange={(e) => updateTender(index, 'amount', e.target.value)}
                      placeholder="0"
                      className="w-full bg-card border border-border text-foreground text-xs rounded-md px-2.5 py-1.5 font-mono-id font-bold outline-none"
                    />
                  </div>

                  <button
                    onClick={() => autoBalanceTenders(index)}
                    title="Auto-fill remaining balance"
                    className="px-2 py-1 bg-muted hover:bg-muted/80 text-[10px] font-semibold rounded border border-border"
                  >
                    Fill
                  </button>

                  {paymentTenders.length > 1 && (
                    <button
                      onClick={() => removeTenderRow(index)}
                      className="text-muted-foreground hover:text-status-blocked p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addTenderRow}
              className="w-full py-2 bg-muted/60 hover:bg-muted border border-dashed border-border rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another Tender Method</span>
            </button>

            {/* Reconciliation Balance check */}
            {(() => {
              const allocated = paymentTenders.reduce((s, p) => s + p.amount, 0);
              const diff = finalTotal - allocated;
              return (
                <div className="pt-2 border-t border-border flex items-center justify-between text-xs font-medium">
                  <span>Allocated: {formatCurrencyDisplay(allocated)}</span>
                  <span className={cn(
                    "font-bold",
                    Math.abs(diff) <= 0.01 ? "text-status-cleared" : "text-status-blocked"
                  )}>
                    {diff === 0 ? "Balanced ✓" : diff > 0 ? `Remaining: ${formatCurrencyDisplay(diff)}` : `Over by: ${formatCurrencyDisplay(Math.abs(diff))}`}
                  </span>
                </div>
              );
            })()}

            {splitError && (
              <div className="p-2.5 bg-status-blocked/10 border border-status-blocked/30 text-status-blocked rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{splitError}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowSplitModal(false)}
                className="flex-1 py-2.5 bg-muted border border-border text-foreground font-semibold rounded-lg text-xs hover:bg-muted/80"
              >
                Cancel
              </button>
              <button
                onClick={() => handleExecuteCheckout()}
                disabled={completingSale}
                className="flex-1 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg text-xs hover:bg-primary/90 disabled:opacity-50"
              >
                {completingSale ? "Processing Sale..." : "Confirm & Complete Sale"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thermal Receipt Preview Modal */}
      {showReceiptModal && lastReceipt && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-base">Receipt Preview</h3>
              </div>
              <button onClick={() => setShowReceiptModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thermal Receipt Monospace Paper Preview */}
            <div className="bg-white text-black p-4 rounded-lg font-mono text-[11px] leading-tight shadow-inner overflow-x-auto border border-gray-300">
              <pre className="whitespace-pre-wrap font-mono">{lastReceipt.plain_text}</pre>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg text-xs flex items-center justify-center gap-2 hover:bg-primary/90"
              >
                <Printer className="w-4 h-4" />
                <span>Print Thermal Receipt</span>
              </button>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(lastReceipt.plain_text);
                  alert("Receipt copied to clipboard!");
                }}
                className="py-2.5 px-4 bg-muted border border-border text-foreground font-semibold rounded-lg text-xs hover:bg-muted/80"
              >
                Copy Text
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift / Till Audit Modal */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base">Cash Till Shift Management</h3>
              <button onClick={() => setShowShiftModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {currentShift ? (
              <div className="space-y-3">
                <div className="bg-status-cleared/10 border border-status-cleared/30 p-3 rounded-lg text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shift Status:</span>
                    <span className="font-bold text-status-cleared uppercase">Open</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Starting Cash:</span>
                    <span className="font-mono-id font-bold">{formatCurrencyDisplay(currentShift.starting_cash || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expected Cash in Till:</span>
                    <span className="font-mono-id font-bold text-primary">{formatCurrencyDisplay(currentShift.expected_cash || 0)}</span>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    const actual = prompt("Enter actual cash in till for end-of-shift audit:", String(currentShift.expected_cash || 0));
                    if (actual !== null) {
                      await endShift(currentShift.id, parseFloat(actual) || 0);
                      setCurrentShift(null);
                      setShowShiftModal(false);
                    }
                  }}
                  className="w-full py-2.5 bg-status-blocked text-status-blocked-foreground font-bold rounded-lg text-xs hover:bg-status-blocked/90"
                >
                  Close Shift & Perform Audit
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Starting Float Cash (RWF)</label>
                  <input
                    type="number"
                    value={startingCashInput}
                    onChange={(e) => setStartingCashInput(e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm font-mono-id font-bold outline-none"
                  />
                </div>

                <button
                  onClick={handleStartShift}
                  className="w-full py-2.5 bg-primary text-primary-foreground font-bold rounded-lg text-xs hover:bg-primary/90"
                >
                  Open Front Desk Till
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
