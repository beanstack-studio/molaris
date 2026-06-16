/*
 * SQL — run in Supabase SQL editor if staff_invites table doesn't exist:
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
 * CREATE POLICY "admins can insert invites"
 *   ON staff_invites FOR INSERT
 *   WITH CHECK (clinic_id IN (
 *     SELECT clinic_id FROM profiles WHERE id = auth.uid() AND role = 'admin'
 *   ));
 *
 * Run before using nickname and clinical access features:
 * ALTER TABLE staff ADD COLUMN IF NOT EXISTS nickname text;
 * ALTER TABLE staff ADD COLUMN IF NOT EXISTS can_access_clinical boolean DEFAULT false;
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useClinic } from "@/contexts/ClinicContext";
import { supabase } from "@/lib/supabaseClient";
import { formatDateStandard } from "@/lib/helpers";
import { EditModal } from "@/components/EditModal";
import { DatePickerField } from "@/components/DatePickerField";
import { Spinner } from "@/components/Spinner";
import { cn } from "@/lib/cn";
import type { ClinicHoursEntry } from "@/lib/types";

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

const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type DayKey = typeof DAY_KEYS[number];

const DAY_SHORT: Record<DayKey, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed",
  thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun",
};

const DAY_KEY_TO_CLINIC_ID: Record<DayKey, string> = {
  monday: "mon", tuesday: "tue", wednesday: "wed",
  thursday: "thu", friday: "fri", saturday: "sat", sunday: "sun",
};

// Week display order for the schedule table (Sun first)
const WEEK_ORDER: { header: string; key: DayKey }[] = [
  { header: "Sun", key: "sunday" },
  { header: "Mon", key: "monday" },
  { header: "Tue", key: "tuesday" },
  { header: "Wed", key: "wednesday" },
  { header: "Thu", key: "thursday" },
  { header: "Fri", key: "friday" },
  { header: "Sat", key: "saturday" },
];

const TIME_OPTIONS: { value: number; label: string }[] = [];
for (let h = 7; h <= 20; h++) {
  for (const m of [0, 30]) {
    const v = h + (m === 30 ? 0.5 : 0);
    const period = h < 12 ? "AM" : "PM";
    const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
    TIME_OPTIONS.push({ value: v, label: `${dh}:${m === 0 ? "00" : "30"} ${period}` });
  }
}

function formatTime(v: number) {
  const h = Math.floor(v); const m = (v % 1) * 60;
  const period = h < 12 ? "AM" : "PM";
  const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${dh}:${m === 0 ? "00" : "30"} ${period}`;
}

type DentistRow = {
  id: string; full_name: string; nickname: string | null;
  prc_number: string | null; ptr_number: string | null;
  date_of_birth: string | null; is_active: boolean; color: string | null;
};
type StaffRow = {
  id: string; full_name: string; nickname: string | null; role: string;
  date_of_birth: string | null; is_active: boolean;
  can_access_clinical: boolean | null;
};
type InviteRow = {
  id: string; email: string; role: string;
  status: "pending" | "accepted" | "expired";
  created_at: string; expires_at: string;
};
type DaySchedule = { is_working: boolean; start_time: number; end_time: number };
type DentistSchedule = Record<DayKey, DaySchedule>;

const DEFAULT_DAY: DaySchedule = { is_working: false, start_time: 8, end_time: 17 };
const DEFAULT_SCHEDULE: DentistSchedule = {
  monday: { is_working: true, start_time: 8, end_time: 17 },
  tuesday: { is_working: true, start_time: 8, end_time: 17 },
  wednesday: { is_working: true, start_time: 8, end_time: 17 },
  thursday: { is_working: true, start_time: 8, end_time: 17 },
  friday: { is_working: true, start_time: 8, end_time: 17 },
  saturday: { is_working: true, start_time: 8, end_time: 12 },
  sunday: DEFAULT_DAY,
};

function formatDayCell(ds: DaySchedule | undefined): string {
  if (!ds || !ds.is_working) return "—";
  const fmt12 = (h: number) => (h > 12 ? h - 12 : h === 0 ? 12 : h);
  return `${fmt12(Math.floor(ds.start_time))}–${fmt12(Math.floor(ds.end_time))}`;
}

function LoadingBlock() {
  return <div className="flex items-center justify-center py-16"><Spinner /></div>;
}

export default function TeamSettingsPage() {
  const { clinicId, profileId, isAdmin, isPro, isLoading: clinicLoading } = useClinic();
  const [dentists, setDentists] = useState<DentistRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [clinicHours, setClinicHours] = useState<ClinicHoursEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Schedule editor state
  const [schedules, setSchedules] = useState<Record<string, DentistSchedule>>({});
  const [editingScheduleFor, setEditingScheduleFor] = useState<{ id: string } | null>(null);
  const [scheduleEdit, setScheduleEdit] = useState<DentistSchedule>(DEFAULT_SCHEDULE);

  // Dentist modal state
  const [showAddDentistModal, setShowAddDentistModal] = useState(false);
  const [editingDentist, setEditingDentist] = useState<DentistRow | null>(null);
  const [dentistName, setDentistName] = useState("");
  const [dentistNickname, setDentistNickname] = useState("");
  const [dentistDob, setDentistDob] = useState("");
  const [dentistPrc, setDentistPrc] = useState("");
  const [dentistPtr, setDentistPtr] = useState("");
  const [dentistColor, setDentistColor] = useState<string>(DENTIST_COLORS[0].hex);
  const [dentistInviteEmail, setDentistInviteEmail] = useState("");
  const [dentistInviteSuccess, setDentistInviteSuccess] = useState<string | null>(null);
  const dentistDobRef = useRef<HTMLInputElement | null>(null);

  // Staff modal state
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffRow | null>(null);
  const [staffName, setStaffName] = useState("");
  const [staffNickname, setStaffNickname] = useState("");
  const [staffRole, setStaffRole] = useState("");
  const [staffDob, setStaffDob] = useState("");
  const [staffCanClinical, setStaffCanClinical] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const staffDobRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async () => {
    if (clinicLoading || !clinicId) return;
    setLoading(true); setError(null);
    try {
      const [dentistRes, staffRes, inviteRes, profileRes] = await Promise.all([
        supabase.from("dentists").select("*").eq("clinic_id", clinicId).order("full_name"),
        supabase.from("staff").select("*").eq("clinic_id", clinicId).order("full_name"),
        supabase.from("staff_invites").select("id, email, role, status, created_at, expires_at")
          .eq("clinic_id", clinicId).eq("status", "pending").order("created_at", { ascending: false }),
        supabase.from("clinic_profile").select("clinic_hours").eq("clinic_id", clinicId).maybeSingle(),
      ]);
      if (dentistRes.error) throw dentistRes.error;
      const loadedDentists = (dentistRes.data ?? []) as DentistRow[];
      setDentists(loadedDentists);
      if (!staffRes.error) setStaff((staffRes.data ?? []) as StaffRow[]);
      if (!inviteRes.error) setInvites((inviteRes.data ?? []) as InviteRow[]);
      if (profileRes.data?.clinic_hours) {
        setClinicHours(profileRes.data.clinic_hours as ClinicHoursEntry[]);
      }

      // Batch-load all dentist schedules
      if (loadedDentists.length > 0) {
        const schedRes = await supabase
          .from("dentist_schedules")
          .select("dentist_id, day_of_week, is_working, start_time, end_time")
          .eq("clinic_id", clinicId)
          .in("dentist_id", loadedDentists.map((d) => d.id));

        if (!schedRes.error && schedRes.data) {
          const newSchedules: Record<string, DentistSchedule> = {};
          for (const d of loadedDentists) {
            const sched: DentistSchedule = {
              monday: { ...DEFAULT_SCHEDULE.monday },
              tuesday: { ...DEFAULT_SCHEDULE.tuesday },
              wednesday: { ...DEFAULT_SCHEDULE.wednesday },
              thursday: { ...DEFAULT_SCHEDULE.thursday },
              friday: { ...DEFAULT_SCHEDULE.friday },
              saturday: { ...DEFAULT_SCHEDULE.saturday },
              sunday: { ...DEFAULT_SCHEDULE.sunday },
            };
            const rows = schedRes.data.filter((r) => r.dentist_id === d.id);
            for (const row of rows) {
              const day = row.day_of_week as DayKey;
              if (DAY_KEYS.includes(day)) {
                sched[day] = {
                  is_working: row.is_working ?? false,
                  start_time: row.start_time ?? 8,
                  end_time: row.end_time ?? 17,
                };
              }
            }
            newSchedules[d.id] = sched;
          }
          setSchedules(newSchedules);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally { setLoading(false); }
  }, [clinicLoading, clinicId]);

  useEffect(() => { loadData(); }, [loadData]);

  function getConstrainedTimeOptions(day: DayKey): { value: number; label: string }[] {
    if (clinicHours.length === 0) return TIME_OPTIONS;
    const ch = clinicHours.find((h) => h.id === DAY_KEY_TO_CLINIC_ID[day]);
    if (!ch || !ch.is_open) return TIME_OPTIONS;
    return TIME_OPTIONS.filter((o) => o.value >= ch.open_hour && o.value <= ch.close_hour);
  }

  function openScheduleEdit(id: string) {
    setScheduleEdit({ ...(schedules[id] ?? DEFAULT_SCHEDULE) });
    setEditingScheduleFor({ id });
  }

  async function saveSchedule() {
    if (!editingScheduleFor) return;
    setBusy(true); setError(null);
    try {
      const rows = DAY_KEYS.map((day) => ({
        clinic_id: clinicId,
        dentist_id: editingScheduleFor.id,
        day_of_week: day,
        is_working: scheduleEdit[day].is_working,
        start_time: scheduleEdit[day].start_time,
        end_time: scheduleEdit[day].end_time,
      }));
      const { error: upsertErr } = await supabase
        .from("dentist_schedules")
        .upsert(rows, { onConflict: "dentist_id,day_of_week" });
      if (upsertErr) throw upsertErr;
      setSchedules((p) => ({ ...p, [editingScheduleFor.id]: { ...scheduleEdit } }));
      setEditingScheduleFor(null);
      setSuccess("Schedule saved."); setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save schedule");
    } finally { setBusy(false); }
  }

  // ── Dentist CRUD ──────────────────────────────────────────────────────────────
  function openAddDentist() {
    setEditingDentist(null); setDentistName(""); setDentistNickname("");
    setDentistDob(""); setDentistPrc(""); setDentistPtr(""); setDentistColor(DENTIST_COLORS[0].hex);
    setDentistInviteEmail(""); setDentistInviteSuccess(null);
    setShowAddDentistModal(true);
  }
  function openEditDentist(d: DentistRow) {
    setEditingDentist(d); setDentistName(d.full_name); setDentistNickname(d.nickname ?? "");
    setDentistDob(d.date_of_birth ?? ""); setDentistPrc(d.prc_number ?? "");
    setDentistPtr(d.ptr_number ?? ""); setDentistColor(d.color ?? DENTIST_COLORS[0].hex);
    setDentistInviteEmail(""); setDentistInviteSuccess(null);
    setShowAddDentistModal(true);
  }
  function closeDentistModal() {
    setShowAddDentistModal(false); setEditingDentist(null);
    setDentistName(""); setDentistNickname(""); setDentistDob(""); setDentistPrc(""); setDentistPtr("");
    setDentistInviteEmail(""); setDentistInviteSuccess(null);
  }
  async function saveDentist() {
    if (!dentistName.trim()) return;
    setBusy(true); setError(null);
    try {
      const payload = {
        clinic_id: clinicId, full_name: dentistName.trim(),
        nickname: dentistNickname.trim() || null, date_of_birth: dentistDob || null,
        prc_number: dentistPrc.trim() || null, ptr_number: dentistPtr ? parseInt(dentistPtr) : null,
        color: dentistColor,
      };
      const { error } = editingDentist
        ? await supabase.from("dentists").update(payload).eq("id", editingDentist.id)
        : await supabase.from("dentists").insert({ ...payload, is_active: true });
      if (error) throw error;
      closeDentistModal();
      await loadData();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save dentist"); }
    finally { setBusy(false); }
  }
  async function deleteDentist(id: string) {
    if (!confirm("Delete this dentist? This cannot be undone.")) return;
    setBusy(true);
    const { error } = await supabase.from("dentists").delete().eq("id", id);
    if (error) setError(error.message);
    else { closeDentistModal(); await loadData(); }
    setBusy(false);
  }
  async function sendDentistInvite() {
    if (!dentistInviteEmail.trim()) return;
    setBusy(true); setDentistInviteSuccess(null);
    try {
      const { error } = await supabase.from("staff_invites").insert({
        clinic_id: clinicId,
        email: dentistInviteEmail.trim().toLowerCase(),
        role: "staff",
        invited_by: profileId,
      });
      if (error) throw error;
      setDentistInviteSuccess(`Invite sent to ${dentistInviteEmail.trim().toLowerCase()}`);
      setDentistInviteEmail("");
      await loadData();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to send invite"); }
    finally { setBusy(false); }
  }

  // ── Staff CRUD ────────────────────────────────────────────────────────────────
  function openAddStaff() {
    setEditingStaff(null); setStaffName(""); setStaffNickname(""); setStaffRole(""); setStaffDob("");
    setStaffCanClinical(false); setInviteEmail(""); setInviteSuccess(null);
    setShowAddStaffModal(true);
  }
  function openEditStaff(s: StaffRow) {
    setEditingStaff(s); setStaffName(s.full_name); setStaffNickname(s.nickname ?? "");
    setStaffRole(s.role); setStaffDob(s.date_of_birth ?? "");
    setStaffCanClinical(s.can_access_clinical ?? false);
    setInviteEmail(""); setInviteSuccess(null);
    setShowAddStaffModal(true);
  }
  function closeStaffModal() {
    setShowAddStaffModal(false); setEditingStaff(null);
    setStaffName(""); setStaffNickname(""); setStaffRole(""); setStaffDob("");
    setStaffCanClinical(false); setInviteEmail(""); setInviteSuccess(null);
  }
  async function saveStaff() {
    if (!staffName.trim() || !staffRole.trim()) return;
    setBusy(true); setError(null);
    try {
      const payload = {
        clinic_id: clinicId, full_name: staffName.trim(),
        nickname: staffNickname.trim() || null,
        role: staffRole.trim(), date_of_birth: staffDob || null,
        can_access_clinical: staffCanClinical,
      };
      const { error } = editingStaff
        ? await supabase.from("staff").update(payload).eq("id", editingStaff.id)
        : await supabase.from("staff").insert({ ...payload, is_active: true, created_by: profileId });
      if (error) throw error;
      closeStaffModal();
      await loadData();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save staff"); }
    finally { setBusy(false); }
  }
  async function deleteStaff(id: string) {
    if (!confirm("Delete this staff member? This cannot be undone.")) return;
    setBusy(true);
    const { error } = await supabase.from("staff").delete().eq("id", id);
    if (error) setError(error.message);
    else { closeStaffModal(); await loadData(); }
    setBusy(false);
  }
  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setBusy(true); setInviteSuccess(null);
    try {
      const { error } = await supabase.from("staff_invites").insert({
        clinic_id: clinicId, email: inviteEmail.trim().toLowerCase(),
        role: "staff", invited_by: profileId,
      });
      if (error) throw error;
      setInviteSuccess(`Invite sent to ${inviteEmail.trim().toLowerCase()}`);
      setInviteEmail(""); await loadData();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to send invite"); }
    finally { setBusy(false); }
  }

  if (loading) return <LoadingBlock />;

  return (
    <>
      {error && <div className="error-banner mb-4">{error}</div>}
      {success && <div className="success-banner mb-4">{success}</div>}

      <div className="spacing-vertical-lg">
        {/* ── DENTISTS ── */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Dentists</h2>
            {isAdmin && (
              <button className="save-btn" onClick={openAddDentist} disabled={busy}>
                Add Dentist
              </button>
            )}
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <colgroup>
                <col className="col-40" />
                <col className="col-30" />
                <col className="col-30" />
              </colgroup>
              <thead className="data-table-head">
                <tr>
                  <th className="data-table-head-cell">Name</th>
                  <th className="data-table-head-cell">PTR No.</th>
                  <th className="data-table-head-cell">License No.</th>
                </tr>
              </thead>
              <tbody>
                {dentists.length === 0 ? (
                  <tr><td className="data-table-empty" colSpan={3}>No dentists yet.</td></tr>
                ) : dentists.map((d, idx) => (
                  <tr
                    key={d.id}
                    className={cn(
                      "data-table-row",
                      idx % 2 === 0 ? "data-table-row-even" : "data-table-row-odd",
                      isAdmin && "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                    onClick={isAdmin ? () => openEditDentist(d) : undefined}
                    onKeyDown={isAdmin ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEditDentist(d); } } : undefined}
                    tabIndex={isAdmin ? 0 : undefined}
                    role={isAdmin ? "button" : undefined}
                    aria-label={isAdmin ? d.full_name : undefined}
                  >
                    <td className="data-table-cell">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3 rounded-full shrink-0"
                          style={{ background: d.color ?? DENTIST_COLORS[0].hex }}
                        />
                        <span className="font-medium">{d.full_name}</span>
                        {!d.is_active && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 dark:bg-slate-700">Inactive</span>
                        )}
                      </div>
                    </td>
                    <td className="data-table-cell text-slate-600">{d.ptr_number ?? "—"}</td>
                    <td className="data-table-cell text-slate-600">{d.prc_number ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── STAFF ── */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Staff Members</h2>
            {isAdmin && (
              <button className="save-btn" onClick={openAddStaff} disabled={busy}>
                Add Staff
              </button>
            )}
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <colgroup>
                <col className="col-60" />
                <col className="col-40" />
              </colgroup>
              <thead className="data-table-head">
                <tr>
                  <th className="data-table-head-cell">Name</th>
                  <th className="data-table-head-cell">Role</th>
                </tr>
              </thead>
              <tbody>
                {staff.length === 0 ? (
                  <tr><td className="data-table-empty" colSpan={2}>No staff members yet.</td></tr>
                ) : staff.map((s, idx) => (
                  <tr
                    key={s.id}
                    className={cn(
                      "data-table-row",
                      idx % 2 === 0 ? "data-table-row-even" : "data-table-row-odd",
                      isAdmin && "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                    onClick={isAdmin ? () => openEditStaff(s) : undefined}
                    onKeyDown={isAdmin ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEditStaff(s); } } : undefined}
                    tabIndex={isAdmin ? 0 : undefined}
                    role={isAdmin ? "button" : undefined}
                    aria-label={isAdmin ? s.full_name : undefined}
                  >
                    <td className="data-table-cell">
                      <span className="font-medium">{s.full_name}</span>
                      {!s.is_active && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 dark:bg-slate-700">Inactive</span>
                      )}
                      {s.can_access_clinical && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">Clinical</span>
                      )}
                    </td>
                    <td className="data-table-cell text-slate-500">{s.role || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pending invites */}
          {invites.length > 0 && isAdmin && (
            <div className="border-t border-slate-100 dark:border-slate-700 px-4 pt-4 pb-2">
              <p className="field-label-text mb-2">Pending invites</p>
              <div className="table-wrapper">
                <table className="data-table">
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
                      <tr key={inv.id} className={cn("data-table-row", idx % 2 === 0 ? "data-table-row-even" : "data-table-row-odd")}>
                        <td className="data-table-cell">{inv.email}</td>
                        <td className="data-table-cell capitalize">{inv.role}</td>
                        <td className="data-table-cell">{formatDateStandard(inv.created_at.split("T")[0])}</td>
                        <td className="data-table-cell"><span className="badge badge-secondary">Pending</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── SCHEDULES ── */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Schedules</h2>
          </div>
          {clinicHours.length > 0 && (
            <p className="hint-text px-4 pb-2">
              Time options constrained to clinic operating hours set in Clinic Profile.
            </p>
          )}
          {dentists.length === 0 && staff.length === 0 ? (
            <div className="data-table-empty">Add team members above to manage their schedules.</div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table min-w-[700px]">
                <colgroup>
                  <col className="col-20" />
                  <col className="col-10" />
                  <col className="col-10" />
                  <col className="col-10" />
                  <col className="col-10" />
                  <col className="col-10" />
                  <col className="col-10" />
                  <col className="col-10" />
                  <col className="col-10" />
                </colgroup>
                <thead className="data-table-head">
                  <tr>
                    <th className="data-table-head-cell">Nickname</th>
                    {WEEK_ORDER.map(({ header }) => (
                      <th key={header} className="data-table-head-cell text-center">{header}</th>
                    ))}
                    <th className="data-table-head-cell-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dentists.map((d, idx) => {
                    const sched = schedules[d.id];
                    const displayName = d.nickname || d.full_name;
                    return (
                      <tr key={d.id} className={cn("data-table-row", idx % 2 === 0 ? "data-table-row-even" : "data-table-row-odd")}>
                        <td className="data-table-cell">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color ?? DENTIST_COLORS[0].hex }} />
                            <span className="font-medium truncate text-sm">{displayName}</span>
                          </div>
                        </td>
                        {WEEK_ORDER.map(({ key }) => {
                          const ds = sched?.[key];
                          const isWorking = ds?.is_working ?? false;
                          return (
                            <td key={key} className={cn("data-table-cell text-center text-xs", isWorking ? "text-blue-600 dark:text-blue-400 font-medium" : "text-slate-300 dark:text-slate-600")}>
                              {formatDayCell(ds)}
                            </td>
                          );
                        })}
                        <td className="data-table-cell-right">
                          {isAdmin && (
                            <button type="button" className="data-table-btn" onClick={() => openScheduleEdit(d.id)}>
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {staff.map((s, idx) => {
                    const displayName = s.nickname || s.full_name;
                    const rowIdx = dentists.length + idx;
                    return (
                      <tr key={s.id} className={cn("data-table-row", rowIdx % 2 === 0 ? "data-table-row-even" : "data-table-row-odd")}>
                        <td className="data-table-cell">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-slate-300 dark:bg-slate-600" />
                            <span className="font-medium truncate text-sm text-slate-500 dark:text-slate-400">{displayName}</span>
                          </div>
                        </td>
                        {WEEK_ORDER.map(({ key }) => (
                          <td key={key} className="data-table-cell text-center text-xs text-slate-300 dark:text-slate-600">—</td>
                        ))}
                        <td className="data-table-cell-right"></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── SCHEDULE EDITOR MODAL ── */}
      <EditModal
        open={editingScheduleFor !== null}
        title="Edit Schedule"
        onClose={() => setEditingScheduleFor(null)}
      >
        <div className="spacing-vertical-lg">
          <div className="divide-y divide-slate-100 dark:divide-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {DAY_KEYS.map((day) => {
              const ds = scheduleEdit[day];
              const ch = clinicHours.find((h) => h.id === DAY_KEY_TO_CLINIC_ID[day]);
              const isClinicClosed = !!ch && !ch.is_open;
              const constrainedOptions = getConstrainedTimeOptions(day);
              return (
                <div key={day} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 w-24">{DAY_SHORT[day]}</span>
                      {isClinicClosed && (
                        <span className="text-xs text-amber-600 dark:text-amber-400">Clinic closed</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{ds.is_working ? "Working" : "Off"}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={ds.is_working}
                        disabled={isClinicClosed}
                        onClick={() => {
                          if (!isClinicClosed) {
                            setScheduleEdit((p) => ({ ...p, [day]: { ...p[day], is_working: !p[day].is_working } }));
                          }
                        }}
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
                          isClinicClosed ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                          ds.is_working ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-600"
                        )}
                      >
                        <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", ds.is_working ? "translate-x-4" : "translate-x-0")} />
                      </button>
                    </div>
                  </div>
                  {ds.is_working && !isClinicClosed && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Opens</label>
                        <select
                          className="input-standard w-full"
                          value={ds.start_time}
                          onChange={(e) => setScheduleEdit((p) => ({ ...p, [day]: { ...p[day], start_time: Number(e.target.value) } }))}
                        >
                          {constrainedOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Closes</label>
                        <select
                          className="input-standard w-full"
                          value={ds.end_time}
                          onChange={(e) => setScheduleEdit((p) => ({ ...p, [day]: { ...p[day], end_time: Number(e.target.value) } }))}
                        >
                          {constrainedOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="modal-actions">
            <div className="modal-actions-right">
              <button className="cancel-btn" onClick={() => setEditingScheduleFor(null)} disabled={busy}>Cancel</button>
              <button className="save-btn" onClick={saveSchedule} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      </EditModal>

      {/* ── ADD/EDIT DENTIST MODAL ── */}
      <EditModal open={showAddDentistModal} title={editingDentist ? "Edit Dentist" : "Add Dentist"} onClose={closeDentistModal}>
        <div className="spacing-vertical-lg">
          <label className="field-label">
            <span className="field-label-text">Full name</span>
            <input className="field-input" value={dentistName} onChange={(e) => setDentistName(e.target.value)} disabled={busy} />
          </label>
          <label className="field-label">
            <span className="field-label-text">Nickname <span className="text-slate-400 font-normal">(optional)</span></span>
            <input className="field-input" placeholder="e.g. Doc Daisy" value={dentistNickname} onChange={(e) => setDentistNickname(e.target.value)} disabled={busy} />
          </label>
          <DatePickerField label="Date of Birth" value={dentistDob} onChange={setDentistDob} inputRef={dentistDobRef} variant="case-modal" max={new Date().toISOString().split("T")[0]} />
          <label className="field-label">
            <span className="field-label-text">PRC / License No.</span>
            <input className="field-input" placeholder="Permanent registration" value={dentistPrc} onChange={(e) => setDentistPrc(e.target.value)} disabled={busy} />
          </label>
          <label className="field-label">
            <span className="field-label-text">PTR No.</span>
            <input type="number" className="field-input" placeholder="Annual" value={dentistPtr} onChange={(e) => setDentistPtr(e.target.value)} disabled={busy} />
          </label>
          <div>
            <span className="field-label-text block mb-2">Calendar color</span>
            <div className="flex gap-2 flex-wrap">
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

          {/* Invite to app */}
          {isAdmin && (
            <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
              <p className="field-label-text mb-1">Invite to Molaris</p>
              <p className="hint-text mb-3">
                Send a login invite so this dentist can access the app.
                {!isPro && <span className="text-amber-600 dark:text-amber-400"> Requires Pro plan.</span>}
              </p>
              {dentistInviteSuccess && <div className="success-banner mb-3">{dentistInviteSuccess}</div>}
              <div className="flex gap-2">
                <input
                  type="email"
                  className="field-input flex-1"
                  placeholder="email@example.com"
                  value={dentistInviteEmail}
                  onChange={(e) => setDentistInviteEmail(e.target.value)}
                  disabled={busy || !isPro}
                />
                <button
                  type="button"
                  className="save-btn shrink-0"
                  onClick={sendDentistInvite}
                  disabled={busy || !dentistInviteEmail.trim() || !isPro}
                >
                  Send invite
                </button>
              </div>
            </div>
          )}

          <div className="modal-actions">
            {editingDentist && (
              <button type="button" className="delete-btn" onClick={() => deleteDentist(editingDentist.id)} disabled={busy}>Delete</button>
            )}
            <div className="modal-actions-right">
              <button type="button" className="cancel-btn" onClick={closeDentistModal} disabled={busy}>Cancel</button>
              <button type="button" className="save-btn" onClick={saveDentist} disabled={busy || !dentistName.trim()}>
                {busy ? "Saving…" : editingDentist ? "Update" : "Add"}
              </button>
            </div>
          </div>
        </div>
      </EditModal>

      {/* ── ADD/EDIT STAFF MODAL ── */}
      <EditModal open={showAddStaffModal} title={editingStaff ? "Edit Staff Member" : "Add Staff Member"} onClose={closeStaffModal}>
        <div className="spacing-vertical-lg">
          <label className="field-label">
            <span className="field-label-text">Full name</span>
            <input className="field-input" value={staffName} onChange={(e) => setStaffName(e.target.value)} disabled={busy} />
          </label>
          <label className="field-label">
            <span className="field-label-text">Nickname <span className="text-slate-400 font-normal">(optional)</span></span>
            <input className="field-input" placeholder="e.g. Carol" value={staffNickname} onChange={(e) => setStaffNickname(e.target.value)} disabled={busy} />
          </label>
          <label className="field-label">
            <span className="field-label-text">Role / Job title</span>
            <select className="field-input" value={staffRole} onChange={(e) => setStaffRole(e.target.value)} disabled={busy}>
              <option value="">Select role</option>
              <option value="Dental Assistant">Dental Assistant</option>
              <option value="Dental Aide">Dental Aide</option>
              <option value="Dental Hygienist">Dental Hygienist</option>
              <option value="Receptionist">Receptionist</option>
              <option value="Secretary">Secretary</option>
              <option value="Nurse">Nurse</option>
              <option value="Sterilization Technician">Sterilization Technician</option>
              <option value="Billing Staff">Billing Staff</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <DatePickerField label="Date of Birth" value={staffDob} onChange={setStaffDob} inputRef={staffDobRef} variant="case-modal" max={new Date().toISOString().split("T")[0]} />

          {/* Clinical access */}
          <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
            <p className="field-label-text mb-1">Clinical Access</p>
            <p className="hint-text mb-3">
              Grants this staff member permission to record treatments and create invoices.
            </p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={staffCanClinical}
                onChange={(e) => setStaffCanClinical(e.target.checked)}
                disabled={busy}
                className="h-4 w-4 rounded"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">Can record treatments and create invoices</span>
            </label>
          </div>

          {/* Invite to app */}
          {isAdmin && (
            <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
              <p className="field-label-text mb-1">Invite to Molaris</p>
              <p className="hint-text mb-3">
                Send a login invite so this person can access the app.
                {!isPro && <span className="text-amber-600 dark:text-amber-400"> Requires Pro plan.</span>}
              </p>
              {inviteSuccess && <div className="success-banner mb-3">{inviteSuccess}</div>}
              <div className="flex gap-2">
                <input
                  type="email"
                  className="field-input flex-1"
                  placeholder="email@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={busy || !isPro}
                />
                <button
                  type="button"
                  className="save-btn shrink-0"
                  onClick={sendInvite}
                  disabled={busy || !inviteEmail.trim() || !isPro}
                >
                  Send invite
                </button>
              </div>
            </div>
          )}

          <div className="modal-actions">
            {editingStaff && isAdmin && (
              <button type="button" className="delete-btn" onClick={() => deleteStaff(editingStaff.id)} disabled={busy}>Delete</button>
            )}
            <div className="modal-actions-right">
              <button type="button" className="cancel-btn" onClick={closeStaffModal} disabled={busy}>Cancel</button>
              <button type="button" className="save-btn" onClick={saveStaff} disabled={busy || !staffName.trim() || !staffRole.trim()}>
                {busy ? "Saving…" : editingStaff ? "Update" : "Add"}
              </button>
            </div>
          </div>
        </div>
      </EditModal>
    </>
  );
}
