"use client";

import { useState, useEffect } from "react";
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  Trash2,
  Receipt,
  User,
  CreditCard,
  Smartphone,
  Banknote,
  CheckCircle,
  Clock,
  Printer,
  Sparkles,
  Ticket,
  DollarSign
} from "lucide-react";
import {
  fetchProducts,
  fetchShiftStatus,
  startShift,
  checkoutPOS,
  fetchMemberTab,
  fetchInvoiceReceipt,
  validatePromoCode,
  validateGiftVoucher,
  ProductItem,
  PaymentTender,
  MemberTabInfo,
  ReceiptData,
  ShiftStatusInfo,
  ValidatePromoResponse,
  ValidateVoucherResponse,
} from "@/lib/api/pos";
import { useAuth, useTenantId } from "@/contexts/AuthContext";

export default function POSPage() {
  const { user } = useAuth();
  const contextTenantId = useTenantId();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<{ product: ProductItem; quantity: number }[]>([]);

  // Member Selection & Member Tab
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string; email?: string } | null>(null);
  const [memberTab, setMemberTab] = useState<MemberTabInfo | null>(null);
  const [loadingTab, setLoadingTab] = useState(false);

  // Promos & Vouchers
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<ValidatePromoResponse['promotion'] | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [loadingPromo, setLoadingPromo] = useState(false);

  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<ValidateVoucherResponse['voucher'] | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [loadingVoucher, setLoadingVoucher] = useState(false);

  // Split Tenders
  const [tenders, setTenders] = useState<PaymentTender[]>([{ method: 'momo', amount: 0 }]);
  const [splitError, setSplitError] = useState<string | null>(null);

  // Shift & Cash Drawer
  const [currentShift, setCurrentShift] = useState<ShiftStatusInfo | null>(null);
  const [startingCashInput, setStartingCashInput] = useState("10000");
  const [showShiftModal, setShowShiftModal] = useState(false);

  // Receipt Modal
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [completingSale, setCompletingSale] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState(false);

  const tenantId = contextTenantId || process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '2c604504-41c3-406b-82a0-a43700057af8';

  // Load Products & Shift on Mount / Tenant Change
  useEffect(() => {
    if (tenantId) {
      loadProductsData();
      loadShiftData();
    }
  }, [tenantId]);

  const loadProductsData = async () => {
    setLoadingProducts(true);
    try {
      const data = await fetchProducts(tenantId);
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Failed to load products from API", err);
      setProducts([]);
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
      setMemberTab(null);
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

  // Cart operations
  const addToCart = (product: ProductItem) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev =>
      prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean) as { product: ProductItem; quantity: number }[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Subtotals & Tax Calculations
  const grossSubtotal = cart.reduce((sum, item) => sum + (item.product.sell_price * item.quantity), 0);

  // Calculate promo discount
  let promoDiscount = 0;
  if (appliedPromo) {
    if (appliedPromo.discount_type === 'percentage') {
      promoDiscount = Math.round((grossSubtotal * (appliedPromo.discount_value || 0)) / 100);
      if (appliedPromo.max_discount_amount && promoDiscount > appliedPromo.max_discount_amount) {
        promoDiscount = appliedPromo.max_discount_amount;
      }
    } else {
      promoDiscount = appliedPromo.discount_value || 0;
    }
  }

  const subtotalAfterPromo = Math.max(0, grossSubtotal - promoDiscount);

  // Calculate voucher discount
  let voucherDiscount = 0;
  if (appliedVoucher) {
    voucherDiscount = Math.min(appliedVoucher.current_balance, subtotalAfterPromo);
  }

  const finalTotalToPay = Math.max(0, subtotalAfterPromo - voucherDiscount);

  // Tender management
  const totalTendered = tenders.reduce((sum, t) => sum + (t.amount || 0), 0);
  const remainingDue = Math.max(0, finalTotalToPay - totalTendered);

  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim()) return;
    setLoadingPromo(true);
    setPromoError(null);
    try {
      const data = await validatePromoCode(tenantId, promoCodeInput.trim(), grossSubtotal, false);
      if (data.valid && data.promotion) {
        setAppliedPromo(data.promotion);
        setPromoCodeInput("");
      } else {
        setPromoError(data.error || "Invalid promo code");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid promo code";
      setPromoError(message);
    } finally {
      setLoadingPromo(false);
    }
  };

  const handleApplyVoucher = async () => {
    if (!voucherCodeInput.trim()) return;
    setLoadingVoucher(true);
    setVoucherError(null);
    try {
      const data = await validateGiftVoucher(tenantId, voucherCodeInput.trim(), subtotalAfterPromo);
      if (data.valid && data.voucher) {
        setAppliedVoucher(data.voucher);
        setVoucherCodeInput("");
      } else {
        setVoucherError(data.error || "Invalid gift voucher");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid gift voucher";
      setVoucherError(message);
    } finally {
      setLoadingVoucher(false);
    }
  };

  const addTender = () => {
    setTenders(prev => [...prev, { method: 'cash', amount: remainingDue }]);
  };

  const updateTender = (index: number, field: keyof PaymentTender, value: PaymentTender[keyof PaymentTender]) => {
    setTenders(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeTender = (index: number) => {
    setTenders(prev => prev.filter((_, i) => i !== index));
  };

  // Complete Sale
  const handleCompleteSale = async () => {
    setSplitError(null);

    if (cart.length === 0) {
      setSplitError("Cart is empty.");
      return;
    }

    if (Math.abs(totalTendered - finalTotalToPay) > 0.01 && finalTotalToPay > 0) {
      setSplitError(`Tendered total (${totalTendered.toLocaleString()} RWF) must equal Total Due (${finalTotalToPay.toLocaleString()} RWF)`);
      return;
    }

    // Validate Member Tab tender
    const memberTabTender = tenders.find(t => t.method === 'member_tab');
    if (memberTabTender && memberTabTender.amount > 0) {
      if (!selectedMember) {
        setSplitError("A member must be selected to pay with Member Tab.");
        return;
      }
      if (memberTab && memberTabTender.amount > memberTab.remaining_credit) {
        setSplitError(`Member tab credit limit exceeded. Remaining credit: ${memberTab.remaining_credit.toLocaleString()} RWF`);
        return;
      }
    }

    setCompletingSale(true);
    try {
      const response = await checkoutPOS({
        tenant_id: tenantId,
        profile_id: selectedMember?.id || null,
        shift_id: currentShift?.id || null,
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          sell_price: item.product.sell_price,
          name: item.product.name
        })),
        payments: tenders,
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
      setCart([]);
      setAppliedPromo(null);
      setAppliedVoucher(null);
      setTenders([{ method: 'momo', amount: 0 }]);

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

  const handleStartShift = async () => {
    try {
      const staffId = user?.id || '00000000-0000-0000-0000-000000000000';
      const shift = await startShift(tenantId, staffId, parseFloat(startingCashInput) || 0);
      setCurrentShift(shift);
      setShowShiftModal(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      alert("Failed to start shift: " + message);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <header className="border-b border-border bg-card px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <ShoppingBag className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Point of Sale</h1>
            <p className="text-xs text-muted-foreground">Kigali Express Terminal • EBM Compliant</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Shift Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg border border-border text-xs">
            <Clock className="size-3.5 text-muted-foreground" />
            <span>Shift: {currentShift ? `#${currentShift.id?.slice(0,6)} (Active)` : 'Closed'}</span>
            {!currentShift && (
              <button
                onClick={() => setShowShiftModal(true)}
                className="ml-2 text-xs text-primary font-semibold hover:underline"
              >
                Start Shift
              </button>
            )}
          </div>

          {/* Quick Member Lookup */}
          <div className="relative">
            <input
              type="text"
              placeholder="Assign Member (Name or Phone)..."
              value={selectedMember ? selectedMember.name : ""}
              onChange={(e) => {
                if (selectedMember) setSelectedMember(null);
              }}
              className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs w-56 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </header>

      {/* Main Grid: 65% Catalog / 35% Checkout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Product Catalog (65%) */}
        <div className="w-[65%] flex flex-col border-r border-border p-6 overflow-hidden">
          {/* Search & Categories */}
          <div className="flex flex-col gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search products by name or scan barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto pr-1">
            {loadingProducts ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                Loading products catalog...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                No products found matching search.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="flex flex-col justify-between p-4 bg-card border border-border rounded-xl hover:border-primary/50 transition-all text-left group h-32"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <span className="font-semibold text-sm text-foreground line-clamp-1 group-hover:text-primary">
                          {p.name}
                        </span>
                        {p.tax_category === 'standard' && (
                          <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                            VAT
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground capitalize mt-0.5">{p.category}</p>
                    </div>

                    <div className="flex items-baseline justify-between mt-2">
                      <span className="font-mono text-sm font-bold text-foreground">
                        {p.sell_price.toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">RWF</span>
                      </span>
                      <span className={`text-[10px] font-medium ${p.stock_quantity > 5 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {p.stock_quantity > 0 ? `${p.stock_quantity} left` : 'Out of Stock'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Checkout Cart & Tenders (35%) */}
        <div className="w-[35%] flex flex-col bg-card overflow-y-auto">
          {/* Member Banner */}
          {selectedMember && (
            <div className="p-4 bg-muted/50 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                  {selectedMember.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">{selectedMember.name}</h4>
                  <p className="text-[10px] text-muted-foreground">Member Account</p>
                </div>
              </div>
              {memberTab && (
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Tab Credit Limit</p>
                  <p className="text-xs font-mono font-bold text-emerald-500">
                    {memberTab.formatted_remaining_credit}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Cart Items List */}
          <div className="flex-1 p-4 overflow-y-auto border-b border-border min-h-[180px]">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Cart Items ({cart.length})</h3>
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <ShoppingBag className="size-8 stroke-1 mb-2 opacity-40" />
                <p className="text-xs">Cart is empty. Click products on left to add.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center justify-between p-2.5 bg-background border border-border rounded-lg">
                    <div className="flex-1 pr-2">
                      <h5 className="text-xs font-semibold text-foreground line-clamp-1">{item.product.name}</h5>
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {item.product.sell_price.toLocaleString()} RWF x {item.quantity}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center border border-border rounded-md bg-muted">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="px-2 text-xs font-bold font-mono text-foreground">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>

                      <span className="text-xs font-mono font-bold text-foreground w-16 text-right">
                        {(item.product.sell_price * item.quantity).toLocaleString()}
                      </span>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-muted-foreground hover:text-rose-500 p-1"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Promos, Vouchers & Totals */}
          <div className="p-4 border-b border-border bg-muted/20 space-y-3">
            {/* Promo Code Input */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Sparkles className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Promo Code (e.g. SUMMER10)"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground uppercase"
                />
              </div>
              <button
                onClick={handleApplyPromo}
                disabled={loadingPromo}
                className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold rounded-md"
              >
                Apply
              </button>
            </div>
            {promoError && <p className="text-[10px] text-rose-500">{promoError}</p>}
            {appliedPromo && (
              <div className="flex items-center justify-between text-xs bg-emerald-500/10 text-emerald-500 p-2 rounded border border-emerald-500/20">
                <span>Promo ({appliedPromo.code}):</span>
                <span className="font-mono font-bold">-{promoDiscount.toLocaleString()} RWF</span>
              </div>
            )}

            {/* Gift Voucher Input */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Ticket className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Gift Voucher (GV-XXXX)"
                  value={voucherCodeInput}
                  onChange={(e) => setVoucherCodeInput(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground uppercase"
                />
              </div>
              <button
                onClick={handleApplyVoucher}
                disabled={loadingVoucher}
                className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold rounded-md"
              >
                Redeem
              </button>
            </div>
            {voucherError && <p className="text-[10px] text-rose-500">{voucherError}</p>}
            {appliedVoucher && (
              <div className="flex items-center justify-between text-xs bg-emerald-500/10 text-emerald-500 p-2 rounded border border-emerald-500/20">
                <span>Voucher ({appliedVoucher.code}):</span>
                <span className="font-mono font-bold">-{voucherDiscount.toLocaleString()} RWF</span>
              </div>
            )}

            {/* Totals Summary */}
            <div className="pt-2 border-t border-border space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Gross Subtotal</span>
                <span className="font-mono">{grossSubtotal.toLocaleString()} RWF</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-foreground pt-1 border-t border-border">
                <span>Total Due</span>
                <span className="font-mono text-primary text-base">{finalTotalToPay.toLocaleString()} RWF</span>
              </div>
            </div>
          </div>

          {/* Payment Tenders Section */}
          <div className="p-4 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Payment Tenders</h4>
                <button
                  onClick={addTender}
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                >
                  <Plus className="size-3" /> Split Tender
                </button>
              </div>

              {splitError && (
                <div className="p-2 mb-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[11px] rounded">
                  {splitError}
                </div>
              )}

              <div className="space-y-2">
                {tenders.map((tender, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      value={tender.method}
                      onChange={(e) => updateTender(index, 'method', e.target.value)}
                      className="bg-background border border-border rounded-md text-xs py-1.5 px-2 text-foreground"
                    >
                      <option value="momo">MoMo Pay</option>
                      <option value="cash">Cash</option>
                      <option value="card">Card Terminal</option>
                      <option value="member_tab">Member Tab</option>
                    </select>

                    <input
                      type="number"
                      placeholder="Amount"
                      value={tender.amount || ''}
                      onChange={(e) => updateTender(index, 'amount', parseFloat(e.target.value) || 0)}
                      className="flex-1 bg-background border border-border rounded-md text-xs py-1.5 px-2 font-mono text-foreground"
                    />

                    {tenders.length > 1 && (
                      <button
                        onClick={() => removeTender(index)}
                        className="text-muted-foreground hover:text-rose-500 p-1"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Checkout Action Button */}
            <div className="pt-4 border-t border-border mt-4">
              <button
                onClick={handleCompleteSale}
                disabled={completingSale || cart.length === 0}
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all min-h-[48px] ${
                  saleSuccess
                    ? "bg-emerald-500 text-white"
                    : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                }`}
              >
                {completingSale ? (
                  <span>Processing Sale...</span>
                ) : saleSuccess ? (
                  <>
                    <CheckCircle className="size-5" />
                    <span>Transaction Completed!</span>
                  </>
                ) : (
                  <>
                    <Receipt className="size-5" />
                    <span>Complete Sale ({finalTotalToPay.toLocaleString()} RWF)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Shift Start Modal */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-lg text-foreground">Open POS Shift</h3>
            <p className="text-xs text-muted-foreground">Specify the opening float in cash drawer before beginning sales.</p>
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">Starting Cash Float (RWF)</label>
              <input
                type="number"
                value={startingCashInput}
                onChange={(e) => setStartingCashInput(e.target.value)}
                className="w-full bg-background border border-border rounded-lg p-2 font-mono text-sm text-foreground"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowShiftModal(false)}
                className="flex-1 py-2 bg-muted text-muted-foreground rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleStartShift}
                className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold"
              >
                Start Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thermal Receipt Preview Modal */}
      {showReceiptModal && lastReceipt && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Printer className="size-4 text-primary" /> EBM Thermal Receipt
              </h3>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="text-xs text-muted-foreground hover:text-foreground font-bold"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-black text-emerald-400 font-mono text-[11px] p-4 rounded-xl whitespace-pre border border-emerald-900/50">
              {lastReceipt.plain_text}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
              >
                <Printer className="size-4" /> Print Thermal Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
