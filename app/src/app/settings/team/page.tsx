"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { EditModal } from "@/components/EditModal";

function TogglePill({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-6 w-11 items-center rounded-full transition",
        checked ? "bg-emerald-500" : "bg-slate-300",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      ].join(" ")}
      aria-label={checked ? "Active" : "Inactive"}
    >
      <span
        className={[
          "inline-block h-5 w-5 transform rounded-full bg-white transition",
          checked ? "translate-x-5" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}

type DentistRow = {
  id: string;
  full_name: string;
  prc_number: string | null;
  ptr_number: string | null;
  date_of_birth: string | null;
  is_active: boolean;
};

type StaffRow = {
  id: string;
  full_name: string;
  role: string;
  date_of_birth: string | null;
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

  // Dentist form & modal
  const [showAddDentistModal, setShowAddDentistModal] = useState(false);
  const [dentistName, setDentistName] = useState("");
  const [dentistDob, setDentistDob] = useState("");
  const [dentistPrc, setDentistPrc] = useState("");
  const [dentistPtr, setDentistPtr] = useState("");
  const [editingDentist, setEditingDentist] = useState<DentistRow | null>(null);

  // Staff form & modal
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState("");
  const [staffDob, setStaffDob] = useState("");
  const [editingStaff, setEditingStaff] = useState<StaffRow | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr(null);
    console.log("loadData called");

    try {
      const dentistRes = await supabase
        .from("dentists")
        .select("*")
        .order("full_name", { ascending: true });

      if (dentistRes.error) throw dentistRes.error;

      const dentistData = (dentistRes.data || []).map((d: any) => ({
        id: d.id,
        full_name: d.full_name,
        prc_number: d.prc_number || null,
        ptr_number: d.ptr_number || null,
        date_of_birth: d.date_of_birth || null,
        is_active: d.is_active ?? true,
      })) as DentistRow[];

      console.log("Loaded dentists:", dentistData);
      setDentists(dentistData);

      try {
        const staffRes = await supabase
          .from("staff")
          .select("*")
          .order("full_name", { ascending: true });

        if (!staffRes.error) {
          const staffData = (staffRes.data || []).map((s: any) => ({
            id: s.id,
            full_name: s.full_name,
            role: s.role,
            date_of_birth: s.date_of_birth || null,
            is_active: s.is_active ?? true,
          })) as StaffRow[];
          setStaff(staffData);
        }
      } catch {
        setStaff([]);
      }
    } catch (error) {
      console.error("Load error:", error);
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
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const { error } = await supabase.from("dentists").insert({
        full_name: dentistName.trim(),
        date_of_birth: dentistDob || null,
        prc_number: dentistPrc.trim() || null,
        ptr_number: dentistPtr ? parseInt(dentistPtr) : null,
        is_active: true,
      });

      if (error) throw error;

      setDentistName("");
      setDentistDob("");
      setDentistPrc("");
      setDentistPtr("");
      setShowAddDentistModal(false);
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
      console.log("Updating dentist:", {
        id: editingDentist.id,
        full_name: dentistName.trim(),
        date_of_birth: dentistDob || null,
        prc_number: dentistPrc.trim() || null,
        ptr_number: dentistPtr.trim() || null,
      });

      const { data, error } = await supabase
        .from("dentists")
        .update({
          full_name: dentistName.trim(),
          date_of_birth: dentistDob || null,
          prc_number: dentistPrc.trim() || null,
          ptr_number: dentistPtr ? parseInt(dentistPtr) : null,
        })
        .eq("id", editingDentist.id)
        .select();

      console.log("Update response - data:", data, "error:", error);

      if (error) {
        console.error("Supabase update error:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        throw error;
      }

      console.log("Update successful, calling loadData");
      setEditingDentist(null);
      setDentistName("");
      setDentistDob("");
      setDentistPrc("");
      setDentistPtr("");
      setShowAddDentistModal(false);
      setErr(null);
      
      // Small delay to ensure database is updated
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await loadData();
      console.log("LoadData completed");
    } catch (error) {
      console.error("Update dentist error:", error);
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
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      
      if (!userId) {
        throw new Error("User not authenticated");
      }

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
        is_active: true,
        created_by: userId,
      });

      if (error) {
        console.error("Add staff error:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        throw error;
      }

      setStaffName("");
      setStaffRole("");
      setStaffDob("");
      setShowAddStaffModal(false);
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
        })
        .eq("id", editingStaff.id);

      if (error) throw error;

      setEditingStaff(null);
      setStaffName("");
      setStaffRole("");
      setStaffDob("");
      setShowAddStaffModal(false);
      setErr(null);
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
    <>
      {err ? <div className="error-banner">{err}</div> : null}
      <div className="page-content">
        <div className="page-sections">
            {/* DENTISTS SECTION */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Dentists</h2>
                <button
                  className="btn-secondary-dark"
                  onClick={() => {
                    setDentistName("");
                    setDentistDob("");
                    setDentistPrc("");
                    setDentistPtr("");
                    setEditingDentist(null);
                    setShowAddDentistModal(true);
                  }}
                  disabled={busy}
                >
                  Add Dentist
                </button>
              </div>

              <div className="table-wrapper">
              <table className="data-table">
                <colgroup>
                  <col className="col-25" />
                  <col className="col-20" />
                  <col className="col-17" />
                  <col className="col-17" />
                  <col className="col-11" />
                  <col className="col-10" />
                </colgroup>
                <thead className="data-table-head">
                  <tr>
                    <th className="data-table-head-cell">Name</th>
                    <th className="data-table-head-cell">Date of Birth</th>
                    <th className="data-table-head-cell">PRC Number</th>
                    <th className="data-table-head-cell">PTR Number</th>
                    <th className="data-table-head-cell">Activate</th>
                    <th className="data-table-head-cell-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dentists.length === 0 ? (
                    <tr className="data-table-row">
                      <td colSpan={6} className="data-table-empty">
                        No dentists yet.
                      </td>
                    </tr>
                  ) : (
                    dentists.map((d, index) => (
                      <tr
                        key={d.id}
                        className={`data-table-row ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}
                      >
                        <td className="data-table-cell font-medium">{d.full_name}</td>
                        <td className="data-table-cell">
                          {d.date_of_birth
                            ? new Date(d.date_of_birth).toLocaleDateString("en-PH")
                            : "—"}
                        </td>
                        <td className="data-table-cell">{d.prc_number || "—"}</td>
                        <td className="data-table-cell">{d.ptr_number || "—"}</td>
                        <td className="data-table-cell">
                          <TogglePill
                            checked={d.is_active}
                            onChange={(v) => toggleDentistActive(d.id, v)}
                            disabled={busy}
                          />
                        </td>
                        <td className="data-table-cell-right">
                          <button
                            className="data-table-btn"
                            onClick={() => {
                              setEditingDentist(d);
                              setDentistName(d.full_name);
                              setDentistDob(d.date_of_birth || "");
                              setDentistPrc(d.prc_number || "");
                              setDentistPtr(d.ptr_number || "");
                              setShowAddDentistModal(true);
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

            {/* STAFF SECTION */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Staff Members</h2>
                <button
                  className="btn-secondary-dark"
                  onClick={() => {
                    setStaffName("");
                    setStaffRole("");
                    setStaffDob("");
                    setEditingStaff(null);
                    setShowAddStaffModal(true);
                  }}
                  disabled={busy}
                >
                  Add Staff
                </button>
              </div>

              <div className="table-wrapper">
              <table className="data-table">
                <colgroup>
                  <col className="col-30" />
                  <col className="col-20" />
                  <col className="col-25" />
                  <col className="col-15" />
                  <col className="col-10" />
                </colgroup>
                <thead className="data-table-head">
                  <tr>
                    <th className="data-table-head-cell">Name</th>
                    <th className="data-table-head-cell">Role</th>
                    <th className="data-table-head-cell">Date of Birth</th>
                    <th className="data-table-head-cell">Activate</th>
                    <th className="data-table-head-cell-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.length === 0 ? (
                    <tr className="data-table-row">
                      <td colSpan={5} className="data-table-empty">
                        No staff members yet.
                      </td>
                    </tr>
                  ) : (
                    staff.map((s, index) => (
                      <tr
                        key={s.id}
                        className={`data-table-row ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}
                      >
                        <td className="data-table-cell font-medium">{s.full_name}</td>
                        <td className="data-table-cell">{s.role}</td>
                        <td className="data-table-cell">
                          {s.date_of_birth
                            ? new Date(s.date_of_birth).toLocaleDateString("en-PH")
                            : "—"}
                        </td>
                        <td className="data-table-cell">
                          <TogglePill
                            checked={s.is_active}
                            onChange={(v) => toggleStaffActive(s.id, v)}
                            disabled={busy}
                          />
                        </td>
                        <td className="data-table-cell-right">
                          <button
                            className="data-table-btn"
                            onClick={() => {
                              setEditingStaff(s);
                              setStaffName(s.full_name);
                              setStaffRole(s.role);
                              setStaffDob(s.date_of_birth || "");
                              setShowAddStaffModal(true);
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
        </div>
      </div>

      {/* ADD/EDIT DENTIST MODAL */}
      <EditModal
        open={showAddDentistModal}
        title={editingDentist ? "Edit dentist" : "Add dentist"}
        onClose={() => {
          setShowAddDentistModal(false);
          setEditingDentist(null);
          setDentistName("");
          setDentistDob("");
          setDentistPrc("");
          setDentistPtr("");
        }}
      >
        <div className="spacing-vertical-lg">
          <label className="field-label">
            <span className="field-label-text">Full name</span>
            <input
              className="field-input"
              value={dentistName}
              onChange={(e) => setDentistName(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="field-label">
            <span className="field-label-text">Date of Birth</span>
            <input
              type="date"
              className="field-input"
              value={dentistDob}
              onChange={(e) => setDentistDob(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="field-label">
            <span className="field-label-text">PRC Number</span>
            <input
              className="field-input"
              placeholder="PRC number (permanent)"
              value={dentistPrc}
              onChange={(e) => setDentistPrc(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="field-label">
            <span className="field-label-text">PTR Number</span>
            <input
              type="number"
              className="field-input"
              placeholder="PTR number (annual)"
              value={dentistPtr}
              onChange={(e) => setDentistPtr(e.target.value)}
              disabled={busy}
            />
          </label>
          <div className="modal-actions">
            {editingDentist && (
              <button
                type="button"
                className="delete-btn"
                onClick={() => deleteDentist(editingDentist.id)}
                disabled={busy}
              >
                Delete
              </button>
            )}
            <div className="modal-actions-right">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => {
                  setShowAddDentistModal(false);
                  setEditingDentist(null);
                  setDentistName("");
                  setDentistDob("");
                  setDentistPrc("");
                  setDentistPtr("");
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="save-btn"
                onClick={editingDentist ? updateDentist : addDentist}
                disabled={busy || !dentistName.trim()}
              >
                {busy ? "Saving…" : editingDentist ? "Update" : "Add"}
              </button>
            </div>
          </div>
        </div>
      </EditModal>

      {/* ADD/EDIT STAFF MODAL */}
      <EditModal
        open={showAddStaffModal}
        title={editingStaff ? "Edit staff member" : "Add staff member"}
        onClose={() => {
          setShowAddStaffModal(false);
          setEditingStaff(null);
          setStaffName("");
          setStaffRole("");
          setStaffDob("");
        }}
      >
        <div className="spacing-vertical-lg">
          <label className="field-label">
            <span className="field-label-text">Full name</span>
            <input
              className="field-input"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="field-label">
            <span className="field-label-text">Role</span>
            <select
              className="field-input"
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
          </label>
          <label className="field-label">
            <span className="field-label-text">Date of Birth</span>
            <input
              type="date"
              className="field-input"
              value={staffDob}
              onChange={(e) => setStaffDob(e.target.value)}
              disabled={busy}
            />
          </label>
          <div className="modal-actions">
            {editingStaff && (
              <button
                type="button"
                className="delete-btn"
                onClick={() => deleteStaff(editingStaff.id)}
                disabled={busy}
              >
                Delete
              </button>
            )}
            <div className="modal-actions-right">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => {
                  setShowAddStaffModal(false);
                  setEditingStaff(null);
                  setStaffName("");
                  setStaffRole("");
                  setStaffDob("");
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="save-btn"
                onClick={editingStaff ? updateStaff : addStaff}
                disabled={busy || !staffName.trim() || !staffRole.trim()}
              >
                {busy ? "Saving…" : editingStaff ? "Update" : "Add"}
              </button>
            </div>
          </div>
        </div>
      </EditModal>
    </>
  );
}
