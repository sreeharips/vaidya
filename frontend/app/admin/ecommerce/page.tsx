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
  type EcommerceSettings,
  type Product,
  type Order,
} from "@/lib/admin-api";

const CATEGORIES = ["oil", "powder", "tablet", "capsule", "syrup", "ghee", "choornam", "kashayam", "other"];
const PRAKRITI_TAGS = ["Vata", "Pitta", "Kapha"];
type ActiveTab = "products" | "orders";

interface VariantDraft {
  id?: string;
  label: string;
  sku: string;
  price: number;
  stock_qty: number;
  weight_grams: number | null;
}

interface ProductDraft {
  name: string;
  description: string;
  category: string;
  prakriti_tags: string[];
  base_price: number | null;
  currency: string;
  is_gmp_certified: boolean;
  is_active: boolean;
  variants: VariantDraft[];
}

const EMPTY_DRAFT: ProductDraft = {
  name: "",
  description: "",
  category: "other",
  prakriti_tags: [],
  base_price: null,
  currency: "INR",
  is_gmp_certified: false,
  is_active: true,
  variants: [],
};

const EMPTY_VARIANT: VariantDraft = {
  label: "",
  sku: "",
  price: 0,
  stock_qty: 0,
  weight_grams: null,
};

export default function EcommercePage() {
  const [settings, setSettings] = useState<EcommerceSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("products");
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>(EMPTY_DRAFT);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [s, p, o] = await Promise.all([
        getEcommerceSettings(),
        getProducts(),
        getOrders(),
      ]);
      setSettings(s);
      setProducts(p);
      setOrders(o);
    } catch {
      // handled
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleToggleEnabled = async () => {
    if (!settings) return;
    try {
      const updated = await updateEcommerceSettings({ ecommerce_enabled: !settings.ecommerce_enabled });
      setSettings(updated);
    } catch {
      alert("Failed to update settings.");
    }
  };

  const openAddProduct = () => {
    setDraft({ ...EMPTY_DRAFT, variants: [] });
    setEditId(null);
    setPanelOpen(true);
  };

  const openEditProduct = (p: Product) => {
    setDraft({
      name: p.name,
      description: p.description || "",
      category: p.category || "other",
      prakriti_tags: p.prakriti_tags,
      base_price: p.base_price,
      currency: p.currency,
      is_gmp_certified: p.is_gmp_certified,
      is_active: p.is_active,
      variants: p.variants.map((v) => ({
        id: v.id,
        label: v.label,
        sku: v.sku || "",
        price: v.price,
        stock_qty: v.stock_qty,
        weight_grams: v.weight_grams,
      })),
    });
    setEditId(p.id);
    setPanelOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!draft.name.trim()) { alert("Product name is required."); return; }
    setSaving(true);
    try {
      const payload = {
        name: draft.name,
        description: draft.description || null,
        category: draft.category,
        prakriti_tags: draft.prakriti_tags,
        base_price: draft.base_price,
        currency: draft.currency,
        is_gmp_certified: draft.is_gmp_certified,
        is_active: draft.is_active,
        variants: draft.variants.map((v) => ({
          label: v.label,
          sku: v.sku || null,
          price: v.price,
          stock_qty: v.stock_qty,
          weight_grams: v.weight_grams,
        })),
      };
      if (editId) {
        await updateProduct(editId, payload);
      } else {
        await createProduct(payload);
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
    if (!confirm("Deactivate this product? It will be hidden from the public store.")) return;
    try {
      await deleteProduct(id);
      setProducts((prev) => prev.map((p) => p.id === id ? { ...p, is_active: false } : p));
    } catch {
      alert("Failed to delete product.");
    }
  };

  const upd = (partial: Partial<ProductDraft>) =>
    setDraft((prev) => ({ ...prev, ...partial }));

  const togglePrakriti = (tag: string) => {
    const arr = draft.prakriti_tags;
    upd({ prakriti_tags: arr.includes(tag) ? arr.filter((t) => t !== tag) : [...arr, tag] });
  };

  const addVariant = () =>
    upd({ variants: [...draft.variants, { ...EMPTY_VARIANT }] });

  const removeVariant = (idx: number) =>
    upd({ variants: draft.variants.filter((_, i) => i !== idx) });

  const updVariant = (idx: number, partial: Partial<VariantDraft>) =>
    upd({
      variants: draft.variants.map((v, i) => i === idx ? { ...v, ...partial } : v),
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-slate">Herbal Products</h1>
        {settings && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-sans text-muted">
              Store {settings.ecommerce_enabled ? "enabled" : "disabled"}
            </span>
            <button
              onClick={handleToggleEnabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.ecommerce_enabled ? "bg-forest" : "bg-cream2"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.ecommerce_enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-cream rounded-md p-1 w-fit">
        {(["products", "orders"] as ActiveTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-sans font-medium capitalize transition-colors ${
              activeTab === t ? "bg-white text-slate shadow-sm" : "text-muted hover:text-slate"
            }`}
          >
            {t === "products" ? `Products (${products.length})` : `Orders (${orders.length})`}
          </button>
        ))}
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
                    <th className="text-left px-4 py-3 text-muted font-medium hidden md:table-cell">Category</th>
                    <th className="text-left px-4 py-3 text-muted font-medium">Base Price</th>
                    <th className="text-left px-4 py-3 text-muted font-medium hidden md:table-cell">Variants</th>
                    <th className="text-left px-4 py-3 text-muted font-medium hidden md:table-cell">GMP</th>
                    <th className="text-left px-4 py-3 text-muted font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream2">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted">
                        No products yet. Add your first herbal product.
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => (
                      <tr key={p.id} className="hover:bg-cream/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate">{p.name}</div>
                          {p.prakriti_tags.length > 0 && (
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              {p.prakriti_tags.map((tag) => (
                                <span key={tag} className="text-[10px] font-sans text-gold">{tag}</span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted hidden md:table-cell capitalize">
                          {p.category || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate">
                          {p.base_price != null
                            ? `${p.currency} ${p.base_price.toFixed(2)}`
                            : p.variants.length > 0
                            ? `from ${p.currency} ${Math.min(...p.variants.map((v) => v.price)).toFixed(2)}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted hidden md:table-cell">
                          {p.variants.length > 0 ? `${p.variants.length} variants` : "—"}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {p.is_gmp_certified ? (
                            <span className="text-xs text-forest font-medium">GMP</span>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>
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
                              Hide
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
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="text-sm font-sans font-medium text-slate">
                        Order #{order.id.slice(-8).toUpperCase()}
                      </p>
                      <span
                        className={`px-2.5 py-1 rounded-md text-xs font-sans font-medium capitalize ${
                          order.status === "delivered"
                            ? "bg-forest-lt text-forest"
                            : order.status === "cancelled"
                            ? "bg-red-50 text-red-500"
                            : "bg-gold-lt text-gold"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {order.items.map((item, i) => (
                        <p key={i} className="text-xs font-sans text-muted">
                          {item.product_name} × {item.quantity} — {order.currency} {item.price.toFixed(2)}
                        </p>
                      ))}
                    </div>
                    <p className="text-xs font-sans text-muted mt-2">
                      Total: <span className="text-slate font-medium">{order.currency} {order.total_amount.toFixed(2)}</span>
                      <span className="ml-3">{new Date(order.ordered_at).toLocaleDateString()}</span>
                    </p>
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

              {/* Name */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Product Name *</label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => upd({ name: e.target.value })}
                  placeholder="e.g. Dhanwantharam Thailam"
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Description</label>
                <textarea
                  rows={3}
                  value={draft.description}
                  onChange={(e) => upd({ description: e.target.value })}
                  placeholder="Benefits, ingredients, usage..."
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest resize-vertical"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Category</label>
                <select
                  value={draft.category}
                  onChange={(e) => upd({ category: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate bg-white focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} className="capitalize">
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Base price + currency */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-sans text-slate mb-1">Base Price</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={draft.base_price ?? ""}
                    onChange={(e) => upd({ base_price: parseFloat(e.target.value) || null })}
                    placeholder="—"
                    className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                  />
                </div>
                <div>
                  <label className="block text-sm font-sans text-slate mb-1">Currency</label>
                  <select
                    value={draft.currency}
                    onChange={(e) => upd({ currency: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate bg-white focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              {/* Prakriti tags */}
              <div>
                <label className="block text-sm font-sans text-slate mb-2">Prakriti Tags</label>
                <div className="flex gap-3">
                  {PRAKRITI_TAGS.map((tag) => (
                    <label
                      key={tag}
                      className={`flex items-center px-4 py-2 rounded-md text-sm font-sans cursor-pointer transition-colors ${
                        draft.prakriti_tags.includes(tag)
                          ? "bg-gold text-white"
                          : "bg-cream text-slate hover:bg-cream2"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={draft.prakriti_tags.includes(tag)}
                        onChange={() => togglePrakriti(tag)}
                        className="sr-only"
                      />
                      {tag}
                    </label>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                {[
                  { field: "is_active" as const, label: "Active (visible in store)" },
                  { field: "is_gmp_certified" as const, label: "GMP Certified" },
                ].map(({ field, label }) => (
                  <label key={field} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!draft[field]}
                      onChange={(e) => upd({ [field]: e.target.checked })}
                      className="w-4 h-4 rounded border-cream2 text-forest focus:ring-forest"
                    />
                    <span className="text-sm font-sans text-slate">{label}</span>
                  </label>
                ))}
              </div>

              {/* Variants */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-sans font-medium text-slate">
                    Variants
                    <span className="ml-1 text-xs font-normal text-muted">(sizes, quantities, etc.)</span>
                  </label>
                  <button
                    onClick={addVariant}
                    className="text-xs font-sans text-forest hover:text-gold font-medium transition-colors"
                  >
                    + Add Variant
                  </button>
                </div>

                {draft.variants.length === 0 ? (
                  <p className="text-xs font-sans text-muted italic">
                    No variants — base price applies to the whole product.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {draft.variants.map((v, idx) => (
                      <div key={idx} className="border border-cream2 rounded-md p-4 space-y-3 bg-cream/30">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-sans font-medium text-slate">Variant {idx + 1}</span>
                          <button
                            onClick={() => removeVariant(idx)}
                            className="text-xs text-red-400 hover:text-red-600 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-sans text-muted mb-1">Label *</label>
                            <input
                              type="text"
                              value={v.label}
                              onChange={(e) => updVariant(idx, { label: e.target.value })}
                              placeholder="e.g. 200ml, 500g"
                              className="w-full px-3 py-2 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-sans text-muted mb-1">SKU</label>
                            <input
                              type="text"
                              value={v.sku}
                              onChange={(e) => updVariant(idx, { sku: e.target.value })}
                              placeholder="optional"
                              className="w-full px-3 py-2 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-sans text-muted mb-1">Price ({draft.currency})</label>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={v.price}
                              onChange={(e) => updVariant(idx, { price: parseFloat(e.target.value) || 0 })}
                              className="w-full px-3 py-2 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-sans text-muted mb-1">Stock</label>
                            <input
                              type="number"
                              min={0}
                              value={v.stock_qty}
                              onChange={(e) => updVariant(idx, { stock_qty: parseInt(e.target.value) || 0 })}
                              className="w-full px-3 py-2 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-sans text-muted mb-1">Weight (grams, optional)</label>
                          <input
                            type="number"
                            min={0}
                            value={v.weight_grams ?? ""}
                            onChange={(e) => updVariant(idx, { weight_grams: parseInt(e.target.value) || null })}
                            placeholder="—"
                            className="w-full px-3 py-2 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Save */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveProduct}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-forest text-white text-sm font-sans font-medium hover:bg-forest2 transition-colors disabled:opacity-60"
                >
                  {saving ? "Saving…" : editId ? "Update Product" : "Add Product"}
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
