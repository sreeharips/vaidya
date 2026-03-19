"use client";

import { useEffect, useState } from "react";
import {
  getDoctors,
  createDoctor,
  updateDoctor,
  toggleDoctorActive,
  type Doctor,
} from "@/lib/admin-api";

const QUALIFICATIONS = ["BAMS", "MD (Ayurveda)", "PhD (Ayurveda)", "BAMS + MD"];
const SPECIALISATIONS = [
  "Panchakarma",
  "Abhyanga",
  "Shirodhara",
  "Pizhichil",
  "Njavarakizhi",
  "Elakizhi",
  "Kati Basti",
  "Nasya",
  "Virechana",
  "Basti",
  "Udvartana",
  "Takradhara",
  "Rasayana",
  "Lepa",
  "General Ayurveda",
  "Marma Therapy",
  "Yoga Therapy",
];
const LANGUAGES = ["English", "Malayalam", "Hindi", "Arabic", "German", "French"];
const PRAKRITI_OPTIONS = ["Vata", "Pitta", "Kapha"];

type LangTab = "en" | "ml" | "ar";

const EMPTY_DOCTOR: Partial<Doctor> = {
  name: "",
  name_ml: "",
  name_ar: "",
  qualification: "BAMS",
  years_exp: 0,
  bio: "",
  bio_ml: "",
  specialisations: [],
  prakriti_affinities: [],
  languages: [],
  gender: "male",
  consultation_fee_usd: 0,
  is_active: true,
};

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Doctor>>(EMPTY_DOCTOR);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [langTab, setLangTab] = useState<LangTab>("en");

  const load = async () => {
    try {
      const data = await getDoctors();
      setDoctors(data);
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
    setEditing({ ...EMPTY_DOCTOR });
    setEditId(null);
    setLangTab("en");
    setPanelOpen(true);
  };

  const openEdit = (doc: Doctor) => {
    setEditing({ ...doc });
    setEditId(doc.id);
    setLangTab("en");
    setPanelOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editId) {
        await updateDoctor(editId, editing);
      } else {
        await createDoctor(editing);
      }
      await load();
      setPanelOpen(false);
    } catch {
      alert("Failed to save doctor.");
    }
    setSaving(false);
  };

  const handleToggleActive = async (doc: Doctor) => {
    try {
      await toggleDoctorActive(doc.id, !doc.is_active);
      setDoctors((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, is_active: !d.is_active } : d))
      );
    } catch {
      // silently fail
    }
  };

  const updateField = (partial: Partial<Doctor>) => {
    setEditing((prev) => ({ ...prev, ...partial }));
  };

  const toggleArrayField = (field: "specialisations" | "prakriti_affinities" | "languages", item: string) => {
    const arr = (editing[field] as string[]) || [];
    const next = arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
    updateField({ [field]: next });
  };

  const tierBadge = (tier: number) => {
    if (tier === 2) return <span className="px-2 py-0.5 rounded text-xs font-sans bg-gold text-white">Tier 2</span>;
    return <span className="px-2 py-0.5 rounded text-xs font-sans bg-forest-lt text-forest">Tier 1</span>;
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
        <h1 className="font-serif text-2xl text-slate">Doctors</h1>
        <button
          onClick={openAdd}
          className="px-5 py-2.5 rounded-xl bg-forest text-white text-sm font-sans font-medium hover:bg-forest2 transition-colors"
        >
          + Add Doctor
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-md border border-cream2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="border-b border-cream2 bg-cream/50">
                <th className="text-left px-4 py-3 text-muted font-medium">Name</th>
                <th className="text-left px-4 py-3 text-muted font-medium">Qualification</th>
                <th className="text-left px-4 py-3 text-muted font-medium hidden md:table-cell">
                  Specialisations
                </th>
                <th className="text-left px-4 py-3 text-muted font-medium hidden lg:table-cell">
                  Languages
                </th>
                <th className="text-left px-4 py-3 text-muted font-medium">Tier</th>
                <th className="text-left px-4 py-3 text-muted font-medium">Active</th>
                <th className="text-left px-4 py-3 text-muted font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream2">
              {doctors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted">
                    No doctors added yet.
                  </td>
                </tr>
              ) : (
                doctors.map((doc) => (
                  <tr key={doc.id} className="hover:bg-cream/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate">{doc.name}</td>
                    <td className="px-4 py-3 text-muted">{doc.qualification}</td>
                    <td className="px-4 py-3 text-muted hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(doc.specialisations || []).slice(0, 3).map((s) => (
                          <span key={s} className="px-1.5 py-0.5 bg-cream rounded text-xs">
                            {s}
                          </span>
                        ))}
                        {(doc.specialisations || []).length > 3 && (
                          <span className="text-xs text-muted">
                            +{doc.specialisations.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted hidden lg:table-cell">
                      {(doc.languages || []).join(", ")}
                    </td>
                    <td className="px-4 py-3">{tierBadge(doc.tier)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(doc)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          doc.is_active ? "bg-forest" : "bg-cream2"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            doc.is_active ? "translate-x-4" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openEdit(doc)}
                        className="text-forest hover:text-gold text-xs font-medium transition-colors"
                      >
                        Edit
                      </button>
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
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setPanelOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-cream2 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-serif text-lg text-slate">
                {editId ? "Edit Doctor" : "Add Doctor"}
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
                {(["en", "ml", "ar"] as LangTab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setLangTab(t)}
                    className={`px-3 py-1.5 rounded-md text-xs font-sans font-medium transition-colors ${
                      langTab === t
                        ? "bg-forest text-white"
                        : "bg-cream text-muted hover:bg-cream2"
                    }`}
                  >
                    {t === "en" ? "English" : t === "ml" ? "Malayalam" : "Arabic"}
                  </button>
                ))}
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">
                  Name ({langTab.toUpperCase()})
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

              {/* Qualification */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Qualification</label>
                <select
                  value={editing.qualification || "BAMS"}
                  onChange={(e) => updateField({ qualification: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest bg-white"
                >
                  {QUALIFICATIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </div>

              {/* Years experience */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Years of Experience</label>
                <input
                  type="number"
                  min={0}
                  value={editing.years_exp ?? 0}
                  onChange={(e) => updateField({ years_exp: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">
                  Bio ({langTab === "en" ? "English" : langTab === "ml" ? "Malayalam" : "Arabic"})
                </label>
                <textarea
                  rows={3}
                  value={langTab === "en" ? editing.bio || "" : editing.bio_ml || ""}
                  onChange={(e) =>
                    updateField(
                      langTab === "en"
                        ? { bio: e.target.value }
                        : { bio_ml: e.target.value }
                    )
                  }
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest resize-vertical"
                />
              </div>

              {/* Specialisations */}
              <div>
                <label className="block text-sm font-sans text-slate mb-2">Specialisations</label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALISATIONS.map((s) => (
                    <label
                      key={s}
                      className={`flex items-center px-3 py-1.5 rounded-md text-xs font-sans cursor-pointer transition-colors ${
                        (editing.specialisations || []).includes(s)
                          ? "bg-forest text-white"
                          : "bg-cream text-slate hover:bg-cream2"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={(editing.specialisations || []).includes(s)}
                        onChange={() => toggleArrayField("specialisations", s)}
                        className="sr-only"
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </div>

              {/* Prakriti affinities */}
              <div>
                <label className="block text-sm font-sans text-slate mb-2">Prakriti Affinities</label>
                <div className="flex gap-3">
                  {PRAKRITI_OPTIONS.map((p) => (
                    <label
                      key={p}
                      className={`flex items-center px-4 py-2 rounded-md text-sm font-sans cursor-pointer transition-colors ${
                        (editing.prakriti_affinities || []).includes(p)
                          ? "bg-gold text-white"
                          : "bg-cream text-slate hover:bg-cream2"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={(editing.prakriti_affinities || []).includes(p)}
                        onChange={() => toggleArrayField("prakriti_affinities", p)}
                        className="sr-only"
                      />
                      {p}
                    </label>
                  ))}
                </div>
              </div>

              {/* Languages */}
              <div>
                <label className="block text-sm font-sans text-slate mb-2">Languages Spoken</label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((l) => (
                    <label
                      key={l}
                      className={`flex items-center px-3 py-1.5 rounded-md text-xs font-sans cursor-pointer transition-colors ${
                        (editing.languages || []).includes(l)
                          ? "bg-forest text-white"
                          : "bg-cream text-slate hover:bg-cream2"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={(editing.languages || []).includes(l)}
                        onChange={() => toggleArrayField("languages", l)}
                        className="sr-only"
                      />
                      {l}
                    </label>
                  ))}
                </div>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-sans text-slate mb-2">Gender</label>
                <div className="flex gap-4">
                  {["male", "female"].map((g) => (
                    <label key={g} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        value={g}
                        checked={editing.gender === g}
                        onChange={(e) => updateField({ gender: e.target.value })}
                        className="w-4 h-4 text-forest focus:ring-forest border-cream2"
                      />
                      <span className="text-sm font-sans text-slate capitalize">{g}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Consultation fee */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Consultation Fee ($)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={editing.consultation_fee_usd ?? 0}
                  onChange={(e) =>
                    updateField({ consultation_fee_usd: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>

              {/* Save */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-forest text-white text-sm font-sans font-medium hover:bg-forest2 transition-colors disabled:opacity-60"
                >
                  {saving ? "Saving..." : editId ? "Update Doctor" : "Add Doctor"}
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
