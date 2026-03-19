"use client";

import { useEffect, useState, useMemo } from "react";
import {
  getAvailability,
  upsertAvailabilityDay,
  bulkSetAvailability,
  setRecurringAvailability,
  deleteAvailabilityDay,
  getTreatments,
  type AvailabilityDay,
  type Treatment,
} from "@/lib/admin-api";

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { firstDay, daysInMonth };
}

function formatDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function monthStr(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AvailabilityPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, AvailabilityDay>>({});
  const [loading, setLoading] = useState(true);

  // Selected day panel
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<{
    total_slots: number;
    is_closed: boolean;
    close_reason: string;
    treatment_ids: string[];
    notes: string;
  }>({ total_slots: 5, is_closed: false, close_reason: "", treatment_ids: [], notes: "" });
  const [saving, setSaving] = useState(false);

  // Block modal
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockFrom, setBlockFrom] = useState("");
  const [blockTo, setBlockTo] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [blocking, setBlocking] = useState(false);

  // Recurring modal
  const [showRecurring, setShowRecurring] = useState(false);
  const [recurWeekdays, setRecurWeekdays] = useState<number[]>([0, 1, 2, 3, 4]); // Mon–Fri
  const [recurSlots, setRecurSlots] = useState(5);
  const [recurTreatments, setRecurTreatments] = useState<string[]>([]);
  const [recurNotes, setRecurNotes] = useState("");
  const [recurring, setRecurring] = useState(false);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadMonth = async (y: number, m: number) => {
    try {
      const data = await getAvailability({ month: monthStr(y, m) });
      const map: Record<string, AvailabilityDay> = {};
      for (const d of data) map[d.slot_date] = d;
      setAvailabilityMap(map);
    } catch {
      // handled
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const t = await getTreatments();
        setTreatments(t.filter((x) => x.is_active));
      } catch {
        // handled
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    loadMonth(year, month);
  }, [year, month]);

  // ── Calendar navigation ─────────────────────────────────────────────────────

  const prevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
    setSelectedDate(null);
    setPanelOpen(false);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
    setSelectedDate(null);
    setPanelOpen(false);
  };

  // ── Day selection ───────────────────────────────────────────────────────────

  const openDay = (dateStr: string) => {
    setSelectedDate(dateStr);
    const existing = availabilityMap[dateStr];
    setEditing({
      total_slots: existing?.total_slots ?? 5,
      is_closed: existing?.is_closed ?? false,
      close_reason: existing?.close_reason ?? "",
      treatment_ids: existing?.treatment_ids ?? [],
      notes: existing?.notes ?? "",
    });
    setPanelOpen(true);
  };

  const handleSaveDay = async () => {
    if (!selectedDate) return;
    setSaving(true);
    try {
      await upsertAvailabilityDay(selectedDate, {
        total_slots: editing.total_slots,
        is_closed: editing.is_closed,
        close_reason: editing.close_reason || null,
        treatment_ids: editing.treatment_ids,
        notes: editing.notes || null,
      });
      await loadMonth(year, month);
      setPanelOpen(false);
    } catch {
      alert("Failed to save. Please try again.");
    }
    setSaving(false);
  };

  const handleDeleteDay = async () => {
    if (!selectedDate || !confirm("Remove configuration for this day? It will revert to the clinic default.")) return;
    try {
      await deleteAvailabilityDay(selectedDate);
      await loadMonth(year, month);
      setPanelOpen(false);
    } catch {
      alert("Failed to remove day configuration.");
    }
  };

  const toggleTreatment = (id: string) => {
    setEditing((prev) => ({
      ...prev,
      treatment_ids: prev.treatment_ids.includes(id)
        ? prev.treatment_ids.filter((t) => t !== id)
        : [...prev.treatment_ids, id],
    }));
  };

  // ── Block dates ─────────────────────────────────────────────────────────────

  const handleBlockDates = async () => {
    if (!blockFrom) return;
    setBlocking(true);
    try {
      const to = blockTo || blockFrom;
      // Enumerate dates in range and bulk-set as closed
      const dates: string[] = [];
      const start = new Date(blockFrom + "T00:00:00");
      const end = new Date(to + "T00:00:00");
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split("T")[0]);
      }
      await bulkSetAvailability({
        dates,
        total_slots: 0,
        is_closed: true,
        close_reason: blockReason || null,
        treatment_ids: [],
        notes: null,
      });
      await loadMonth(year, month);
      setShowBlockModal(false);
      setBlockFrom(""); setBlockTo(""); setBlockReason("");
    } catch {
      alert("Failed to block dates.");
    }
    setBlocking(false);
  };

  // ── Recurring ───────────────────────────────────────────────────────────────

  const handleSetRecurring = async () => {
    setRecurring(true);
    // Apply to the entire current displayed month
    const y = year, m = month;
    const { daysInMonth } = getMonthDays(y, m);
    const dateFrom = formatDate(y, m, 1);
    const dateTo = formatDate(y, m, daysInMonth);
    try {
      // Python weekday: Mon=0 … Sun=6. JS getDay: Sun=0, Mon=1 … Sat=6
      // Our UI uses Mon=0..Sun=6 (matches Python).
      await setRecurringAvailability({
        weekdays: recurWeekdays,
        date_from: dateFrom,
        date_to: dateTo,
        total_slots: recurSlots,
        is_closed: false,
        treatment_ids: recurTreatments,
        notes: recurNotes || null,
      });
      await loadMonth(year, month);
      setShowRecurring(false);
      setRecurWeekdays([0, 1, 2, 3, 4]);
      setRecurSlots(5);
      setRecurTreatments([]);
      setRecurNotes("");
    } catch {
      alert("Failed to apply recurring schedule.");
    }
    setRecurring(false);
  };

  // ── Calendar rendering ──────────────────────────────────────────────────────

  const { firstDay, daysInMonth } = useMemo(() => getMonthDays(year, month), [year, month]);

  const dayCells = [];
  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

  // Empty cells for days before the 1st
  for (let i = 0; i < firstDay; i++) {
    dayCells.push(<div key={`empty-${i}`} className="h-[72px]" />);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDate(year, month, d);
    const slot = availabilityMap[dateStr];
    const isSelected = selectedDate === dateStr && panelOpen;
    const isToday = dateStr === todayStr;

    let bgClass = "border-cream2 hover:border-forest/40 hover:bg-cream/40";
    let indicator: React.ReactNode = null;

    if (slot) {
      if (slot.is_closed) {
        bgClass = "border-red-200 bg-red-50 hover:border-red-300";
        indicator = (
          <span className="text-[10px] font-sans text-red-600 bg-red-100 rounded px-1 py-0.5 truncate block">
            Closed
          </span>
        );
      } else {
        bgClass = "border-forest/30 bg-forest-lt/40 hover:border-forest/60";
        indicator = (
          <span className="text-[10px] font-sans text-forest bg-forest-lt rounded px-1 py-0.5 truncate block">
            {slot.total_slots} slots
          </span>
        );
      }
    }

    if (isSelected) bgClass = "border-forest bg-forest-lt shadow-sm";

    dayCells.push(
      <button
        key={d}
        onClick={() => openDay(dateStr)}
        className={`h-[72px] p-1.5 rounded-md border text-left transition-all ${bgClass}`}
      >
        <span
          className={`text-xs font-sans font-semibold block mb-1 ${
            isToday ? "text-gold" : isSelected ? "text-forest" : "text-slate"
          }`}
        >
          {d}
          {isToday && <span className="ml-1 text-[9px] font-normal text-gold/80">Today</span>}
        </span>
        {indicator}
        {slot && slot.treatment_ids.length > 0 && !slot.is_closed && (
          <span className="text-[9px] font-sans text-muted truncate block mt-0.5">
            {slot.treatment_ids.length} treatment{slot.treatment_ids.length !== 1 ? "s" : ""}
          </span>
        )}
      </button>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  // ── Legend ──────────────────────────────────────────────────────────────────

  const openCount = Object.values(availabilityMap).filter(
    (d) => !d.is_closed && new Date(d.slot_date).getMonth() === month,
  ).length;
  const closedCount = Object.values(availabilityMap).filter(
    (d) => d.is_closed && new Date(d.slot_date).getMonth() === month,
  ).length;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl text-slate">Availability Calendar</h1>
          <p className="text-sm font-sans text-muted mt-0.5">
            Configure daily slot capacity and treatments for each day
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRecurring(true)}
            className="px-4 py-2 rounded-xl bg-forest text-white text-sm font-sans font-medium hover:bg-forest2 transition-colors"
          >
            Set Recurring
          </button>
          <button
            onClick={() => setShowBlockModal(true)}
            className="px-4 py-2 rounded-xl border border-red-300 text-red-600 text-sm font-sans font-medium hover:bg-red-50 transition-colors"
          >
            Block Dates
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-1.5 text-sm font-sans text-muted">
          <span className="w-3 h-3 rounded-sm bg-forest-lt border border-forest/30 inline-block" />
          {openCount} open
        </div>
        <div className="flex items-center gap-1.5 text-sm font-sans text-muted">
          <span className="w-3 h-3 rounded-sm bg-red-50 border border-red-200 inline-block" />
          {closedCount} closed
        </div>
        <div className="flex items-center gap-1.5 text-sm font-sans text-muted">
          <span className="w-3 h-3 rounded-sm bg-white border border-cream2 inline-block" />
          {daysInMonth - openCount - closedCount} unset (uses clinic default)
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="xl:col-span-2 bg-white rounded-md border border-cream2 p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 text-muted hover:text-slate transition-colors rounded-lg hover:bg-cream">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="font-serif text-lg text-slate">
              {MONTHS[month]} {year}
            </h2>
            <button onClick={nextMonth} className="p-2 text-muted hover:text-slate transition-colors rounded-lg hover:bg-cream">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS_SHORT.map((d) => (
              <div key={d} className="text-center text-xs font-sans text-muted py-1 font-medium">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">{dayCells}</div>
        </div>

        {/* Day detail panel */}
        <div className="bg-white rounded-md border border-cream2 flex flex-col">
          <div className="px-5 py-4 border-b border-cream2">
            <h3 className="font-serif text-lg text-slate">
              {selectedDate && panelOpen
                ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })
                : "Select a day"}
            </h3>
            {selectedDate && panelOpen && availabilityMap[selectedDate] && (
              <p className="text-xs font-sans text-muted mt-0.5">Configured — click Save to update</p>
            )}
            {selectedDate && panelOpen && !availabilityMap[selectedDate] && (
              <p className="text-xs font-sans text-muted mt-0.5">Not configured — save to set</p>
            )}
          </div>

          {!selectedDate || !panelOpen ? (
            <div className="flex-1 flex items-center justify-center px-5 py-10 text-center text-sm text-muted font-sans">
              Click a day on the calendar to configure it.
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Open / Closed toggle */}
              <div>
                <label className="block text-sm font-sans font-medium text-slate mb-2">Status</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing((p) => ({ ...p, is_closed: false }))}
                    className={`flex-1 py-2 rounded-md text-sm font-sans font-medium transition-colors ${
                      !editing.is_closed
                        ? "bg-forest text-white"
                        : "bg-cream text-muted hover:bg-cream2"
                    }`}
                  >
                    Open
                  </button>
                  <button
                    onClick={() => setEditing((p) => ({ ...p, is_closed: true }))}
                    className={`flex-1 py-2 rounded-md text-sm font-sans font-medium transition-colors ${
                      editing.is_closed
                        ? "bg-red-500 text-white"
                        : "bg-cream text-muted hover:bg-cream2"
                    }`}
                  >
                    Closed
                  </button>
                </div>
              </div>

              {editing.is_closed ? (
                <div>
                  <label className="block text-sm font-sans text-slate mb-1">Reason (optional)</label>
                  <input
                    type="text"
                    value={editing.close_reason}
                    onChange={(e) => setEditing((p) => ({ ...p, close_reason: e.target.value }))}
                    placeholder="e.g. Public holiday, Doctor leave"
                    className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                  />
                </div>
              ) : (
                <>
                  {/* Total slots */}
                  <div>
                    <label className="block text-sm font-sans text-slate mb-1">Total Slots (capacity)</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={editing.total_slots}
                      onChange={(e) =>
                        setEditing((p) => ({ ...p, total_slots: parseInt(e.target.value) || 1 }))
                      }
                      className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                    />
                    <p className="text-xs text-muted mt-1 font-sans">
                      Max number of guests that can be admitted on this day
                    </p>
                  </div>

                  {/* Treatments */}
                  <div>
                    <label className="block text-sm font-sans text-slate mb-1">Available Treatments</label>
                    <p className="text-xs text-muted mb-2 font-sans">
                      Leave all unchecked to offer all clinic treatments.
                    </p>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {treatments.length === 0 ? (
                        <p className="text-xs text-muted font-sans">No treatments set up yet.</p>
                      ) : (
                        treatments.map((t) => (
                          <label
                            key={t.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-cream cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={editing.treatment_ids.includes(t.id)}
                              onChange={() => toggleTreatment(t.id)}
                              className="w-4 h-4 rounded border-cream2 text-forest focus:ring-forest"
                            />
                            <span className="text-sm font-sans text-slate">{t.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-sans text-slate mb-1">Notes (internal)</label>
                    <textarea
                      rows={2}
                      value={editing.notes}
                      onChange={(e) => setEditing((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="Staff notes for this day…"
                      className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest resize-none"
                    />
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveDay}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-forest text-white text-sm font-sans font-medium hover:bg-forest2 transition-colors disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                {availabilityMap[selectedDate] && (
                  <button
                    onClick={handleDeleteDay}
                    className="px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-sans hover:bg-red-50 transition-colors"
                    title="Remove configuration (revert to default)"
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={() => setPanelOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-cream2 text-slate text-sm font-sans hover:bg-cream transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Block Dates Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-serif text-lg text-slate mb-4">Block Dates</h3>
            <p className="text-sm font-sans text-muted mb-4">
              Mark a date range as closed. This will override any existing configuration.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-sans text-slate mb-1">From</label>
                <input
                  type="date"
                  value={blockFrom}
                  onChange={(e) => setBlockFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30"
                />
              </div>
              <div>
                <label className="block text-sm font-sans text-slate mb-1">To (optional — defaults to same day)</label>
                <input
                  type="date"
                  value={blockTo}
                  min={blockFrom}
                  onChange={(e) => setBlockTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30"
                />
              </div>
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="e.g. Holiday, Staff training"
                  className="w-full px-3 py-2 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={() => { setShowBlockModal(false); setBlockFrom(""); setBlockTo(""); setBlockReason(""); }}
                className="px-4 py-2 rounded-xl text-sm font-sans text-slate hover:bg-cream transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBlockDates}
                disabled={!blockFrom || blocking}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-sans font-medium hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {blocking ? "Blocking…" : "Block"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Recurring Modal */}
      {showRecurring && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-serif text-lg text-slate mb-1">Set Recurring Schedule</h3>
            <p className="text-sm font-sans text-muted mb-4">
              Apply a slot configuration to selected weekdays throughout{" "}
              <strong className="text-slate">{MONTHS[month]} {year}</strong>.
            </p>
            <div className="space-y-5">
              {/* Weekday picker */}
              <div>
                <label className="block text-sm font-sans text-slate mb-2">Days of the Week</label>
                <div className="flex gap-1.5 flex-wrap">
                  {WEEKDAYS_FULL.map((day, i) => (
                    <button
                      key={day}
                      onClick={() =>
                        setRecurWeekdays((prev) =>
                          prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i]
                        )
                      }
                      className={`px-3 py-1.5 rounded-md text-xs font-sans font-medium transition-colors ${
                        recurWeekdays.includes(i)
                          ? "bg-forest text-white"
                          : "bg-cream text-muted hover:bg-cream2"
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slots */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Total Slots per Day</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={recurSlots}
                  onChange={(e) => setRecurSlots(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30"
                />
              </div>

              {/* Treatments */}
              {treatments.length > 0 && (
                <div>
                  <label className="block text-sm font-sans text-slate mb-1">Available Treatments</label>
                  <p className="text-xs text-muted mb-2 font-sans">
                    Leave unchecked to offer all clinic treatments.
                  </p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {treatments.map((t) => (
                      <label
                        key={t.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-cream cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={recurTreatments.includes(t.id)}
                          onChange={() =>
                            setRecurTreatments((prev) =>
                              prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id]
                            )
                          }
                          className="w-4 h-4 rounded border-cream2 text-forest focus:ring-forest"
                        />
                        <span className="text-sm font-sans text-slate">{t.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={recurNotes}
                  onChange={(e) => setRecurNotes(e.target.value)}
                  placeholder="e.g. Standard operating days"
                  className="w-full px-3 py-2 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={() => setShowRecurring(false)}
                className="px-4 py-2 rounded-xl text-sm font-sans text-slate hover:bg-cream transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSetRecurring}
                disabled={recurWeekdays.length === 0 || recurring}
                className="px-4 py-2 rounded-xl bg-forest text-white text-sm font-sans font-medium hover:bg-forest2 transition-colors disabled:opacity-60"
              >
                {recurring ? "Applying…" : `Apply to ${MONTHS[month]}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
