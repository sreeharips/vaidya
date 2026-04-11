"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPlatformClinic, type ClinicCreateInput } from "@/lib/admin-api";

const DISTRICTS = [
  "Thiruvananthapuram", "Kollam", "Pathanamthitta", "Alappuzha",
  "Kottayam", "Idukki", "Ernakulam", "Thrissur", "Palakkad",
  "Malappuram", "Kozhikode", "Wayanad", "Kannur", "Kasaragod",
];

const SPECIALISATIONS = [
  "Panchakarma", "Shirodhara", "Abhyanga", "Basti", "Kati Basti",
  "Nasyam", "Pizhichil", "Njavara Kizhi", "Udvartana", "Rasayana",
];

const ATMOSPHERE_OPTIONS = [
  { value: "backwaters",   label: "Backwaters" },
  { value: "hill-station", label: "Hill Station" },
  { value: "coastal",      label: "Coastal" },
  { value: "forest",       label: "Forest" },
  { value: "city",         label: "City" },
];

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ml", label: "Malayalam" },
  { value: "ar", label: "Arabic" },
  { value: "de", label: "German" },
  { value: "hi", label: "Hindi" },
];

const CERTIFICATION_OPTIONS = [
  "NABH Accredited",
  "Govt of Kerala AYUSH Certified",
  "ISO 9001:2015",
  "Kerala Ayurvedic Medicine Board",
  "AYUSH Ministry Certified",
  "International Ayurvedic Medical Association",
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-cream2 p-6">
      <h2 className="font-serif text-lg text-slate mb-5 pb-3 border-b border-cream2">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-sans font-medium text-muted uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full text-sm font-sans border border-cream2 rounded-lg px-3 py-2 outline-none focus:border-forest bg-white text-slate placeholder:text-muted";

function TogglePill({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-sans font-medium border transition-colors ${
        active
          ? "bg-forest text-white border-forest"
          : "bg-white text-muted border-cream2 hover:border-forest hover:text-forest"
      }`}
    >
      {label}
    </button>
  );
}

function toggle(arr: string[], val: string) {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
}

export default function NewClinicPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<ClinicCreateInput>({
    name: "",
    slug: "",
    district: "",
    description: "",
    tier: 1,
    address: "",
    lat: undefined,
    lng: undefined,
    phone: "",
    email: "",
    website_url: "",
    specialisations: [],
    atmosphere: [],
    certifications: [],
    languages: [],
    pricing_min: undefined,
    pricing_max: undefined,
  });

  const set = (key: keyof ClinicCreateInput, value: unknown) =>
    setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.district) {
      setError("Name and district are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const clinic = await createPlatformClinic({
        ...form,
        slug: form.slug?.trim() || undefined,
        description: form.description?.trim() || undefined,
        address: form.address?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        email: form.email?.trim() || undefined,
        website_url: form.website_url?.trim() || undefined,
      });
      router.push(`/admin/platform/clinics/${clinic.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create clinic");
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/admin/platform")}
          className="text-muted hover:text-slate transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="font-serif text-2xl text-slate">Create New Clinic</h1>
          <p className="text-sm font-sans text-muted mt-0.5">Clinic starts inactive until onboarding is complete</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-sans px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <Section title="Basic Information">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Clinic Name" required>
              <input
                className={inputCls}
                value={form.name}
                onChange={e => set("name", e.target.value)}
                placeholder="e.g. Kairali Ayurvedic Healing Village"
              />
            </Field>
          </div>
          <Field label="URL Slug">
            <input
              className={inputCls}
              value={form.slug}
              onChange={e => set("slug", e.target.value)}
              placeholder="auto-generated from name"
            />
            <p className="text-xs text-muted mt-1">Leave blank to auto-generate</p>
          </Field>
          <Field label="District" required>
            <select
              className={inputCls}
              value={form.district}
              onChange={e => set("district", e.target.value)}
            >
              <option value="">Select district…</option>
              {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Description">
          <textarea
            className={`${inputCls} min-h-[100px] resize-y`}
            value={form.description}
            onChange={e => set("description", e.target.value)}
            placeholder="Briefly describe the clinic's philosophy, setting, and speciality…"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Credentialing Tier">
            <select className={inputCls} value={form.tier} onChange={e => set("tier", Number(e.target.value))}>
              <option value={1}>Tier 1 — Verified</option>
              <option value={2}>Tier 2 — Certified Authentic</option>
            </select>
          </Field>
          <Field label="Established Year">
            <input
              type="number"
              className={inputCls}
              placeholder="e.g. 1998"
              min={1900}
              max={new Date().getFullYear()}
            />
          </Field>
        </div>
      </Section>

      {/* Contact & Location */}
      <Section title="Contact & Location">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone">
            <input className={inputCls} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+91 9876543210" />
          </Field>
          <Field label="Email">
            <input type="email" className={inputCls} value={form.email} onChange={e => set("email", e.target.value)} placeholder="clinic@example.com" />
          </Field>
          <div className="col-span-2">
            <Field label="Website">
              <input className={inputCls} value={form.website_url} onChange={e => set("website_url", e.target.value)} placeholder="https://www.clinic.com" />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Address">
              <input className={inputCls} value={form.address} onChange={e => set("address", e.target.value)} placeholder="Full address" />
            </Field>
          </div>
          <Field label="Latitude">
            <input type="number" step="any" className={inputCls} placeholder="e.g. 10.8505" onChange={e => set("lat", Number(e.target.value) || undefined)} />
          </Field>
          <Field label="Longitude">
            <input type="number" step="any" className={inputCls} placeholder="e.g. 76.2711" onChange={e => set("lng", Number(e.target.value) || undefined)} />
          </Field>
        </div>
      </Section>

      {/* Pricing */}
      <Section title="Pricing">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Min price / night (USD)">
            <input type="number" className={inputCls} placeholder="e.g. 80" onChange={e => set("pricing_min", Number(e.target.value) || undefined)} />
          </Field>
          <Field label="Max price / night (USD)">
            <input type="number" className={inputCls} placeholder="e.g. 300" onChange={e => set("pricing_max", Number(e.target.value) || undefined)} />
          </Field>
        </div>
      </Section>

      {/* Tags */}
      <Section title="Tags & Credentials">
        <Field label="Specialisations">
          <div className="flex flex-wrap gap-2 mt-1">
            {SPECIALISATIONS.map(s => (
              <TogglePill
                key={s} label={s}
                active={form.specialisations.includes(s)}
                onClick={() => set("specialisations", toggle(form.specialisations, s))}
              />
            ))}
          </div>
        </Field>

        <Field label="Atmosphere / Setting">
          <div className="flex flex-wrap gap-2 mt-1">
            {ATMOSPHERE_OPTIONS.map(a => (
              <TogglePill
                key={a.value} label={a.label}
                active={form.atmosphere.includes(a.value)}
                onClick={() => set("atmosphere", toggle(form.atmosphere, a.value))}
              />
            ))}
          </div>
        </Field>

        <Field label="Languages Spoken">
          <div className="flex flex-wrap gap-2 mt-1">
            {LANGUAGE_OPTIONS.map(l => (
              <TogglePill
                key={l.value} label={l.label}
                active={form.languages.includes(l.value)}
                onClick={() => set("languages", toggle(form.languages, l.value))}
              />
            ))}
          </div>
        </Field>

        <Field label="Certifications">
          <div className="flex flex-wrap gap-2 mt-1">
            {CERTIFICATION_OPTIONS.map(c => (
              <TogglePill
                key={c} label={c}
                active={form.certifications.includes(c)}
                onClick={() => set("certifications", toggle(form.certifications, c))}
              />
            ))}
          </div>
        </Field>
      </Section>

      {/* Submit */}
      <div className="flex items-center gap-3 pb-6">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-forest text-white rounded-xl text-sm font-sans font-medium hover:bg-forest2 transition-colors disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create Clinic"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/platform")}
          className="px-4 py-2.5 text-sm font-sans text-muted hover:text-slate transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
