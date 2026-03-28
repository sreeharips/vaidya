"use client";

import { useEffect, useState } from "react";
import {
  getRetreats,
  createRetreat,
  updateRetreat,
  deleteRetreat,
  type Retreat,
} from "@/lib/admin-api";

const PACKAGE_TYPES = ["panchakarma", "wellness", "therapeutic", "rejuvenation", "retreat", "detox"] as const;

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

const PRAKRITI_OPTIONS = ["vata", "pitta", "kapha"] as const;
const LANGUAGE_OPTIONS = ["English", "Malayalam", "Hindi", "Arabic", "German", "French"] as const;

const EMPTY: Partial<Retreat> = {
  name: "",
  name_display_en: "",
  description_en: "",
  package_type: "wellness",
  wellness_categories: [],
  duration_min_days: 7,
  duration_max_days: 21,
  price_usd: 0,
  price_inr: undefined,
  includes_accommodation: false,
  includes_meals: false,
  includes_transfers: false,
  max_guests_per_slot: 1,
  what_to_expect: "",
  contraindications: "",
  highlights: [],
  treatments_included: [],
  ideal_for: [],
  prakriti_tags: [],
  photos: [],
  daily_schedule: "",
  cancellation_policy: "",
  language_of_instruction: [],
  min_age: undefined,
  is_active: true,
  display_order: 0,
};

// Helpers: convert array ↔ textarea (one item per line)
const toLines = (arr: string[] | null | undefined) => (arr ?? []).join("\n");
const fromLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

function formatCategory(cat: string) {
  return cat.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// Reusable label style
const labelCls = "block text-xs font-sans font-semibold uppercase tracking-wide text-muted mb-1.5";
const inputCls = "w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest";
const textareaCls = `${inputCls} resize-vertical`;

export default function PackagesPage() {
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Retreat>>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Textarea state for array fields (kept as string, converted on save)
  const [highlightsText, setHighlightsText] = useState("");
  const [treatmentsText, setTreatmentsText] = useState("");
  const [idealForText, setIdealForText] = useState("");
  const [photosText, setPhotosText] = useState("");

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

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing({ ...EMPTY });
    setEditId(null);
    setHighlightsText(""); setTreatmentsText(""); setIdealForText(""); setPhotosText("");
    setPanelOpen(true);
  };

  const openEdit = (r: Retreat) => {
    setEditing({ ...r });
    setEditId(r.id);
    setHighlightsText(toLines(r.highlights));
    setTreatmentsText(toLines(r.treatments_included));
    setIdealForText(toLines(r.ideal_for));
    setPhotosText(toLines(r.photos));
    setPanelOpen(true);
  };

  const field = (partial: Partial<Retreat>) => setEditing((p) => ({ ...p, ...partial }));

  const toggleArr = (key: keyof Retreat, val: string) => {
    const arr = (editing[key] as string[]) ?? [];
    field({ [key]: arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val] });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...editing,
        highlights: fromLines(highlightsText),
        treatments_included: fromLines(treatmentsText),
        ideal_for: fromLines(idealForText),
        photos: fromLines(photosText),
      };
      if (editId) {
        await updateRetreat(editId, payload);
      } else {
        await createRetreat(payload);
      }
      await load();
      setPanelOpen(false);
    } catch {
      alert("Failed to save retreat.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Archive this retreat? It will be hidden from patients.")) return;
    try {
      await deleteRetreat(id);
      setRetreats((prev) => prev.filter((r) => r.id !== id));
    } catch {
      alert("Failed to delete retreat.");
    }
  };

  const handleToggleActive = async (r: Retreat) => {
    try {
      await updateRetreat(r.id, { is_active: !r.is_active });
      await load();
    } catch {
      alert("Failed to update status.");
    }
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
                <th className="text-left px-4 py-3 text-muted font-medium hidden md:table-cell">Price</th>
                <th className="text-left px-4 py-3 text-muted font-medium hidden lg:table-cell">Includes</th>
                <th className="text-left px-4 py-3 text-muted font-medium hidden lg:table-cell">Prakriti</th>
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
                retreats.map((r) => (
                  <tr key={r.id} className="hover:bg-cream/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate">{r.name_display_en || r.name}</div>
                      {r.max_guests_per_slot > 1 && (
                        <div className="text-xs text-muted mt-0.5">Up to {r.max_guests_per_slot} guests</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted hidden md:table-cell capitalize">{r.package_type}</td>
                    <td className="px-4 py-3 text-muted hidden md:table-cell">
                      {r.duration_min_days}–{r.duration_max_days} days
                    </td>
                    <td className="px-4 py-3 text-muted hidden md:table-cell">
                      ${r.price_usd?.toLocaleString()}
                      {r.price_inr && <span className="text-xs ml-1">/ ₹{r.price_inr.toLocaleString()}</span>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex gap-1.5 flex-wrap">
                        {r.includes_accommodation && <span className="px-1.5 py-0.5 bg-forest-lt text-forest rounded text-xs">Stay</span>}
                        {r.includes_meals && <span className="px-1.5 py-0.5 bg-forest-lt text-forest rounded text-xs">Meals</span>}
                        {r.includes_transfers && <span className="px-1.5 py-0.5 bg-forest-lt text-forest rounded text-xs">Transfers</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex gap-1 flex-wrap">
                        {(r.prakriti_tags ?? []).map((t) => (
                          <span key={t} className="px-1.5 py-0.5 bg-gold-lt text-gold rounded text-xs capitalize">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(r)}
                        className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                          r.is_active ? "bg-forest-lt text-forest" : "bg-cream2 text-muted"
                        }`}
                      >
                        {r.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => openEdit(r)} className="text-forest hover:text-gold text-xs font-medium transition-colors">Edit</button>
                        <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-600 text-xs font-medium transition-colors">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out edit panel */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setPanelOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-cream2 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-serif text-lg text-slate">{editId ? "Edit Retreat" : "Add Retreat"}</h2>
              <button onClick={() => setPanelOpen(false)} className="p-1 text-muted hover:text-slate transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">

              {/* ── Core identity ───────────────────────────────────── */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted border-b border-cream2 pb-2">Basic info</h3>

                <div>
                  <label className={labelCls}>Internal name</label>
                  <input type="text" value={editing.name || ""} onChange={(e) => field({ name: e.target.value })} placeholder="panchakarma-14-day" className={inputCls} />
                </div>

                <div>
                  <label className={labelCls}>Display name (EN)</label>
                  <input type="text" value={editing.name_display_en || ""} onChange={(e) => field({ name_display_en: e.target.value })} placeholder="14-Day Panchakarma Detox" className={inputCls} />
                </div>

                <div>
                  <label className={labelCls}>Retreat type</label>
                  <select value={editing.package_type || "wellness"} onChange={(e) => field({ package_type: e.target.value })} className={inputCls}>
                    {PACKAGE_TYPES.map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Min duration (days)</label>
                    <input type="number" min={1} value={editing.duration_min_days ?? 7} onChange={(e) => field({ duration_min_days: parseInt(e.target.value) || 1 })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Max duration (days)</label>
                    <input type="number" min={1} value={editing.duration_max_days ?? 21} onChange={(e) => field({ duration_max_days: parseInt(e.target.value) || 1 })} className={inputCls} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Price (USD)</label>
                    <input type="number" min={0} step={1} value={editing.price_usd ?? ""} onChange={(e) => field({ price_usd: parseFloat(e.target.value) || 0 })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Price (INR) <span className="normal-case font-normal">optional</span></label>
                    <input type="number" min={0} step={1} value={editing.price_inr ?? ""} onChange={(e) => field({ price_inr: parseFloat(e.target.value) || undefined })} className={inputCls} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Max guests / slot</label>
                    <input type="number" min={1} value={editing.max_guests_per_slot ?? 1} onChange={(e) => field({ max_guests_per_slot: parseInt(e.target.value) || 1 })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Min age <span className="normal-case font-normal">optional</span></label>
                    <input type="number" min={1} value={editing.min_age ?? ""} onChange={(e) => field({ min_age: parseInt(e.target.value) || undefined })} className={inputCls} />
                  </div>
                </div>
              </div>

              {/* ── Includes ────────────────────────────────────────── */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted border-b border-cream2 pb-2">What&apos;s included</h3>
                {([
                  ["includes_accommodation", "Accommodation"],
                  ["includes_meals", "Meals"],
                  ["includes_transfers", "Transfers"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={!!(editing[key])} onChange={(e) => field({ [key]: e.target.checked })} className="w-4 h-4 rounded border-cream2 text-forest focus:ring-forest" />
                    <span className="text-sm font-sans text-slate">{label}</span>
                  </label>
                ))}
              </div>

              {/* ── Wellness categories ─────────────────────────────── */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted border-b border-cream2 pb-2 mb-3">Wellness categories</h3>
                <div className="flex flex-wrap gap-2">
                  {WELLNESS_CATEGORIES.map((cat) => {
                    const active = (editing.wellness_categories ?? []).includes(cat);
                    return (
                      <label key={cat} className={`flex items-center px-3 py-1.5 rounded-md text-xs font-sans cursor-pointer transition-colors ${active ? "bg-gold text-white" : "bg-cream text-slate hover:bg-cream2"}`}>
                        <input type="checkbox" checked={active} onChange={() => toggleArr("wellness_categories", cat)} className="sr-only" />
                        {formatCategory(cat)}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* ── Prakriti compatibility ──────────────────────────── */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted border-b border-cream2 pb-2 mb-3">Prakriti compatibility</h3>
                <div className="flex gap-3">
                  {PRAKRITI_OPTIONS.map((p) => {
                    const active = (editing.prakriti_tags ?? []).includes(p);
                    const colors: Record<string, string> = { vata: "bg-blue-50 text-blue-700 border-blue-200", pitta: "bg-red-50 text-red-700 border-red-200", kapha: "bg-green-50 text-green-700 border-green-200" };
                    return (
                      <label key={p} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-sans cursor-pointer border transition-all ${active ? colors[p] + " font-semibold" : "bg-cream border-cream2 text-muted"}`}>
                        <input type="checkbox" checked={active} onChange={() => toggleArr("prakriti_tags", p)} className="sr-only" />
                        <span className="capitalize">{p}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* ── Language of instruction ─────────────────────────── */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted border-b border-cream2 pb-2 mb-3">Language of instruction</h3>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGE_OPTIONS.map((lang) => {
                    const active = (editing.language_of_instruction ?? []).includes(lang);
                    return (
                      <label key={lang} className={`flex items-center px-3 py-1.5 rounded-md text-xs font-sans cursor-pointer transition-colors ${active ? "bg-forest text-white" : "bg-cream text-slate hover:bg-cream2"}`}>
                        <input type="checkbox" checked={active} onChange={() => toggleArr("language_of_instruction", lang)} className="sr-only" />
                        {lang}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* ── Content fields ──────────────────────────────────── */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted border-b border-cream2 pb-2">Content</h3>

                <div>
                  <label className={labelCls}>Description (EN)</label>
                  <textarea rows={3} value={editing.description_en || ""} onChange={(e) => field({ description_en: e.target.value })} placeholder="Overview shown at the top of the retreat page." className={textareaCls} />
                </div>

                <div>
                  <label className={labelCls}>Highlights <span className="normal-case font-normal text-muted">— one per line</span></label>
                  <textarea rows={4} value={highlightsText} onChange={(e) => setHighlightsText(e.target.value)} placeholder={"Daily Abhyanga massage\nPanchakarma cleanse program\nPivate vaidya consultations"} className={textareaCls} />
                </div>

                <div>
                  <label className={labelCls}>What to expect</label>
                  <textarea rows={3} value={editing.what_to_expect || ""} onChange={(e) => field({ what_to_expect: e.target.value })} placeholder="Describe the day-by-day experience..." className={textareaCls} />
                </div>

                <div>
                  <label className={labelCls}>A typical day</label>
                  <textarea rows={4} value={editing.daily_schedule || ""} onChange={(e) => field({ daily_schedule: e.target.value })} placeholder={"06:00 Yoga & pranayama\n08:00 Abhyanga massage\n09:30 Herbal breakfast\n..."} className={textareaCls} />
                </div>

                <div>
                  <label className={labelCls}>Treatments included <span className="normal-case font-normal text-muted">— one per line</span></label>
                  <textarea rows={4} value={treatmentsText} onChange={(e) => setTreatmentsText(e.target.value)} placeholder={"Abhyanga\nShirodhara\nVirechana\nNasya"} className={textareaCls} />
                </div>

                <div>
                  <label className={labelCls}>Ideal for <span className="normal-case font-normal text-muted">— one per line</span></label>
                  <textarea rows={3} value={idealForText} onChange={(e) => setIdealForText(e.target.value)} placeholder={"Chronic stress\nPost-illness recovery\nWeight management"} className={textareaCls} />
                </div>

                <div>
                  <label className={labelCls}>Contraindications</label>
                  <textarea rows={2} value={editing.contraindications || ""} onChange={(e) => field({ contraindications: e.target.value })} placeholder="Not suitable for pregnant women or those with..." className={textareaCls} />
                </div>

                <div>
                  <label className={labelCls}>Cancellation policy</label>
                  <textarea rows={2} value={editing.cancellation_policy || ""} onChange={(e) => field({ cancellation_policy: e.target.value })} placeholder="Free cancellation up to 14 days before check-in..." className={textareaCls} />
                </div>

                <div>
                  <label className={labelCls}>Photo URLs <span className="normal-case font-normal text-muted">— one URL per line</span></label>
                  <textarea rows={3} value={photosText} onChange={(e) => setPhotosText(e.target.value)} placeholder={"https://example.com/photo1.jpg\nhttps://example.com/photo2.jpg"} className={textareaCls} />
                </div>
              </div>

              {/* ── Display ─────────────────────────────────────────── */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted border-b border-cream2 pb-2">Display</h3>

                <div>
                  <label className={labelCls}>Display order <span className="normal-case font-normal">(lower = first)</span></label>
                  <input type="number" min={0} value={editing.display_order ?? 0} onChange={(e) => field({ display_order: parseInt(e.target.value) || 0 })} className={inputCls} />
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => field({ is_active: e.target.checked })} className="w-4 h-4 rounded border-cream2 text-forest focus:ring-forest" />
                  <span className="text-sm font-sans text-slate">Active (visible to patients)</span>
                </label>
              </div>

              {/* ── Actions ─────────────────────────────────────────── */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-forest text-white text-sm font-sans font-medium hover:bg-forest2 transition-colors disabled:opacity-60"
                >
                  {saving ? "Saving…" : editId ? "Update retreat" : "Add retreat"}
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
