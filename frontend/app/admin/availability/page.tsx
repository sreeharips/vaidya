"use client";

import { useEffect, useState, useMemo } from "react";
import {
  getSlots,
  getDoctors,
  blockDates,
  setRecurring,
  createSlot,
  deleteSlot,
  type Slot,
  type Doctor,
} from "@/lib/admin-api";

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { firstDay, daysInMonth };
}

function formatDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function AvailabilityPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Modal states
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockFrom, setBlockFrom] = useState("");
  const [blockTo, setBlockTo] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const [showRecurring, setShowRecurring] = useState(false);
  const [recurDow, setRecurDow] = useState(1);
  const [recurStart, setRecurStart] = useState("09:00");
  const [recurEnd, setRecurEnd] = useState("17:00");
  const [recurMax, setRecurMax] = useState(5);
  const [recurFrom, setRecurFrom] = useState("");
  const [recurUntil, setRecurUntil] = useState("");

  const [showAddSlot, setShowAddSlot] = useState(false);
  const [newSlotStart, setNewSlotStart] = useState("09:00");
  const [newSlotEnd, setNewSlotEnd] = useState("17:00");
  const [newSlotMax, setNewSlotMax] = useState(5);

  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

  const load = async () => {
    try {
      const docs = await getDoctors();
      setDoctors(docs);
      if (docs.length > 0 && !selectedDoctorId) {
        setSelectedDoctorId(docs[0].id);
      }
    } catch {
      // handled
    }
    setLoading(false);
  };

  const loadSlots = async () => {
    if (!selectedDoctorId) return;
    try {
      const data = await getSlots({ doctor_id: selectedDoctorId, month: monthStr });
      setSlots(data);
    } catch {
      // handled
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    loadSlots();
  }, [selectedDoctorId, monthStr]);

  const { firstDay, daysInMonth } = useMemo(() => getMonthDays(year, month), [year, month]);

  const slotsByDate = useMemo(() => {
    const map: Record<string, Slot[]> = {};
    for (const s of slots) {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    }
    return map;
  }, [slots]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
    setSelectedDate(null);
  };

  const handleBlockDates = async () => {
    if (!selectedDoctorId || !blockFrom) return;
    const dates: string[] = [];
    const start = new Date(blockFrom);
    const end = blockTo ? new Date(blockTo) : start;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split("T")[0]);
    }
    try {
      await blockDates({ doctor_id: selectedDoctorId, dates, reason: blockReason });
      await loadSlots();
      setShowBlockModal(false);
      setBlockFrom("");
      setBlockTo("");
      setBlockReason("");
    } catch {
      alert("Failed to block dates.");
    }
  };

  const handleSetRecurring = async () => {
    if (!selectedDoctorId || !recurFrom || !recurUntil) return;
    try {
      await setRecurring({
        doctor_id: selectedDoctorId,
        day_of_week: recurDow,
        start_time: recurStart,
        end_time: recurEnd,
        max_patients: recurMax,
        valid_from: recurFrom,
        valid_until: recurUntil,
      });
      await loadSlots();
      setShowRecurring(false);
    } catch {
      alert("Failed to set recurring schedule.");
    }
  };

  const handleAddSlot = async () => {
    if (!selectedDoctorId || !selectedDate) return;
    try {
      await createSlot({
        doctor_id: selectedDoctorId,
        date: selectedDate,
        start_time: newSlotStart,
        end_time: newSlotEnd,
        max_patients: newSlotMax,
      });
      await loadSlots();
      setShowAddSlot(false);
    } catch {
      alert("Failed to add slot.");
    }
  };

  const handleDeleteSlot = async (id: string) => {
    if (!confirm("Remove this slot?")) return;
    try {
      await deleteSlot(id);
      await loadSlots();
    } catch {
      alert("Failed to remove slot.");
    }
  };

  const dayCells = [];
  for (let i = 0; i < firstDay; i++) {
    dayCells.push(<div key={`empty-${i}`} className="h-20" />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDate(year, month, d);
    const daySlots = slotsByDate[dateStr] || [];
    const available = daySlots.filter((s) => !s.is_blocked).reduce((sum, s) => sum + (s.max_patients - s.booked_count), 0);
    const booked = daySlots.reduce((sum, s) => sum + s.booked_count, 0);
    const blocked = daySlots.filter((s) => s.is_blocked).length;
    const isSelected = selectedDate === dateStr;
    const isToday = dateStr === formatDate(today.getFullYear(), today.getMonth(), today.getDate());

    dayCells.push(
      <button
        key={d}
        onClick={() => setSelectedDate(dateStr)}
        className={`h-20 p-1.5 rounded-md border text-left transition-colors ${
          isSelected
            ? "border-forest bg-forest-lt"
            : isToday
            ? "border-gold bg-gold-lt/30"
            : "border-cream2 hover:border-forest/30 hover:bg-cream"
        }`}
      >
        <span className={`text-xs font-sans font-medium ${isToday ? "text-gold" : "text-slate"}`}>
          {d}
        </span>
        {daySlots.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {available > 0 && (
              <div className="text-[10px] font-sans text-forest bg-forest-lt rounded px-1 truncate">
                {available} avail
              </div>
            )}
            {booked > 0 && (
              <div className="text-[10px] font-sans text-gold bg-gold-lt rounded px-1 truncate">
                {booked} booked
              </div>
            )}
            {blocked > 0 && (
              <div className="text-[10px] font-sans text-red-600 bg-red-50 rounded px-1 truncate">
                blocked
              </div>
            )}
          </div>
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

  const selectedSlots = selectedDate ? slotsByDate[selectedDate] || [] : [];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="font-serif text-2xl text-slate">Availability</h1>
        <div className="flex items-center gap-3">
          <select
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            className="px-3 py-2 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 bg-white"
          >
            {doctors.map((doc) => (
              <option key={doc.id} value={doc.id}>{doc.name}</option>
            ))}
          </select>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-white rounded-md border border-cream2 p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 text-muted hover:text-slate transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="font-serif text-lg text-slate">
              {MONTHS[month]} {year}
            </h2>
            <button onClick={nextMonth} className="p-2 text-muted hover:text-slate transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center text-xs font-sans text-muted py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">{dayCells}</div>
        </div>

        {/* Day detail */}
        <div className="bg-white rounded-md border border-cream2">
          <div className="px-5 py-4 border-b border-cream2 flex items-center justify-between">
            <h3 className="font-serif text-lg text-slate">
              {selectedDate
                ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })
                : "Select a date"}
            </h3>
            {selectedDate && (
              <button
                onClick={() => setShowAddSlot(true)}
                className="text-xs font-sans text-forest font-medium hover:text-gold transition-colors"
              >
                + Add Slot
              </button>
            )}
          </div>

          {!selectedDate ? (
            <div className="px-5 py-10 text-center text-sm text-muted font-sans">
              Click a day on the calendar to view details.
            </div>
          ) : selectedSlots.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted font-sans">
              No slots for this date.
            </div>
          ) : (
            <div className="divide-y divide-cream2">
              {selectedSlots.map((slot) => (
                <div key={slot.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-sans font-medium text-slate">
                        {slot.start_time} &ndash; {slot.end_time}
                      </p>
                      {slot.is_blocked ? (
                        <p className="text-xs font-sans text-red-500 mt-0.5">
                          Blocked{slot.block_reason ? `: ${slot.block_reason}` : ""}
                        </p>
                      ) : (
                        <p className="text-xs font-sans text-muted mt-0.5">
                          {slot.booked_count}/{slot.max_patients} booked
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteSlot(slot.id)}
                      className="p-1 text-red-400 hover:text-red-600 transition-colors"
                      title="Remove slot"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Block Dates Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-md p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-serif text-lg text-slate mb-4">Block Dates</h3>
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
                <label className="block text-sm font-sans text-slate mb-1">To (optional)</label>
                <input
                  type="date"
                  value={blockTo}
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
                  className="w-full px-3 py-2 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30"
                  placeholder="e.g. Holiday, Training"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={() => setShowBlockModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-sans text-slate hover:bg-cream transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBlockDates}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-sans font-medium hover:bg-red-700 transition-colors"
              >
                Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Recurring Modal */}
      {showRecurring && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-md p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-serif text-lg text-slate mb-4">Set Recurring Schedule</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Day of Week</label>
                <select
                  value={recurDow}
                  onChange={(e) => setRecurDow(parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-md border border-cream2 text-sm font-sans text-slate bg-white focus:outline-none focus:ring-2 focus:ring-forest/30"
                >
                  {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => (
                    <option key={d} value={i}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-sans text-slate mb-1">Start Time</label>
                  <input
                    type="time"
                    value={recurStart}
                    onChange={(e) => setRecurStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-sans text-slate mb-1">End Time</label>
                  <input
                    type="time"
                    value={recurEnd}
                    onChange={(e) => setRecurEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Max Patients per Slot</label>
                <input
                  type="number"
                  min={1}
                  value={recurMax}
                  onChange={(e) => setRecurMax(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-sans text-slate mb-1">Valid From</label>
                  <input
                    type="date"
                    value={recurFrom}
                    onChange={(e) => setRecurFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-sans text-slate mb-1">Valid Until</label>
                  <input
                    type="date"
                    value={recurUntil}
                    onChange={(e) => setRecurUntil(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30"
                  />
                </div>
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
                className="px-4 py-2 rounded-xl bg-forest text-white text-sm font-sans font-medium hover:bg-forest2 transition-colors"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Slot Modal */}
      {showAddSlot && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-md p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-serif text-lg text-slate mb-4">
              Add Slot — {new Date(selectedDate + "T00:00:00").toLocaleDateString()}
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-sans text-slate mb-1">Start Time</label>
                  <input
                    type="time"
                    value={newSlotStart}
                    onChange={(e) => setNewSlotStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-sans text-slate mb-1">End Time</label>
                  <input
                    type="time"
                    value={newSlotEnd}
                    onChange={(e) => setNewSlotEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Max Patients</label>
                <input
                  type="number"
                  min={1}
                  value={newSlotMax}
                  onChange={(e) => setNewSlotMax(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={() => setShowAddSlot(false)}
                className="px-4 py-2 rounded-xl text-sm font-sans text-slate hover:bg-cream transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSlot}
                className="px-4 py-2 rounded-xl bg-forest text-white text-sm font-sans font-medium hover:bg-forest2 transition-colors"
              >
                Add Slot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
