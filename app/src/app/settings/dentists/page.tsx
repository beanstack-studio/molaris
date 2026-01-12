"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { EditModal } from "@/components/EditModal";

type DentistRow = {
  id: string;
  full_name: string;
  prc_number: string | null;
  is_active: boolean;
};

type StaffRow = {
  id: string;
  full_name: string;
  role: string;
  date_of_birth: string | null;
  gender: "M" | "F" | null;
  is_active: boolean;
};

function LoadingBlock() {
  return (
    <div className="flex items-center justify-center py-16">
      <img src="/loading.gif" alt="Loading" className="h-12 w-12 opacity-70" />
    </div>
  );
}

export default function TeamSettingsPage() {
  const [dentists, setDentists] = useState<DentistRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Dentist form
  const [dentistName, setDentistName] = useState("");
  const [dentistPrc, setDentistPrc] = useState("");
  const [editingDentist, setEditingDentist] = useState<DentistRow | null>(null);

  // Staff form
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState("");
  const [staffDob, setStaffDob] = useState("");
  const [staffGender, setStaffGender] = useState<"M" | "F" | "">("");
  const [editingStaff, setEditingStaff] = useState<StaffRow | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr(null);

    try {
      const [dentistRes, staffRes] = await Promise.all([
        supabase
          .from("dentists")
          .select("id, full_name, prc_number, is_active")
          .order("full_name", { ascending: true }),
        supabase
          .from("staff")
          .select("id, full_name, role, date_of_birth, gender, is_active")
          .order("full_name", { ascending: true }),
      ]);

      if (dentistRes.error) throw dentistRes.error;
      if (staffRes.error) throw staffRes.error;

      setDentists((dentistRes.data || []) as DentistRow[]);
      setStaff((staffRes.data || []) as StaffRow[]);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // DENTIST OPERATIONS
  async function addDentist() {
    if (!dentistName.trim()) {
      setErr("Please enter dentist name");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      const { error } = await supabase.from("dentists").insert({
        full_name: dentistName.trim(),
        prc_number: dentistPrc.trim() || null,
        is_active: true,
      });

      if (error) throw error;

      setDentistName("");
      setDentistPrc("");
      await loadData();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to add dentist");
    } finally {
      setBusy(false);
    }
  }

  async function updateDentist() {
    if (!editingDentist) return;
    if (!dentistName.trim()) {
      setErr("Please enter dentist name");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      const { error } = await supabase
        .from("dentists")
        .update({
          full_name: dentistName.trim(),
          prc_number: dentistPrc.trim() || null,
        })
        .eq("id", editingDentist.id);

      if (error) throw error;

      setEditingDentist(null);
      setDentistName("");
      setDentistPrc("");
      await loadData();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to update dentist");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDentist(id: string) {
    if (!confirm("Delete this dentist?")) return;

    setBusy(true);
    setErr(null);

    try {
      const { error } = await supabase.from("dentists").delete().eq("id", id);

      if (error) throw error;
      setEditingDentist(null);
      await loadData();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to delete dentist");
    } finally {
      setBusy(false);
    }
  }

  async function toggleDentistActive(id: string, isActive: boolean) {
    setBusy(true);
    setErr(null);

    try {
      const { error } = await supabase
        .from("dentists")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to update dentist");
    } finally {
      setBusy(false);
    }
  }

  // STAFF OPERATIONS
  async function addStaff() {
    if (!staffName.trim()) {
      setErr("Please enter staff name");
      return;
    }
    if (!staffRole.trim()) {
      setErr("Please select staff role");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error("User not authenticated");

      const { error } = await supabase.from("staff").insert({
        full_name: staffName.trim(),
        role: staffRole.trim(),
        date_of_birth: staffDob || null,
        gender: (staffGender as "M" | "F" | null) || null,
        is_active: true,
        created_by: userId,
      });

      if (error) throw error;

      setStaffName("");
      setStaffRole("");
      setStaffDob("");
      setStaffGender("");
      await loadData();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to add staff");
    } finally {
      setBusy(false);
    }
  }

  async function updateStaff() {
    if (!editingStaff) return;
    if (!staffName.trim()) {
      setErr("Please enter staff name");
      return;
    }
    if (!staffRole.trim()) {
      setErr("Please select staff role");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      const { error } = await supabase
        .from("staff")
        .update({
          full_name: staffName.trim(),
          role: staffRole.trim(),
          date_of_birth: staffDob || null,
          gender: (staffGender as "M" | "F" | null) || null,
        })
        .eq("id", editingStaff.id);

      if (error) throw error;

      setEditingStaff(null);
      setStaffName("");
      setStaffRole("");
      setStaffDob("");
      setStaffGender("");
      await loadData();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to update staff");
    } finally {
      setBusy(false);
    }
  }

  async function deleteStaff(id: string) {
    if (!confirm("Delete this staff member?")) return;

    setBusy(true);
    setErr(null);

    try {
      const { error } = await supabase.from("staff").delete().eq("id", id);

      if (error) throw error;
      setEditingStaff(null);
      await loadData();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to delete staff");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStaffActive(id: string, isActive: boolean) {
    setBusy(true);
    setErr(null);

    try {
      const { error } = await supabase
        .from("staff")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to update staff");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock />;

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-bold text-slate-900">Team Management</h1>

      {err && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* ============================================================
          DENTISTS SECTION
          ============================================================ */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold text-slate-900">Dentists</h2>

        {/* Add Dentist Box */}
        <div className="mt-4 rounded-xl border bg-white p-4">
          <div className="mb-3 text-sm font-semibold text-slate-700">Add dentist</div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <input
              className="h-10 flex-1 rounded-lg border px-3 text-sm"
              placeholder="Dentist name"
              value={dentistName}
              onChange={(e) => setDentistName(e.target.value)}
              disabled={busy}
            />
            <input
              className="h-10 w-full rounded-lg border px-3 text-sm sm:w-[160px]"
              placeholder="PRC number"
              value={dentistPrc}
              onChange={(e) => setDentistPrc(e.target.value)}
              disabled={busy}
            />
            <button
              className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              onClick={addDentist}
              disabled={busy}
            >
              Add
            </button>
          </div>
        </div>

        {/* Dentists Table */}
        <div className="mt-4 rounded-xl border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">PRC Number</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-700">Active</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dentists.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No dentists yet.
                  </td>
                </tr>
              ) : (
                dentists.map((d, index) => (
                  <tr
                    key={d.id}
                    className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{d.full_name}</td>
                    <td className="px-4 py-3 text-slate-600">{d.prc_number || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={d.is_active}
                        onChange={(e) => toggleDentistActive(d.id, e.target.checked)}
                        disabled={busy}
                        className="h-4 w-4 rounded"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="px-3 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-60"
                        onClick={() => {
                          setEditingDentist(d);
                          setDentistName(d.full_name);
                          setDentistPrc(d.prc_number || "");
                        }}
                        disabled={busy}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================
          STAFF SECTION
          ============================================================ */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-slate-900">Staff Members</h2>

        {/* Add Staff Box */}
        <div className="mt-4 rounded-xl border bg-white p-4">
          <div className="mb-3 text-sm font-semibold text-slate-700">Add staff member</div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_140px_100px_100px]">
            <input
              className="h-10 rounded-lg border px-3 text-sm"
              placeholder="Full name"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              disabled={busy}
            />
            <select
              className="h-10 rounded-lg border bg-white px-3 text-sm"
              value={staffRole}
              onChange={(e) => setStaffRole(e.target.value)}
              disabled={busy}
            >
              <option value="">Select role</option>
              <option value="Dental Hygienist">Dental Hygienist</option>
              <option value="Dental Assistant">Dental Assistant</option>
              <option value="Secretary">Secretary</option>
              <option value="Receptionist">Receptionist</option>
              <option value="Nurse">Nurse</option>
              <option value="Admin">Admin</option>
              <option value="Other">Other</option>
            </select>
            <input
              type="date"
              className="h-10 rounded-lg border px-3 text-sm"
              value={staffDob}
              onChange={(e) => setStaffDob(e.target.value)}
              disabled={busy}
            />
            <select
              className="h-10 rounded-lg border bg-white px-3 text-sm"
              value={staffGender}
              onChange={(e) => setStaffGender(e.target.value as "M" | "F" | "")}
              disabled={busy}
            >
              <option value="">Gender</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
            <button
              className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              onClick={addStaff}
              disabled={busy}
            >
              Add
            </button>
          </div>
        </div>

        {/* Staff Table */}
        <div className="mt-4 rounded-xl border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Role</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Date of Birth</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-700">Gender</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-700">Active</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No staff members yet.
                  </td>
                </tr>
              ) : (
                staff.map((s, index) => (
                  <tr
                    key={s.id}
                    className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{s.full_name}</td>
                    <td className="px-4 py-3 text-slate-600">{s.role}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.date_of_birth
                        ? new Date(s.date_of_birth).toLocaleDateString("en-PH")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">
                      {s.gender === "M" ? "M" : s.gender === "F" ? "F" : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={s.is_active}
                        onChange={(e) => toggleStaffActive(s.id, e.target.checked)}
                        disabled={busy}
                        className="h-4 w-4 rounded"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="px-3 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-60"
                        onClick={() => {
                          setEditingStaff(s);
                          setStaffName(s.full_name);
                          setStaffRole(s.role);
                          setStaffDob(s.date_of_birth || "");
                          setStaffGender(s.gender || "");
                        }}
                        disabled={busy}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT DENTIST MODAL */}
      <EditModal
        open={!!editingDentist}
        title="Edit dentist"
        onClose={() => {
          setEditingDentist(null);
          setDentistName("");
          setDentistPrc("");
        }}
      >
        {editingDentist && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Full name</label>
              <input
                className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
                value={dentistName}
                onChange={(e) => setDentistName(e.target.value)}
                disabled={busy}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">PRC number</label>
              <input
                className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
                value={dentistPrc}
                onChange={(e) => setDentistPrc(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="delete-btn"
                onClick={() => deleteDentist(editingDentist.id)}
                disabled={busy}
              >
                Delete
              </button>
              <div className="modal-actions-right">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => {
                    setEditingDentist(null);
                    setDentistName("");
                    setDentistPrc("");
                  }}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="save-btn"
                  onClick={updateDentist}
                  disabled={busy || !dentistName.trim()}
                >
                  {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </EditModal>

      {/* EDIT STAFF MODAL */}
      <EditModal
        open={!!editingStaff}
        title="Edit staff member"
        onClose={() => {
          setEditingStaff(null);
          setStaffName("");
          setStaffRole("");
          setStaffDob("");
          setStaffGender("");
        }}
      >
        {editingStaff && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Full name</label>
              <input
                className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                disabled={busy}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Role</label>
              <select
                className="mt-1 h-10 w-full rounded-lg border bg-white px-3 text-sm"
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value)}
                disabled={busy}
              >
                <option value="">Select role</option>
                <option value="Dental Hygienist">Dental Hygienist</option>
                <option value="Dental Assistant">Dental Assistant</option>
                <option value="Secretary">Secretary</option>
                <option value="Receptionist">Receptionist</option>
                <option value="Nurse">Nurse</option>
                <option value="Admin">Admin</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Date of Birth</label>
              <input
                type="date"
                className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
                value={staffDob}
                onChange={(e) => setStaffDob(e.target.value)}
                disabled={busy}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Gender</label>
              <select
                className="mt-1 h-10 w-full rounded-lg border bg-white px-3 text-sm"
                value={staffGender}
                onChange={(e) => setStaffGender(e.target.value as "M" | "F" | "")}
                disabled={busy}
              >
                <option value="">Select gender</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="delete-btn"
                onClick={() => deleteStaff(editingStaff.id)}
                disabled={busy}
              >
                Delete
              </button>
              <div className="modal-actions-right">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => {
                    setEditingStaff(null);
                    setStaffName("");
                    setStaffRole("");
                    setStaffDob("");
                    setStaffGender("");
                  }}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="save-btn"
                  onClick={updateStaff}
                  disabled={busy || !staffName.trim() || !staffRole.trim()}
                >
                  {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </EditModal>
    </div>
  );
}

