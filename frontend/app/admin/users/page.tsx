"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getUsers,
  createUser,
  updateUser,
  changeUserRole,
  toggleUserActive,
  deleteUser,
  getPlatformClinics,
  type ManagedUser,
  type PlatformClinic,
} from "@/lib/admin-api";

const ROLES = ["patient", "doctor", "clinic_admin", "platform_admin"] as const;

const ROLE_COLORS: Record<string, string> = {
  patient: "bg-blue-100 text-blue-800",
  doctor: "bg-emerald-100 text-emerald-800",
  clinic_admin: "bg-amber-100 text-amber-800",
  platform_admin: "bg-purple-100 text-purple-800",
};

type Panel = "create" | "edit" | "role" | null;

export default function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const limit = 20;

  // Panel
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [saving, setSaving] = useState(false);

  // Clinics for assignment
  const [clinics, setClinics] = useState<PlatformClinic[]>([]);

  // Form state — create
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState("patient");
  const [formClinicId, setFormClinicId] = useState("");

  // Form state — edit
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editClinicId, setEditClinicId] = useState("");

  // Form state — role change
  const [newRole, setNewRole] = useState("");
  const [roleClinicId, setRoleClinicId] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, unknown> = { limit, offset: page * limit };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (activeFilter !== "") params.is_active = activeFilter === "true";
      const data = await getUsers(params as Parameters<typeof getUsers>[0]);
      setUsers(data.items);
      setTotal(data.total);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, activeFilter, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    getPlatformClinics()
      .then(setClinics)
      .catch(() => {});
  }, []);

  const openCreate = () => {
    setFormEmail("");
    setFormPassword("");
    setFormName("");
    setFormPhone("");
    setFormRole("patient");
    setFormClinicId("");
    setPanel("create");
    setError("");
  };

  const openEdit = (u: ManagedUser) => {
    setSelected(u);
    setEditName(u.full_name || "");
    setEditPhone(u.phone || "");
    setEditEmail(u.email);
    setEditClinicId(u.clinic_id || "");
    setPanel("edit");
    setError("");
  };

  const openRole = (u: ManagedUser) => {
    setSelected(u);
    setNewRole(u.role);
    setRoleClinicId(u.clinic_id || "");
    setPanel("role");
    setError("");
  };

  const handleCreate = async () => {
    setSaving(true);
    setError("");
    try {
      await createUser({
        email: formEmail,
        password: formPassword,
        full_name: formName || undefined,
        phone: formPhone || undefined,
        role: formRole,
        clinic_id: formClinicId || undefined,
      });
      setPanel(null);
      fetchUsers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const data: Record<string, string | undefined> = {};
      if (editName !== (selected.full_name || "")) data.full_name = editName;
      if (editPhone !== (selected.phone || "")) data.phone = editPhone;
      if (editEmail !== selected.email) data.email = editEmail;
      if (editClinicId !== (selected.clinic_id || "")) data.clinic_id = editClinicId || undefined;
      await updateUser(selected.id, data);
      setPanel(null);
      fetchUsers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await changeUserRole(selected.id, newRole, roleClinicId || undefined);
      setPanel(null);
      fetchUsers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to change role");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (u: ManagedUser) => {
    try {
      await toggleUserActive(u.id);
      fetchUsers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to toggle user");
    }
  };

  const handleDelete = async (u: ManagedUser) => {
    if (!confirm(`Deactivate ${u.email}?`)) return;
    try {
      await deleteUser(u.id);
      fetchUsers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete user");
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif text-forest">User Management</h1>
          <p className="text-sm text-forest/60 mt-1">{total} users total</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-forest text-white rounded-lg text-sm hover:bg-forest/90 transition-colors"
        >
          + Create User
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="px-3 py-2 border border-forest/20 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-forest/30"
        />
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(0);
          }}
          className="px-3 py-2 border border-forest/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace("_", " ")}
            </option>
          ))}
        </select>
        <select
          value={activeFilter}
          onChange={(e) => {
            setActiveFilter(e.target.value);
            setPage(0);
          }}
          className="px-3 py-2 border border-forest/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
        >
          <option value="">All status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-forest/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-forest/5 text-forest/70 text-left">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Clinic</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last Login</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-forest/40">
                    Loading...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-forest/40">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-forest/[0.02]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-forest">{u.full_name || "—"}</div>
                      <div className="text-xs text-forest/50">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] || "bg-gray-100 text-gray-800"}`}
                      >
                        {u.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-forest/60">{u.clinic_name || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block w-2 h-2 rounded-full mr-1.5 ${u.is_active ? "bg-emerald-500" : "bg-red-400"}`}
                      />
                      <span className="text-forest/60">{u.is_active ? "Active" : "Inactive"}</span>
                    </td>
                    <td className="px-4 py-3 text-forest/50 text-xs">
                      {u.last_login_at
                        ? new Date(u.last_login_at).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="px-2 py-1 text-xs text-forest hover:bg-forest/10 rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openRole(u)}
                        className="px-2 py-1 text-xs text-amber-700 hover:bg-amber-50 rounded transition-colors"
                      >
                        Role
                      </button>
                      <button
                        onClick={() => handleToggle(u)}
                        className="px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 rounded transition-colors"
                      >
                        {u.is_active ? "Deactivate" : "Activate"}
                      </button>
                      {u.is_active && (
                        <button
                          onClick={() => handleDelete(u)}
                          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-forest/5">
            <span className="text-xs text-forest/50">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 text-xs border border-forest/20 rounded disabled:opacity-30 hover:bg-forest/5"
              >
                Prev
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 text-xs border border-forest/20 rounded disabled:opacity-30 hover:bg-forest/5"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-out Panel */}
      {panel && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setPanel(null)}
          />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 overflow-y-auto">
            <div className="px-6 py-5 border-b border-forest/10 flex items-center justify-between">
              <h2 className="text-lg font-serif text-forest">
                {panel === "create"
                  ? "Create User"
                  : panel === "edit"
                    ? "Edit User"
                    : "Change Role"}
              </h2>
              <button
                onClick={() => setPanel(null)}
                className="text-forest/40 hover:text-forest"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
              )}

              {panel === "create" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-forest/70 mb-1">Email *</label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-forest/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-forest/70 mb-1">Password *</label>
                    <input
                      type="password"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-forest/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
                      placeholder="Min 8 characters"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-forest/70 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 border border-forest/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-forest/70 mb-1">Phone</label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-forest/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-forest/70 mb-1">Role</label>
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                      className="w-full px-3 py-2 border border-forest/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(formRole === "clinic_admin" || formRole === "doctor") && (
                    <div>
                      <label className="block text-sm font-medium text-forest/70 mb-1">Clinic</label>
                      <select
                        value={formClinicId}
                        onChange={(e) => setFormClinicId(e.target.value)}
                        className="w-full px-3 py-2 border border-forest/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
                      >
                        <option value="">None</option>
                        {clinics.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button
                    onClick={handleCreate}
                    disabled={saving || !formEmail || !formPassword}
                    className="w-full py-2.5 bg-forest text-white rounded-lg text-sm font-medium hover:bg-forest/90 disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Creating..." : "Create User"}
                  </button>
                </>
              )}

              {panel === "edit" && selected && (
                <>
                  <div className="text-xs text-forest/40 mb-2">ID: {selected.id}</div>
                  <div>
                    <label className="block text-sm font-medium text-forest/70 mb-1">Email</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-forest/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-forest/70 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border border-forest/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-forest/70 mb-1">Phone</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-forest/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-forest/70 mb-1">Clinic</label>
                    <select
                      value={editClinicId}
                      onChange={(e) => setEditClinicId(e.target.value)}
                      className="w-full px-3 py-2 border border-forest/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
                    >
                      <option value="">None</option>
                      {clinics.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleUpdate}
                    disabled={saving}
                    className="w-full py-2.5 bg-forest text-white rounded-lg text-sm font-medium hover:bg-forest/90 disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </>
              )}

              {panel === "role" && selected && (
                <>
                  <div className="text-sm text-forest/60 mb-2">
                    Changing role for <strong>{selected.email}</strong>
                  </div>
                  <div className="text-xs text-forest/40 mb-4">
                    Current role:{" "}
                    <span className={`px-2 py-0.5 rounded-full ${ROLE_COLORS[selected.role]}`}>
                      {selected.role.replace("_", " ")}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-forest/70 mb-1">New Role</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full px-3 py-2 border border-forest/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(newRole === "clinic_admin" || newRole === "doctor") && (
                    <div>
                      <label className="block text-sm font-medium text-forest/70 mb-1">Assign to Clinic</label>
                      <select
                        value={roleClinicId}
                        onChange={(e) => setRoleClinicId(e.target.value)}
                        className="w-full px-3 py-2 border border-forest/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forest/30"
                      >
                        <option value="">None</option>
                        {clinics.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button
                    onClick={handleRoleChange}
                    disabled={saving || newRole === selected.role}
                    className="w-full py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Updating..." : "Change Role"}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
