"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText, Plus, Search, Truck, Check, X, RefreshCw,
  Clock, CheckCircle, PackageCheck, AlertCircle, ShoppingCart,
  ArrowRight, DollarSign, Calendar
} from "lucide-react";
import { cn, formatCurrencyDisplay } from "@/lib/utils";
import {
  fetchPurchaseOrders, createPurchaseOrder, getPurchaseOrder,
  receivePurchaseOrder, fetchSuppliers, fetchProducts,
  PurchaseOrder, Supplier, ProductItem
} from "@/lib/api/pos";
import { useTenantId } from "@/contexts/AuthContext";

export default function PurchaseOrdersPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Create PO modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [poItems, setPoItems] = useState<{ product_id: string; quantity_ordered: number; unit_cost: number }[]>([
    { product_id: "", quantity_ordered: 10, unit_cost: 0 }
  ]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Receiving Modal state
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
  const [receiveInputs, setReceiveInputs] = useState<{ [itemId: string]: number }>({});
  const [submittingReceive, setSubmittingReceive] = useState(false);
  const [receiveSuccessMsg, setReceiveSuccessMsg] = useState<string | null>(null);

  const contextTenantId = useTenantId();
  const tenantId = contextTenantId || process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '2c604504-41c3-406b-82a0-a43700057af8';

  useEffect(() => {
    if (tenantId) {
      loadData();
    }
  }, [tenantId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pos, sups, prods] = await Promise.all([
        fetchPurchaseOrders(tenantId).catch(() => []),
        fetchSuppliers(tenantId).catch(() => []),
        fetchProducts(tenantId).catch(() => [])
      ]);
      setPurchaseOrders(pos || []);
      setSuppliers(sups || []);
      setProducts(prods || []);
    } catch (err) {
      console.warn("Failed to load PO data", err);
    } finally {
      setLoading(false);
    }
  };

  // Add Item to PO Creator
  const addItemLine = () => {
    setPoItems(prev => [...prev, { product_id: "", quantity_ordered: 10, unit_cost: 0 }]);
  };

  const updateItemLine = (index: number, field: string, value: any) => {
    setPoItems(prev => {
      const updated = [...prev];
      if (field === 'product_id') {
        const prod = products.find(p => p.id === value);
        updated[index] = {
          ...updated[index],
          product_id: value,
          unit_cost: prod?.cost_price || Math.round(prod?.sell_price ? prod.sell_price * 0.6 : 0)
        };
      } else {
        updated[index] = {
          ...updated[index],
          [field]: field === 'quantity_ordered' || field === 'unit_cost' ? (parseFloat(value) || 0) : value
        };
      }
      return updated;
    });
  };

  const removeItemLine = (index: number) => {
    setPoItems(prev => prev.filter((_, i) => i !== index));
  };

  // Create Purchase Order
  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      setCreateError("Please select a supplier");
      return;
    }
    const validItems = poItems.filter(i => i.product_id && i.quantity_ordered > 0);
    if (validItems.length === 0) {
      setCreateError("Add at least one product with quantity > 0");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      await createPurchaseOrder({
        tenant_id: tenantId,
        supplier_id: selectedSupplierId,
        expected_delivery_date: expectedDate || null,
        notes: poNotes || null,
        items: validItems
      });
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create purchase order");
    } finally {
      setCreating(false);
    }
  };

  // Open Receiving Modal
  const handleOpenReceive = async (po: PurchaseOrder) => {
    try {
      const detailed = await getPurchaseOrder(po.id, tenantId);
      setReceivingPO(detailed);
      const initialInputs: { [itemId: string]: number } = {};
      (detailed.items || []).forEach(item => {
        if (item.id) {
          const remaining = Math.max(0, item.quantity_ordered - (item.quantity_received || 0));
          initialInputs[item.id] = remaining;
        }
      });
      setReceiveInputs(initialInputs);
    } catch (err) {
      alert("Failed to load PO items for receiving");
    }
  };

  // Submit Receive & update COGS
  const handleSubmitReceive = async () => {
    if (!receivingPO) return;
    setSubmittingReceive(true);
    try {
      const receivedItemsPayload = Object.entries(receiveInputs)
        .filter(([_, qty]) => qty > 0)
        .map(([itemId, qty]) => {
          const poItem = receivingPO.items?.find(i => i.id === itemId);
          return {
            item_id: itemId,
            product_id: poItem?.product_id || "",
            quantity_received: qty
          };
        });

      if (receivedItemsPayload.length === 0) {
        alert("Please enter a quantity greater than 0 to receive");
        setSubmittingReceive(false);
        return;
      }

      const res = await receivePurchaseOrder(receivingPO.id, {
        tenant_id: tenantId,
        received_items: receivedItemsPayload
      });

      setReceiveSuccessMsg(`Stock updated successfully! ${res.cogs_updates?.length || 0} product COGS recalculated.`);
      loadData();
      setTimeout(() => {
        setReceivingPO(null);
        setReceiveSuccessMsg(null);
      }, 2500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      alert("Failed to receive PO items: " + message);
    } finally {
      setSubmittingReceive(false);
    }
  };

  const filteredPOs = purchaseOrders.filter(po => {
    const matchesStatus = statusFilter === "all" || po.status === statusFilter;
    const matchesSearch = po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (po.suppliers?.name && po.suppliers.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-status-action/10 text-status-action border border-status-action/20 flex items-center justify-center shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-headline-md font-bold tracking-tight">Purchase Orders & COGS</h1>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-muted text-muted-foreground border border-border">
                  {purchaseOrders.length} Orders
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Inventory replenishment, PO receiving workflows, and weighted-average COGS updates</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/pos"
              className="px-3 py-1.5 bg-muted border border-border text-xs font-semibold rounded-lg hover:bg-muted/80 flex items-center gap-1.5 transition-colors min-h-[38px]"
            >
              <ShoppingCart className="w-4 h-4 text-primary" />
              <span>Back to POS</span>
            </Link>

            <Link
              href="/admin/suppliers"
              className="px-3 py-1.5 bg-muted border border-border text-xs font-semibold rounded-lg hover:bg-muted/80 flex items-center gap-1.5 transition-colors min-h-[38px]"
            >
              <Truck className="w-4 h-4 text-primary" />
              <span>Suppliers</span>
            </Link>

            <button
              onClick={() => {
                setShowCreateModal(true);
                setPoItems([{ product_id: products[0]?.id || "", quantity_ordered: 20, unit_cost: 0 }]);
                setSelectedSupplierId(suppliers[0]?.id || "");
              }}
              className="px-3.5 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 flex items-center gap-1.5 shadow-sm min-h-[38px]"
            >
              <Plus className="w-4 h-4" />
              <span>Create Purchase Order</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4">
        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border p-3 rounded-xl">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by PO# or Supplier name..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-muted border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary text-foreground"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            {['all', 'pending', 'ordered', 'partially_received', 'received'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap capitalize transition-colors min-h-[36px]",
                  statusFilter === st
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-foreground hover:bg-muted/80 border border-border"
                )}
              >
                {st.replace('_', ' ')}
              </button>
            ))}

            <button
              onClick={loadData}
              className="w-9 h-9 flex items-center justify-center bg-muted border border-border rounded-lg hover:bg-muted/80 transition-colors shrink-0"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin text-primary")} />
            </button>
          </div>
        </div>

        {/* PO Table */}
        {loading ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredPOs.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed border-border rounded-xl">
            <FileText className="w-12 h-12 opacity-30 mb-2" />
            <p className="text-sm font-semibold">No purchase orders found</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Order Date</th>
                  <th className="py-3 px-4">Expected Delivery</th>
                  <th className="py-3 px-4">Total Cost</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPOs.map((po) => (
                  <tr key={po.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono-id font-bold text-foreground">
                      {po.po_number}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-foreground">
                      {po.suppliers?.name || "Direct Vendor"}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">
                      {new Date(po.order_date).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">
                      {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3.5 px-4 font-mono-id font-bold text-foreground">
                      {formatCurrencyDisplay(po.total_cost || 0)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                        po.status === 'received' ? "bg-status-cleared/15 text-status-cleared border border-status-cleared/30" :
                        po.status === 'partially_received' ? "bg-status-action/15 text-status-action border border-status-action/30" :
                        po.status === 'ordered' ? "bg-primary/10 text-primary border border-primary/20" :
                        "bg-muted text-muted-foreground border border-border"
                      )}>
                        {po.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {po.status !== 'received' ? (
                        <button
                          onClick={() => handleOpenReceive(po)}
                          className="px-3 py-1.5 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 text-xs shadow-sm"
                        >
                          Receive Stock
                        </button>
                      ) : (
                        <span className="text-status-cleared font-semibold flex items-center justify-end gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Received
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Purchase Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base">Create Purchase Order</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-2.5 bg-status-blocked/10 border border-status-blocked/30 text-status-blocked rounded-lg text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreatePO} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Supplier *</label>
                  <select
                    required
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-muted border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary text-foreground"
                  >
                    <option value="">Select a supplier...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.payment_terms || "Net 30"})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-muted border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Order Item Lines</label>
                  <button
                    type="button"
                    onClick={addItemLine}
                    className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item Line
                  </button>
                </div>

                <div className="space-y-2">
                  {poItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 bg-muted/40 p-2.5 rounded-lg border border-border">
                      <div className="flex-1">
                        <select
                          required
                          value={item.product_id}
                          onChange={(e) => updateItemLine(index, 'product_id', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-card border border-border rounded outline-none text-foreground"
                        >
                          <option value="">Select Product...</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock_quantity})</option>
                          ))}
                        </select>
                      </div>

                      <div className="w-24">
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={item.quantity_ordered || ''}
                          onChange={(e) => updateItemLine(index, 'quantity_ordered', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-card border border-border rounded outline-none font-mono-id"
                        />
                      </div>

                      <div className="w-28">
                        <input
                          type="number"
                          min="0"
                          placeholder="Unit Cost"
                          value={item.unit_cost || ''}
                          onChange={(e) => updateItemLine(index, 'unit_cost', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-card border border-border rounded outline-none font-mono-id"
                        />
                      </div>

                      <div className="w-28 text-right font-mono-id font-bold text-xs text-foreground px-2">
                        {formatCurrencyDisplay((item.quantity_ordered || 0) * (item.unit_cost || 0))}
                      </div>

                      {poItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItemLine(index)}
                          className="text-muted-foreground hover:text-status-blocked p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end text-sm font-bold pt-2 border-t border-border">
                  <span>Total Estimated PO Cost: &nbsp;</span>
                  <span className="font-mono-id text-primary">
                    {formatCurrencyDisplay(poItems.reduce((s, i) => s + (i.quantity_ordered * i.unit_cost), 0))}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Notes / Instructions</label>
                <textarea
                  rows={2}
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="e.g. Delivery via front reception dock..."
                  className="w-full px-3 py-2 text-xs bg-muted border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 bg-muted border border-border text-foreground font-semibold rounded-lg text-xs hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2 bg-primary text-primary-foreground font-bold rounded-lg text-xs hover:bg-primary/90 disabled:opacity-50"
                >
                  {creating ? "Submitting..." : "Generate Purchase Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO Receiving & COGS Recalculation Modal */}
      {receivingPO && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base">Receive Purchase Order #{receivingPO.po_number}</h3>
                <p className="text-xs text-muted-foreground">Verify quantities received to update stock and re-calculate COGS</p>
              </div>
              <button onClick={() => setReceivingPO(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {receiveSuccessMsg && (
              <div className="p-3 bg-status-cleared/15 border border-status-cleared/30 text-status-cleared rounded-lg text-xs font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{receiveSuccessMsg}</span>
              </div>
            )}

            {/* Receiving Table */}
            <div className="space-y-3">
              <div className="bg-muted/40 border border-border rounded-lg p-3">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted-foreground font-semibold border-b border-border pb-2">
                    <tr>
                      <th className="pb-2">Product</th>
                      <th className="pb-2 text-center">Ordered</th>
                      <th className="pb-2 text-center">Previously Recv</th>
                      <th className="pb-2 text-right">Recv Now</th>
                      <th className="pb-2 text-right">Unit Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(receivingPO.items || []).map((item) => {
                      const previouslyReceived = item.quantity_received || 0;
                      const remaining = Math.max(0, item.quantity_ordered - previouslyReceived);
                      const currentVal = receiveInputs[item.id || ""] || 0;

                      return (
                        <tr key={item.id} className="py-2">
                          <td className="py-2.5 font-medium text-foreground">
                            <div>{item.products?.name || "Product"}</div>
                            <span className="text-[10px] text-muted-foreground">Current Stock: {item.products?.stock_quantity || 0}</span>
                          </td>
                          <td className="py-2.5 text-center font-mono-id">{item.quantity_ordered}</td>
                          <td className="py-2.5 text-center font-mono-id text-muted-foreground">{previouslyReceived}</td>
                          <td className="py-2.5 text-right">
                            <input
                              type="number"
                              min="0"
                              max={remaining}
                              value={currentVal}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 0;
                                setReceiveInputs(prev => ({ ...prev, [item.id || ""]: val }));
                              }}
                              className="w-20 px-2 py-1 bg-card border border-border rounded text-right font-mono-id font-bold text-xs outline-none"
                            />
                          </td>
                          <td className="py-2.5 text-right font-mono-id font-bold">
                            {formatCurrencyDisplay(item.unit_cost)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* COGS Impact Explanation Banner */}
              <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-primary font-bold">
                  <DollarSign className="w-4 h-4" />
                  <span>Weighted-Average Cost of Goods Sold (COGS) Formula</span>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Upon receipt, product unit cost will be updated as: <code className="bg-muted px-1 py-0.5 rounded font-mono text-[10px]">New Cost = (Current Stock × Current Cost + Received Qty × PO Cost) ÷ Total New Stock</code>.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReceivingPO(null)}
                className="flex-1 py-2.5 bg-muted border border-border text-foreground font-semibold rounded-lg text-xs hover:bg-muted/80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitReceive}
                disabled={submittingReceive}
                className="flex-1 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg text-xs hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <PackageCheck className="w-4 h-4" />
                <span>{submittingReceive ? "Processing Stock Receipt..." : "Confirm & Update Inventory"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
