"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/currency";
import {
  getPlatformClinics,
  getPlatformStats,
  upgradeClinicTier,
  type PlatformClinic,
  type PlatformStats,
} from "@/lib/admin-api";

export default function PlatformPage() {
  const [clinics, setClinics] = useState<PlatformClinic[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const load = async () => {
    try {
      const [c, s] = await Promise.all([getPlatformClinics(), getPlatformStats()]);
      setClinics(c);
      setStats(s);
    } catch {
      // handled
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpgrade = async (clinicId: string) => {
    if (!confirm("Upgrade this clinic to Tier 2? This requires meeting all Certified Authentic criteria.")) return;
    setUpgrading(clinicId);
    try {
      await upgradeClinicTier(clinicId, 2);
      setClinics((prev) =>
        prev.map((c) => (c.id === clinicId ? { ...c, tier: 2 } : c))
      );
    } catch {
      alert("Failed to upgrade clinic tier.");
    }
    setUpgrading(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  const statCards = stats
    ? [
        { label: "Total Clinics", value: stats.total_clinics },
        { label: "Tier 1 (Verified)", value: stats.tier1_clinics },
        { label: "Tier 2 (Certified)", value: stats.tier2_clinics },
        { label: "Total Bookings", value: stats.total_bookings.toLocaleString() },
        { label: "Total Revenue", value: formatMoney(stats.total_revenue, "INR", "en-IN") },
        { label: "Active Retreats", value: stats.active_retreats },
      ]
    : [];

  return (
    <div>
      <h1 className="font-serif text-2xl text-slate mb-6">Platform Administration</h1>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {statCards.map((card) => (
            <div key={card.label} className="bg-white rounded-md border border-cream2 px-4 py-3">
              <p className="text-xs font-sans text-muted">{card.label}</p>
              <p className="text-lg font-sans font-semibold text-slate">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Clinics table */}
      <div className="bg-white rounded-md border border-cream2 overflow-hidden">
        <div className="px-5 py-4 border-b border-cream2">
          <h2 className="font-serif text-lg text-slate">All Clinics</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="border-b border-cream2 bg-cream/50">
                <th className="text-left px-4 py-3 text-muted font-medium">Clinic Name</th>
                <th className="text-left px-4 py-3 text-muted font-medium">District</th>
                <th className="text-left px-4 py-3 text-muted font-medium">Tier</th>
                <th className="text-left px-4 py-3 text-muted font-medium hidden md:table-cell">Retreats</th>
                <th className="text-left px-4 py-3 text-muted font-medium hidden md:table-cell">Bookings</th>
                <th className="text-left px-4 py-3 text-muted font-medium hidden lg:table-cell">Revenue</th>
                <th className="text-left px-4 py-3 text-muted font-medium">Status</th>
                <th className="text-left px-4 py-3 text-muted font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream2">
              {clinics.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted">
                    No clinics on the platform.
                  </td>
                </tr>
              ) : (
                clinics.map((clinic) => (
                  <tr key={clinic.id} className="hover:bg-cream/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate">{clinic.name}</td>
                    <td className="px-4 py-3 text-muted">{clinic.district}</td>
                    <td className="px-4 py-3">
                      {clinic.tier === 2 ? (
                        <span className="px-2 py-0.5 rounded text-xs font-sans font-medium bg-gold text-white">
                          Tier 2
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-sans font-medium bg-forest-lt text-forest">
                          Tier 1
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted hidden md:table-cell">{clinic.retreats_count}</td>
                    <td className="px-4 py-3 text-muted hidden md:table-cell">{clinic.bookings_count}</td>
                    <td className="px-4 py-3 text-muted hidden lg:table-cell">
                      {formatMoney(clinic.revenue, "INR", "en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          clinic.is_active ? "bg-forest-lt text-forest" : "bg-cream2 text-muted"
                        }`}
                      >
                        {clinic.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {clinic.tier === 1 && (
                        <button
                          onClick={() => handleUpgrade(clinic.id)}
                          disabled={upgrading === clinic.id}
                          className="px-3 py-1.5 rounded-xl bg-gold text-white text-xs font-sans font-medium hover:bg-gold/90 transition-colors disabled:opacity-50"
                        >
                          {upgrading === clinic.id ? "Upgrading..." : "Upgrade to Tier 2"}
                        </button>
                      )}
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
