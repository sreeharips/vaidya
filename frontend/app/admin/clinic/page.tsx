"use client";

import { useEffect, useState } from "react";
import {
  getClinic,
  updateClinic,
  deactivateClinic,
  type Clinic,
} from "@/lib/admin-api";

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
];

const CERTIFICATIONS = [
  "AYUSH Registered",
  "NABH Accredited",
  "GMP Certified",
  "ISO 9001",
  "Kerala Tourism Approved",
];

const PRAKRITI_OPTIONS = ["Vata", "Pitta", "Kapha"];

type LangTab = "en" | "ml" | "ar";

export default function ClinicProfilePage() {
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [langTab, setLangTab] = useState<LangTab>("en");
  const [showDeactivate, setShowDeactivate] = useState(false);

  useEffect(() => {
    getClinic()
      .then(setClinic)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = (partial: Partial<Clinic>) => {
    if (!clinic) return;
    setClinic({ ...clinic, ...partial });
  };

  const toggleArrayItem = (field: keyof Clinic, item: string) => {
    if (!clinic) return;
    const arr = (clinic[field] as string[]) || [];
    const next = arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
    update({ [field]: next } as Partial<Clinic>);
  };

  const handleSave = async () => {
    if (!clinic) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updateClinic(clinic);
      setClinic(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert("Failed to save changes.");
    }
    setSaving(false);
  };

  const handleDeactivate = async () => {
    try {
      await deactivateClinic();
      if (clinic) setClinic({ ...clinic, is_active: false });
      setShowDeactivate(false);
    } catch {
      alert("Failed to deactivate clinic.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  if (!clinic) {
    return <div className="text-muted font-sans py-10 text-center">Could not load clinic profile.</div>;
  }

  const langTabs: { key: LangTab; label: string }[] = [
    { key: "en", label: "English" },
    { key: "ml", label: "Malayalam" },
    { key: "ar", label: "Arabic" },
  ];

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-slate">Clinic Profile</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-forest text-white text-sm font-sans font-medium hover:bg-forest2 transition-colors disabled:opacity-60"
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save changes"}
        </button>
      </div>

      <div className="space-y-6">
        {/* Basic info with language tabs */}
        <section className="bg-white rounded-md border border-cream2 p-6">
          <h2 className="font-serif text-lg text-slate mb-4">Basic Information</h2>

          <div className="flex gap-2 mb-4">
            {langTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setLangTab(t.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-sans font-medium transition-colors ${
                  langTab === t.key
                    ? "bg-forest text-white"
                    : "bg-cream text-muted hover:bg-cream2"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-sans text-slate mb-1">
                Clinic Name ({langTab.toUpperCase()})
              </label>
              <input
                type="text"
                value={
                  langTab === "en"
                    ? clinic.name
                    : langTab === "ml"
                    ? clinic.name_ml || ""
                    : clinic.name_ar || ""
                }
                onChange={(e) =>
                  update(
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

            <div>
              <label className="block text-sm font-sans text-slate mb-1">
                Description ({langTab.toUpperCase()})
              </label>
              <textarea
                rows={4}
                value={
                  langTab === "en"
                    ? clinic.description
                    : langTab === "ml"
                    ? clinic.description_ml || ""
                    : clinic.description_ar || ""
                }
                onChange={(e) =>
                  update(
                    langTab === "en"
                      ? { description: e.target.value }
                      : langTab === "ml"
                      ? { description_ml: e.target.value }
                      : { description_ar: e.target.value }
                  )
                }
                className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest resize-vertical"
              />
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="bg-white rounded-md border border-cream2 p-6">
          <h2 className="font-serif text-lg text-slate mb-4">Contact</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-sans text-slate mb-1">Phone</label>
              <input
                type="tel"
                value={clinic.phone}
                onChange={(e) => update({ phone: e.target.value })}
                className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
              />
            </div>
            <div>
              <label className="block text-sm font-sans text-slate mb-1">Email</label>
              <input
                type="email"
                value={clinic.email}
                onChange={(e) => update({ email: e.target.value })}
                className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-sans text-slate mb-1">Website</label>
              <input
                type="url"
                value={clinic.website || ""}
                onChange={(e) => update({ website: e.target.value })}
                className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                placeholder="https://"
              />
            </div>
          </div>
        </section>

        {/* Address + coordinates */}
        <section className="bg-white rounded-md border border-cream2 p-6">
          <h2 className="font-serif text-lg text-slate mb-4">Location</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-sans text-slate mb-1">Address</label>
              <textarea
                rows={2}
                value={clinic.address}
                onChange={(e) => update({ address: e.target.value })}
                className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest resize-vertical"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-sans text-slate mb-1">District</label>
                <input
                  type="text"
                  value={clinic.district}
                  onChange={(e) => update({ district: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={clinic.lat}
                  onChange={(e) => update({ lat: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={clinic.lng}
                  onChange={(e) => update({ lng: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Tags */}
        <section className="bg-white rounded-md border border-cream2 p-6">
          <h2 className="font-serif text-lg text-slate mb-4">Specialisations &amp; Tags</h2>

          <div className="mb-5">
            <label className="block text-sm font-sans text-slate mb-2">Specialisations</label>
            <div className="flex flex-wrap gap-2">
              {SPECIALISATIONS.map((s) => (
                <label
                  key={s}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-sans cursor-pointer transition-colors ${
                    clinic.specialisations?.includes(s)
                      ? "bg-forest text-white"
                      : "bg-cream text-slate hover:bg-cream2"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={clinic.specialisations?.includes(s) || false}
                    onChange={() => toggleArrayItem("specialisations", s)}
                    className="sr-only"
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-sans text-slate mb-2">Prakriti Affinities</label>
            <div className="flex gap-3">
              {PRAKRITI_OPTIONS.map((p) => (
                <label
                  key={p}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-sans cursor-pointer transition-colors ${
                    clinic.prakriti_affinities?.includes(p)
                      ? "bg-gold text-white"
                      : "bg-cream text-slate hover:bg-cream2"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={clinic.prakriti_affinities?.includes(p) || false}
                    onChange={() => toggleArrayItem("prakriti_affinities", p)}
                    className="sr-only"
                  />
                  {p}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-sans text-slate mb-2">Certifications</label>
            <div className="flex flex-wrap gap-2">
              {CERTIFICATIONS.map((c) => (
                <label
                  key={c}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-sans cursor-pointer transition-colors ${
                    clinic.certifications?.includes(c)
                      ? "bg-forest text-white"
                      : "bg-cream text-slate hover:bg-cream2"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={clinic.certifications?.includes(c) || false}
                    onChange={() => toggleArrayItem("certifications", c)}
                    className="sr-only"
                  />
                  {c}
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* Facilities */}
        <section className="bg-white rounded-md border border-cream2 p-6">
          <h2 className="font-serif text-lg text-slate mb-4">Facilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-sans text-slate mb-1">Accommodation Type</label>
              <select
                value={clinic.accommodation_type || ""}
                onChange={(e) => update({ accommodation_type: e.target.value })}
                className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest bg-white"
              >
                <option value="">None</option>
                <option value="basic">Basic rooms</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium / Resort</option>
                <option value="heritage">Heritage cottage</option>
              </select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clinic.airport_pickup}
                  onChange={(e) => update({ airport_pickup: e.target.checked })}
                  className="w-4 h-4 rounded border-cream2 text-forest focus:ring-forest"
                />
                <span className="text-sm font-sans text-slate">Airport pickup available</span>
              </label>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-sans text-slate mb-1">Operating Hours</label>
              <input
                type="text"
                value={clinic.operating_hours || ""}
                onChange={(e) => update({ operating_hours: e.target.value })}
                className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                placeholder="e.g. Mon-Sat 8:00 AM - 6:00 PM"
              />
            </div>
          </div>
        </section>

        {/* Social links */}
        <section className="bg-white rounded-md border border-cream2 p-6">
          <h2 className="font-serif text-lg text-slate mb-4">Social Links</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-sans text-slate mb-1">Facebook</label>
              <input
                type="url"
                value={clinic.social_facebook || ""}
                onChange={(e) => update({ social_facebook: e.target.value })}
                className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                placeholder="https://facebook.com/..."
              />
            </div>
            <div>
              <label className="block text-sm font-sans text-slate mb-1">Instagram</label>
              <input
                type="url"
                value={clinic.social_instagram || ""}
                onChange={(e) => update({ social_instagram: e.target.value })}
                className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                placeholder="https://instagram.com/..."
              />
            </div>
            <div>
              <label className="block text-sm font-sans text-slate mb-1">YouTube</label>
              <input
                type="url"
                value={clinic.social_youtube || ""}
                onChange={(e) => update({ social_youtube: e.target.value })}
                className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                placeholder="https://youtube.com/..."
              />
            </div>
          </div>
        </section>

        {/* Danger zone */}
        <section className="bg-white rounded-md border border-red-200 p-6">
          <h2 className="font-serif text-lg text-red-700 mb-2">Danger Zone</h2>
          <p className="text-sm font-sans text-muted mb-4">
            Deactivating your clinic will remove it from search results and prevent new bookings.
          </p>
          <button
            onClick={() => setShowDeactivate(true)}
            className="px-4 py-2 rounded-xl border border-red-300 text-red-600 text-sm font-sans font-medium hover:bg-red-50 transition-colors"
          >
            Deactivate clinic
          </button>
        </section>
      </div>

      {/* Deactivate confirmation modal */}
      {showDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-md p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-serif text-lg text-slate mb-2">Deactivate clinic?</h3>
            <p className="text-sm font-sans text-muted mb-5">
              This will hide your clinic from all search results and prevent new bookings.
              Existing bookings will not be affected. You can reactivate later.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeactivate(false)}
                className="px-4 py-2 rounded-xl text-sm font-sans text-slate hover:bg-cream transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-sans font-medium hover:bg-red-700 transition-colors"
              >
                Yes, deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
