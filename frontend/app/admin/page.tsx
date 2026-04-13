"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getBookingStats,
  getBookings,
  acceptBooking,
  declineBooking,
  type BookingStats,
  type Booking,
} from "@/lib/admin-api";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<BookingStats | null>(null);
  const [pending, setPending] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
    try {
      const [s, b] = await Promise.all([
        getBookingStats(),
        getBookings({ status: "pending", limit: 5 }),
      ]);
      setStats(s);
      setPending(b.items);
    } catch {
      // handled by adminFetch redirect
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem("admin_user");
    if (stored) {
      try {
        const u = JSON.parse(stored);
        if (u.role === "platform_admin") {
          router.replace("/admin/platform");
          return;
        }
      } catch { /* ignore */ }
    }
    load();
  }, []);

  const handleAccept = async (id: string) => {
    setActionLoading(id);
    try {
      await acceptBooking(id);
      await load();
    } catch {
      // silently fail
    }
    setActionLoading(null);
  };

  const handleDecline = async (id: string) => {
    const reason = prompt("Reason for declining:");
    if (!reason) return;
    setActionLoading(id);
    try {
      await declineBooking(id, reason);
      await load();
    } catch {
      // silently fail
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

  const statCards = [
    {
      label: "Bookings this month",
      value: stats?.bookings_this_month ?? 0,
      color: "bg-forest-lt text-forest",
    },
    {
      label: "Revenue this month",
      value: `$${(stats?.revenue_this_month ?? 0).toLocaleString()}`,
      color: "bg-gold-lt text-gold",
    },
    {
      label: "Pending requests",
      value: stats?.pending_requests ?? 0,
      color: "bg-bark-lt text-bark",
    },
    {
      label: "Active retreats",
      value: stats?.active_retreats ?? 0,
      color: "bg-forest-lt text-forest",
    },
  ];

  return (
    <div>
      <h1 className="font-serif text-2xl text-slate mb-6">Dashboard</h1>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-md border border-cream2 p-5"
          >
            <p className="text-sm font-sans text-muted mb-1">{card.label}</p>
            <p className="text-2xl font-sans font-semibold text-slate">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending bookings */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-md border border-cream2">
            <div className="px-5 py-4 border-b border-cream2">
              <h2 className="font-serif text-lg text-slate">Pending Bookings</h2>
            </div>
            {pending.length === 0 ? (
              <div className="px-5 py-10 text-center text-muted text-sm font-sans">
                No pending bookings.
              </div>
            ) : (
              <div className="divide-y divide-cream2">
                {pending.map((booking) => (
                  <div key={booking.id} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-sans text-sm font-medium text-slate truncate">
                        {booking.guest_name}
                      </p>
                      <p className="font-sans text-xs text-muted mt-0.5">
                        {booking.retreat_name}
                      </p>
                      <p className="font-sans text-xs text-muted">
                        {new Date(booking.start_date).toLocaleDateString()} &ndash;{" "}
                        {new Date(booking.end_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleAccept(booking.id)}
                        disabled={actionLoading === booking.id}
                        className="px-3 py-1.5 rounded-xl bg-forest text-white text-xs font-sans font-medium hover:bg-forest2 transition-colors disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDecline(booking.id)}
                        disabled={actionLoading === booking.id}
                        className="px-3 py-1.5 rounded-xl bg-white border border-red-300 text-red-600 text-xs font-sans font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick links */}
        <div>
          <div className="bg-white rounded-md border border-cream2">
            <div className="px-5 py-4 border-b border-cream2">
              <h2 className="font-serif text-lg text-slate">Quick Links</h2>
            </div>
            <div className="p-4 space-y-2">
              {[
                { label: "Edit clinic profile", href: "/admin/clinic" },
                { label: "Manage retreats", href: "/admin/retreats" },
                { label: "Manage team", href: "/admin/team" },
                { label: "View all bookings", href: "/admin/bookings" },
              ].map((link) => (
                <button
                  key={link.href}
                  onClick={() => router.push(link.href)}
                  className="w-full text-left px-4 py-2.5 rounded-md text-sm font-sans text-forest hover:bg-forest-lt transition-colors"
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
