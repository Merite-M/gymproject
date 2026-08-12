"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy';
const supabase = createClient(supabaseUrl, supabaseKey);

type Product = {
    id: string;
    name: string;
    category: string;
    sell_price: number;
    stock_quantity: number;
    tenant_id: string;
};

type Profile = {
    id: string;
    first_name: string;
    last_name: string;
};

type Shift = {
    id: string;
    tenant_id: string;
    expected_cash: number;
};

type CartItem = Product & { quantity: number };

export default function POSTerminal() {
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [activeCategory, setActiveCategory] = useState<string>('ALL');
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [selectedProfile, setSelectedProfile] = useState<string>('');
    const [tillStatus, setTillStatus] = useState<Shift | null>(null); // For cash till challenge
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    useEffect(() => {
        async function loadData() {
            try {
               const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();
               if (tenant) {
                   const tid = tenant.id;

                   // Fetch Products
                   const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/pos/products?tenant_id=${tid}`);
                   if (res.ok) {
                       const data = await res.json();
                       setProducts(data);
                       const cats = Array.from(new Set(data.map((p: Product) => p.category)));
                       setCategories(['ALL', ...cats as string[]]);
                   }

                   // Fetch Profiles (for Tab search)
                   const { data: profs } = await supabase.from('profiles').select('id, first_name, last_name').eq('tenant_id', tid);
                   if (profs) setProfiles(profs);
               }
            } catch (e) {
                console.error("Error loading POS data", e);
            }
        }
        loadData();
    }, []);

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

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden text-gray-900">
            {/* Left Panel: Category Grid & Items */}
            <div className="w-2/3 flex flex-col border-r border-gray-300">
                <div className="bg-white p-4 flex justify-between items-center shadow-sm z-10">
                    <h1 className="text-xl font-bold">SOHO KIGALI POS TERMINAL</h1>
                    <span className="text-sm bg-gray-200 px-3 py-1 rounded-full">Till Station: #01</span>
                </div>

                <div className="flex gap-2 p-4 bg-gray-50 border-b border-gray-200 overflow-x-auto">
                    {categories.map(c => (
                        <button
                            key={c}
                            onClick={() => setActiveCategory(c)}
                            className={`px-6 py-3 font-semibold rounded-md whitespace-nowrap transition-colors ${activeCategory === c ? 'bg-black text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'}`}
                        >
                            {c}
                        </button>
                    ))}
                </div>

                <div className="flex-1 p-6 overflow-y-auto">
                    <div className="grid grid-cols-3 gap-6">
                        {filteredProducts.map(p => (
                            <div
                                key={p.id}
                                onClick={() => addToCart(p)}
                                className={`flex flex-col justify-between p-6 rounded-xl border-2 cursor-pointer transition-all ${p.stock_quantity === 0 ? 'bg-gray-100 border-gray-200 opacity-60 grayscale' : 'bg-white border-transparent hover:border-black shadow-md'}`}
                            >
                                <div className="text-lg font-bold mb-2 leading-tight">{p.name}</div>
                                <div className="text-xl font-medium text-green-700 mb-4">{p.sell_price.toLocaleString()} RWF</div>
                                <div className={`text-sm font-bold ${p.stock_quantity === 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                    [{p.stock_quantity} stock{p.stock_quantity === 0 ? '!' : ''}]
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel: Active Checkout Console */}
            <div className="w-1/3 flex flex-col bg-white">
                <div className="p-6 border-b border-gray-200">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Active Client (For Tab):</label>
                    <select
                        className="w-full border border-gray-300 rounded-md p-3 focus:ring-black focus:border-black"
                        value={selectedProfile}
                        onChange={(e) => setSelectedProfile(e.target.value)}
                    >
                        <option value="">-- Select Walk-in / Member --</option>
                        {profiles.map(p => (
                            <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    <h3 className="font-bold text-gray-500 mb-4 tracking-wider text-sm">CART ITEMS</h3>
                    {cart.length === 0 ? (
                        <div className="text-gray-400 text-center mt-10">Cart is empty</div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {cart.map(item => (
                                <div key={item.id} className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                                    <div>
                                        <div className="font-bold">{item.name}</div>
                                        <div className="text-sm text-gray-500">Qty: {item.quantity} × {item.sell_price.toLocaleString()} RWF</div>
                                    </div>
                                    <div className="font-bold">
                                        {(item.quantity * item.sell_price).toLocaleString()} RWF
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-6 bg-white border-t border-gray-200">
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-lg font-bold text-gray-500">Total Due:</span>
                        <span className="text-3xl font-black">{cartTotal.toLocaleString()} RWF</span>
                    </div>

                    <div className="flex flex-col gap-3">
                        <p className="text-sm font-bold text-gray-500 mb-1">PAYMENT METHOD:</p>
                        <button
                            disabled={isCheckingOut || cart.length === 0}
                            onClick={() => handleCheckout('cash')}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-lg disabled:opacity-50"
                        >
                            CASH {tillStatus ? '' : '(Open Shift)'}
                        </button>
                        <button
                            disabled={isCheckingOut || cart.length === 0}
                            onClick={() => handleCheckout('momo')}
                            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-4 rounded-lg disabled:opacity-50"
                        >
                            MoMo LINK CALL
                        </button>
                        <button
                            disabled={isCheckingOut || cart.length === 0 || !selectedProfile}
                            onClick={() => handleCheckout('member_tab')}
                            className="w-full bg-black hover:bg-gray-800 text-white font-bold py-4 rounded-lg disabled:opacity-50"
                        >
                            CHARGE TO TAB
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
