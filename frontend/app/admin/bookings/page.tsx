"use client";

import { useEffect, useState } from "react";
import {
  getBookings,
  getBookingStats,
  acceptBooking,
  declineBooking,
  completeBooking,
  type Booking,
  type BookingStats,
} from "@/lib/admin-api";

const TABS = ["pending", "confirmed", "completed", "cancelled"] as const;
type TabStatus = (typeof TABS)[number];

export default function BookingsPage() {
  const [tab, setTab] = useState<TabStatus>("pending");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<BookingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showDeclineModal, setShowDeclineModal] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const load = async (status: string) => {
    setLoading(true);
    try {
      const [b, s] = await Promise.all([
        getBookings({ status, limit: 50 }),
        getBookingStats(),
      ]);
      setBookings(b.items);
      setTotal(b.total);
      setStats(s);
    } catch {
      // handled
    }
    setLoading(false);
  };

  useEffect(() => {
    load(tab);
  }, [tab]);

  const handleAccept = async (id: string) => {
    setActionLoading(id);
    try {
      await acceptBooking(id);
      await load(tab);
    } catch {
      alert("Failed to accept booking.");
    }
    setActionLoading(null);
  };

  const handleDecline = async () => {
    if (!showDeclineModal || !declineReason.trim()) return;
    setActionLoading(showDeclineModal);
    try {
      await declineBooking(showDeclineModal, declineReason);
      await load(tab);
    } catch {
      alert("Failed to decline booking.");
    }
    setActionLoading(null);
    setShowDeclineModal(null);
    setDeclineReason("");
  };

  const handleComplete = async (id: string) => {
    setActionLoading(id);
    try {
      await completeBooking(id);
      await load(tab);
    } catch {
      alert("Failed to complete booking.");
    }
    setActionLoading(null);
  };

  const statCards = stats
    ? [
        { label: "This Month", value: stats.bookings_this_month },
        { label: "Revenue", value: `$${stats.revenue_this_month.toLocaleString()}` },
        { label: "Pending", value: stats.pending_requests },
        { label: "Doctors", value: stats.active_doctors },
      ]
    : [];

  return (
    <div>
      <h1 className="font-serif text-2xl text-slate mb-6">Bookings</h1>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {statCards.map((card) => (
            <div key={card.label} className="bg-white rounded-md border border-cream2 px-4 py-3">
              <p className="text-xs font-sans text-muted">{card.label}</p>
              <p className="text-lg font-sans font-semibold text-slate">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-cream rounded-md p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-sans font-medium capitalize transition-colors ${
              tab === t
                ? "bg-white text-slate shadow-sm"
                : "text-muted hover:text-slate"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Bookings list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-forest border-t-transparent" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-md border border-cream2 p-10 text-center">
          <p className="text-sm font-sans text-muted">No {tab} bookings.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-white rounded-md border border-cream2 p-5"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-sans text-sm font-semibold text-slate truncate">
                      {booking.patient_name}
                    </h3>
                    <span className="text-xs font-sans text-muted">
                      {booking.patient_email}
                    </span>
                  </div>
                  <p className="text-sm font-sans text-slate">
                    {booking.treatment_name}
                    <span className="text-muted"> with Dr. {booking.doctor_name}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-sans text-muted">
                    <span>
                      {new Date(booking.start_date).toLocaleDateString()} &ndash;{" "}
                      {new Date(booking.end_date).toLocaleDateString()}
                    </span>
                    <span className="font-medium text-slate">
                      ${booking.total_amount.toLocaleString()}
                    </span>
                    <span className="text-gold">
                      Commission: ${booking.commission_amount.toLocaleString()}
                    </span>
                    {booking.status === "cancelled" && (
                      <span className="text-red-500">Declined</span>
                    )}
                  </div>
                  <p className="text-xs font-sans text-muted mt-1">
                    Booked {new Date(booking.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {tab === "pending" && (
                    <>
                      <button
                        onClick={() => handleAccept(booking.id)}
                        disabled={actionLoading === booking.id}
                        className="px-4 py-2 rounded-xl bg-forest text-white text-xs font-sans font-medium hover:bg-forest2 transition-colors disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => {
                          setShowDeclineModal(booking.id);
                          setDeclineReason("");
                        }}
                        disabled={actionLoading === booking.id}
                        className="px-4 py-2 rounded-xl border border-red-300 text-red-600 text-xs font-sans font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {tab === "confirmed" && (
                    <button
                      onClick={() => handleComplete(booking.id)}
                      disabled={actionLoading === booking.id}
                      className="px-4 py-2 rounded-xl bg-gold text-white text-xs font-sans font-medium hover:bg-gold/90 transition-colors disabled:opacity-50"
                    >
                      Mark Complete
                    </button>
                  )}
                  {(tab === "completed" || tab === "cancelled") && (
                    <span
                      className={`px-3 py-1.5 rounded-md text-xs font-sans font-medium ${
                        tab === "completed"
                          ? "bg-forest-lt text-forest"
                          : "bg-cream2 text-muted"
                      }`}
                    >
                      {tab === "completed" ? "Completed" : "Cancelled"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {total > bookings.length && (
            <p className="text-center text-sm font-sans text-muted py-4">
              Showing {bookings.length} of {total} bookings.
            </p>
          )}
        </div>
      )}

      {/* Decline reason modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-md p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-serif text-lg text-slate mb-3">Decline Booking</h3>
            <p className="text-sm font-sans text-muted mb-4">
              Please provide a reason for declining this booking.
            </p>
            <textarea
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 resize-vertical mb-4"
              placeholder="e.g. Fully booked for those dates..."
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeclineModal(null);
                  setDeclineReason("");
                }}
                className="px-4 py-2 rounded-xl text-sm font-sans text-slate hover:bg-cream transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDecline}
                disabled={!declineReason.trim()}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-sans font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
