"use client";

import { useEffect, useState } from "react";
import {
  getClinicExperiences,
  createClinicExperience,
  updateClinicExperience,
  deleteClinicExperience,
  reorderClinicExperiences,
  type ClinicExperience,
} from "@/lib/admin-api";

const CATEGORIES = ["sightseeing", "adventure", "cultural", "nature", "wellness"] as const;

const EMPTY: Partial<ClinicExperience> = {
  name_en: "",
  name_ar: null,
  name_ml: null,
  description_en: null,
  description_ar: null,
  description_ml: null,
  category: "sightseeing",
  price_inr: 0,
  photos: [],
  max_per_booking: 1,
  is_active: true,
  display_order: 0,
};

export default function ExperiencesPage() {
  const [items, setItems] = useState<ClinicExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<ClinicExperience>>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const data = await getClinicExperiences();
      setItems(data);
    } catch {
      // silently handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditing({ ...EMPTY });
    setEditId(null);
    setError("");
    setPanelOpen(true);
  };

  const openEdit = (item: ClinicExperience) => {
    setEditing({ ...item });
    setEditId(item.id);
    setError("");
    setPanelOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      if (editId) {
        await updateClinicExperience(editId, editing);
      } else {
        await createClinicExperience(editing);
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
    if (!confirm("Remove this experience?")) return;
    try {
      await deleteClinicExperience(id);
      await load();
    } catch {
      alert("Could not remove experience.");
    }
  };

  const moveItem = async (index: number, direction: -1 | 1) => {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    try {
      await reorderClinicExperiences(next.map((i) => i.id));
    } catch {
      await load();
    }
  };

  const categoryColor = (cat: string) => {
    const map: Record<string, string> = {
      sightseeing: "rgba(30,61,47,0.1)",
      adventure: "rgba(220,100,40,0.1)",
      cultural: "rgba(100,60,160,0.1)",
      nature: "rgba(40,140,80,0.1)",
      wellness: "rgba(184,134,44,0.1)",
    };
    return map[cat] ?? "var(--cream2)";
  };

  return (
    <div style={{ padding: "2rem 1.5rem", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: "1.8rem", fontWeight: 400, color: "var(--forest)", marginBottom: 4 }}>
            Experiences
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            Paid add-ons your guests can book alongside a retreat.
          </p>
        </div>
        <button
          onClick={openAdd}
          style={{ background: "var(--forest)", color: "#fff", border: "none", borderRadius: "var(--r-xl)", padding: "9px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
        >
          + Add experience
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)" }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)", border: "1px dashed var(--border)", borderRadius: "var(--r-md)" }}>
          <p style={{ fontSize: 15, marginBottom: 8 }}>No experiences yet.</p>
          <p style={{ fontSize: 13 }}>Add sightseeing, boat tours, or cultural activities guests can book as add-ons.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((item, idx) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                background: "#fff",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                padding: "14px 18px",
                opacity: item.is_active ? 1 : 0.55,
              }}
            >
              {/* Order buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button
                  onClick={() => moveItem(idx, -1)}
                  disabled={idx === 0}
                  style={{ width: 24, height: 24, border: "1px solid var(--border)", borderRadius: 4, background: "#fff", cursor: idx === 0 ? "not-allowed" : "pointer", opacity: idx === 0 ? 0.3 : 1, fontSize: 12 }}
                >▲</button>
                <button
                  onClick={() => moveItem(idx, 1)}
                  disabled={idx === items.length - 1}
                  style={{ width: 24, height: 24, border: "1px solid var(--border)", borderRadius: 4, background: "#fff", cursor: idx === items.length - 1 ? "not-allowed" : "pointer", opacity: idx === items.length - 1 ? 0.3 : 1, fontSize: 12 }}
                >▼</button>
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span
                    style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", padding: "2px 8px", borderRadius: 99, background: categoryColor(item.category), color: "var(--forest)" }}
                  >
                    {item.category}
                  </span>
                  {!item.is_active && (
                    <span style={{ fontSize: 11, color: "var(--muted)", background: "var(--cream)", padding: "2px 8px", borderRadius: 99 }}>Inactive</span>
                  )}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--slate)" }}>{item.name_en}</div>
                {item.description_en && (
                  <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                    {item.description_en.slice(0, 90)}{item.description_en.length > 90 ? "…" : ""}
                  </div>
                )}
              </div>

              {/* Price */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "var(--serif)", fontSize: 16, fontWeight: 600, color: "var(--forest)" }}>
                  ₹{item.price_inr.toLocaleString("en-IN")}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>max {item.max_per_booking}/booking</div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => openEdit(item)}
                  style={{ padding: "6px 14px", border: "1px solid var(--border)", borderRadius: "var(--r-xl)", background: "#fff", fontSize: 13, cursor: "pointer" }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  style={{ padding: "6px 12px", border: "1px solid rgba(197,48,48,0.3)", borderRadius: "var(--r-xl)", background: "rgba(197,48,48,0.05)", color: "#c53030", fontSize: 13, cursor: "pointer" }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Slide-in panel ────────────────────────────────────────────────────── */}
      {panelOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 50, display: "flex", justifyContent: "flex-end" }}
          onClick={(e) => { if (e.target === e.currentTarget) setPanelOpen(false) }}
        >
          <div style={{ width: 480, maxWidth: "100vw", background: "#fff", height: "100%", overflowY: "auto", padding: "28px 28px 80px", boxShadow: "-4px 0 20px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontFamily: "var(--serif)", fontSize: "1.4rem", fontWeight: 400, color: "var(--forest)" }}>
                {editId ? "Edit experience" : "Add experience"}
              </h2>
              <button onClick={() => setPanelOpen(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--muted)" }}>×</button>
            </div>

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 16 }}>
                {error}
              </div>
            )}

            {/* Name */}
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Name (English) *
            </label>
            <input
              value={editing.name_en ?? ""}
              onChange={(e) => setEditing((p) => ({ ...p, name_en: e.target.value }))}
              placeholder="e.g. Varkala Cliff Sunset Walk"
              style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", fontSize: 14, marginBottom: 16, boxSizing: "border-box" }}
            />

            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Name (Arabic)
            </label>
            <input
              value={editing.name_ar ?? ""}
              onChange={(e) => setEditing((p) => ({ ...p, name_ar: e.target.value || null }))}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", fontSize: 14, marginBottom: 16, boxSizing: "border-box" }}
            />

            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Name (Malayalam)
            </label>
            <input
              value={editing.name_ml ?? ""}
              onChange={(e) => setEditing((p) => ({ ...p, name_ml: e.target.value || null }))}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", fontSize: 14, marginBottom: 16, boxSizing: "border-box" }}
            />

            {/* Category */}
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Category *
            </label>
            <select
              value={editing.category ?? "sightseeing"}
              onChange={(e) => setEditing((p) => ({ ...p, category: e.target.value as ClinicExperience["category"] }))}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", fontSize: 14, marginBottom: 16 }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>

            {/* Price */}
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Price (INR) *
            </label>
            <input
              type="number"
              min={1}
              value={editing.price_inr ?? ""}
              onChange={(e) => setEditing((p) => ({ ...p, price_inr: Number(e.target.value) }))}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", fontSize: 14, marginBottom: 16, boxSizing: "border-box" }}
            />

            {/* Description */}
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Description (English)
            </label>
            <textarea
              value={editing.description_en ?? ""}
              onChange={(e) => setEditing((p) => ({ ...p, description_en: e.target.value || null }))}
              rows={3}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", fontSize: 14, marginBottom: 16, resize: "vertical", boxSizing: "border-box" }}
            />

            {/* Max per booking */}
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Max quantity per booking
            </label>
            <input
              type="number"
              min={1}
              value={editing.max_per_booking ?? 1}
              onChange={(e) => setEditing((p) => ({ ...p, max_per_booking: Number(e.target.value) }))}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", fontSize: 14, marginBottom: 16, boxSizing: "border-box" }}
            />

            {/* Active */}
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--slate)", cursor: "pointer", marginBottom: 24 }}>
              <input
                type="checkbox"
                checked={editing.is_active ?? true}
                onChange={(e) => setEditing((p) => ({ ...p, is_active: e.target.checked }))}
              />
              Active (visible to guests)
            </label>

            <button
              onClick={handleSave}
              disabled={saving || !editing.name_en || !editing.price_inr}
              style={{ width: "100%", padding: "12px 0", background: "var(--forest)", color: "#fff", border: "none", borderRadius: "var(--r-xl)", fontSize: 15, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Saving…" : editId ? "Save changes" : "Add experience"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
