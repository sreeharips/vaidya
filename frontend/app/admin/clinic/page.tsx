"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getClinic,
  updateClinic,
  deactivateClinic,
  getClinicReviews,
  type Clinic,
  type ClinicReviews,
} from "@/lib/admin-api";

// ── Constants ─────────────────────────────────────────────────────────────────

const SPECIALISATION_OPTIONS = [
  "Panchakarma", "Abhyanga", "Shirodhara", "Pizhichil", "Njavarakizhi",
  "Elakizhi", "Kati Basti", "Nasya", "Virechana", "Basti",
  "Udvartana", "Takradhara", "Rasayana", "Lepa",
];

const CERTIFICATION_OPTIONS = [
  "AYUSH Registered", "NABH Accredited", "GMP Certified",
  "ISO 9001", "Kerala Tourism Approved", "NABH Wellness Certified",
];

const WELLNESS_CATEGORIES = [
  "detox-cleanse", "stress-relief", "pain-management", "weight-wellness",
  "skin-hair", "immunity-boost", "fertility-wellness", "anti-aging",
  "digestive-health", "mental-clarity", "joint-mobility", "post-surgery",
];
const LANGUAGE_OPTIONS = ["English", "Malayalam", "Hindi", "Arabic", "German", "French"];

const ATMOSPHERE_OPTIONS = [
  { value: "backwaters",   label: "Backwaters",    desc: "Alappuzha / Kuttanad area" },
  { value: "hill-station", label: "Hill Station",  desc: "Munnar / Wayanad / Idukki" },
  { value: "coastal",      label: "Coastal",       desc: "Varkala / Kovalam / Bekal" },
  { value: "forest",       label: "Forest",        desc: "Thekkady / Silent Valley" },
  { value: "city",         label: "City",          desc: "Urban clinic" },
];

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
};

type LangTab = "en" | "ml" | "ar";

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  title, children, badge,
}: {
  title: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-md border border-cream2 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-cream2">
        <h2 className="font-serif text-lg text-slate">{title}</h2>
        {badge}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function ReadOnlyBadge() {
  return (
    <span className="text-xs font-sans text-muted border border-cream2 rounded px-2 py-0.5">
      read-only
    </span>
  );
}

function Stars({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} style={{ color: i < Math.round(rating) ? "#b8862c" : "#e2d8cc" }}>★</span>
      ))}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ClinicProfilePage() {
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [reviews, setReviews] = useState<ClinicReviews | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [langTab, setLangTab] = useState<LangTab>("en");
  const [showDeactivate, setShowDeactivate] = useState(false);

  useEffect(() => {
    Promise.all([
      getClinic(),
      getClinicReviews().catch(() => null),
    ])
      .then(([c, r]) => {
        setClinic(c);
        setReviews(r);
      })
      .catch((err: unknown) => {
        // #region agent log
        fetch("http://127.0.0.1:7770/ingest/72da58e2-dd69-45c1-a02a-44fb01af9698", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "ee0189" },
          body: JSON.stringify({
            sessionId: "ee0189",
            location: "admin/clinic/page.tsx:useEffect",
            message: "clinic load failed",
            data: { error: err instanceof Error ? err.message : String(err) },
            timestamp: Date.now(),
            hypothesisId: "H5",
          }),
        }).catch(() => {});
        // #endregion
      })
      .finally(() => setLoading(false));
  }, []);

  const update = (partial: Partial<Clinic>) => {
    if (!clinic) return;
    setClinic({ ...clinic, ...partial });
  };

  const toggleArr = (field: keyof Clinic, item: string) => {
    if (!clinic) return;
    const arr = (clinic[field] as string[]) ?? [];
    update({ [field]: arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item] } as Partial<Clinic>);
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

  const getHours = () => clinic?.operating_hours ?? {};
  const setDayHours = (day: string, field: "open" | "close" | "closed", value: string | boolean) => {
    const hours: Record<string, { open: string; close: string; closed: boolean }> = {
      ...getHours() as Record<string, { open: string; close: string; closed: boolean }>,
    };
    const prev = hours[day] ?? { open: "09:00", close: "18:00", closed: false };
    hours[day] = { ...prev, [field]: value };
    update({ operating_hours: hours });
  };

  const getSocial = () => (clinic?.social_links ?? {}) as Record<string, string>;
  const setSocial = (key: string, value: string) => {
    update({ social_links: { ...getSocial(), [key]: value || undefined } });
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

  const tierLabel = clinic.tier === 2 ? "Tier 2 — Certified Authentic" : "Tier 1 — Verified";

  return (
    <div className="max-w-4xl">

      {/* Page header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="font-serif text-2xl text-slate">{clinic.name}</h1>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-xs font-sans text-muted border border-cream2 px-2 py-0.5 rounded">
              {tierLabel}
            </span>
            {clinic.rating !== null && (
              <span className="flex items-center gap-1.5 text-xs font-sans text-muted">
                <Stars rating={clinic.rating} />
                {clinic.rating.toFixed(1)} ({clinic.review_count} reviews)
              </span>
            )}
            {!clinic.is_active && (
              <span className="text-xs font-sans text-red-600 border border-red-200 px-2 py-0.5 rounded">
                Inactive
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link
            href={`/en/clinics/${clinic.slug}`}
            target="_blank"
            className="px-4 py-2 rounded-xl border border-forest text-forest text-sm font-sans font-medium hover:bg-forest-lt transition-colors"
          >
            View public page ↗
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-forest text-white text-sm font-sans font-medium hover:bg-forest2 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : saved ? "✓ Saved" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="space-y-6">

        {/* ── Description ──────────────────────────────────────────────────── */}
        <Section title="About the clinic">
          <div className="flex gap-2 mb-4">
            {langTabs.map(t => (
              <button
                key={t.key}
                onClick={() => setLangTab(t.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-sans font-medium transition-colors ${
                  langTab === t.key ? "bg-forest text-white" : "bg-cream text-muted hover:bg-cream2"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <textarea
            rows={5}
            value={
              langTab === "en" ? (clinic.description_en ?? "") :
              langTab === "ml" ? (clinic.description_ml ?? "") :
              (clinic.description_ar ?? "")
            }
            onChange={e =>
              update(
                langTab === "en" ? { description_en: e.target.value } :
                langTab === "ml" ? { description_ml: e.target.value } :
                { description_ar: e.target.value }
              )
            }
            placeholder={`Describe your clinic in ${langTab === "en" ? "English" : langTab === "ml" ? "Malayalam" : "Arabic"}…`}
            className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest resize-vertical"
          />
        </Section>

        {/* ── Contact ───────────────────────────────────────────────────────── */}
        <Section title="Contact">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-sans text-slate mb-1">Phone</label>
              <input
                type="tel"
                value={clinic.phone ?? ""}
                onChange={e => update({ phone: e.target.value })}
                placeholder="+91 484 000 0000"
                className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
              />
            </div>
            <div>
              <label className="block text-sm font-sans text-slate mb-1">Email</label>
              <input
                type="email"
                value={clinic.email ?? ""}
                onChange={e => update({ email: e.target.value })}
                placeholder="info@clinic.com"
                className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-sans text-slate mb-1">Website</label>
              <input
                type="url"
                value={clinic.website_url ?? ""}
                onChange={e => update({ website_url: e.target.value })}
                placeholder="https://yourclinic.com"
                className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
              />
            </div>
          </div>
        </Section>

        {/* ── Location ─────────────────────────────────────────────────────── */}
        <Section title="Location">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Address line 1</label>
                <input
                  type="text"
                  value={clinic.address_line1 ?? ""}
                  onChange={e => update({ address_line1: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Address line 2</label>
                <input
                  type="text"
                  value={clinic.address_line2 ?? ""}
                  onChange={e => update({ address_line2: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-sans text-slate mb-1">District</label>
                <input
                  type="text"
                  value={clinic.district ?? ""}
                  onChange={e => update({ district: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>
              <div>
                <label className="block text-sm font-sans text-slate mb-1">State</label>
                <input
                  type="text"
                  value={clinic.state ?? ""}
                  onChange={e => update({ state: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Pincode</label>
                <input
                  type="text"
                  value={clinic.pincode ?? ""}
                  onChange={e => update({ pincode: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={clinic.lat ?? ""}
                  onChange={e => update({ lat: parseFloat(e.target.value) || null })}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={clinic.lng ?? ""}
                  onChange={e => update({ lng: parseFloat(e.target.value) || null })}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>
            </div>
          </div>
        </Section>

        {/* ── Getting Here ──────────────────────────────────────────────────── */}
        <Section title="Getting Here">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-sans text-slate mb-1">
                Full Address
                <span className="ml-2 text-xs text-muted font-normal">(shown publicly on the clinic page)</span>
              </label>
              <input
                type="text"
                value={clinic.address ?? ""}
                onChange={e => update({ address: e.target.value })}
                placeholder="e.g. Somatheeram, Trivandrum – Kovalam Road, Chowara, Kerala 695501"
                className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
              />
              <p className="text-xs text-muted mt-1 font-sans">
                This single-line address is what appears in the "Getting Here" card on the clinic page. Keep it concise.
              </p>
            </div>
            <div>
              <label className="block text-sm font-sans text-slate mb-1">
                Transport &amp; Directions
                <span className="ml-2 text-xs text-muted font-normal">(shown in the Transport card)</span>
              </label>
              <textarea
                rows={4}
                value={clinic.transport_info ?? ""}
                onChange={e => update({ transport_info: e.target.value })}
                placeholder="e.g. 30 km from Trivandrum International Airport. Airport pickups available on request. Nearest railway station: Trivandrum Central (35 km)."
                className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest resize-vertical"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clinic.accommodation_available}
                  onChange={e => update({ accommodation_available: e.target.checked })}
                  className="w-4 h-4 rounded border-cream2 text-forest focus:ring-forest"
                />
                <span className="text-sm font-sans text-slate">
                  On-site accommodation available for retreat guests
                  <span className="ml-2 text-xs text-muted font-normal">(shows the Accommodation card publicly)</span>
                </span>
              </label>
            </div>
          </div>
        </Section>

        {/* ── Operating Hours ───────────────────────────────────────────────── */}
        <Section title="Operating Hours">
          <div className="space-y-2.5">
            {DAYS.map(day => {
              const h = (getHours() as Record<string, { open: string; close: string; closed: boolean }>)[day]
                ?? { open: "09:00", close: "18:00", closed: false };
              return (
                <div key={day} className="flex items-center gap-4">
                  <span className="text-sm font-sans text-muted w-8 flex-shrink-0">{DAY_LABELS[day]}</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!h.closed}
                      onChange={e => setDayHours(day, "closed", !e.target.checked)}
                      className="w-4 h-4 rounded border-cream2 text-forest focus:ring-forest"
                    />
                    <span className="text-xs font-sans text-slate">Open</span>
                  </label>
                  {!h.closed ? (
                    <>
                      <input
                        type="time"
                        value={h.open}
                        onChange={e => setDayHours(day, "open", e.target.value)}
                        className="px-2 py-1.5 rounded border border-cream2 text-sm font-sans text-slate focus:outline-none focus:border-forest"
                      />
                      <span className="text-muted text-sm">–</span>
                      <input
                        type="time"
                        value={h.close}
                        onChange={e => setDayHours(day, "close", e.target.value)}
                        className="px-2 py-1.5 rounded border border-cream2 text-sm font-sans text-slate focus:outline-none focus:border-forest"
                      />
                    </>
                  ) : (
                    <span className="text-xs font-sans text-muted italic">Closed</span>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        {/* ── Pricing ───────────────────────────────────────────────────────── */}
        <Section title="Pricing">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-sans text-slate mb-1">Min price / day (₹)</label>
              <input
                type="number"
                min="0"
                value={clinic.pricing_min ?? ""}
                onChange={e => update({ pricing_min: parseFloat(e.target.value) || null })}
                placeholder="e.g. 3500"
                className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
              />
            </div>
            <div>
              <label className="block text-sm font-sans text-slate mb-1">Max price / day (₹)</label>
              <input
                type="number"
                min="0"
                value={clinic.pricing_max ?? ""}
                onChange={e => update({ pricing_max: parseFloat(e.target.value) || null })}
                placeholder="e.g. 8000"
                className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
              />
            </div>
          </div>
          <p className="text-xs font-sans text-muted mt-2">
            Displayed as a price range on the public listing. Used for patient budget filters.
          </p>
        </Section>

        {/* ── Tags & Credentials ────────────────────────────────────────────── */}
        <Section title="Tags & Credentials">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-sans text-slate mb-2">Atmosphere / Setting</label>
              <p className="text-xs text-muted mb-2">Select all that describe your clinic's natural environment. Used in search filters and the home page.</p>
              <div className="flex flex-wrap gap-2">
                {ATMOSPHERE_OPTIONS.map(a => (
                  <label key={a.value} className={`flex flex-col px-3 py-2 rounded-md text-xs font-sans cursor-pointer transition-colors border ${
                    clinic.atmosphere?.includes(a.value)
                      ? "bg-forest text-white border-forest"
                      : "bg-cream text-slate hover:bg-cream2 border-cream2"
                  }`}>
                    <input type="checkbox" checked={clinic.atmosphere?.includes(a.value) ?? false}
                      onChange={() => toggleArr("atmosphere", a.value)} className="sr-only" />
                    <span className="font-medium">{a.label}</span>
                    <span className={`text-[10px] mt-0.5 ${clinic.atmosphere?.includes(a.value) ? "text-white/70" : "text-muted"}`}>{a.desc}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-sans text-slate mb-2">Specialisations</label>
              <div className="flex flex-wrap gap-2">
                {SPECIALISATION_OPTIONS.map(s => (
                  <label key={s} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-sans cursor-pointer transition-colors ${
                    clinic.specialisations?.includes(s) ? "bg-forest text-white" : "bg-cream text-slate hover:bg-cream2"
                  }`}>
                    <input type="checkbox" checked={clinic.specialisations?.includes(s) ?? false}
                      onChange={() => toggleArr("specialisations", s)} className="sr-only" />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-sans text-slate mb-2">Wellness categories</label>
              <div className="flex flex-wrap gap-2">
                {WELLNESS_CATEGORIES.map(c => (
                  <label key={c} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-sans cursor-pointer transition-colors ${
                    clinic.wellness_categories?.includes(c) ? "bg-gold text-white" : "bg-cream text-slate hover:bg-cream2"
                  }`}>
                    <input type="checkbox" checked={clinic.wellness_categories?.includes(c) ?? false}
                      onChange={() => toggleArr("wellness_categories", c)} className="sr-only" />
                    {c.replace(/-/g, ' ')}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-sans text-slate mb-2">Languages spoken</label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map(l => (
                  <label key={l} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-sans cursor-pointer transition-colors ${
                    clinic.languages?.includes(l) ? "bg-forest text-white" : "bg-cream text-slate hover:bg-cream2"
                  }`}>
                    <input type="checkbox" checked={clinic.languages?.includes(l) ?? false}
                      onChange={() => toggleArr("languages", l)} className="sr-only" />
                    {l}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-sans text-slate mb-2">Certifications</label>
              <div className="flex flex-wrap gap-2">
                {CERTIFICATION_OPTIONS.map(c => (
                  <label key={c} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-sans cursor-pointer transition-colors ${
                    clinic.certifications?.includes(c) ? "bg-forest text-white" : "bg-cream text-slate hover:bg-cream2"
                  }`}>
                    <input type="checkbox" checked={clinic.certifications?.includes(c) ?? false}
                      onChange={() => toggleArr("certifications", c)} className="sr-only" />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Social Links ──────────────────────────────────────────────────── */}
        <Section title="Social Links">
          <div className="space-y-4">
            {[
              { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/yourclinic" },
              { key: "facebook",  label: "Facebook",  placeholder: "https://facebook.com/yourclinic" },
              { key: "youtube",   label: "YouTube",   placeholder: "https://youtube.com/@yourclinic" },
              { key: "whatsapp",  label: "WhatsApp",  placeholder: "+91 90000 00000" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-sans text-slate mb-1">{label}</label>
                <input
                  type="text"
                  value={getSocial()[key] ?? ""}
                  onChange={e => setSocial(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>
            ))}
          </div>
        </Section>

        {/* ── Facilities & Policies ─────────────────────────────────────────── */}
        <Section title="Facilities & Policies">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-5">
              {[
                { field: "accommodation_available" as keyof Clinic, label: "On-site accommodation" },
                { field: "pickup_available"        as keyof Clinic, label: "Airport / transport pickup" },
                { field: "outcome_enrolled"        as keyof Clinic, label: "Outcome data enrolled" },
              ].map(({ field, label }) => (
                <label key={field} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!clinic[field]}
                    onChange={e => update({ [field]: e.target.checked } as Partial<Clinic>)}
                    className="w-4 h-4 rounded border-cream2 text-forest focus:ring-forest"
                  />
                  <span className="text-sm font-sans text-slate">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Team ─────────────────────────────────────────────────────────── */}
        <Section title="Team">
          <p className="text-sm font-sans text-muted">
            Manage your clinic team members.{" "}
            <Link href="/admin/team" className="text-forest underline">Go to Team →</Link>
          </p>
        </Section>

        {/* ── Retreats ──────────────────────────────────────────────────────── */}
        <Section title="Retreats">
          <p className="text-sm font-sans text-muted">
            Manage your wellness retreats.{" "}
            <Link href="/admin/retreats" className="text-forest underline">Go to Retreats →</Link>
          </p>
        </Section>


        {/* ── Reviews — read-only ───────────────────────────────────────────── */}
        <Section
          title={`Patient Reviews${reviews ? ` (${reviews.total})` : ""}`}
          badge={<ReadOnlyBadge />}
        >
          {!reviews || reviews.total === 0 ? (
            <p className="text-sm font-sans text-muted">
              No reviews yet. Reviews appear automatically after verified bookings complete.
            </p>
          ) : (
            <div>
              {/* Rating summary */}
              <div className="flex items-start gap-6 mb-6 p-4 bg-cream rounded-md">
                <div className="text-center">
                  <div className="font-serif text-4xl text-forest leading-none">
                    {reviews.avg_rating?.toFixed(1)}
                  </div>
                  <div className="mt-1.5">
                    <Stars rating={reviews.avg_rating ?? 0} />
                  </div>
                  <div className="text-xs text-muted mt-1">{reviews.total} total</div>
                </div>
                <div className="flex-1">
                  {[5, 4, 3, 2, 1].map(star => {
                    const count = reviews.reviews.filter(r => r.rating === star).length;
                    const pct = reviews.total > 0 ? (count / reviews.total) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs text-muted w-3">{star}</span>
                        <span style={{ color: "#b8862c" }} className="text-xs">★</span>
                        <div className="flex-1 bg-cream2 rounded-full h-1.5">
                          <div className="bg-gold rounded-full h-1.5" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted w-5 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Review cards */}
              <div className="space-y-3">
                {reviews.reviews.map(r => (
                  <div key={r.id} className="border border-cream2 rounded-md p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Stars rating={r.rating} />
                        <span className={`text-xs font-sans px-1.5 py-0.5 rounded border ${
                          r.verified
                            ? "text-forest border-green-200"
                            : "text-muted border-cream2"
                        }`}>
                          {r.verified ? "Verified" : "Unverified"}
                        </span>
                      </div>
                      <span className="text-xs text-muted">
                        {r.reviewer_location && `${r.reviewer_location} · `}
                        {new Date(r.created_at).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </span>
                    </div>
                    {r.review_text && (
                      <p className="text-sm font-sans text-slate leading-relaxed">{r.review_text}</p>
                    )}
                    {r.treatment_slug && (
                      <p className="text-xs text-muted mt-1.5">Treatment: {r.treatment_slug}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* ── Credentialing status — read-only ──────────────────────────────── */}
        <Section title="Credentialing Status" badge={<ReadOnlyBadge />}>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm font-sans">
            {[
              { label: "Tier",             value: tierLabel },
              { label: "Rating",           value: clinic.rating !== null ? `${clinic.rating.toFixed(1)} / 5.0` : "No reviews" },
              { label: "Total reviews",    value: String(clinic.review_count) },
              { label: "Outcome enrolled", value: clinic.outcome_enrolled ? "Yes" : "No" },
              { label: "Status",           value: clinic.is_active ? "Active" : "Inactive" },
            ].map(row => (
              <div key={row.label} className="flex gap-2">
                <span className="text-muted w-36 flex-shrink-0">{row.label}</span>
                <span className="text-slate font-medium">{row.value}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-4">
            Tier upgrades and certification changes are managed by AyuRetreats.{" "}
            <a href="mailto:partners@ayuretreats.com" className="text-forest underline">Contact partners@ayuretreats.com</a>
          </p>
        </Section>

        {/* ── Bottom save bar ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between bg-white border border-cream2 rounded-md px-5 py-4">
          <p className="text-sm font-sans text-muted">
            Reviews, rating, and credentialing tier cannot be edited here.
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-forest text-white text-sm font-sans font-medium hover:bg-forest2 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : saved ? "✓ Saved" : "Save changes"}
          </button>
        </div>

        {/* ── Danger zone ───────────────────────────────────────────────────── */}
        <section className="bg-white rounded-md border border-red-200 p-6">
          <h2 className="font-serif text-lg text-red-700 mb-2">Danger Zone</h2>
          <p className="text-sm font-sans text-muted mb-4">
            Deactivating removes your clinic from search results and prevents new bookings.
            Existing bookings are unaffected. You can reactivate later via support.
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
              Existing confirmed bookings will not be affected.
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
