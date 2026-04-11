"use client";

import { useEffect, useRef, useState } from "react";
import {
  getPlatformTags,
  createPlatformTag,
  updatePlatformTag,
  deletePlatformTag,
  reorderPlatformTags,
  type PlatformTagItem,
} from "@/lib/admin-api";

// ── Tag list for one type ─────────────────────────────────────────────────────

function TagList({
  type,
  title,
  description,
  accentClass,
}: {
  type: "specialisation" | "certification";
  title: string;
  description: string;
  accentClass: string;
}) {
  const [tags, setTags] = useState<PlatformTagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = () =>
    getPlatformTags(type)
      .then(setTags)
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, [type]);

  const handleAdd = async () => {
    const val = newValue.trim();
    if (!val) return;
    setAdding(true);
    setAddError("");
    try {
      const tag = await createPlatformTag({ type, value: val });
      setTags(prev => [...prev, tag]);
      setNewValue("");
      inputRef.current?.focus();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Failed to add");
    }
    setAdding(false);
  };

  const handleToggleActive = async (tag: PlatformTagItem) => {
    setSaving(tag.id);
    try {
      const updated = await updatePlatformTag(tag.id, { is_active: !tag.is_active });
      setTags(prev => prev.map(t => t.id === tag.id ? updated : t));
    } catch { /* ignore */ }
    setSaving(null);
  };

  const handleEditSave = async (tag: PlatformTagItem) => {
    const val = editValue.trim();
    if (!val || val === tag.value) { setEditId(null); return; }
    setSaving(tag.id);
    try {
      const updated = await updatePlatformTag(tag.id, { value: val });
      setTags(prev => prev.map(t => t.id === tag.id ? updated : t));
      setEditId(null);
    } catch { /* ignore */ }
    setSaving(null);
  };

  const handleDelete = async (tag: PlatformTagItem) => {
    if (!confirm(`Delete "${tag.value}"? This cannot be undone.`)) return;
    setSaving(tag.id);
    try {
      await deletePlatformTag(tag.id);
      setTags(prev => prev.filter(t => t.id !== tag.id));
    } catch { /* ignore */ }
    setSaving(null);
  };

  // Drag-to-reorder
  const handleDragEnd = async () => {
    if (!dragging || !dragOver || dragging === dragOver) {
      setDragging(null); setDragOver(null); return;
    }
    const from = tags.findIndex(t => t.id === dragging);
    const to   = tags.findIndex(t => t.id === dragOver);
    const reordered = [...tags];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setTags(reordered);
    setDragging(null);
    setDragOver(null);
    await reorderPlatformTags(reordered.map(t => t.id));
  };

  const active   = tags.filter(t => t.is_active);
  const inactive = tags.filter(t => !t.is_active);

  return (
    <div className="bg-white rounded-xl border border-cream2 overflow-hidden">
      {/* Header */}
      <div className={`px-6 py-5 border-b border-cream2 ${accentClass}`}>
        <h2 className="font-serif text-lg text-slate">{title}</h2>
        <p className="text-xs font-sans text-muted mt-0.5">{description}</p>
      </div>

      {/* Add new */}
      <div className="px-6 py-4 border-b border-cream2 bg-cream/40">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={newValue}
            onChange={e => { setNewValue(e.target.value); setAddError(""); }}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder={`Add new ${type}…`}
            className="flex-1 text-sm font-sans border border-cream2 rounded-lg px-3 py-2 outline-none focus:border-forest bg-white"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newValue.trim()}
            className="px-4 py-2 bg-forest text-white rounded-lg text-sm font-sans font-medium hover:bg-forest2 transition-colors disabled:opacity-40"
          >
            {adding ? "…" : "Add"}
          </button>
        </div>
        {addError && <p className="text-xs text-red-500 mt-1.5">{addError}</p>}
      </div>

      {/* Tag list */}
      {loading ? (
        <div className="px-6 py-8 text-center text-sm text-muted font-sans">Loading…</div>
      ) : tags.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-muted font-sans">No {type}s yet.</div>
      ) : (
        <ul className="divide-y divide-cream2">
          {[...active, ...inactive].map(tag => (
            <li
              key={tag.id}
              draggable={tag.is_active}
              onDragStart={() => setDragging(tag.id)}
              onDragOver={e => { e.preventDefault(); setDragOver(tag.id); }}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-3 px-6 py-3 transition-colors ${
                dragging === tag.id ? "opacity-40" : ""
              } ${dragOver === tag.id && dragging !== tag.id ? "bg-forest-lt/50" : "hover:bg-cream/40"}`}
            >
              {/* Drag handle */}
              {tag.is_active && (
                <span className="text-muted cursor-grab select-none">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8h16M4 16h16" />
                  </svg>
                </span>
              )}

              {/* Inline edit or label */}
              <div className="flex-1 min-w-0">
                {editId === tag.id ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") handleEditSave(tag);
                      if (e.key === "Escape") setEditId(null);
                    }}
                    onBlur={() => handleEditSave(tag)}
                    className="w-full text-sm font-sans border border-forest rounded px-2 py-0.5 outline-none"
                  />
                ) : (
                  <span
                    className={`text-sm font-sans ${tag.is_active ? "text-slate" : "text-muted line-through"}`}
                    onDoubleClick={() => { setEditId(tag.id); setEditValue(tag.value); }}
                    title="Double-click to edit"
                  >
                    {tag.value}
                  </span>
                )}
              </div>

              {/* Status badge */}
              <span className={`text-xs font-sans px-2 py-0.5 rounded-full ${
                tag.is_active ? "bg-forest-lt text-forest" : "bg-cream2 text-muted"
              }`}>
                {tag.is_active ? "Active" : "Inactive"}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1 ml-1">
                <button
                  onClick={() => { setEditId(tag.id); setEditValue(tag.value); }}
                  title="Edit"
                  disabled={saving === tag.id}
                  className="p-1.5 rounded text-muted hover:text-forest hover:bg-forest-lt transition-colors disabled:opacity-40"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleToggleActive(tag)}
                  title={tag.is_active ? "Deactivate" : "Activate"}
                  disabled={saving === tag.id}
                  className="p-1.5 rounded text-muted hover:text-gold hover:bg-gold-lt transition-colors disabled:opacity-40"
                >
                  {saving === tag.id ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : tag.is_active ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => handleDelete(tag)}
                  title="Delete"
                  disabled={saving === tag.id}
                  className="p-1.5 rounded text-muted hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Footer count */}
      <div className="px-6 py-3 bg-cream/30 border-t border-cream2 flex gap-4 text-xs font-sans text-muted">
        <span>{active.length} active</span>
        {inactive.length > 0 && <span>{inactive.length} inactive</span>}
        <span className="ml-auto text-muted/60">Drag to reorder · Double-click to edit</span>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TagsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-slate">Manage Tags</h1>
        <p className="text-sm font-sans text-muted mt-1">
          These lists appear in the clinic admin portal when clinics set up their profile.
          Changes take effect immediately for all clinics.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TagList
          type="specialisation"
          title="Specialisations"
          description="Ayurvedic treatments and therapies offered by clinics"
          accentClass="bg-bark-lt/40"
        />
        <TagList
          type="certification"
          title="Certifications"
          description="Accreditations and credentials clinics can claim"
          accentClass="bg-gold-lt/40"
        />
      </div>
    </div>
  );
}
