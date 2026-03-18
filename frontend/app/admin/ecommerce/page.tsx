"use client";

import { useEffect, useState } from "react";
import {
  getEcommerceSettings,
  updateEcommerceSettings,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getOrders,
  updateOrderStatus,
  type EcommerceSettings,
  type Product,
  type Order,
} from "@/lib/admin-api";

const ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];

type ActiveTab = "products" | "orders";

const EMPTY_PRODUCT: Partial<Product> = {
  name: "",
  description: "",
  price: 0,
  stock: 0,
  category: "",
  is_active: true,
};

export default function EcommercePage() {
  const [settings, setSettings] = useState<EcommerceSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("products");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Product>>(EMPTY_PRODUCT);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [s, p, o] = await Promise.all([
        getEcommerceSettings(),
        getProducts(),
        getOrders({ limit: 50 }),
      ]);
      setSettings(s);
      setProducts(p);
      setOrders(o.items);
    } catch {
      // handled
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggleEnabled = async () => {
    if (!settings) return;
    try {
      const updated = await updateEcommerceSettings({ enabled: !settings.enabled });
      setSettings(updated);
    } catch {
      alert("Failed to update settings.");
    }
  };

  const openAddProduct = () => {
    setEditing({ ...EMPTY_PRODUCT });
    setEditId(null);
    setPanelOpen(true);
  };

  const openEditProduct = (p: Product) => {
    setEditing({ ...p });
    setEditId(p.id);
    setPanelOpen(true);
  };

  const handleSaveProduct = async () => {
    setSaving(true);
    try {
      if (editId) {
        await updateProduct(editId, editing);
      } else {
        await createProduct(editing);
      }
      const p = await getProducts();
      setProducts(p);
      setPanelOpen(false);
    } catch {
      alert("Failed to save product.");
    }
    setSaving(false);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    try {
      await deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch {
      alert("Failed to delete product.");
    }
  };

  const handleOrderStatus = async (orderId: string, status: string) => {
    try {
      await updateOrderStatus(orderId, status);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: status as Order["status"] } : o))
      );
    } catch {
      alert("Failed to update order status.");
    }
  };

  const updateField = (partial: Partial<Product>) => {
    setEditing((prev) => ({ ...prev, ...partial }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-slate">E-commerce</h1>
        {settings && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-sans text-muted">
              Store is {settings.enabled ? "enabled" : "disabled"}
            </span>
            <button
              onClick={handleToggleEnabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.enabled ? "bg-forest" : "bg-cream2"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-cream rounded-md p-1 w-fit">
        <button
          onClick={() => setActiveTab("products")}
          className={`px-4 py-2 rounded-md text-sm font-sans font-medium transition-colors ${
            activeTab === "products"
              ? "bg-white text-slate shadow-sm"
              : "text-muted hover:text-slate"
          }`}
        >
          Products ({products.length})
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-4 py-2 rounded-md text-sm font-sans font-medium transition-colors ${
            activeTab === "orders"
              ? "bg-white text-slate shadow-sm"
              : "text-muted hover:text-slate"
          }`}
        >
          Orders ({orders.length})
        </button>
      </div>

      {/* Products tab */}
      {activeTab === "products" && (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={openAddProduct}
              className="px-5 py-2.5 rounded-xl bg-forest text-white text-sm font-sans font-medium hover:bg-forest2 transition-colors"
            >
              + Add Product
            </button>
          </div>

          <div className="bg-white rounded-md border border-cream2 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-sans">
                <thead>
                  <tr className="border-b border-cream2 bg-cream/50">
                    <th className="text-left px-4 py-3 text-muted font-medium">Name</th>
                    <th className="text-left px-4 py-3 text-muted font-medium">Category</th>
                    <th className="text-left px-4 py-3 text-muted font-medium">Price</th>
                    <th className="text-left px-4 py-3 text-muted font-medium">Stock</th>
                    <th className="text-left px-4 py-3 text-muted font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-muted font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream2">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-muted">
                        No products yet.
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => (
                      <tr key={p.id} className="hover:bg-cream/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate">{p.name}</td>
                        <td className="px-4 py-3 text-muted">{p.category || "—"}</td>
                        <td className="px-4 py-3 text-slate">${p.price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-muted">{p.stock}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              p.is_active ? "bg-forest-lt text-forest" : "bg-cream2 text-muted"
                            }`}
                          >
                            {p.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => openEditProduct(p)}
                              className="text-forest hover:text-gold text-xs font-medium transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="text-red-400 hover:text-red-600 text-xs font-medium transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Orders tab */}
      {activeTab === "orders" && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="bg-white rounded-md border border-cream2 p-10 text-center">
              <p className="text-sm font-sans text-muted">No orders yet.</p>
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="bg-white rounded-md border border-cream2 p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-sans text-sm font-semibold text-slate">
                        {order.patient_name}
                      </h3>
                      <span className="text-xs font-sans text-muted">
                        #{order.id.slice(0, 8)}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {order.items.map((item, i) => (
                        <p key={i} className="text-sm font-sans text-muted">
                          {item.quantity}x {item.product_name} — ${item.price.toFixed(2)}
                        </p>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs font-sans text-muted">
                      <span className="font-medium text-slate">
                        Total: ${order.total.toFixed(2)}
                      </span>
                      <span>{new Date(order.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={order.status}
                      onChange={(e) => handleOrderStatus(order.id, e.target.value)}
                      className="px-3 py-1.5 rounded-md border border-cream2 text-xs font-sans text-slate bg-white focus:outline-none focus:ring-2 focus:ring-forest/30"
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Product slide-out panel */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setPanelOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-cream2 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-serif text-lg text-slate">
                {editId ? "Edit Product" : "Add Product"}
              </h2>
              <button
                onClick={() => setPanelOpen(false)}
                className="p-1 text-muted hover:text-slate transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Product Name</label>
                <input
                  type="text"
                  value={editing.name || ""}
                  onChange={(e) => updateField({ name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>

              <div>
                <label className="block text-sm font-sans text-slate mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editing.description || ""}
                  onChange={(e) => updateField({ description: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest resize-vertical"
                />
              </div>

              <div>
                <label className="block text-sm font-sans text-slate mb-1">Category</label>
                <input
                  type="text"
                  value={editing.category || ""}
                  onChange={(e) => updateField({ category: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                  placeholder="e.g. Oils, Powders, Tablets"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-sans text-slate mb-1">Price ($)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={editing.price ?? 0}
                    onChange={(e) => updateField({ price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                  />
                </div>
                <div>
                  <label className="block text-sm font-sans text-slate mb-1">Stock</label>
                  <input
                    type="number"
                    min={0}
                    value={editing.stock ?? 0}
                    onChange={(e) => updateField({ stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.is_active ?? true}
                  onChange={(e) => updateField({ is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-cream2 text-forest focus:ring-forest"
                />
                <span className="text-sm font-sans text-slate">Active (visible in store)</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveProduct}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-forest text-white text-sm font-sans font-medium hover:bg-forest2 transition-colors disabled:opacity-60"
                >
                  {saving ? "Saving..." : editId ? "Update Product" : "Add Product"}
                </button>
                <button
                  onClick={() => setPanelOpen(false)}
                  className="px-6 py-2.5 rounded-xl border border-cream2 text-sm font-sans text-slate hover:bg-cream transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
