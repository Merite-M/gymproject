/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from "next/link";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://omufxcaifzqepvqbgghc.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key_for_build';
const supabase = createClient(supabaseUrl, supabaseKey);

interface Product {
    id: string;
    name: string;
    category: string;
    sell_price: number;
    stock_quantity: number;
}

interface CartItem extends Product {
    quantity: number;
}

interface Profile {
    id: string;
    first_name: string;
    last_name: string;
}

interface Shift {
    id: string;
    status: string;
}

export default function POSTerminal() {
    const [isPosEnabled, setIsPosEnabled] = useState<boolean | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [activeCategory, setActiveCategory] = useState<string>('ALL');
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [selectedProfile, setSelectedProfile] = useState<string>('');
    const [memberTabBalance, setMemberTabBalance] = useState<number>(0);
    const [tillStatus, setTillStatus] = useState<Shift | null>(null); // For cash till challenge
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [showShiftModal, setShowShiftModal] = useState<boolean>(false);
    const [shiftReport, setShiftReport] = useState<any>(null);
    const [actualCash, setActualCash] = useState<string>('');

    useEffect(() => {
        const fetchInitialData = async () => {
            const { data: tenant } = await supabase.from('tenants').select('*').limit(1).single();
            if (tenant && tenant.features && tenant.features.pos !== undefined) {
                setIsPosEnabled(tenant.features.pos);
            } else {
                setIsPosEnabled(true);
            }

            if (tenant) {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/pos/products?tenant_id=${tenant.id}`);
                if (res.ok) {
                    const data: Product[] = await res.json();
                    setProducts(data);
                    const cats = Array.from(new Set(data.map(p => p.category)));
                    setCategories(['ALL', ...cats]);
                }

                const { data: profs } = await supabase.from('profiles').select('id, first_name, last_name');
                if (profs) setProfiles(profs);

                const resShift = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/pos/shift/status?tenant_id=${tenant.id}`);
                if (resShift.ok) {
                    setTillStatus(await resShift.json());
                }
            }
        };

        fetchInitialData();

        const channel = supabase
        .channel('public:inventory_items')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'inventory_items' },
          async (payload) => {
               const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();
               if(tenant) {
                   const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/pos/products?tenant_id=${tenant.id}`);
                   if (res.ok) setProducts(await res.json());
               }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, []);


    useEffect(() => {
        const fetchTabBalance = async () => {
            if (selectedProfile) {
                const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();
                if (tenant) {
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/pos/member_tab/${selectedProfile}?tenant_id=${tenant.id}`);
                    if (res.ok) {
                        const data = await res.json();
                        setMemberTabBalance(data.balance);
                    }
                }
            } else {
                setMemberTabBalance(0);
            }
        };
        fetchTabBalance();
    }, [selectedProfile]);



    const fetchXReport = async () => {
        if (!tillStatus) return;
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/pos/shift/${tillStatus.id}/x-report`);
        if (res.ok) {
            setShiftReport(await res.json());
        }
    };

    useEffect(() => {
        if (showShiftModal && tillStatus) {
            fetchXReport();
        }
    }, [showShiftModal, tillStatus]);


    const filteredProducts = activeCategory === 'ALL' ? products : products.filter(p => p.category === activeCategory);

    const addToCart = (product: Product) => {
        if (product.stock_quantity <= 0) {
            alert("Out of stock!");
            return;
        }
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                if (existing.quantity >= product.stock_quantity) {
                    alert("Not enough stock!");
                    return prev;
                }
                return prev.map((item: CartItem) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const removeFromCart = (product: Product) => {
      setCart(prev => {
        const existing = prev.find(item => item.id === product.id);
        if (existing) {
            if (existing.quantity === 1) {
              return prev.filter(item => item.id !== product.id);
            }
            return prev.map((item: CartItem) => item.id === product.id ? { ...item, quantity: item.quantity - 1 } : item);
        }
        return prev;
      });
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.sell_price * item.quantity), 0);

    const handleCheckout = async (method: string) => {
        if (cart.length === 0) return;
        if (method === 'member_tab' && !selectedProfile) {
            alert("Please select a member to charge to tab");
            return;
        }
        if (method === 'cash' && !tillStatus) {
            const startingCash = prompt("Audit: Please enter current physical till cash balance to open shift");
            if (!startingCash) return;
            // Open shift
            const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/pos/shift/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_id: tenant?.id, staff_id: null, starting_cash: parseFloat(startingCash) })
            });
            const shift = await res.json();
            setTillStatus(shift);
            alert("Shift Opened. Proceeding with checkout.");
            return; // Requires them to click checkout again after shift opens
        }

        setIsCheckingOut(true);
        try {
             const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();
             const payload = {
                 tenant_id: tenant?.id,
                 profile_id: selectedProfile || null,
                 method,
                 shift_id: tillStatus ? tillStatus.id : null,
                 staff_id: null, // Would be current user
                 items: cart.map(item => ({ product_id: item.id, quantity: item.quantity, sell_price: item.sell_price, name: item.name }))
             };

             const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/pos/checkout`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(payload)
             });

             const result = await res.json();
             if (result.success) {
                 alert("Checkout Successful!");
                 setCart([]);
                 setSelectedProfile('');
                 // Refresh products to show new stock
                 const prodsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/pos/products?tenant_id=${tenant?.id}`);
                 if (prodsRes.ok) setProducts(await prodsRes.json());
             } else {
                 alert(`Checkout Failed: ${result.error}`);
             }
        } catch (e) {
            console.error(e);
            alert("Checkout Error");
        }
        setIsCheckingOut(false);
    };


    const handleCloseShift = async () => {
        if (!tillStatus || !actualCash) return;
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/pos/shift/end`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ shift_id: tillStatus.id, actual_cash: parseFloat(actualCash) })
            });
            const result = await res.json();

            if (result.status === 'discrepancy') {
                 alert(`Shift closed with discrepancy. Expected: ${result.expected_cash}, Actual: ${result.actual_cash}`);
            } else {
                 alert('Shift closed successfully.');
            }

            setTillStatus(null);
            setShowShiftModal(false);
            setShiftReport(null);
            setActualCash('');
        } catch (error) {
            console.error(error);
            alert("Error closing shift");
        }
    };


    if (isPosEnabled === null) {
        return <div className="flex h-screen items-center justify-center font-body-base bg-canvas-bg text-primary">Loading POS Terminal...</div>;
    }

    if (isPosEnabled === false) {
        return <div className="flex h-screen items-center justify-center text-danger-crimson font-bold text-2xl bg-canvas-bg font-body-base">POS Feature is currently disabled for this tenant.</div>;
    }

    return (
      <div className="flex h-screen bg-canvas-bg overflow-hidden text-on-background font-body-base">
        {/* SideNavBar */}
        <nav className="bg-inverse-surface dark:bg-on-background w-64 flex-shrink-0 h-screen border-r border-border-hairline hidden md:flex flex-col py-4 z-20">
          <div className="px-gutter mb-8 mt-2">
            <h1 className="text-subhead-sm font-bold text-surface-container-lowest">Soho Kigali</h1>
            <p className="text-on-surface-variant text-body-dense">POS Terminal</p>
          </div>
          <div className="px-gutter mb-6">
            <button className="w-full bg-primary-container text-on-primary-container rounded-lg py-2 px-3 flex items-center justify-center space-x-2 border border-surface-tint/30 text-label-caps font-bold uppercase tracking-widest">
              <span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 1"}}>qr_code_scanner</span>
              <span>Scanner Active</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ul className="space-y-1">
              <li>
                <Link className="flex items-center space-x-3 px-3 py-2 text-on-surface-variant hover:text-on-surface mx-2 hover:bg-surface-tint hover:text-white transition-colors rounded-lg group scale-95 duration-150" href="/monitor">
                  <span className="material-symbols-outlined group-hover:text-white">dashboard</span>
                  <span>Monitor</span>
                </Link>
              </li>
              <li>
                <Link className="flex items-center space-x-3 px-3 py-2 text-on-surface-variant hover:text-on-surface mx-2 hover:bg-surface-tint hover:text-white transition-colors rounded-lg group scale-95 duration-150" href="/members">
                  <span className="material-symbols-outlined">group</span>
                  <span>Directory</span>
                </Link>
              </li>
              <li>
                <Link className="flex items-center space-x-3 px-3 py-2 bg-primary-container text-on-primary-container rounded-lg mx-2 scale-95 duration-150 font-medium" href="/pos">
                  <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>payments</span>
                  <span>POS</span>
                </Link>
              </li>
            </ul>
          </div>
          <div className="mt-auto pt-4 border-t border-surface-tint/20">
            <div className="px-gutter mt-4 flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-surface-tint/50 flex items-center justify-center text-white font-bold text-sm">
                AM
              </div>
              <div>
                <p className="text-sm font-medium text-surface-container-lowest">Admin Manager</p>
                <p className="text-xs text-on-surface-variant">Front Desk</p>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          {/* TopAppBar */}
          <header className="bg-surface border-b border-border-hairline flex justify-between items-center w-full px-gutter sticky top-0 z-10 h-16 shrink-0">
            <div className="flex items-center gap-8 h-full">
              <h2 className="text-headline-md font-bold text-primary tracking-tight">Point of Sale</h2>
            </div>
            <div className="flex items-center gap-4">
              <button
                  onClick={() => setShowShiftModal(true)}
                  className="px-4 py-2 bg-surface-container border border-border-hairline rounded-lg text-body-dense font-medium text-primary hover:bg-surface-muted transition-colors flex items-center gap-2"
              >
                  <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
                  {tillStatus ? 'Till Management' : 'Open Till'}
              </button>
              <div className="flex items-center gap-2 border-l border-border-hairline pl-4 ml-2">
                <button className="text-text-muted hover:text-on-surface transition-colors p-1.5 rounded-full hover:bg-surface-muted">
                  <span className="material-symbols-outlined">notifications</span>
                </button>
              </div>
            </div>
          </header>

          <div className="flex flex-1 overflow-hidden relative">
            {/* Category Grid (65%) */}
            <div className="w-full lg:w-[65%] flex flex-col border-r border-border-hairline h-full relative z-10 bg-canvas-bg shadow-[4px_0_24px_rgba(0,0,0,0.02)] overflow-y-auto">
              {/* Category Filter */}
              <div className="px-6 py-4 border-b border-border-hairline bg-surface sticky top-0 z-10">
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mb-2">
                    {categories.map(c => (
                        <button
                            key={c}
                            onClick={() => setActiveCategory(c)}
                            className={`px-4 py-2 text-label-caps font-bold uppercase tracking-widest whitespace-nowrap rounded-lg transition-colors border shadow-sm ${activeCategory === c ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-lowest text-text-muted border-border-hairline hover:bg-surface-muted hover:text-primary'}`}
                        >
                            {c}
                        </button>
                    ))}
                </div>
              </div>

              {/* Items Grid */}
              <div className="p-6 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map(p => (
                  <div
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className={`p-4 rounded-xl border flex flex-col justify-between transition-all cursor-pointer ${p.stock_quantity === 0 ? 'bg-surface-container opacity-60 border-border-hairline grayscale' : 'bg-surface-container-lowest border-border-hairline shadow-sm hover:border-primary hover:shadow-md'}`}
                  >
                    <div>
                      <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center overflow-hidden border border-border-hairline mb-3">
                        <span className="material-symbols-outlined text-[20px] text-primary opacity-50">shopping_bag</span>
                      </div>
                      <h3 className="font-bold text-primary mb-1 text-[15px] leading-tight line-clamp-2">{p.name}</h3>
                      <p className="text-body-dense text-text-muted capitalize">{p.category}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border-hairline/50 flex justify-between items-center">
                      <span className="font-mono-id text-[15px] font-bold text-primary">${p.sell_price.toFixed(2)}</span>
                      <span className={`text-[11px] font-bold uppercase tracking-widest ${p.stock_quantity === 0 ? 'text-danger-crimson' : 'text-secondary'}`}>{p.stock_quantity} left</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Checkout Console (35%) */}
            <div className="w-full lg:w-[35%] bg-surface flex flex-col h-full z-0 relative">
              {/* Active Client Card */}
              <div className="p-6 border-b border-border-hairline bg-surface shrink-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-2">Associate Order With Member</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <select
                        className="w-full bg-surface-container-lowest border border-border-hairline rounded-lg py-2.5 px-3 text-body-base text-primary font-medium focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        value={selectedProfile}
                        onChange={(e) => setSelectedProfile(e.target.value)}
                    >
                        <option value="">-- Guest Checkout --</option>
                        {profiles.map(p => (
                            <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                        ))}
                    </select>
                  </div>
                </div>
                {selectedProfile && (
                  <div className="mt-3 p-3 bg-surface-container-lowest rounded-lg border border-border-hairline flex justify-between items-center">
                      <span className="text-body-dense font-medium text-text-muted">Account Tab Balance:</span>
                      <span className={`font-mono-id font-bold ${memberTabBalance > 0 ? 'text-danger-crimson' : 'text-primary'}`}>
                          ${memberTabBalance.toFixed(2)}
                      </span>
                  </div>
                )}
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto p-6 bg-canvas-bg">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-text-muted">
                    <span className="material-symbols-outlined text-4xl mb-4 opacity-50">shopping_cart</span>
                    <p className="font-medium text-body-base">Cart is empty</p>
                    <p className="text-body-dense text-center mt-2 max-w-[200px]">Select items from the grid to add them to this order.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map(item => (
                      <div key={item.id} className="bg-surface-container-lowest border border-border-hairline rounded-lg p-3 flex justify-between items-center shadow-sm">
                        <div className="flex-1 min-w-0 pr-4">
                          <h4 className="font-bold text-primary truncate text-sm">{item.name}</h4>
                          <p className="text-body-dense text-text-muted font-mono-id">${item.sell_price.toFixed(2)} /ea</p>
                        </div>
                        <div className="flex items-center bg-surface-muted rounded-md border border-border-hairline h-8 shrink-0 overflow-hidden">
                          <button onClick={(e) => { e.stopPropagation(); removeFromCart(item); }} className="w-8 h-full flex items-center justify-center hover:bg-surface-container text-text-muted transition-colors"><span className="material-symbols-outlined text-[16px]">remove</span></button>
                          <span className="w-8 text-center text-mono-id font-bold text-primary border-x border-border-hairline h-full flex items-center justify-center bg-surface-container-lowest">{item.quantity}</span>
                          <button onClick={(e) => { e.stopPropagation(); addToCart(item); }} className="w-8 h-full flex items-center justify-center hover:bg-surface-container text-text-muted transition-colors"><span className="material-symbols-outlined text-[16px]">add</span></button>
                        </div>
                        <div className="w-16 text-right text-mono-id font-bold text-primary shrink-0">
                          ${(item.quantity * item.sell_price).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totals & Actions */}
              <div className="p-6 bg-surface border-t border-border-hairline shrink-0">
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-1">Total Amount</p>
                    <p className="text-body-dense text-text-muted">Includes VAT</p>
                  </div>
                  <h2 className="text-[32px] font-headline-md font-black text-primary font-mono-id leading-none">
                    ${cartTotal.toFixed(2)}
                  </h2>
                </div>

                <div className="space-y-3">
                  <div className="flex gap-3">
                    <button
                      disabled={isCheckingOut || cart.length === 0}
                      onClick={() => handleCheckout('cash')}
                      className="flex-1 py-4 bg-primary text-on-primary rounded-lg text-body-base font-bold flex flex-col items-center justify-center gap-1 hover:bg-primary/90 transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                    >
                      <span className="material-symbols-outlined text-[20px]">payments</span>
                      <span>Cash {tillStatus ? '' : '(Open)'}</span>
                    </button>
                    <button
                      disabled={isCheckingOut || cart.length === 0}
                      onClick={() => handleCheckout('momo')}
                      className="flex-1 py-4 bg-warning-amber text-white rounded-lg text-body-base font-bold flex flex-col items-center justify-center gap-1 hover:bg-warning-amber/90 transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                    >
                      <span className="material-symbols-outlined text-[20px]">send_money</span>
                      <span>MoMo</span>
                    </button>
                  </div>
                  <button
                    disabled={isCheckingOut || cart.length === 0 || !selectedProfile}
                    onClick={() => handleCheckout('member_tab')}
                    className="w-full py-3 bg-surface-container-low text-primary border border-border-hairline rounded-lg text-body-dense font-medium flex items-center justify-center gap-2 hover:bg-surface-muted transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                    <span>Charge to Account Tab</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

        {/* Shift Management Modal */}
        {showShiftModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-surface rounded-xl shadow-xl border border-border-hairline w-full max-w-md overflow-hidden">
                    <div className="px-6 py-4 border-b border-border-hairline flex justify-between items-center bg-canvas-bg">
                        <h3 className="font-bold text-primary text-body-base">
                            {tillStatus ? 'Shift Management (X-Report)' : 'Open New Shift'}
                        </h3>
                        <button onClick={() => setShowShiftModal(false)} className="text-text-muted hover:text-primary">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    <div className="p-6">
                        {!tillStatus ? (
                             <div className="text-center">
                                 <p className="text-body-dense text-text-muted mb-4">You need to open a shift to process cash transactions.</p>
                                 <button
                                     onClick={() => { setShowShiftModal(false); handleCheckout('cash'); }}
                                     className="px-6 py-3 bg-primary text-on-primary font-bold rounded-lg hover:bg-primary/90 transition-colors w-full"
                                 >
                                     Open Shift Now
                                 </button>
                             </div>
                        ) : (
                             <div>
                                 {shiftReport ? (
                                     <div className="space-y-4">
                                         <div className="grid grid-cols-2 gap-4">
                                             <div className="p-3 bg-canvas-bg rounded-lg border border-border-hairline">
                                                 <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">Cash Sales</p>
                                                 <p className="font-mono-id font-bold text-primary">${(shiftReport.totals?.cash || 0).toFixed(2)}</p>
                                             </div>
                                             <div className="p-3 bg-canvas-bg rounded-lg border border-border-hairline">
                                                 <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">MoMo Sales</p>
                                                 <p className="font-mono-id font-bold text-primary">${(shiftReport.totals?.momo || 0).toFixed(2)}</p>
                                             </div>
                                             <div className="p-3 bg-canvas-bg rounded-lg border border-border-hairline">
                                                 <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">Tab Charges</p>
                                                 <p className="font-mono-id font-bold text-primary">${(shiftReport.totals?.member_tab || 0).toFixed(2)}</p>
                                             </div>
                                             <div className="p-3 bg-surface-muted rounded-lg border border-border-hairline">
                                                 <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">Expected Cash In Till</p>
                                                 <p className="font-mono-id font-bold text-primary text-lg">${(shiftReport.expected_cash || 0).toFixed(2)}</p>
                                             </div>
                                         </div>

                                         <div className="pt-4 border-t border-border-hairline mt-4">
                                             <p className="font-bold text-primary mb-2 text-sm">Z-Report: Close Shift</p>
                                             <div className="flex gap-2">
                                                 <input
                                                     type="number"
                                                     placeholder="Counted Cash ($)"
                                                     value={actualCash}
                                                     onChange={e => setActualCash(e.target.value)}
                                                     className="flex-1 bg-surface-container-lowest border border-border-hairline rounded-lg px-3 py-2 text-body-base text-primary font-mono-id"
                                                 />
                                                 <button
                                                     disabled={!actualCash}
                                                     onClick={handleCloseShift}
                                                     className="px-4 py-2 bg-danger-crimson text-white font-bold rounded-lg hover:bg-danger-crimson/90 transition-colors disabled:opacity-50"
                                                 >
                                                     Close Till
                                                 </button>
                                             </div>
                                         </div>
                                     </div>
                                 ) : (
                                     <p className="text-center text-text-muted">Loading report...</p>
                                 )}
                             </div>
                        )}
                    </div>
                </div>
            </div>
        )}

      </div>
      </div>
    );
}
