"use client";

import { useEffect, useState } from "react";
import {
  getRetreats,
  createRetreat,
  updateRetreat,
  deleteRetreat,
  type Retreat,
} from "@/lib/admin-api";

const RETREAT_TYPES = ["panchakarma", "wellness", "therapeutic", "rejuvenation"] as const;

const WELLNESS_CATEGORIES = [
  "detox-cleanse",
  "stress-relief",
  "pain-management",
  "weight-wellness",
  "skin-hair",
  "immunity-boost",
  "anti-aging",
  "digestive-health",
  "joint-mobility",
] as const;

const EMPTY_RETREAT: Partial<Retreat> = {
  name: "",
  name_display_en: "",
  description_en: "",
  package_type: "wellness",
  wellness_categories: [],
  duration_min_days: 7,
  duration_max_days: 21,
  price_usd: 0,
  price_inr: 0,
  includes_accommodation: false,
  includes_meals: false,
  includes_transfers: false,
  max_guests_per_slot: 1,
  is_active: true,
  display_order: 0,
};

export default function RetreatsPage() {
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Retreat>>(EMPTY_RETREAT);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await getRetreats();
      setRetreats(data);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditing({ ...EMPTY_RETREAT });
    setEditId(null);
    setPanelOpen(true);
  };

  const openEdit = (retreat: Retreat) => {
    setEditing({ ...retreat });
    setEditId(retreat.id);
    setPanelOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editId) {
        await updateRetreat(editId, editing);
      } else {
        await createRetreat(editing);
      }
      await load();
      setPanelOpen(false);
    } catch {
      alert("Failed to save retreat.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this retreat? This cannot be undone.")) return;
    try {
      await deleteRetreat(id);
      setRetreats((prev) => prev.filter((r) => r.id !== id));
    } catch {
      alert("Failed to delete retreat.");
    }
  };

  const handleToggleActive = async (retreat: Retreat) => {
    try {
      await updateRetreat(retreat.id, { is_active: !retreat.is_active });
      await load();
    } catch {
      alert("Failed to update retreat status.");
    }
  };

  const updateField = (partial: Partial<Retreat>) => {
    setEditing((prev) => ({ ...prev, ...partial }));
  };

  const toggleCategory = (cat: string) => {
    const arr = editing.wellness_categories || [];
    const next = arr.includes(cat) ? arr.filter((c) => c !== cat) : [...arr, cat];
    updateField({ wellness_categories: next });
  };

  const formatCategory = (cat: string) =>
    cat
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

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
        <h1 className="font-serif text-2xl text-slate">Retreats</h1>
        <button
          onClick={openAdd}
          className="px-5 py-2.5 rounded-xl bg-forest text-white text-sm font-sans font-medium hover:bg-forest2 transition-colors"
        >
          + Add Retreat
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-md border border-cream2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="border-b border-cream2 bg-cream/50">
                <th className="text-left px-4 py-3 text-muted font-medium">Name</th>
                <th className="text-left px-4 py-3 text-muted font-medium hidden md:table-cell">Type</th>
                <th className="text-left px-4 py-3 text-muted font-medium hidden md:table-cell">Duration</th>
                <th className="text-left px-4 py-3 text-muted font-medium hidden md:table-cell">Price (USD)</th>
                <th className="text-left px-4 py-3 text-muted font-medium hidden lg:table-cell">Includes</th>
                <th className="text-left px-4 py-3 text-muted font-medium hidden lg:table-cell">Categories</th>
                <th className="text-left px-4 py-3 text-muted font-medium">Status</th>
                <th className="text-left px-4 py-3 text-muted font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream2">
              {retreats.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted">
                    No retreats added yet.
                  </td>
                </tr>
              ) : (
                retreats.map((retreat) => (
                  <tr key={retreat.id} className="hover:bg-cream/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate">{retreat.name_display_en || retreat.name}</div>
                      {retreat.max_guests_per_slot > 1 && (
                        <div className="text-xs text-muted mt-0.5">
                          Up to {retreat.max_guests_per_slot} guests
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted hidden md:table-cell capitalize">
                      {retreat.package_type}
                    </td>
                    <td className="px-4 py-3 text-muted hidden md:table-cell">
                      {retreat.duration_min_days}–{retreat.duration_max_days} days
                    </td>
                    <td className="px-4 py-3 text-muted hidden md:table-cell">
                      ${retreat.price_usd}/night
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex gap-1.5">
                        {retreat.includes_accommodation && (
                          <span className="px-1.5 py-0.5 bg-forest-lt text-forest rounded text-xs">Stay</span>
                        )}
                        {retreat.includes_meals && (
                          <span className="px-1.5 py-0.5 bg-forest-lt text-forest rounded text-xs">Meals</span>
                        )}
                        {retreat.includes_transfers && (
                          <span className="px-1.5 py-0.5 bg-forest-lt text-forest rounded text-xs">Transfers</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(retreat.wellness_categories || []).slice(0, 2).map((cat) => (
                          <span key={cat} className="px-1.5 py-0.5 bg-gold-lt text-gold rounded text-xs">
                            {formatCategory(cat)}
                          </span>
                        ))}
                        {(retreat.wellness_categories || []).length > 2 && (
                          <span className="px-1.5 py-0.5 bg-cream2 text-muted rounded text-xs">
                            +{retreat.wellness_categories.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(retreat)}
                        className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                          retreat.is_active ? "bg-forest-lt text-forest" : "bg-cream2 text-muted"
                        }`}
                      >
                        {retreat.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openEdit(retreat)}
                          className="text-forest hover:text-gold text-xs font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(retreat.id)}
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

      {/* Slide-out panel */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setPanelOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-cream2 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-serif text-lg text-slate">
                {editId ? "Edit Retreat" : "Add Retreat"}
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
                <label className="block text-sm font-sans text-slate mb-1">Retreat Name</label>
                <input
                  type="text"
                  value={editing.name || ""}
                  onChange={(e) => updateField({ name: e.target.value })}
                  placeholder="Internal name (slug-friendly)"
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Display Name (EN)</label>
                <input
                  type="text"
                  value={editing.name_display_en || ""}
                  onChange={(e) => updateField({ name_display_en: e.target.value })}
                  placeholder="Name shown to guests"
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>

              {/* Retreat type */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Retreat Type</label>
                <select
                  value={editing.package_type || "wellness"}
                  onChange={(e) => updateField({ package_type: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                >
                  {RETREAT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Wellness categories */}
              <div>
                <label className="block text-sm font-sans text-slate mb-2">Wellness Categories</label>
                <div className="flex flex-wrap gap-2">
                  {WELLNESS_CATEGORIES.map((cat) => (
                    <label
                      key={cat}
                      className={`flex items-center px-3 py-1.5 rounded-md text-xs font-sans cursor-pointer transition-colors ${
                        (editing.wellness_categories || []).includes(cat)
                          ? "bg-gold text-white"
                          : "bg-cream text-slate hover:bg-cream2"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={(editing.wellness_categories || []).includes(cat)}
                        onChange={() => toggleCategory(cat)}
                        className="sr-only"
                      />
                      {formatCategory(cat)}
                    </label>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-sans text-slate mb-1">Min Duration (days)</label>
                  <input
                    type="number"
                    min={1}
                    value={editing.duration_min_days ?? 7}
                    onChange={(e) => updateField({ duration_min_days: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                  />
                </div>
                <div>
                  <label className="block text-sm font-sans text-slate mb-1">Max Duration (days)</label>
                  <input
                    type="number"
                    min={1}
                    value={editing.duration_max_days ?? 21}
                    onChange={(e) => updateField({ duration_max_days: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                  />
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-sans text-slate mb-1">Price USD / night</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={editing.price_usd ?? 0}
                    onChange={(e) => updateField({ price_usd: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                  />
                </div>
                <div>
                  <label className="block text-sm font-sans text-slate mb-1">
                    Price INR / night <span className="text-muted">(optional)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={editing.price_inr ?? 0}
                    onChange={(e) => updateField({ price_inr: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                  />
                </div>
              </div>

              {/* Includes checkboxes */}
              <div>
                <label className="block text-sm font-sans text-slate mb-2">Includes</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editing.includes_accommodation ?? false}
                      onChange={(e) => updateField({ includes_accommodation: e.target.checked })}
                      className="w-4 h-4 rounded border-cream2 text-forest focus:ring-forest"
                    />
                    <span className="text-sm font-sans text-slate">Accommodation</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editing.includes_meals ?? false}
                      onChange={(e) => updateField({ includes_meals: e.target.checked })}
                      className="w-4 h-4 rounded border-cream2 text-forest focus:ring-forest"
                    />
                    <span className="text-sm font-sans text-slate">Meals</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editing.includes_transfers ?? false}
                      onChange={(e) => updateField({ includes_transfers: e.target.checked })}
                      className="w-4 h-4 rounded border-cream2 text-forest focus:ring-forest"
                    />
                    <span className="text-sm font-sans text-slate">Transfers</span>
                  </label>
                </div>
              </div>

              {/* Max guests */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Max Guests per Slot</label>
                <input
                  type="number"
                  min={1}
                  value={editing.max_guests_per_slot ?? 1}
                  onChange={(e) => updateField({ max_guests_per_slot: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Description (EN)</label>
                <textarea
                  rows={4}
                  value={editing.description_en || ""}
                  onChange={(e) => updateField({ description_en: e.target.value })}
                  placeholder="Describe what this retreat includes..."
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest resize-vertical"
                />
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.is_active ?? true}
                  onChange={(e) => updateField({ is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-cream2 text-forest focus:ring-forest"
                />
                <span className="text-sm font-sans text-slate">Active (visible to guests)</span>
              </label>

              {/* Save */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-forest text-white text-sm font-sans font-medium hover:bg-forest2 transition-colors disabled:opacity-60"
                >
                  {saving ? "Saving..." : editId ? "Update Retreat" : "Add Retreat"}
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
