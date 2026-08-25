"use client";
import Image from "next/image";

import { useState } from "react";
import { ShoppingCart, Search, User, Package, CreditCard, Smartphone, Wallet, Receipt, Tag, Gift, Check, X } from "lucide-react";
import { cn, formatCurrencyDisplay } from "@/lib/utils";

export default function POSPage() {
  const [cart, setCart] = useState<any[]>([]);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Promo & Voucher state
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [loadingPromo, setLoadingPromo] = useState(false);

  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<any>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [loadingVoucher, setLoadingVoucher] = useState(false);

  // Mock product data
  const categories = [
    { id: "all", name: "All Products" },
    { id: "supplements", name: "Supplements" },
    { id: "merchandise", name: "Merchandise" },
    { id: "services", name: "Services" },
    { id: "refreshments", name: "Refreshments" },
  ];

  const products = [
    { id: "1", name: "Protein Powder", category: "supplements", price: 45000, stock: 15, image: null },
    { id: "2", name: "Energy Drink", category: "refreshments", price: 2500, stock: 50, image: null },
    { id: "3", name: "Gym T-Shirt", category: "merchandise", price: 15000, stock: 20, image: null },
    { id: "4", name: "Personal Training Session", category: "services", price: 25000, stock: 999, image: null },
    { id: "5", name: "Pre-Workout", category: "supplements", price: 35000, stock: 8, image: null },
    { id: "6", name: "Water Bottle", category: "refreshments", price: 1000, stock: 100, image: null },
  ];

  const filteredProducts = products.filter(product => 
    (selectedCategory === "all" || product.category === selectedCategory) &&
    (searchQuery === "" || product.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => 
      item.id === productId
        ? { ...item, quantity }
        : item
    ));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim()) return;
    setLoadingPromo(true);
    setPromoError(null);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000000';
      const res = await fetch(`${backendUrl}/api/payments/validate-promo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          code: promoCodeInput.trim(),
          subtotal: cartTotal
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setPromoError(data.error || "Failed to validate promo code");
      } else {
        setAppliedPromo(data.promotion);
        setPromoCodeInput("");
      }
    } catch (err: any) {
      // Fallback client side calculation for demo / offline mode
      const codeUpper = promoCodeInput.trim().toUpperCase();
      if (codeUpper === "SAVE10" || codeUpper === "WELCOME10") {
        const discountVal = Math.round(cartTotal * 0.1);
        setAppliedPromo({
          code: codeUpper,
          discount_type: "percentage",
          discount_value: 10,
          calculated_discount: discountVal
        });
        setPromoCodeInput("");
      } else if (codeUpper === "FLAT5000") {
        const discountVal = Math.min(5000, cartTotal);
        setAppliedPromo({
          code: codeUpper,
          discount_type: "flat",
          discount_value: 5000,
          calculated_discount: discountVal
        });
        setPromoCodeInput("");
      } else {
        setPromoError("Invalid promo code");
      }
    } finally {
      setLoadingPromo(false);
    }
  };

  const promoDiscount = appliedPromo
    ? appliedPromo.discount_type === 'percentage'
      ? Math.round((cartTotal * appliedPromo.discount_value) / 100)
      : Math.min(appliedPromo.discount_value, cartTotal)
    : 0;

  const subtotalAfterPromo = Math.max(0, cartTotal - promoDiscount);

  const handleApplyVoucher = async () => {
    if (!voucherCodeInput.trim()) return;
    setLoadingVoucher(true);
    setVoucherError(null);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000000';
      const res = await fetch(`${backendUrl}/api/payments/apply-gift-voucher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          code: voucherCodeInput.trim(),
          amount_to_use: subtotalAfterPromo
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setVoucherError(data.error || "Failed to apply gift voucher");
      } else {
        setAppliedVoucher(data);
        setVoucherCodeInput("");
      }
    } catch (err: any) {
      // Fallback demo/offline gift voucher mode
      const codeUpper = voucherCodeInput.trim().toUpperCase();
      if (codeUpper.startsWith("GV-") || codeUpper === "GIFT10000") {
        const initialVal = 10000;
        const appliedVal = Math.min(initialVal, subtotalAfterPromo);
        setAppliedVoucher({
          applied_amount: appliedVal,
          remaining_balance: initialVal - appliedVal,
          voucher: { code: codeUpper }
        });
        setVoucherCodeInput("");
      } else {
        setVoucherError("Invalid gift voucher code");
      }
    } finally {
      setLoadingVoucher(false);
    }
  };

  const voucherDiscount = appliedVoucher ? Math.min(appliedVoucher.applied_amount, subtotalAfterPromo) : 0;
  const finalTotal = Math.max(0, subtotalAfterPromo - voucherDiscount);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-headline-md font-bold text-foreground">Point of Sale</h1>
              <p className="text-sm text-muted-foreground">Retail checkout & fast billing console</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="pl-10 pr-4 py-2 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-foreground placeholder:text-muted-foreground w-64"
              />
            </div>
            <button className="px-4 py-2 bg-muted border border-border text-foreground rounded-lg hover:bg-muted/80 flex items-center gap-2 min-h-[44px]">
              <Receipt className="w-4 h-4" />
              Cash Till Audit
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Products */}
        <div className="flex-1 flex flex-col">
          {/* Categories */}
          <div className="p-4 border-b border-border bg-card">
            <div className="flex gap-2 overflow-x-auto">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap min-h-[44px]",
                    selectedCategory === category.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground hover:bg-muted/80"
                  )}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className={cn(
                    "bg-card border border-border rounded-lg p-4 cursor-pointer transition-colors hover:bg-muted",
                    product.stock === 0 && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center">
                    {product.image ? (
                      <Image width={100} height={100} src={product.image} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <Package className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <h3 className="font-medium text-foreground text-sm truncate">{product.name}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-lg font-mono-id font-bold text-primary">
                      {formatCurrencyDisplay(product.price)}
                    </span>
                    <span className={cn(
                      "text-xs",
                      product.stock > 10 ? "text-status-cleared" : 
                      product.stock > 0 ? "text-status-action" : "text-status-blocked"
                    )}>
                      {product.stock === 999 ? "∞" : product.stock} in stock
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Cart */}
        <div className="w-96 border-l border-border flex flex-col bg-card">
          {/* Member Lookup */}
          <div className="p-4 border-b border-border">
            <button
              onClick={() => setSelectedMember({ name: "John Doe", id: "1" })}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors min-h-[44px]",
                selectedMember ? "bg-primary/10 border-primary text-primary" : "bg-muted border-border text-foreground hover:bg-muted/80"
              )}
            >
              <User className="w-5 h-5" />
              <span className="flex-1 text-left">
                {selectedMember ? selectedMember.name : "Lookup Member"}
              </span>
            </button>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4">
            <h2 className="text-sm font-headline-md font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Cart ({cart.length})
            </h2>
            
            {cart.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Cart is empty</p>
                <p className="text-xs mt-2">Add products to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.id} className="bg-muted rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-card rounded-lg flex items-center justify-center shrink-0">
                        <Package className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground text-sm truncate">{item.name}</h3>
                        <p className="text-xs text-muted-foreground">{formatCurrencyDisplay(item.price)}</p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-muted-foreground hover:text-status-blocked"
                      >
                        ×
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-8 h-8 rounded bg-card border border-border flex items-center justify-center hover:bg-muted"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-8 h-8 rounded bg-card border border-border flex items-center justify-center hover:bg-muted"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-mono-id font-bold text-foreground">
                        {formatCurrencyDisplay(item.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Summary */}
          <div className="p-4 border-t border-border bg-muted/50 space-y-4">
            {/* Promo Code & Voucher Section */}
            <div className="space-y-2 border-b border-border pb-3">
              {/* Promo Code Input */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" /> Promo Code
                </label>
                {appliedPromo ? (
                  <div className="flex items-center justify-between bg-primary/10 border border-primary/30 p-2 rounded-lg text-xs text-primary font-medium">
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
                      className="flex-1 px-3 py-1.5 text-xs bg-muted border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary text-foreground"
                    />
                    <button
                      onClick={handleApplyPromo}
                      disabled={loadingPromo || !promoCodeInput.trim() || cart.length === 0}
                      className="px-3 py-1.5 text-xs bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/80 disabled:opacity-50"
                    >
                      {loadingPromo ? "..." : "Apply"}
                    </button>
                  </div>
                )}
                {promoError && <p className="text-[11px] text-status-blocked mt-1">{promoError}</p>}
              </div>

              {/* Gift Voucher Input */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1">
                  <Gift className="w-3.5 h-3.5" /> Gift Voucher
                </label>
                {appliedVoucher ? (
                  <div className="flex items-center justify-between bg-status-cleared/10 border border-status-cleared/30 p-2 rounded-lg text-xs text-status-cleared font-medium">
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
                      placeholder="e.g. GV-88219"
                      className="flex-1 px-3 py-1.5 text-xs bg-muted border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary text-foreground"
                    />
                    <button
                      onClick={handleApplyVoucher}
                      disabled={loadingVoucher || !voucherCodeInput.trim() || cart.length === 0}
                      className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-secondary/80 disabled:opacity-50"
                    >
                      {loadingVoucher ? "..." : "Apply"}
                    </button>
                  </div>
                )}
                {voucherError && <p className="text-[11px] text-status-blocked mt-1">{voucherError}</p>}
              </div>
            </div>

            <div className="space-y-1.5 mb-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono-id">{formatCurrencyDisplay(cartTotal)}</span>
              </div>
              {promoDiscount > 0 && (
                <div className="flex justify-between text-sm text-primary">
                  <span>Promo Discount ({appliedPromo?.code})</span>
                  <span className="font-mono-id">-{formatCurrencyDisplay(promoDiscount)}</span>
                </div>
              )}
              {voucherDiscount > 0 && (
                <div className="flex justify-between text-sm text-status-cleared">
                  <span>Gift Voucher</span>
                  <span className="font-mono-id">-{formatCurrencyDisplay(voucherDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax (0%)</span>
                <span className="font-mono-id">{formatCurrencyDisplay(0)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                <span>Total</span>
                <span className="font-mono-id text-primary">{formatCurrencyDisplay(finalTotal)}</span>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button className="px-3 py-2 bg-muted border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 min-h-[44px] flex items-center justify-center gap-2">
                <Wallet className="w-4 h-4" />
                Cash
              </button>
              <button className="px-3 py-2 bg-status-cleared text-status-cleared-foreground rounded-lg text-sm font-medium hover:bg-status-cleared/80 min-h-[44px] flex items-center justify-center gap-2">
                <Smartphone className="w-4 h-4" />
                MTN MoMo
              </button>
              <button className="px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 min-h-[44px] flex items-center justify-center gap-2">
                <Smartphone className="w-4 h-4" />
                Airtel Money
              </button>
              <button className="px-3 py-2 bg-muted border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 min-h-[44px] flex items-center justify-center gap-2">
                <CreditCard className="w-4 h-4" />
                Charge Tab
              </button>
            </div>

            <button
              disabled={cart.length === 0}
              className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/80 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Complete Sale ({formatCurrencyDisplay(finalTotal)})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
