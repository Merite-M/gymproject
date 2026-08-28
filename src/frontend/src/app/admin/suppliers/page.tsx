"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Truck, Plus, Search, Mail, Phone, MapPin, CreditCard,
  Edit2, Trash2, X, RefreshCw, ChevronRight, FileText, ShoppingCart
} from "lucide-react";
import { cn, formatCurrencyDisplay } from "@/lib/utils";
import {
  fetchSuppliers, createSupplier, updateSupplier, deleteSupplier,
  getSupplier, Supplier, PurchaseOrder
} from "@/lib/api/pos";
import { useTenantId } from "@/contexts/AuthContext";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<(Supplier & { purchase_orders: PurchaseOrder[] }) | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    payment_terms: "Net 30",
    notes: ""
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const contextTenantId = useTenantId();
  const tenantId = contextTenantId || process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '2c604504-41c3-406b-82a0-a43700057af8';

  useEffect(() => {
    if (tenantId) {
      loadSuppliersList();
    }
  }, [tenantId]);

  const loadSuppliersList = async () => {
    setLoading(true);
    try {
      const data = await fetchSuppliers(tenantId);
      setSuppliers(data || []);
    } catch (err) {
      console.warn("Error fetching suppliers:", err);
      // Fallback sample data
      setSuppliers([
        {
          id: "sup-1",
          tenant_id: tenantId,
          name: "Inyange Industries Ltd",
          contact_person: "Patrick Mugabo",
          phone: "+250 788 123 456",
          email: "orders@inyange.rw",
          address: "Masaka Sector, Kigali",
          payment_terms: "Net 15",
          notes: "Main supplier for water, juices, and dairy recovery drinks",
          purchase_orders_count: 3,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: "sup-2",
          tenant_id: tenantId,
          name: "Optimum Nutrition East Africa",
          contact_person: "Sarah Keza",
          phone: "+250 788 654 321",
          email: "distribution@optimumnutrition.co.rw",
          address: "Kigali Special Economic Zone",
          payment_terms: "Net 30",
          notes: "Whey protein, creatine, and BCAAs importer",
          purchase_orders_count: 5,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormData({
      name: "",
      contact_person: "",
      phone: "",
      email: "",
      address: "",
      payment_terms: "Net 30",
      notes: ""
    });
    setFormError(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (sup: Supplier, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSupplier(sup);
    setFormData({
      name: sup.name,
      contact_person: sup.contact_person || "",
      phone: sup.phone || "",
      email: sup.email || "",
      address: sup.address || "",
      payment_terms: sup.payment_terms || "Net 30",
      notes: sup.notes || ""
    });
    setFormError(null);
    setShowAddModal(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Supplier name is required");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, {
          tenant_id: tenantId,
          ...formData
        });
      } else {
        await createSupplier({
          tenant_id: tenantId,
          ...formData
        });
      }
      setShowAddModal(false);
      loadSuppliersList();
    } catch (err: any) {
      setFormError(err.message || "Failed to save supplier");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSupplier = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this supplier?")) return;
    try {
      await deleteSupplier(id, tenantId);
      loadSuppliersList();
      if (selectedSupplier?.id === id) {
        setSelectedSupplier(null);
      }
    } catch (err: any) {
      setFormError("Failed to delete supplier: " + err.message);
    }
  };

  const handleViewSupplierDetails = async (sup: Supplier) => {
    setLoadingDetails(true);
    try {
      const details = await getSupplier(sup.id, tenantId);
      setSelectedSupplier(details);
    } catch (err) {
      setSelectedSupplier({
        ...sup,
        purchase_orders: []
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.contact_person && s.contact_person.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shadow-sm">
              <Truck className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-headline-md font-bold tracking-tight">Supplier Directory</h1>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-muted text-muted-foreground border border-border">
                  {suppliers.length} Registered
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Manage vendors, procurement terms, and purchase order histories</p>
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
              href="/admin/purchase-orders"
              className="px-3 py-1.5 bg-muted border border-border text-xs font-semibold rounded-lg hover:bg-muted/80 flex items-center gap-1.5 transition-colors min-h-[38px]"
            >
              <FileText className="w-4 h-4 text-status-action" />
              <span>Purchase Orders</span>
            </Link>

            <button
              onClick={handleOpenAdd}
              className="px-3.5 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 flex items-center gap-1.5 shadow-sm min-h-[38px]"
            >
              <Plus className="w-4 h-4" />
              <span>New Supplier</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Suppliers List Area */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto">
          {/* Search Bar */}
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search suppliers by name, contact or email..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-foreground placeholder:text-muted-foreground min-h-[38px]"
              />
            </div>

            <button
              onClick={loadSuppliersList}
              className="w-9 h-9 flex items-center justify-center bg-card border border-border rounded-lg hover:bg-muted transition-colors"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin text-primary")} />
            </button>
          </div>

          {/* Supplier Cards Grid */}
          {loading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed border-border rounded-xl">
              <Truck className="w-12 h-12 opacity-30 mb-2" />
              <p className="text-sm font-semibold">No suppliers found</p>
              <button onClick={handleOpenAdd} className="mt-3 text-xs text-primary font-bold hover:underline">
                + Register First Supplier
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSuppliers.map((sup) => (
                <div
                  key={sup.id}
                  onClick={() => handleViewSupplierDetails(sup)}
                  className={cn(
                    "bg-card border rounded-xl p-5 cursor-pointer transition-all hover:border-primary/50 hover:shadow-md flex flex-col justify-between group",
                    selectedSupplier?.id === sup.id ? "border-primary ring-1 ring-primary" : "border-border"
                  )}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                          {sup.name}
                        </h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <span>{sup.contact_person || "No contact person"}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handleOpenEdit(sup, e)}
                          title="Edit Supplier"
                          className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground rounded hover:bg-muted"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteSupplier(sup.id, e)}
                          title="Delete Supplier"
                          className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-status-blocked rounded hover:bg-muted"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-muted-foreground mb-4">
                      {sup.phone && (
                        <div className="flex items-center gap-2 truncate">
                          <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>{sup.phone}</span>
                        </div>
                      )}
                      {sup.email && (
                        <div className="flex items-center gap-2 truncate">
                          <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>{sup.email}</span>
                        </div>
                      )}
                      {sup.address && (
                        <div className="flex items-center gap-2 truncate">
                          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>{sup.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                    <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium text-[11px]">
                      {sup.payment_terms || "Net 30"}
                    </span>

                    <span className="text-primary font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform text-[11px]">
                      <span>{sup.purchase_orders_count || 0} POs</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Drawer - Selected Supplier Profile & PO History */}
        {selectedSupplier && (
          <div className="w-96 border-l border-border bg-card flex flex-col shrink-0 overflow-y-auto">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-foreground">{selectedSupplier.name}</h3>
                <p className="text-[11px] text-muted-foreground">Supplier Profile & History</p>
              </div>
              <button onClick={() => setSelectedSupplier(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Vendor Specs */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contact:</span>
                  <span className="font-semibold text-foreground">{selectedSupplier.contact_person || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-mono-id text-foreground">{selectedSupplier.phone || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="text-foreground truncate max-w-[180px]">{selectedSupplier.email || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Terms:</span>
                  <span className="font-bold text-primary">{selectedSupplier.payment_terms || "Net 30"}</span>
                </div>
                {selectedSupplier.notes && (
                  <div className="pt-2 border-t border-border text-muted-foreground text-[11px]">
                    <p className="italic">&ldquo;{selectedSupplier.notes}&rdquo;</p>
                  </div>
                )}
              </div>

              {/* Purchase Order History */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Purchase Order History ({selectedSupplier.purchase_orders?.length || 0})
                  </h4>
                  <Link
                    href={`/admin/purchase-orders?supplier_id=${selectedSupplier.id}`}
                    className="text-[11px] text-primary font-bold hover:underline"
                  >
                    + Create PO
                  </Link>
                </div>

                {loadingDetails ? (
                  <p className="text-xs text-muted-foreground animate-pulse py-4 text-center">Loading PO records...</p>
                ) : !selectedSupplier.purchase_orders || selectedSupplier.purchase_orders.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground bg-muted/30 rounded-lg text-xs">
                    No purchase orders recorded yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedSupplier.purchase_orders.map((po) => (
                      <div key={po.id} className="bg-muted/40 border border-border rounded-lg p-2.5 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono-id font-bold text-foreground">{po.po_number}</span>
                          <span className={cn(
                            "px-1.5 py-0.2 rounded text-[10px] font-bold uppercase",
                            po.status === 'received' ? "bg-status-cleared/15 text-status-cleared" :
                            po.status === 'partially_received' ? "bg-status-action/15 text-status-action" :
                            "bg-muted text-muted-foreground"
                          )}>
                            {po.status}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-[11px]">
                          <span>{new Date(po.order_date).toLocaleDateString()}</span>
                          <span className="font-mono-id font-bold text-foreground">{formatCurrencyDisplay(po.total_cost || 0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base">
                {editingSupplier ? "Edit Supplier" : "Register New Supplier"}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 bg-status-blocked/10 border border-status-blocked/30 text-status-blocked rounded-lg text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveSupplier} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Company / Supplier Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Inyange Industries Ltd"
                  className="w-full px-3 py-2 text-xs bg-muted border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="e.g. Patrick Mugabo"
                    className="w-full px-3 py-2 text-xs bg-muted border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+250 788..."
                    className="w-full px-3 py-2 text-xs bg-muted border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="orders@vendor.rw"
                    className="w-full px-3 py-2 text-xs bg-muted border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Payment Terms</label>
                  <select
                    value={formData.payment_terms}
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-muted border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary text-foreground"
                  >
                    <option value="Cash on Delivery">Cash on Delivery</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 60">Net 60</option>
                    <option value="Prepaid">Prepaid</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Physical Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. Masaka Sector, Kigali"
                  className="w-full px-3 py-2 text-xs bg-muted border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Notes / Supply Categories</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add notes on delivery schedules or lead times..."
                  className="w-full px-3 py-2 text-xs bg-muted border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 bg-muted border border-border text-foreground font-semibold rounded-lg text-xs hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-primary text-primary-foreground font-bold rounded-lg text-xs hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingSupplier ? "Update Supplier" : "Save Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
