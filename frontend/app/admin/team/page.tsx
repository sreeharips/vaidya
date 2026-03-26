"use client";

import { useEffect, useState, useRef } from "react";
import {
  getTeam,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  uploadTeamPhoto,
  type TeamMember,
} from "@/lib/admin-api";

const EMPTY_MEMBER: Partial<TeamMember> = {
  name: "",
  name_ml: null,
  qualification: "",
  years_experience: 0,
  bio_en: "",
  bio_ml: null,
  photo_url: null,
  display_order: 0,
  is_active: true,
};

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<TeamMember>>(EMPTY_MEMBER);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const data = await getTeam();
      setMembers(data);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditing({ ...EMPTY_MEMBER });
    setEditId(null);
    setPanelOpen(true);
  };

  const openEdit = (m: TeamMember) => {
    setEditing({ ...m });
    setEditId(m.id);
    setPanelOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editId) {
        await updateTeamMember(editId, editing);
      } else {
        await createTeamMember(editing);
      }
      await load();
      setPanelOpen(false);
    } catch {
      alert("Failed to save team member.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this team member? This cannot be undone.")) return;
    try {
      await deleteTeamMember(id);
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch {
      alert("Failed to delete team member.");
    }
  };

  const handleToggleActive = async (m: TeamMember) => {
    try {
      await updateTeamMember(m.id, { is_active: !m.is_active });
      await load();
    } catch {
      alert("Failed to update status.");
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editId || !e.target.files?.[0]) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", e.target.files[0]);
      const updated = await uploadTeamPhoto(editId, formData);
      setEditing((prev) => ({ ...prev, photo_url: updated.photo_url }));
      await load();
    } catch {
      alert("Failed to upload photo.");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateField = (partial: Partial<TeamMember>) => {
    setEditing((prev) => ({ ...prev, ...partial }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-slate">Team</h1>
        <button
          onClick={openAdd}
          className="px-5 py-2.5 rounded-xl bg-forest text-white text-sm font-sans font-medium hover:bg-forest2 transition-colors"
        >
          + Add Member
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-md border border-cream2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="border-b border-cream2 bg-cream/50">
                <th className="text-left px-4 py-3 text-muted font-medium">Member</th>
                <th className="text-left px-4 py-3 text-muted font-medium hidden md:table-cell">Qualification</th>
                <th className="text-left px-4 py-3 text-muted font-medium hidden md:table-cell">Experience</th>
                <th className="text-left px-4 py-3 text-muted font-medium">Status</th>
                <th className="text-left px-4 py-3 text-muted font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream2">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted">
                    No team members added yet.
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.id} className="hover:bg-cream/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {m.photo_url ? (
                          <img
                            src={m.photo_url}
                            alt={m.name}
                            className="w-9 h-9 rounded-full object-cover border border-cream2"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-cream2 flex items-center justify-center text-muted text-xs font-medium">
                            {m.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-slate">{m.name}</div>
                          {m.name_ml && (
                            <div className="text-xs text-muted">{m.name_ml}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted hidden md:table-cell">{m.qualification}</td>
                    <td className="px-4 py-3 text-muted hidden md:table-cell">
                      {m.years_experience} {m.years_experience === 1 ? "year" : "years"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(m)}
                        className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                          m.is_active ? "bg-forest-lt text-forest" : "bg-cream2 text-muted"
                        }`}
                      >
                        {m.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openEdit(m)}
                          className="text-forest hover:text-gold text-xs font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="text-red-400 hover:text-red-600 text-xs font-medium transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out panel */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setPanelOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-cream2 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-serif text-lg text-slate">
                {editId ? "Edit Team Member" : "Add Team Member"}
              </h2>
              <button
                onClick={() => setPanelOpen(false)}
                className="p-1 text-muted hover:text-slate transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Photo upload (only for existing members) */}
              {editId && (
                <div>
                  <label className="block text-sm font-sans text-slate mb-2">Photo</label>
                  <div className="flex items-center gap-4">
                    {editing.photo_url ? (
                      <img
                        src={editing.photo_url}
                        alt="Current photo"
                        className="w-16 h-16 rounded-full object-cover border border-cream2"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-cream2 flex items-center justify-center text-muted text-sm font-medium">
                        No photo
                      </div>
                    )}
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="px-4 py-2 rounded-md border border-cream2 text-sm font-sans text-slate hover:bg-cream transition-colors disabled:opacity-60"
                      >
                        {uploading ? "Uploading..." : "Upload Photo"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Name</label>
                <input
                  type="text"
                  value={editing.name || ""}
                  onChange={(e) => updateField({ name: e.target.value })}
                  placeholder="Full name"
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>

              {/* Name ML */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">
                  Name (Malayalam) <span className="text-muted">optional</span>
                </label>
                <input
                  type="text"
                  value={editing.name_ml || ""}
                  onChange={(e) => updateField({ name_ml: e.target.value || null })}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>

              {/* Qualification */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Qualification</label>
                <input
                  type="text"
                  value={editing.qualification || ""}
                  onChange={(e) => updateField({ qualification: e.target.value })}
                  placeholder="e.g. BAMS, MD (Ay)"
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>

              {/* Years experience */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Years of Experience</label>
                <input
                  type="number"
                  min={0}
                  value={editing.years_experience ?? 0}
                  onChange={(e) => updateField({ years_experience: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                />
              </div>

              {/* Bio EN */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">Bio (English)</label>
                <textarea
                  rows={4}
                  value={editing.bio_en || ""}
                  onChange={(e) => updateField({ bio_en: e.target.value || null })}
                  placeholder="Brief bio describing their expertise..."
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest resize-vertical"
                />
              </div>

              {/* Bio ML */}
              <div>
                <label className="block text-sm font-sans text-slate mb-1">
                  Bio (Malayalam) <span className="text-muted">optional</span>
                </label>
                <textarea
                  rows={3}
                  value={editing.bio_ml || ""}
                  onChange={(e) => updateField({ bio_ml: e.target.value || null })}
                  className="w-full px-3 py-2.5 rounded-md border border-cream2 text-sm font-sans text-slate focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest resize-vertical"
                />
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.is_active ?? true}
                  onChange={(e) => updateField({ is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-cream2 text-forest focus:ring-forest"
                />
                <span className="text-sm font-sans text-slate">Active (visible on website)</span>
              </label>

              {/* Save */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-forest text-white text-sm font-sans font-medium hover:bg-forest2 transition-colors disabled:opacity-60"
                >
                  {saving ? "Saving..." : editId ? "Update Member" : "Add Member"}
                </button>
                <button
                  onClick={() => setPanelOpen(false)}
                  className="px-6 py-2.5 rounded-xl border border-cream2 text-sm font-sans text-slate hover:bg-cream transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
