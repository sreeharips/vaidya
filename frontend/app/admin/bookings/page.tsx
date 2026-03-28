"use client";

import { useEffect, useState } from "react";
import {
  getBookings,
  getBookingStats,
  acceptBooking,
  declineBooking,
  completeBooking,
  createAdminBooking,
  getRetreats,
  type Booking,
  type BookingStats,
  type Retreat,
  type AdminBookingCreate,
} from "@/lib/admin-api";

const TABS = ["pending", "confirmed", "completed", "cancelled"] as const;
type TabStatus = (typeof TABS)[number];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  payment_received: "bg-blue-100 text-blue-700",
  confirmed: "bg-forest-lt text-forest",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-cream2 text-muted",
};

export default function BookingsPage() {
  const [tab, setTab] = useState<TabStatus>("pending");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<BookingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Decline modal
  const [showDeclineModal, setShowDeclineModal] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  // Create booking panel
  const [showCreate, setShowCreate] = useState(false);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [createForm, setCreateForm] = useState<AdminBookingCreate>({
    retreat_id: "",
    start_date: "",
    end_date: "",
    guest_name: "",
    guest_email: "",
    guest_count: 1,
    lang: "en",
    notes: "",
    skip_availability_check: false,
  });
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────────

  const load = async (status: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const [b, s] = await Promise.all([
        getBookings({ status, limit: 50 }),
        getBookingStats(),
      ]);
      setBookings(b.items);
      setTotal(b.total);
      setStats(s);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Failed to load bookings");
    }
    setLoading(false);
  };

  const loadPackages = async () => {
    try {
      const pkgs = await getRetreats();
      setRetreats(pkgs.filter((p) => p.is_active));
    } catch {
      // handled
    }
  };

  useEffect(() => {
    load(tab);
  }, [tab]);

  useEffect(() => {
    loadPackages();
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

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

  const handleCreate = async () => {
    if (!createForm.retreat_id || !createForm.start_date || !createForm.end_date || !createForm.guest_name.trim()) {
      setCreateError("Package, dates, and guest name are required.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      await createAdminBooking(createForm);
      setShowCreate(false);
      setCreateForm({
        retreat_id: "",
        start_date: "",
        end_date: "",
        guest_name: "",
        guest_email: "",
        guest_count: 1,
        lang: "en",
        notes: "",
        skip_availability_check: false,
      });
      await load(tab);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create booking.";
      setCreateError(msg);
    }
    setCreating(false);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const selectedPackage = retreats.find((r) => r.id === createForm.retreat_id);

  const nightsEstimate =
    createForm.start_date && createForm.end_date
      ? Math.max(
          0,
          Math.floor(
            (new Date(createForm.end_date).getTime() - new Date(createForm.start_date).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null;

  const statCards = stats
    ? [
        { label: "This Month", value: stats.bookings_this_month, color: "text-slate" },
        { label: "Revenue", value: `$${stats.revenue_this_month.toLocaleString()}`, color: "text-forest" },
        { label: "Pending", value: stats.pending_requests, color: "text-amber-600" },
        { label: "Active Retreats", value: stats.active_retreats, color: "text-slate" },
      ]
    : [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-slate">Bookings</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2.5 rounded-xl bg-forest text-white text-sm font-sans font-medium hover:bg-forest2 transition-colors"
        >
          + New Booking
        </button>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {statCards.map((card) => (
            <div key={card.label} className="bg-white rounded-md border border-cream2 px-4 py-3">
              <p className="text-xs font-sans text-muted">{card.label}</p>
              <p className={`text-lg font-sans font-semibold ${card.color}`}>{card.value}</p>
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
      ) : loadError ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-6 text-center">
          <p className="text-sm font-sans text-red-700">{loadError}</p>
          {loadError.includes("clinic") && (
            <p className="text-xs font-sans text-red-500 mt-2">
              Your account may not be linked to a clinic. Contact a platform admin.
            </p>
          )}
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
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                {/* Left: details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="font-sans text-sm font-semibold text-slate truncate">
                      {booking.guest_name}
                    </h3>
                    {booking.guest_email && (
                      <span className="text-xs font-sans text-muted">{booking.guest_email}</span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium ${STATUS_COLORS[booking.status] || "bg-cream2 text-muted"}`}>
                      {booking.status.replace("_", " ")}
                    </span>
                  </div>

                  <p className="text-sm font-sans text-slate">
                    <span className="font-medium">{booking.retreat_name}</span>
                    {booking.guest_count > 1 && (
                      <span className="text-muted ml-2">
                        ({booking.guest_count} guest{booking.guest_count !== 1 ? "s" : ""})
                      </span>
                    )}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-sans text-muted">
                    <span>
                      {new Date(booking.start_date).toLocaleDateString()} &ndash;{" "}
                      {new Date(booking.end_date).toLocaleDateString()}
                    </span>
                    <span className="font-medium text-slate">
                      {booking.nights} night{booking.nights !== 1 ? "s" : ""}
                    </span>
                    <span className="font-semibold text-slate">
                      ${booking.total_amount.toLocaleString()} {booking.currency}
                    </span>
                    <span className="text-gold">
                      Commission: ${booking.commission_amount.toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs font-sans text-muted mt-1">
                    Booked {new Date(booking.created_at).toLocaleDateString()}
                    {booking.payment_ref && (
                      <span className="ml-2">Ref: {booking.payment_ref}</span>
                    )}
                  </p>
                </div>

                {/* Right: actions */}
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

      {/* ── Create Booking Panel ──────────────────────────────────────────── */}
      {showCreate && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowCreate(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-cream2 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-serif text-lg text-slate">New Booking</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1 text-muted hover:text-slate transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Package */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">
                  Package <span className="text-red-500">*</span>
                </label>
                <select
                  value={createForm.retreat_id}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, retreat_id: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest bg-white"
                >
                  <option value="">Select retreat...</option>
                  {retreats.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.package_type})
                      {pkg.duration_min_days ? ` — ${pkg.duration_min_days}–${pkg.duration_max_days} days` : ""}
                      {pkg.price_usd ? ` — $${pkg.price_usd}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-sans text-slate mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={createForm.start_date}
                    onChange={(e) => setCreateForm((p) => ({ ...p, start_date: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                  />
                </div>
                <div>
                  <label className="block text-sm font-sans text-slate mb-1">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={createForm.end_date}
                    min={createForm.start_date || undefined}
                    onChange={(e) => setCreateForm((p) => ({ ...p, end_date: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                  />
                </div>
              </div>

              {/* Duration + price summary */}
              {selectedPackage && nightsEstimate !== null && nightsEstimate > 0 && (
                <div className="bg-cream/60 rounded-md px-4 py-3">
                  <div className="flex items-center justify-between text-sm font-sans">
                    <span className="text-muted">
                      {nightsEstimate} night{nightsEstimate !== 1 ? "s" : ""}
                      {selectedPackage.duration_min_days && (
                        <span className="ml-1">
                          (recommended: {selectedPackage.duration_min_days}–{selectedPackage.duration_max_days} days)
                        </span>
                      )}
                    </span>
                    {selectedPackage.price_usd && (
                      <span className="font-semibold text-slate">${selectedPackage.price_usd} USD</span>
                    )}
                  </div>
                </div>
              )}

              <hr className="border-cream2" />

              {/* Guest info */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">
                  Guest Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.guest_name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, guest_name: e.target.value }))}
                  placeholder="Full name"
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-sans text-slate mb-1">Email</label>
                  <input
                    type="email"
                    value={createForm.guest_email || ""}
                    onChange={(e) => setCreateForm((p) => ({ ...p, guest_email: e.target.value }))}
                    placeholder="guest@email.com"
                    className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                  />
                </div>
                <div>
                  <label className="block text-sm font-sans text-slate mb-1">
                    Guests <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={createForm.guest_count}
                    onChange={(e) =>
                      setCreateForm((p) => ({
                        ...p,
                        guest_count: Math.min(10, Math.max(1, parseInt(e.target.value) || 1)),
                      }))
                    }
                    className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                  />
                </div>
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Language</label>
                <select
                  value={createForm.lang}
                  onChange={(e) => setCreateForm((p) => ({ ...p, lang: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest bg-white"
                >
                  <option value="en">English</option>
                  <option value="ml">Malayalam</option>
                  <option value="hi">Hindi</option>
                  <option value="ar">Arabic</option>
                  <option value="de">German</option>
                  <option value="fr">French</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Internal Notes</label>
                <textarea
                  rows={2}
                  value={createForm.notes || ""}
                  onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Walk-in, phone booking, special requests..."
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest resize-none"
                />
              </div>

              {/* Skip availability check */}
              <label className="flex items-center gap-2 text-sm font-sans text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={createForm.skip_availability_check}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, skip_availability_check: e.target.checked }))
                  }
                  className="rounded border-cream2 text-forest focus:ring-forest/30"
                />
                Skip availability check
              </label>

              {/* Error */}
              {createError && (
                <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm font-sans text-red-700">
                  {createError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 py-2.5 rounded-xl bg-forest text-white text-sm font-sans font-medium hover:bg-forest2 transition-colors disabled:opacity-60"
                >
                  {creating ? "Creating..." : "Create Booking"}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-6 py-2.5 rounded-xl border border-cream2 text-sm font-sans text-slate hover:bg-cream transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Decline Reason Modal ──────────────────────────────────────────── */}
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
