"use client";

import { useEffect, useState } from "react";
import {
  getClinicRooms,
  createClinicRoom,
  updateClinicRoom,
  deleteClinicRoom,
  type Room,
  type RoomCategory,
} from "@/lib/admin-api";

const CATEGORIES: { value: RoomCategory; label: string; badge: string }[] = [
  { value: "non_ac",      label: "Non-AC Standard", badge: "#6b7280" },
  { value: "ac_standard", label: "AC Standard",     badge: "#0ea5e9" },
  { value: "deluxe",      label: "Deluxe AC",       badge: "#8b5cf6" },
  { value: "suite",       label: "Suite",            badge: "#b8862c" },
];

const COMMON_AMENITIES = [
  "Air Conditioning", "Hot Water", "Private Bathroom", "WiFi", "TV",
  "Balcony", "Garden View", "Sea View", "Mini Fridge", "Kettle",
  "Room Service", "Hair Dryer", "Safe", "Mosquito Net", "Ayurvedic Toiletries",
];

const EMPTY: Partial<Room> = {
  name: "",
  category: "non_ac",
  description: "",
  price_per_night_inr: 0,
  amenities: [],
  photos: [],
  max_occupancy: 2,
  is_active: true,
  display_order: 0,
};

function CategoryBadge({ category }: { category: RoomCategory }) {
  const c = CATEGORIES.find(c => c.value === category);
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 600,
      background: (c?.badge ?? "#6b7280") + "22",
      color: c?.badge ?? "#6b7280",
      border: `1px solid ${(c?.badge ?? "#6b7280")}44`,
    }}>
      {c?.label ?? category}
    </span>
  );
}

export default function RoomsPage() {
  const [items, setItems] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Room>>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [photosText, setPhotosText] = useState("");

  const load = async () => {
    try {
      setItems(await getClinicRooms());
    } catch {
      // silently handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing({ ...EMPTY, amenities: [], photos: [] });
    setPhotosText("");
    setEditId(null);
    setError("");
    setPanelOpen(true);
  };

  const openEdit = (item: Room) => {
    setEditing({ ...item });
    setPhotosText((item.photos ?? []).join("\n"));
    setEditId(item.id);
    setError("");
    setPanelOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    const photos = photosText
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(Boolean);
    const payload = { ...editing, photos };
    try {
      if (editId) {
        await updateClinicRoom(editId, payload);
      } else {
        await createClinicRoom(payload);
      }
      setPanelOpen(false);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this room? It will be hidden from bookings.")) return;
    try {
      await deleteClinicRoom(id);
      await load();
    } catch {
      alert("Could not remove room.");
    }
  };

  const toggleAmenity = (a: string) => {
    const current = editing.amenities ?? [];
    setEditing(prev => ({
      ...prev,
      amenities: current.includes(a)
        ? current.filter(x => x !== a)
        : [...current, a],
    }));
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: "1.6rem", fontWeight: 400, color: "var(--forest)", margin: 0 }}>
            Rooms
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>
            Configure room types — guests select a room during booking.
          </p>
        </div>
        <button
          onClick={openAdd}
          style={{
            padding: "10px 20px", background: "var(--forest)", color: "#fff",
            border: "none", borderRadius: "var(--r-xl)", fontSize: 13, fontWeight: 600,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add room
        </button>
      </div>

      {/* Room list */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-forest border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 24px",
          border: "2px dashed var(--border)", borderRadius: "var(--r-lg)",
          color: "var(--muted)",
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🛏</div>
          <p style={{ fontSize: 14, margin: "0 0 16px" }}>No rooms configured yet.</p>
          <button
            onClick={openAdd}
            style={{
              padding: "8px 20px", background: "var(--forest)", color: "#fff",
              border: "none", borderRadius: "var(--r-xl)", fontSize: 13, cursor: "pointer",
            }}
          >
            Add your first room
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {items.map(room => (
            <div
              key={room.id}
              style={{
                background: "#fff",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                opacity: room.is_active ? 1 : 0.55,
              }}
            >
              {/* Photo thumbnail */}
              {room.photos?.[0] ? (
                <img
                  src={room.photos[0]}
                  alt={room.name}
                  style={{ width: 72, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: 72, height: 56, borderRadius: 8, background: "var(--cream)",
                  flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, color: "var(--muted)",
                }}>🛏</div>
              )}

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--slate)" }}>{room.name}</span>
                  <CategoryBadge category={room.category as RoomCategory} />
                  {!room.is_active && (
                    <span style={{ fontSize: 11, color: "#ef4444", background: "#fef2f2", padding: "1px 8px", borderRadius: 99, border: "1px solid #fecaca" }}>
                      Hidden
                    </span>
                  )}
                </div>
                {room.amenities?.length > 0 && (
                  <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>
                    {room.amenities.slice(0, 5).join(" · ")}
                    {room.amenities.length > 5 && ` +${room.amenities.length - 5} more`}
                  </div>
                )}
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  Max {room.max_occupancy} guests
                </div>
              </div>

              {/* Price */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--forest)" }}>
                  ₹{Math.round(room.price_per_night_inr).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>per night</div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => openEdit(room)}
                  style={{
                    padding: "7px 14px", border: "1px solid var(--border)",
                    borderRadius: "var(--r-md)", fontSize: 12, background: "#fff",
                    cursor: "pointer", color: "var(--slate)", fontWeight: 500,
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(room.id)}
                  style={{
                    padding: "7px 14px", border: "1px solid #fecaca",
                    borderRadius: "var(--r-md)", fontSize: 12, background: "#fff",
                    cursor: "pointer", color: "#ef4444",
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide-out panel */}
      {panelOpen && (
        <>
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 40 }}
            onClick={() => setPanelOpen(false)}
          />
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0, width: "min(480px, 100vw)",
            background: "#fff", zIndex: 50, overflowY: "auto",
            boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
          }}>
            <div style={{ padding: "24px 28px 100px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <h2 style={{ fontFamily: "var(--serif)", fontSize: "1.25rem", fontWeight: 400, color: "var(--forest)", margin: 0 }}>
                  {editId ? "Edit room" : "Add room"}
                </h2>
                <button onClick={() => setPanelOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "var(--muted)" }}>×</button>
              </div>

              {/* Name */}
              <label style={{ display: "block", marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Room name *</span>
                <input
                  className="booking-input"
                  style={{ width: "100%", marginTop: 6 }}
                  placeholder="e.g. Deluxe Garden Room"
                  value={editing.name ?? ""}
                  onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                />
              </label>

              {/* Category */}
              <label style={{ display: "block", marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Category *</span>
                <select
                  className="booking-select"
                  style={{ width: "100%", marginTop: 6 }}
                  value={editing.category ?? "non_ac"}
                  onChange={e => setEditing(p => ({ ...p, category: e.target.value as RoomCategory }))}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>

              {/* Price + Occupancy */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <label>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Price / night (₹) *</span>
                  <input
                    className="booking-input"
                    type="number"
                    min={1}
                    style={{ width: "100%", marginTop: 6 }}
                    placeholder="3000"
                    value={editing.price_per_night_inr || ""}
                    onChange={e => setEditing(p => ({ ...p, price_per_night_inr: Number(e.target.value) }))}
                  />
                </label>
                <label>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Max guests</span>
                  <select
                    className="booking-select"
                    style={{ width: "100%", marginTop: 6 }}
                    value={editing.max_occupancy ?? 2}
                    onChange={e => setEditing(p => ({ ...p, max_occupancy: Number(e.target.value) }))}
                  >
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              </div>

              {/* Description */}
              <label style={{ display: "block", marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</span>
                <textarea
                  className="booking-input"
                  rows={3}
                  style={{ width: "100%", marginTop: 6, resize: "vertical" }}
                  placeholder="Spacious room with garden views and traditional Kerala décor…"
                  value={editing.description ?? ""}
                  onChange={e => setEditing(p => ({ ...p, description: e.target.value }))}
                />
              </label>

              {/* Amenities */}
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Amenities</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {COMMON_AMENITIES.map(a => {
                    const selected = (editing.amenities ?? []).includes(a);
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleAmenity(a)}
                        style={{
                          padding: "5px 12px",
                          borderRadius: 99,
                          fontSize: 12,
                          border: `1.5px solid ${selected ? "var(--forest)" : "var(--border)"}`,
                          background: selected ? "var(--forest)" : "#fff",
                          color: selected ? "#fff" : "var(--slate)",
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        {a}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Photos */}
              <label style={{ display: "block", marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Photo URLs</span>
                <span style={{ display: "block", fontSize: 11, color: "var(--muted)", marginTop: 2 }}>One URL per line (use S3/CDN URLs from the Images page)</span>
                <textarea
                  className="booking-input"
                  rows={3}
                  style={{ width: "100%", marginTop: 6, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
                  placeholder={"https://cdn.example.com/room1.jpg\nhttps://cdn.example.com/room2.jpg"}
                  value={photosText}
                  onChange={e => setPhotosText(e.target.value)}
                />
              </label>

              {/* Active toggle */}
              <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={editing.is_active ?? true}
                  onChange={e => setEditing(p => ({ ...p, is_active: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: "var(--forest)" }}
                />
                <span style={{ fontSize: 13, color: "var(--slate)" }}>Visible to guests during booking</span>
              </label>

              {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setPanelOpen(false)}
                  style={{
                    flex: 1, padding: "11px 0",
                    border: "1.5px solid var(--border)", borderRadius: "var(--r-xl)",
                    background: "#fff", fontSize: 13, cursor: "pointer", color: "var(--slate)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !editing.name || !editing.price_per_night_inr}
                  style={{
                    flex: 2, padding: "11px 0",
                    background: (saving || !editing.name || !editing.price_per_night_inr) ? "var(--border)" : "var(--forest)",
                    color: (saving || !editing.name || !editing.price_per_night_inr) ? "var(--muted)" : "#fff",
                    border: "none", borderRadius: "var(--r-xl)",
                    fontSize: 13, fontWeight: 600,
                    cursor: (saving || !editing.name || !editing.price_per_night_inr) ? "not-allowed" : "pointer",
                  }}
                >
                  {saving ? "Saving…" : editId ? "Save changes" : "Add room"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
