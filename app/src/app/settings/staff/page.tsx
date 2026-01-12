"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { StaffRow } from "@/lib/types";

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    role: "",
  });

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setErr(null);

    try {
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      if (error) throw error;
      setStaff(data || []);
    } catch (err) {
      setErr(err instanceof Error ? err.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  async function createStaff() {
    if (!formData.full_name.trim()) {
      setErr("Please enter staff name");
      return;
    }
    if (!formData.role.trim()) {
      setErr("Please enter staff role");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error("User not authenticated");

      const { error } = await supabase.from("staff").insert({
        full_name: formData.full_name.trim(),
        role: formData.role.trim(),
        is_active: true,
        created_by: userId,
      });

      if (error) throw error;

      setFormData({ full_name: "", role: "" });
      setShowCreate(false);
      await loadStaff();
    } catch (err) {
      setErr(err instanceof Error ? err.message : "Failed to create staff");
    } finally {
      setBusy(false);
    }
  }

  async function updateStaff(id: string) {
    if (!formData.full_name.trim()) {
      setErr("Please enter staff name");
      return;
    }
    if (!formData.role.trim()) {
      setErr("Please enter staff role");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      const { error } = await supabase
        .from("staff")
        .update({
          full_name: formData.full_name.trim(),
          role: formData.role.trim(),
        })
        .eq("id", id);

      if (error) throw error;

      setFormData({ full_name: "", role: "" });
      setEditingId(null);
      await loadStaff();
    } catch (err) {
      setErr(err instanceof Error ? err.message : "Failed to update staff");
    } finally {
      setBusy(false);
    }
  }

  async function deactivateStaff(id: string) {
    if (!confirm("Deactivate this staff member?")) return;

    setBusy(true);
    setErr(null);

    try {
      const { error } = await supabase
        .from("staff")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
      await loadStaff();
    } catch (err) {
      setErr(err instanceof Error ? err.message : "Failed to deactivate staff");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        <div className="flex flex-col items-center gap-3">
          <img src="/loading.gif" alt="Loading" className="h-12 w-12" />
          <div className="text-sm">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Staff Management</h1>
            <p className="text-sm text-slate-600 mt-1">Manage dentists, assistants, and staff members</p>
          </div>
          <button
            className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            onClick={() => {
              setShowCreate(true);
              setEditingId(null);
              setFormData({ full_name: "", role: "" });
            }}
          >
            Add Staff Member
          </button>
        </div>

        {err && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err}
          </div>
        )}

        {/* Staff List */}
        <div className="rounded-2xl border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Role</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                      No staff members yet. Click "Add Staff Member" to get started.
                    </td>
                  </tr>
                ) : (
                  staff.map((member, index) => (
                    <tr key={member.id} className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{member.full_name}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{member.role}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            className="px-3 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                            onClick={() => {
                              setEditingId(member.id);
                              setFormData({
                                full_name: member.full_name,
                                role: member.role,
                              });
                            }}
                            disabled={busy}
                          >
                            Edit
                          </button>
                          <button
                            className="px-3 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                            onClick={() => deactivateStaff(member.id)}
                            disabled={busy}
                          >
                            Deactivate
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

        {/* Create/Edit Modal */}
        {showCreate || editingId ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && (setShowCreate(false), setEditingId(null))} onDoubleClick={(e) => e.target === e.currentTarget && (setShowCreate(false), setEditingId(null))}>
            <div className="w-full max-w-md rounded-2xl border bg-white p-6">
              <h2 className="text-lg font-semibold">
                {editingId ? "Edit Staff Member" : "Add Staff Member"}
              </h2>

              <div className="mt-4 grid gap-4">
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-700">Full Name *</span>
                  <input
                    type="text"
                    className="h-10 rounded-lg border px-3"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="E.g., Dr. Juan Dela Cruz"
                    autoFocus
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="text-slate-700">Role *</span>
                  <select
                    className="h-10 rounded-lg border bg-white px-3"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="">Select role</option>
                    <option value="Dentist">Dentist</option>
                    <option value="Dental Hygienist">Dental Hygienist</option>
                    <option value="Dental Assistant">Dental Assistant</option>
                    <option value="Secretary">Secretary</option>
                    <option value="Receptionist">Receptionist</option>
                    <option value="Nurse">Nurse</option>
                    <option value="Admin">Admin</option>
                    <option value="Other">Other</option>
                  </select>
                </label>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    className="cancel-btn"
                    onClick={() => {
                      setShowCreate(false);
                      setEditingId(null);
                      setFormData({ full_name: "", role: "" });
                    }}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                  <button
                    className="save-btn"
                    disabled={busy}
                    onClick={() => {
                      if (editingId) {
                        updateStaff(editingId);
                      } else {
                        createStaff();
                      }
                    }}
                  >
                    {editingId ? "Update" : "Add"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
