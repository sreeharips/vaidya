"use client";

import { useEffect, useState } from "react";
import {
  getTreatments,
  createTreatment,
  updateTreatment,
  deleteTreatment,
  getDoctors,
  type Treatment,
  type Doctor,
} from "@/lib/admin-api";

const PRAKRITI_TAGS = ["Vata", "Pitta", "Kapha"];

type LangTab = "en" | "ml" | "ar";

const EMPTY_TREATMENT: Partial<Treatment> = {
  name: "",
  name_ml: "",
  name_ar: "",
  description: "",
  description_ml: "",
  prakriti_tags: [],
  duration_min_days: 7,
  duration_max_days: 21,
  price_per_day: 0,
  
  doctor_ids: [],
  is_active: true,
};

export default function TreatmentsPage() {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Treatment>>(EMPTY_TREATMENT);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [langTab, setLangTab] = useState<LangTab>("en");

  const load = async () => {
    try {
      const [t, d] = await Promise.all([getTreatments(), getDoctors()]);
      setTreatments(t);
      setDoctors(d);
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
    setEditing({ ...EMPTY_TREATMENT });
    setEditId(null);
    setLangTab("en");
    setPanelOpen(true);
  };

  const openEdit = (t: Treatment) => {
    setEditing({ ...t });
    setEditId(t.id);
    setLangTab("en");
    setPanelOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editId) {
        await updateTreatment(editId, editing);
      } else {
        await createTreatment(editing);
      }
      await load();
      setPanelOpen(false);
    } catch {
      alert("Failed to save treatment.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this treatment? This cannot be undone.")) return;
    try {
      await deleteTreatment(id);
      setTreatments((prev) => prev.filter((t) => t.id !== id));
    } catch {
      alert("Failed to delete treatment.");
    }
  };

  const updateField = (partial: Partial<Treatment>) => {
    setEditing((prev) => ({ ...prev, ...partial }));
  };

  const toggleTag = (tag: string) => {
    const arr = editing.prakriti_tags || [];
    const next = arr.includes(tag) ? arr.filter((t) => t !== tag) : [...arr, tag];
    updateField({ prakriti_tags: next });
  };

  const toggleDoctor = (docId: string) => {
    const arr = editing.doctor_ids || [];
    const next = arr.includes(docId) ? arr.filter((d) => d !== docId) : [...arr, docId];
    updateField({ doctor_ids: next });
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
        <h1 className="font-serif text-2xl text-slate">Treatments</h1>
        <button
          onClick={openAdd}
          className="px-5 py-2.5 rounded-xl bg-forest text-white text-sm font-sans font-medium hover:bg-forest2 transition-colors"
        >
          + Add Treatment
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-md border border-cream2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="border-b border-cream2 bg-cream/50">
                <th className="text-left px-4 py-3 text-muted font-medium">Name</th>
                <th className="text-left px-4 py-3 text-muted font-medium hidden md:table-cell">Duration</th>
                <th className="text-left px-4 py-3 text-muted font-medium hidden md:table-cell">Price Range</th>
                <th className="text-left px-4 py-3 text-muted font-medium hidden lg:table-cell">Prakriti Tags</th>
                <th className="text-left px-4 py-3 text-muted font-medium">Status</th>
                <th className="text-left px-4 py-3 text-muted font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream2">
              {treatments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    No treatments added yet.
                  </td>
                </tr>
              ) : (
                treatments.map((t) => (
                  <tr key={t.id} className="hover:bg-cream/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate">{t.name}</td>
                    <td className="px-4 py-3 text-muted hidden md:table-cell">
                      {t.duration_min_days}–{t.duration_max_days} days
                    </td>
                    <td className="px-4 py-3 text-muted hidden md:table-cell">
                      ${t.price_per_day} – ${t.price_per_day}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex gap-1">
                        {(t.prakriti_tags || []).map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 bg-gold-lt text-gold rounded text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          t.is_active ? "bg-forest-lt text-forest" : "bg-cream2 text-muted"
                        }`}
                      >
                        {t.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openEdit(t)}
                          className="text-forest hover:text-gold text-xs font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
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
                {editId ? "Edit Treatment" : "Add Treatment"}
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
              {/* Language tabs */}
              <div className="flex gap-2">
                {(["en", "ml", "ar"] as LangTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setLangTab(tab)}
                    className={`px-3 py-1.5 rounded-md text-xs font-sans font-medium transition-colors ${
                      langTab === tab ? "bg-forest text-white" : "bg-cream text-muted hover:bg-cream2"
                    }`}
                  >
                    {tab === "en" ? "English" : tab === "ml" ? "Malayalam" : "Arabic"}
                  </button>
                ))}
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">
                  Treatment Name ({langTab.toUpperCase()})
                </label>
                <input
                  type="text"
                  value={
                    langTab === "en"
                      ? editing.name || ""
                      : langTab === "ml"
                      ? editing.name_ml || ""
                      : editing.name_ar || ""
                  }
                  onChange={(e) =>
                    updateField(
                      langTab === "en"
                        ? { name: e.target.value }
                        : langTab === "ml"
                        ? { name_ml: e.target.value }
                        : { name_ar: e.target.value }
                    )
                  }
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">
                  Description ({langTab === "ar" ? "Arabic" : langTab === "ml" ? "Malayalam" : "English"})
                </label>
                <textarea
                  rows={4}
                  value={
                    langTab === "en"
                      ? editing.description || ""
                      : editing.description_ml || ""
                  }
                  onChange={(e) =>
                    updateField(
                      langTab === "en"
                        ? { description: e.target.value }
                        : { description_ml: e.target.value }
                    )
                  }
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest resize-vertical"
                />
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

              {/* Price range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-sans text-slate mb-1">Min Price ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={editing.price_per_day ?? 0}
                    onChange={(e) => updateField({ price_per_day: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                  />
                </div>
                <div>
                  <label className="block text-sm font-sans text-slate mb-1">Max Price ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={editing.price_per_day ?? 0}
                    onChange={(e) => updateField({ price_per_day: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                  />
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
                        (editing.prakriti_tags || []).includes(tag)
                          ? "bg-gold text-white"
                          : "bg-cream text-slate hover:bg-cream2"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={(editing.prakriti_tags || []).includes(tag)}
                        onChange={() => toggleTag(tag)}
                        className="sr-only"
                      />
                      {tag}
                    </label>
                  ))}
                </div>
              </div>

              {/* Doctors */}
              <div>
                <label className="block text-sm font-sans text-slate mb-2">Assigned Doctors</label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {doctors.map((doc) => (
                    <label
                      key={doc.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-cream cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={(editing.doctor_ids || []).includes(doc.id)}
                        onChange={() => toggleDoctor(doc.id)}
                        className="w-4 h-4 rounded border-cream2 text-forest focus:ring-forest"
                      />
                      <span className="text-sm font-sans text-slate">
                        {doc.name} — {doc.qualification}
                      </span>
                    </label>
                  ))}
                  {doctors.length === 0 && (
                    <p className="text-sm text-muted px-3">No doctors available. Add doctors first.</p>
                  )}
                </div>
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.is_active ?? true}
                  onChange={(e) => updateField({ is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-cream2 text-forest focus:ring-forest"
                />
                <span className="text-sm font-sans text-slate">Active (visible to patients)</span>
              </label>

              {/* Save */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-forest text-white text-sm font-sans font-medium hover:bg-forest2 transition-colors disabled:opacity-60"
                >
                  {saving ? "Saving..." : editId ? "Update Treatment" : "Add Treatment"}
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
