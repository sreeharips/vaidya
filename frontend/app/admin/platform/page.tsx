"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/currency";
import {
  getPlatformClinics,
  getPlatformStats,
  type PlatformClinic,
  type PlatformStats,
} from "@/lib/admin-api";

export default function PlatformPage() {
  const router = useRouter();
  const [clinics, setClinics] = useState<PlatformClinic[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([getPlatformClinics(), getPlatformStats()])
      .then(([c, s]) => { setClinics(c); setStats(s); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = clinics.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.district ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // Onboarding pipeline buckets
  const pipeline = [
    { label: "Just created",   range: [0, 25],  color: "bg-cream2 text-muted" },
    { label: "In progress",    range: [26, 74],  color: "bg-gold-lt text-bark" },
    { label: "Almost ready",   range: [75, 99],  color: "bg-forest-lt text-forest" },
    { label: "Live",           range: [100, 100], color: "bg-forest text-white" },
  ];

  const pipelineCounts = pipeline.map(p => ({
    ...p,
    count: clinics.filter(c => c.onboarding_pct >= p.range[0] && c.onboarding_pct <= p.range[1]).length,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-slate">Super Admin</h1>
          <p className="text-sm font-sans text-muted mt-0.5">Manage all clinics and onboarding</p>
        </div>
        <button
          onClick={() => router.push("/admin/platform/clinics/new")}
          className="flex items-center gap-2 px-4 py-2 bg-forest text-white rounded-xl text-sm font-sans font-medium hover:bg-forest2 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Clinic
        </button>
      </div>

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Clinics",    value: stats.total_clinics,     sub: `${stats.active_clinics} active` },
            { label: "Tier 2 Certified", value: stats.tier2_clinics,     sub: `${stats.tier1_clinics} at Tier 1` },
            { label: "Total Bookings",   value: stats.total_bookings.toLocaleString(), sub: "all time" },
            { label: "Platform Revenue", value: formatMoney(stats.total_revenue, "INR", "en-IN"), sub: `GMV ${formatMoney(stats.total_gmv, "INR", "en-IN")}` },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-lg border border-cream2 px-4 py-4">
              <p className="text-xs font-sans text-muted">{card.label}</p>
              <p className="text-xl font-sans font-semibold text-slate mt-0.5">{card.value}</p>
              <p className="text-xs font-sans text-muted mt-1">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Onboarding pipeline */}
      <div className="bg-white rounded-lg border border-cream2 p-5">
        <h2 className="font-serif text-base text-slate mb-4">Onboarding Pipeline</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {pipelineCounts.map(p => (
            <div key={p.label} className="flex flex-col items-center p-4 rounded-lg bg-cream/50 border border-cream2">
              <span className={`text-2xl font-sans font-semibold mb-1 ${p.count > 0 ? "text-slate" : "text-muted"}`}>
                {p.count}
              </span>
              <span className="text-xs font-sans text-muted text-center">{p.label}</span>
              <span className={`mt-2 text-xs px-2 py-0.5 rounded-full font-sans font-medium ${p.color}`}>
                {p.range[0]}–{p.range[1] === 100 ? "100" : p.range[1]}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Clinic table */}
      <div className="bg-white rounded-lg border border-cream2 overflow-hidden">
        <div className="px-5 py-4 border-b border-cream2 flex items-center justify-between gap-3">
          <h2 className="font-serif text-base text-slate whitespace-nowrap">All Clinics</h2>
          <input
            type="text"
            placeholder="Search by name or district…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 max-w-xs text-sm font-sans border border-cream2 rounded-lg px-3 py-1.5 outline-none focus:border-forest bg-cream/50"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="border-b border-cream2 bg-cream/40">
                <th className="text-left px-4 py-3 text-muted font-medium">Clinic</th>
                <th className="text-left px-4 py-3 text-muted font-medium hidden md:table-cell">District</th>
                <th className="text-left px-4 py-3 text-muted font-medium">Tier</th>
                <th className="text-left px-4 py-3 text-muted font-medium">Onboarding</th>
                <th className="text-left px-4 py-3 text-muted font-medium hidden lg:table-cell">Retreats</th>
                <th className="text-left px-4 py-3 text-muted font-medium hidden lg:table-cell">Bookings</th>
                <th className="text-left px-4 py-3 text-muted font-medium">Status</th>
                <th className="text-left px-4 py-3 text-muted font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream2">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted font-sans text-sm">
                    {search ? "No clinics match your search." : "No clinics yet. Create your first clinic."}
                  </td>
                </tr>
              ) : (
                filtered.map(clinic => (
                  <tr key={clinic.id} className="hover:bg-cream/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate">{clinic.name}</div>
                      {!clinic.has_admin && (
                        <div className="text-xs text-gold mt-0.5">No admin yet</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted hidden md:table-cell">{clinic.district ?? "—"}</td>
                    <td className="px-4 py-3">
                      {clinic.tier === 2 ? (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gold text-white">Tier 2</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-forest-lt text-forest">Tier 1</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <div className="flex-1 bg-cream2 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-forest transition-all"
                            style={{ width: `${clinic.onboarding_pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted w-8 text-right">{clinic.onboarding_pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted hidden lg:table-cell">{clinic.retreats_count}</td>
                    <td className="px-4 py-3 text-muted hidden lg:table-cell">{clinic.bookings_count}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${clinic.is_active ? "bg-forest-lt text-forest" : "bg-cream2 text-muted"}`}>
                        {clinic.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => router.push(`/admin/platform/clinics/${clinic.id}`)}
                        className="px-3 py-1.5 rounded-lg border border-cream2 text-xs font-sans text-slate hover:border-forest hover:text-forest transition-colors"
                      >
                        Manage →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
