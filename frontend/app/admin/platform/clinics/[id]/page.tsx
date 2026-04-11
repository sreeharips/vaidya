"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/currency";
import {
  getPlatformClinic,
  inviteClinicAdmin,
  activatePlatformClinic,
  deactivatePlatformClinic,
  upgradeClinicTier,
  type PlatformClinicDetail,
  type OnboardingStep,
} from "@/lib/admin-api";

// ── Helpers ──────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-cream/60 rounded-lg px-4 py-3 text-center">
      <p className="text-xl font-sans font-semibold text-slate">{value}</p>
      <p className="text-xs font-sans text-muted mt-0.5">{label}</p>
    </div>
  );
}

function StepRow({ step, index }: { step: OnboardingStep; index: number }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-cream2 last:border-0">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-sans font-medium ${
        step.done ? "bg-forest text-white" : "bg-cream2 text-muted"
      }`}>
        {step.done ? (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          index + 1
        )}
      </div>
      <span className={`text-sm font-sans ${step.done ? "text-slate" : "text-muted"}`}>
        {step.label}
      </span>
      {step.done && (
        <span className="ml-auto text-xs text-forest font-sans">Done</span>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ClinicDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [clinic, setClinic] = useState<PlatformClinicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState({ email: "", full_name: "", password: "" });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const load = async () => {
    try {
      const c = await getPlatformClinic(params.id);
      setClinic(c);
    } catch {
      router.push("/admin/platform");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [params.id]);

  const handleToggleActive = async () => {
    if (!clinic) return;
    setActionLoading("active");
    try {
      if (clinic.is_active) {
        await deactivatePlatformClinic(clinic.id);
      } else {
        await activatePlatformClinic(clinic.id);
      }
      await load();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const handleUpgradeTier = async () => {
    if (!clinic) return;
    const newTier = clinic.tier === 1 ? 2 : 1;
    const msg = newTier === 2
      ? "Upgrade to Tier 2 (Certified Authentic)? Ensure the clinic meets all credentialing criteria."
      : "Downgrade to Tier 1 (Verified)?";
    if (!confirm(msg)) return;
    setActionLoading("tier");
    try {
      await upgradeClinicTier(clinic.id, newTier);
      await load();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");
    if (!inviteForm.email || !inviteForm.full_name || !inviteForm.password) {
      setInviteError("All fields are required.");
      return;
    }
    if (inviteForm.password.length < 8) {
      setInviteError("Password must be at least 8 characters.");
      return;
    }
    setActionLoading("invite");
    try {
      await inviteClinicAdmin(params.id, inviteForm);
      setInviteSuccess(true);
      setInviteOpen(false);
      setInviteForm({ email: "", full_name: "", password: "" });
      await load();
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : "Failed to create admin account");
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  if (!clinic) return null;

  const doneSteps = clinic.onboarding.filter(s => s.done).length;
  const donePct = Math.round((doneSteps / clinic.onboarding.length) * 100);
  const doneCount = doneSteps;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Back */}
      <button
        onClick={() => router.push("/admin/platform")}
        className="flex items-center gap-1.5 text-sm font-sans text-muted hover:text-slate transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
        All Clinics
      </button>

      {/* Clinic header */}
      <div className="bg-white rounded-lg border border-cream2 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="font-serif text-2xl text-slate">{clinic.name}</h1>
              {clinic.tier === 2 ? (
                <span className="px-2 py-0.5 rounded text-xs font-sans font-medium bg-gold text-white">Tier 2</span>
              ) : (
                <span className="px-2 py-0.5 rounded text-xs font-sans font-medium bg-forest-lt text-forest">Tier 1</span>
              )}
              <span className={`px-2 py-0.5 rounded text-xs font-sans font-medium ${clinic.is_active ? "bg-forest-lt text-forest" : "bg-cream2 text-muted"}`}>
                {clinic.is_active ? "Live" : "Inactive"}
              </span>
            </div>
            <p className="text-sm font-sans text-muted">{clinic.district ?? "—"} · /{clinic.slug}</p>
            {clinic.description && (
              <p className="text-sm font-sans text-slate mt-2 line-clamp-2">{clinic.description}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleToggleActive}
              disabled={actionLoading === "active"}
              className={`px-4 py-2 rounded-xl text-sm font-sans font-medium transition-colors disabled:opacity-50 ${
                clinic.is_active
                  ? "bg-cream2 text-muted hover:bg-red-50 hover:text-red-600 border border-cream2"
                  : "bg-forest text-white hover:bg-forest2"
              }`}
            >
              {actionLoading === "active" ? "…" : clinic.is_active ? "Deactivate" : "Set Live"}
            </button>
            <button
              onClick={handleUpgradeTier}
              disabled={actionLoading === "tier"}
              className="px-4 py-2 rounded-xl text-sm font-sans font-medium bg-gold-lt text-bark border border-gold-lt hover:bg-gold hover:text-white transition-colors disabled:opacity-50"
            >
              {actionLoading === "tier" ? "…" : clinic.tier === 1 ? "Upgrade to Tier 2" : "Downgrade to Tier 1"}
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-3 mt-5">
          <StatCard label="Retreats"    value={clinic.retreats_count} />
          <StatCard label="Team"        value={clinic.team_count} />
          <StatCard label="Photos"      value={clinic.images_count} />
          <StatCard label="Bookings"    value={clinic.bookings_count} />
        </div>
      </div>

      {/* Onboarding checklist */}
      <div className="bg-white rounded-lg border border-cream2 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-serif text-lg text-slate">Onboarding Progress</h2>
            <p className="text-sm font-sans text-muted mt-0.5">{doneCount} of {clinic.onboarding.length} steps complete</p>
          </div>
          <div className="text-right">
            <span className={`text-2xl font-sans font-semibold ${donePct === 100 ? "text-forest" : donePct >= 50 ? "text-gold" : "text-muted"}`}>
              {donePct}%
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-cream2 rounded-full h-2 mb-5">
          <div
            className="h-2 rounded-full bg-forest transition-all duration-500"
            style={{ width: `${donePct}%` }}
          />
        </div>

        {/* Steps */}
        <div>
          {clinic.onboarding.map((step, i) => (
            <StepRow key={step.key} step={step} index={i} />
          ))}
        </div>

        {donePct === 100 && (
          <div className="mt-4 bg-forest-lt text-forest text-sm font-sans px-4 py-3 rounded-lg">
            ✓ Onboarding complete — clinic is ready to go live!
          </div>
        )}
      </div>

      {/* Admin user */}
      <div className="bg-white rounded-lg border border-cream2 p-6">
        <h2 className="font-serif text-lg text-slate mb-4">Clinic Admin Account</h2>

        {inviteSuccess && (
          <div className="mb-4 bg-forest-lt text-forest text-sm font-sans px-4 py-3 rounded-lg">
            ✓ Admin account created successfully. Share the login credentials with the clinic.
          </div>
        )}

        {clinic.admin_user ? (
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-forest-lt flex items-center justify-center font-serif text-forest text-lg flex-shrink-0">
              {(clinic.admin_user.full_name ?? clinic.admin_user.email)[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-sans font-medium text-slate">{clinic.admin_user.full_name ?? "—"}</p>
              <p className="text-sm font-sans text-muted">{clinic.admin_user.email}</p>
              <p className="text-xs font-sans text-muted mt-1">
                {clinic.admin_user.last_login_at
                  ? `Last login: ${new Date(clinic.admin_user.last_login_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                  : "Never logged in"}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm font-sans text-muted mb-4">
              No admin account yet. Create login credentials to give the clinic access to their admin portal.
            </p>
            {!inviteOpen ? (
              <button
                onClick={() => setInviteOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-forest text-white rounded-xl text-sm font-sans font-medium hover:bg-forest2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Admin Account
              </button>
            ) : (
              <form onSubmit={handleInvite} className="space-y-3 max-w-sm">
                {inviteError && (
                  <div className="text-red-600 text-xs font-sans bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                    {inviteError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-sans text-muted uppercase tracking-wide mb-1">Full Name</label>
                  <input
                    className="w-full text-sm font-sans border border-cream2 rounded-lg px-3 py-2 outline-none focus:border-forest"
                    value={inviteForm.full_name}
                    onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="Dr. Rajesh Kumar"
                  />
                </div>
                <div>
                  <label className="block text-xs font-sans text-muted uppercase tracking-wide mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full text-sm font-sans border border-cream2 rounded-lg px-3 py-2 outline-none focus:border-forest"
                    value={inviteForm.email}
                    onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="admin@clinic.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-sans text-muted uppercase tracking-wide mb-1">Temporary Password</label>
                  <input
                    type="password"
                    className="w-full text-sm font-sans border border-cream2 rounded-lg px-3 py-2 outline-none focus:border-forest"
                    value={inviteForm.password}
                    onChange={e => setInviteForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min 8 characters"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={actionLoading === "invite"}
                    className="px-4 py-2 bg-forest text-white rounded-xl text-sm font-sans font-medium hover:bg-forest2 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === "invite" ? "Creating…" : "Create Account"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setInviteOpen(false); setInviteError(""); }}
                    className="px-4 py-2 text-sm font-sans text-muted hover:text-slate transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Clinic details */}
      <div className="bg-white rounded-lg border border-cream2 p-6">
        <h2 className="font-serif text-lg text-slate mb-4">Clinic Details</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm font-sans">
          {[
            ["Phone",      clinic.phone],
            ["Email",      clinic.email],
            ["Website",    clinic.website_url],
            ["Address",    clinic.address],
            ["Pricing",    clinic.pricing_min && clinic.pricing_max ? `$${clinic.pricing_min}–$${clinic.pricing_max} / night` : "Not set"],
            ["Languages",  clinic.languages.length ? clinic.languages.join(", ") : "Not set"],
          ].map(([label, val]) => val ? (
            <div key={label as string}>
              <dt className="text-muted text-xs uppercase tracking-wide mb-0.5">{label}</dt>
              <dd className="text-slate">{val as string}</dd>
            </div>
          ) : null)}
        </dl>

        {clinic.specialisations.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-sans text-muted uppercase tracking-wide mb-2">Specialisations</p>
            <div className="flex flex-wrap gap-1.5">
              {clinic.specialisations.map(s => (
                <span key={s} className="px-2.5 py-1 rounded-full bg-bark-lt text-bark text-xs font-sans">{s}</span>
              ))}
            </div>
          </div>
        )}

        {clinic.certifications.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-sans text-muted uppercase tracking-wide mb-2">Certifications</p>
            <div className="flex flex-wrap gap-1.5">
              {clinic.certifications.map(c => (
                <span key={c} className="px-2.5 py-1 rounded-full bg-gold-lt text-bark text-xs font-sans">{c}</span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-cream2">
          <a
            href={`/admin/platform/clinics/${clinic.id}/edit`}
            className="text-sm font-sans text-forest hover:underline"
          >
            Edit clinic details →
          </a>
        </div>
      </div>
    </div>
  );
}
