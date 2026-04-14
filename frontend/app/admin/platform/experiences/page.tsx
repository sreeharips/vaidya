"use client";

import { useEffect, useState } from "react";
import {
  getPlatformExperiences,
  createPlatformExperience,
  updatePlatformExperience,
  deletePlatformExperience,
  type PlatformExperience,
} from "@/lib/admin-api";

const CATEGORIES = ["sightseeing", "adventure", "cultural", "nature", "wellness"] as const;

const EMPTY: Partial<PlatformExperience> = {
  name_en: "",
  name_ar: null,
  name_ml: null,
  description_en: null,
  description_ar: null,
  description_ml: null,
  category: "sightseeing",
  lat: null,
  lng: null,
  district: null,
  region_label: null,
  typical_duration_hours: null,
  price_inr: 0,
  is_free: true,
  photos: [],
  external_url: null,
  is_active: true,
};

export default function PlatformExperiencesPage() {
  const [items, setItems] = useState<PlatformExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<PlatformExperience>>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const data = await getPlatformExperiences();
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

  const openEdit = (item: PlatformExperience) => {
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
        await updatePlatformExperience(editId, editing);
      } else {
        await createPlatformExperience(editing);
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
    if (!confirm("Deactivate this experience?")) return;
    try {
      await deletePlatformExperience(id);
      await load();
    } catch {
      alert("Could not deactivate experience.");
    }
  };

  const categoryBadgeColor = (cat: string) => {
    const map: Record<string, string> = {
      sightseeing: "#e6f0eb",
      adventure:   "#fef3e2",
      cultural:    "#f0ebfb",
      nature:      "#e8f5ed",
      wellness:    "#fdf8e8",
    };
    return map[cat] ?? "#f5f5f5";
  };

  return (
    <div style={{ padding: "2rem 1.5rem", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: "1.8rem", fontWeight: 400, color: "#1e1b4b", marginBottom: 4 }}>
            Curated Experiences
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            Platform-wide experiences auto-matched to all retreats within 50 km by GPS.
          </p>
        </div>
        <button
          onClick={openAdd}
          style={{ background: "#1e1b4b", color: "#fff", border: "none", borderRadius: "var(--r-xl)", padding: "9px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
        >
          + Add experience
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)" }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)", border: "1px dashed var(--border)", borderRadius: "var(--r-md)" }}>
          <p style={{ fontSize: 15, marginBottom: 8 }}>No curated experiences yet.</p>
          <p style={{ fontSize: 13 }}>Add Varkala Cliff Walk, Periyar Wildlife Reserve, Alappuzha Houseboat, etc.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                {["Name", "Category", "District", "Location", "Price", "Status", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid var(--border)", opacity: item.is_active ? 1 : 0.5 }}>
                  <td style={{ padding: "12px 12px" }}>
                    <div style={{ fontWeight: 600, color: "var(--slate)" }}>{item.name_en}</div>
                    {item.region_label && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{item.region_label}</div>}
                  </td>
                  <td style={{ padding: "12px 12px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: categoryBadgeColor(item.category), color: "var(--slate)" }}>
                      {item.category}
                    </span>
                  </td>
                  <td style={{ padding: "12px 12px", color: "var(--muted)" }}>{item.district ?? "—"}</td>
                  <td style={{ padding: "12px 12px", color: "var(--muted)", fontFamily: "monospace", fontSize: 12 }}>
                    {item.lat != null && item.lng != null ? `${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}` : "—"}
                  </td>
                  <td style={{ padding: "12px 12px", fontWeight: 600, color: "var(--forest)" }}>
                    {item.is_free ? "Free" : `₹${Number(item.price_inr).toLocaleString("en-IN")}`}
                  </td>
                  <td style={{ padding: "12px 12px" }}>
                    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: item.is_active ? "rgba(30,61,47,0.1)" : "var(--cream)", color: item.is_active ? "var(--forest)" : "var(--muted)" }}>
                      {item.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 12px", whiteSpace: "nowrap" }}>
                    <button onClick={() => openEdit(item)} style={{ padding: "5px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-xl)", background: "#fff", fontSize: 12, cursor: "pointer", marginRight: 8 }}>Edit</button>
                    <button onClick={() => handleDelete(item.id)} style={{ padding: "5px 12px", border: "1px solid rgba(197,48,48,0.3)", borderRadius: "var(--r-xl)", background: "rgba(197,48,48,0.05)", color: "#c53030", fontSize: 12, cursor: "pointer" }}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Slide-in panel ────────────────────────────────────────────────────── */}
      {panelOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 50, display: "flex", justifyContent: "flex-end" }}
          onClick={(e) => { if (e.target === e.currentTarget) setPanelOpen(false) }}
        >
          <div style={{ width: 520, maxWidth: "100vw", background: "#fff", height: "100%", overflowY: "auto", padding: "28px 28px 80px", boxShadow: "-4px 0 20px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontFamily: "var(--serif)", fontSize: "1.4rem", fontWeight: 400, color: "#1e1b4b" }}>
                {editId ? "Edit experience" : "Add curated experience"}
              </h2>
              <button onClick={() => setPanelOpen(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--muted)" }}>×</button>
            </div>

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 16 }}>
                {error}
              </div>
            )}

            <label style={labelStyle}>Name (English) *</label>
            <input value={editing.name_en ?? ""} onChange={(e) => setEditing((p) => ({ ...p, name_en: e.target.value }))} placeholder="e.g. Varkala Cliff Walk" style={inputStyle} />

            <label style={labelStyle}>Name (Arabic)</label>
            <input value={editing.name_ar ?? ""} onChange={(e) => setEditing((p) => ({ ...p, name_ar: e.target.value || null }))} style={inputStyle} />

            <label style={labelStyle}>Name (Malayalam)</label>
            <input value={editing.name_ml ?? ""} onChange={(e) => setEditing((p) => ({ ...p, name_ml: e.target.value || null }))} style={inputStyle} />

            <label style={labelStyle}>Category *</label>
            <select value={editing.category ?? "sightseeing"} onChange={(e) => setEditing((p) => ({ ...p, category: e.target.value as PlatformExperience["category"] }))} style={inputStyle}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>

            <label style={labelStyle}>District (must match clinic district value exactly)</label>
            <input value={editing.district ?? ""} onChange={(e) => setEditing((p) => ({ ...p, district: e.target.value || null }))} placeholder="e.g. Thiruvananthapuram" style={inputStyle} />

            <label style={labelStyle}>Region label (display hint)</label>
            <input value={editing.region_label ?? ""} onChange={(e) => setEditing((p) => ({ ...p, region_label: e.target.value || null }))} placeholder="e.g. Varkala Cliffs Area" style={inputStyle} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Latitude</label>
                <input type="number" step="0.0001" value={editing.lat ?? ""} onChange={(e) => setEditing((p) => ({ ...p, lat: e.target.value ? Number(e.target.value) : null }))} placeholder="8.7362" style={{ ...inputStyle, marginBottom: 0 }} />
              </div>
              <div>
                <label style={labelStyle}>Longitude</label>
                <input type="number" step="0.0001" value={editing.lng ?? ""} onChange={(e) => setEditing((p) => ({ ...p, lng: e.target.value ? Number(e.target.value) : null }))} placeholder="76.7121" style={{ ...inputStyle, marginBottom: 0 }} />
              </div>
            </div>

            <label style={{ ...labelStyle, marginTop: 4 }}>Typical duration (hours)</label>
            <input type="number" min={0} step={0.5} value={editing.typical_duration_hours ?? ""} onChange={(e) => setEditing((p) => ({ ...p, typical_duration_hours: e.target.value ? Number(e.target.value) : null }))} placeholder="2.5" style={inputStyle} />

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--slate)", cursor: "pointer", marginBottom: 16 }}>
              <input type="checkbox" checked={editing.is_free ?? true} onChange={(e) => setEditing((p) => ({ ...p, is_free: e.target.checked }))} />
              Free to visit
            </label>

            {!editing.is_free && (
              <>
                <label style={labelStyle}>Price (INR)</label>
                <input type="number" min={0} value={editing.price_inr ?? 0} onChange={(e) => setEditing((p) => ({ ...p, price_inr: Number(e.target.value) }))} style={inputStyle} />
              </>
            )}

            <label style={labelStyle}>Description (English)</label>
            <textarea value={editing.description_en ?? ""} onChange={(e) => setEditing((p) => ({ ...p, description_en: e.target.value || null }))} rows={3} style={{ ...inputStyle, resize: "vertical" }} />

            <label style={labelStyle}>External URL (optional)</label>
            <input type="url" value={editing.external_url ?? ""} onChange={(e) => setEditing((p) => ({ ...p, external_url: e.target.value || null }))} placeholder="https://maps.google.com/..." style={inputStyle} />

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--slate)", cursor: "pointer", marginBottom: 24 }}>
              <input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing((p) => ({ ...p, is_active: e.target.checked }))} />
              Active
            </label>

            <button
              onClick={handleSave}
              disabled={saving || !editing.name_en}
              style={{ width: "100%", padding: "12px 0", background: "#1e1b4b", color: "#fff", border: "none", borderRadius: "var(--r-xl)", fontSize: 15, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Saving…" : editId ? "Save changes" : "Add experience"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-sm)",
  fontSize: 14,
  marginBottom: 16,
  boxSizing: "border-box",
};
