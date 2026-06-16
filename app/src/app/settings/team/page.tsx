/*
 * SQL — run in Supabase SQL editor to create the staff_invites table:
 *
 * CREATE TABLE staff_invites (
 *   id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   clinic_id   uuid NOT NULL REFERENCES clinics(id),
 *   email       text NOT NULL,
 *   role        text NOT NULL DEFAULT 'staff',
 *   invited_by  uuid REFERENCES profiles(id),
 *   token       uuid NOT NULL DEFAULT gen_random_uuid(),
 *   status      text NOT NULL DEFAULT 'pending'
 *               CHECK (status IN ('pending', 'accepted', 'expired')),
 *   created_at  timestamptz DEFAULT now(),
 *   expires_at  timestamptz DEFAULT (now() + interval '7 days')
 * );
 * ALTER TABLE staff_invites ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "clinic members can view invites"
 *   ON staff_invites FOR SELECT
 *   USING (clinic_id IN (
 *     SELECT clinic_id FROM profiles WHERE id = auth.uid()
 *   ));
 * CREATE POLICY "owners can insert invites"
 *   ON staff_invites FOR INSERT
 *   WITH CHECK (clinic_id IN (
 *     SELECT clinic_id FROM profiles WHERE id = auth.uid() AND role = 'owner'
 *   ));
 */

"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useClinic } from "@/contexts/ClinicContext";
import { supabase } from "@/lib/supabaseClient";
import { formatDateStandard } from "@/lib/helpers";
import { EditModal } from "@/components/EditModal";
import { DatePickerField } from "@/components/DatePickerField";
import { Spinner } from "@/components/Spinner";
import { Toggle } from "@/components/Toggle";
import { TableOptions, type ColumnConfig } from "@/components/shared/TableOptions";

const TogglePill = Toggle;

const DENTIST_COLORS = [
  { hex: "#6366f1", label: "Indigo" },
  { hex: "#0d9488", label: "Teal" },
  { hex: "#e11d48", label: "Rose" },
  { hex: "#d97706", label: "Amber" },
  { hex: "#059669", label: "Emerald" },
  { hex: "#0ea5e9", label: "Sky" },
  { hex: "#9333ea", label: "Purple" },
  { hex: "#ea580c", label: "Orange" },
  { hex: "#65a30d", label: "Lime" },
  { hex: "#06b6d4", label: "Cyan" },
];

type DentistRow = {
  id: string;
  full_name: string;
  nickname: string | null;
  prc_number: string | null;
  ptr_number: string | null;
  date_of_birth: string | null;
  is_active: boolean;
  color: string | null;
};

type StaffRow = {
  id: string;
  full_name: string;
  role: string;
  date_of_birth: string | null;
  is_active: boolean;
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  status: "pending" | "accepted" | "expired";
  created_at: string;
  expires_at: string;
};

const DENTIST_TEAM_COLUMNS: ColumnConfig[] = [
  { key: "full_name",    label: "Name",         required: true },
  { key: "date_of_birth", label: "Date of Birth" },
  { key: "prc_number",  label: "PRC Number" },
  { key: "ptr_number",  label: "PTR Number" },
  { key: "activate",    label: "Activate" },
];

const STAFF_TEAM_COLUMNS: ColumnConfig[] = [
  { key: "full_name",    label: "Name", required: true },
  { key: "role",         label: "Role" },
  { key: "date_of_birth", label: "Date of Birth" },
  { key: "activate",    label: "Activate" },
];

function LoadingBlock() {
  return (
    <div className="flex items-center justify-center py-16">
      <Spinner />
    </div>
  );
}

export default function TeamSettingsPage() {
  const { clinicId, isOwner, isPro, isLoading: clinicLoading } = useClinic();
  const [dentists, setDentists] = useState<DentistRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dentistSortConfig, setDentistSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "full_name", direction: "asc" });
  const [staffSortConfig, setStaffSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "full_name", direction: "asc" });

  // Invite state (embedded inside Add/Edit Staff modal)
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Dentist form & modal
  const [showAddDentistModal, setShowAddDentistModal] = useState(false);
  const [dentistName, setDentistName] = useState("");
  const [dentistDob, setDentistDob] = useState("");
  const [dentistPrc, setDentistPrc] = useState("");
  const [dentistPtr, setDentistPtr] = useState("");
  const [dentistColor, setDentistColor] = useState<string>(DENTIST_COLORS[0].hex);
  const [dentistNickname, setDentistNickname] = useState("");
  const [editingDentist, setEditingDentist] = useState<DentistRow | null>(null);
  const dentistDobRef = useRef<HTMLInputElement | null>(null);

  // Staff form & modal
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState("");
  const [staffDob, setStaffDob] = useState("");
  const [editingStaff, setEditingStaff] = useState<StaffRow | null>(null);
  const staffDobRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async () => {
    if (clinicLoading || !clinicId) return;
    setLoading(true);
    setError(null);

    try {
      const dentistRes = await supabase
        .from("dentists")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("full_name", { ascending: true });

      if (dentistRes.error) throw dentistRes.error;

      const dentistData = (dentistRes.data || []).map((d: Record<string, unknown>) => ({
        id: d.id as string,
        full_name: d.full_name as string,
        nickname: (d.nickname as string | null) || null,
        prc_number: (d.prc_number as string | null) || null,
        ptr_number: (d.ptr_number as string | null) || null,
        date_of_birth: (d.date_of_birth as string | null) || null,
        is_active: (d.is_active as boolean) ?? true,
        color: (d.color as string | null) || null,
      })) as DentistRow[];

      setDentists(dentistData);

      try {
        const staffRes = await supabase
          .from("staff")
          .select("*")
          .eq("clinic_id", clinicId)
          .order("full_name", { ascending: true });

        if (!staffRes.error) {
          const staffData = (staffRes.data || []).map((s: Record<string, unknown>) => ({
            id: s.id as string,
            full_name: s.full_name as string,
            role: s.role as string,
            date_of_birth: (s.date_of_birth as string | null) || null,
            is_active: (s.is_active as boolean) ?? true,
          })) as StaffRow[];
          setStaff(staffData);
        }
      } catch {
        setStaff([]);
      }

      try {
        const inviteRes = await supabase
          .from("staff_invites")
          .select("id, email, role, status, created_at, expires_at")
          .eq("clinic_id", clinicId)
          .eq("status", "pending")
          .order("created_at", { ascending: false });

        if (!inviteRes.error) {
          setInvites((inviteRes.data || []) as InviteRow[]);
        }
      } catch {
        setInvites([]);
      }
    } catch (err) {
      console.error("Load error:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [clinicLoading, clinicId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // DENTIST OPERATIONS
  async function addDentist() {
    if (!dentistName.trim()) {
      setError("Please enter dentist name");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      if (!userId) {
        throw new Error("User not authenticated");
      }

      const { error } = await supabase.from("dentists").insert({
        clinic_id: clinicId,
        full_name: dentistName.trim(),
        nickname: dentistNickname.trim() || null,
        date_of_birth: dentistDob || null,
        prc_number: dentistPrc.trim() || null,
        ptr_number: dentistPtr ? parseInt(dentistPtr) : null,
        is_active: true,
        color: dentistColor,
      });

      if (error) throw error;

      setDentistName("");
      setDentistDob("");
      setDentistPrc("");
      setDentistPtr("");
      setShowAddDentistModal(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add dentist");
    } finally {
      setBusy(false);
    }
  }

  async function updateDentist() {
    if (!editingDentist) return;
    if (!dentistName.trim()) {
      setError("Please enter dentist name");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const { error } = await supabase
        .from("dentists")
        .update({
          full_name: dentistName.trim(),
          nickname: dentistNickname.trim() || null,
          date_of_birth: dentistDob || null,
          prc_number: dentistPrc.trim() || null,
          ptr_number: dentistPtr ? parseInt(dentistPtr) : null,
          color: dentistColor,
        })
        .eq("id", editingDentist.id)
        .select();

      if (error) throw error;

      setEditingDentist(null);
      setDentistName("");
      setDentistNickname("");
      setDentistDob("");
      setDentistPrc("");
      setDentistPtr("");
      setShowAddDentistModal(false);
      setError(null);

      // Small delay to ensure database is updated
      await new Promise(resolve => setTimeout(resolve, 500));

      await loadData();
    } catch (err) {
      console.error("Update dentist error:", err);
      setError(err instanceof Error ? err.message : "Failed to update dentist");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDentist(id: string) {
    if (!confirm("Delete this dentist?")) return;

    setBusy(true);
    setError(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete dentist");
    } finally {
      setBusy(false);
    }
  }

  async function toggleDentistActive(id: string, isActive: boolean) {
    setBusy(true);
    setError(null);

    try {
      const { error } = await supabase
        .from("dentists")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update dentist");
    } finally {
      setBusy(false);
    }
  }

  // STAFF OPERATIONS
  async function addStaff() {
    if (!staffName.trim()) {
      setError("Please enter staff name");
      return;
    }
    if (!staffRole.trim()) {
      setError("Please select staff role");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error("User not authenticated");

      const { error } = await supabase.from("staff").insert({
        clinic_id: clinicId,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add staff");
    } finally {
      setBusy(false);
    }
  }

  async function updateStaff() {
    if (!editingStaff) return;
    if (!staffName.trim()) {
      setError("Please enter staff name");
      return;
    }
    if (!staffRole.trim()) {
      setError("Please select staff role");
      return;
    }

    setBusy(true);
    setError(null);

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
      setError(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update staff");
    } finally {
      setBusy(false);
    }
  }

  async function deleteStaff(id: string) {
    if (!confirm("Delete this staff member?")) return;

    setBusy(true);
    setError(null);

    try {
      const { error } = await supabase.from("staff").delete().eq("id", id);

      if (error) throw error;
      setEditingStaff(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete staff");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStaffActive(id: string, isActive: boolean) {
    setBusy(true);
    setError(null);

    try {
      const { error } = await supabase
        .from("staff")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update staff");
    } finally {
      setBusy(false);
    }
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) {
      setError("Please enter an email address");
      return;
    }

    setBusy(true);
    setError(null);
    setInviteSuccess(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error("User not authenticated");

      const { error: insertError } = await supabase.from("staff_invites").insert({
        clinic_id: clinicId,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        invited_by: userId,
      });

      if (insertError) throw insertError;

      setInviteSuccess("Invite recorded. Email sending coming soon.");
      setInviteEmail("");
      setInviteRole("staff");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record invite");
    } finally {
      setBusy(false);
    }
  }

  const sortedDentists = useMemo(() => {
    const list = [...dentists];
    const { key, direction } = dentistSortConfig;
    const dir = direction === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (key === "full_name") return dir * (a.full_name ?? "").localeCompare(b.full_name ?? "");
      if (key === "role")      return dir * (a.full_name ?? "").localeCompare(b.full_name ?? "");
      return 0;
    });
    return list;
  }, [dentists, dentistSortConfig]);

  const sortedStaff = useMemo(() => {
    const list = [...staff];
    const { key, direction } = staffSortConfig;
    const dir = direction === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (key === "full_name") return dir * (a.full_name ?? "").localeCompare(b.full_name ?? "");
      if (key === "role")      return dir * (a.role ?? "").localeCompare(b.role ?? "");
      return 0;
    });
    return list;
  }, [staff, staffSortConfig]);

  if (loading) return <LoadingBlock />;

  return (
    <>
      {error ? <div className="error-banner mb-4">{error}</div> : null}
      <div className="spacing-vertical-lg">

            {/* DENTISTS SECTION */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Dentists</h2>
                <div className="flex items-center gap-2">
                  <TableOptions
                    tableName="dentists_team"
                    columns={DENTIST_TEAM_COLUMNS}
                    sorts={[
                      { key: "full_name", label: "Name" },
                      { key: "role",      label: "Role" },
                    ]}
                    currentSort={dentistSortConfig}
                    onSortChange={(k, d) => setDentistSortConfig({ key: k, direction: d })}
                    data={dentists}
                    onDownloadCSV={() => {}}
                  />
                <button
                  className="save-btn"
                  onClick={() => {
                    setDentistName("");
                    setDentistNickname("");
                    setDentistDob("");
                    setDentistPrc("");
                    setDentistPtr("");
                    setDentistColor(DENTIST_COLORS[0].hex);
                    setEditingDentist(null);
                    setShowAddDentistModal(true);
                  }}
                  disabled={busy}
                >
                  Add Dentist
                </button>
                </div>
              </div>

              <div className="table-wrapper">
              <table className="data-table min-w-[600px]">
                <colgroup>
                  <col className="col-35" />
                  <col className="col-18" />
                  <col className="col-17" />
                  <col className="col-15" />
                  <col className="col-15" />
                </colgroup>
                <thead className="data-table-head">
                  <tr>
                    <th className="data-table-head-cell">Name</th>
                    <th className="data-table-head-cell">Date of Birth</th>
                    <th className="data-table-head-cell">PRC Number</th>
                    <th className="data-table-head-cell">PTR Number</th>
                    <th className="data-table-head-cell">Activate</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDentists.length === 0 ? (
                    <tr className="data-table-row">
                      <td colSpan={5} className="data-table-empty">
                        No dentists yet.
                      </td>
                    </tr>
                  ) : (
                    sortedDentists.map((d, index) => (
                      <tr
                        key={d.id}
                        className={`data-table-row cursor-pointer hover:bg-slate-50 ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}
                        onClick={() => {
                          setEditingDentist(d);
                          setDentistName(d.full_name);
                          setDentistNickname(d.nickname || "");
                          setDentistDob(d.date_of_birth || "");
                          setDentistPrc(d.prc_number || "");
                          setDentistPtr(d.ptr_number || "");
                          setDentistColor(d.color || DENTIST_COLORS[0].hex);
                          setShowAddDentistModal(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setEditingDentist(d);
                            setDentistName(d.full_name);
                            setDentistNickname(d.nickname || "");
                            setDentistDob(d.date_of_birth || "");
                            setDentistPrc(d.prc_number || "");
                            setDentistPtr(d.ptr_number || "");
                            setDentistColor(d.color || DENTIST_COLORS[0].hex);
                            setShowAddDentistModal(true);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Edit dentist ${d.full_name}`}
                      >
                        <td className="data-table-cell">
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color || DENTIST_COLORS[0].hex }} />
                            <span>
                              {d.full_name}
                              {d.nickname && <span className="ml-1.5 text-xs text-slate-400">({d.nickname})</span>}
                            </span>
                          </div>
                        </td>
                        <td className="data-table-cell">
                          {d.date_of_birth
                            ? formatDateStandard(d.date_of_birth.split('T')[0])
                            : "—"}
                        </td>
                        <td className="data-table-cell">{d.prc_number || "—"}</td>
                        <td className="data-table-cell">{d.ptr_number || "—"}</td>
                        <td className="data-table-cell" onClick={(e) => e.stopPropagation()}>
                          <TogglePill
                            checked={d.is_active}
                            onChange={(v) => toggleDentistActive(d.id, v)}
                            disabled={busy}
                          />
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
                <div className="flex items-center gap-2">
                  <TableOptions
                    tableName="staff_team"
                    columns={STAFF_TEAM_COLUMNS}
                    sorts={[
                      { key: "full_name", label: "Name" },
                      { key: "role",      label: "Role" },
                    ]}
                    currentSort={staffSortConfig}
                    onSortChange={(k, d) => setStaffSortConfig({ key: k, direction: d })}
                    data={staff}
                    onDownloadCSV={() => {}}
                  />
                  <button
                    className="save-btn"
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
              </div>

              <div className="table-wrapper">
              <table className="data-table">
                <colgroup>
                  <col className="col-35" />
                  <col className="col-25" />
                  <col className="col-25" />
                  <col className="col-15" />
                </colgroup>
                <thead className="data-table-head">
                  <tr>
                    <th className="data-table-head-cell">Name</th>
                    <th className="data-table-head-cell">Role</th>
                    <th className="data-table-head-cell">Date of Birth</th>
                    <th className="data-table-head-cell">Activate</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStaff.length === 0 ? (
                    <tr className="data-table-row">
                      <td colSpan={4} className="data-table-empty">
                        No staff members yet.
                      </td>
                    </tr>
                  ) : (
                    sortedStaff.map((s, index) => (
                      <tr
                        key={s.id}
                        className={`data-table-row cursor-pointer hover:bg-slate-50 ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}
                        onClick={() => {
                          setEditingStaff(s);
                          setStaffName(s.full_name);
                          setStaffRole(s.role);
                          setStaffDob(s.date_of_birth || "");
                          setShowAddStaffModal(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setEditingStaff(s);
                            setStaffName(s.full_name);
                            setStaffRole(s.role);
                            setStaffDob(s.date_of_birth || "");
                            setShowAddStaffModal(true);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Edit staff member ${s.full_name}`}
                      >
                        <td className="data-table-cell">{s.full_name}</td>
                        <td className="data-table-cell">{s.role}</td>
                        <td className="data-table-cell">
                          {s.date_of_birth
                            ? formatDateStandard(s.date_of_birth.split('T')[0])
                            : "—"}
                        </td>
                        <td className="data-table-cell" onClick={(e) => e.stopPropagation()}>
                          <TogglePill
                            checked={s.is_active}
                            onChange={(v) => toggleStaffActive(s.id, v)}
                            disabled={busy}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* PENDING INVITES */}
            {invites.length > 0 && (
              <div className="border-t border-slate-100 px-4 pt-4 pb-2">
                <p className="field-label-text mb-2">Pending invites</p>
                <div className="table-wrapper">
                  <table className="data-table">
                    <colgroup>
                      <col className="col-40" />
                      <col className="col-20" />
                      <col className="col-20" />
                      <col className="col-20" />
                    </colgroup>
                    <thead className="data-table-head">
                      <tr>
                        <th className="data-table-head-cell">Email</th>
                        <th className="data-table-head-cell">Role</th>
                        <th className="data-table-head-cell">Invited</th>
                        <th className="data-table-head-cell">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invites.map((inv, idx) => (
                        <tr
                          key={inv.id}
                          className={`data-table-row ${idx % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}
                        >
                          <td className="data-table-cell">{inv.email}</td>
                          <td className="data-table-cell capitalize">{inv.role}</td>
                          <td className="data-table-cell">{formatDateStandard(inv.created_at.split("T")[0])}</td>
                          <td className="data-table-cell">
                            <span className="badge badge-secondary">Pending</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            </div>

      </div> {/* end spacing-vertical-lg */}

      {/* ADD/EDIT DENTIST MODAL */}
      <EditModal
        open={showAddDentistModal}
        title={editingDentist ? "Edit dentist" : "Add dentist"}
        onClose={() => {
          setShowAddDentistModal(false);
          setEditingDentist(null);
          setDentistName("");
          setDentistNickname("");
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
            <span className="field-label-text">Nickname <span className="text-slate-400 font-normal">(optional — shown in UI)</span></span>
            <input
              className="field-input"
              placeholder="e.g. Dr. Ana"
              value={dentistNickname}
              onChange={(e) => setDentistNickname(e.target.value)}
              disabled={busy}
            />
          </label>
          <DatePickerField
            label="Date of Birth"
            value={dentistDob}
            onChange={(val) => setDentistDob(val)}
            inputRef={dentistDobRef}
            variant="case-modal"
            max={new Date().toISOString().split("T")[0]}
          />
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
          <div className="grid gap-1">
            <span className="field-label-text">Calendar color</span>
            <div className="flex gap-2">
              {DENTIST_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.label}
                  onClick={() => setDentistColor(c.hex)}
                  className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    background: c.hex,
                    borderColor: dentistColor === c.hex ? "#1e293b" : "transparent",
                    boxShadow: dentistColor === c.hex ? `0 0 0 2px white, 0 0 0 4px ${c.hex}` : "none",
                  }}
                  disabled={busy}
                />
              ))}
            </div>
          </div>
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
                  setDentistNickname("");
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
          setInviteEmail("");
          setInviteRole("staff");
          setInviteSuccess(null);
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
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
            </select>
          </label>
          <DatePickerField
            label="Date of Birth"
            value={staffDob}
            onChange={(val) => setStaffDob(val)}
            inputRef={staffDobRef}
            variant="case-modal"
            max={new Date().toISOString().split("T")[0]}
          />

          {/* Invite to app — inline inside staff modal */}
          {isOwner && (
            <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
              <p className="field-label-text mb-1">Invite to Molaris</p>
              <p className="hint-text mb-3">
                Send a login invite so this staff member can access the app.
                {!isPro && <span className="text-amber-600 dark:text-amber-400"> Requires Pro plan.</span>}
              </p>
              {inviteSuccess && <div className="success-banner mb-3">{inviteSuccess}</div>}
              <div className="flex gap-2">
                <input
                  type="email"
                  className="field-input flex-1"
                  placeholder="staff@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={busy || !isPro}
                />
                <button
                  type="button"
                  className={isPro ? "save-btn shrink-0" : "save-btn shrink-0 opacity-50 cursor-not-allowed"}
                  onClick={isPro ? sendInvite : undefined}
                  disabled={busy || !inviteEmail.trim() || !isPro}
                >
                  Send invite
                </button>
              </div>
            </div>
          )}

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
                  setInviteEmail("");
                  setInviteRole("staff");
                  setInviteSuccess(null);
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
