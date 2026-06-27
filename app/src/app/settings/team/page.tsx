/*
 * SQL Migrations — run in Supabase SQL editor before using these features:
 *   See supabase/migrations/20260623_team_updates.sql
 *
 * Quick reference:
 *   ALTER TABLE dentists ADD COLUMN IF NOT EXISTS photo_url text;
 *   ALTER TABLE dentists ADD COLUMN IF NOT EXISTS specialty text;
 *   ALTER TABLE dentists ADD COLUMN IF NOT EXISTS phone text;
 *   ALTER TABLE staff ADD COLUMN IF NOT EXISTS photo_url text;
 *   ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone text;
 *   ALTER TABLE dentist_blockouts ADD COLUMN IF NOT EXISTS reason text;
 *   ALTER TABLE dentist_blockouts ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES staff(id);
 *
 * schedule_requests table (Sub-task 3 — run in Supabase SQL editor):
 *   CREATE TABLE IF NOT EXISTS public.schedule_requests (
 *     id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     clinic_id    uuid NOT NULL REFERENCES public.clinics(id),
 *     profile_id   uuid NOT NULL REFERENCES public.profiles(id),
 *     request_type text NOT NULL CHECK (request_type IN ('leave')),
 *     from_date    date NOT NULL,
 *     to_date      date NOT NULL,
 *     reason       text,
 *     status       text NOT NULL DEFAULT 'pending'
 *                  CHECK (status IN ('pending', 'approved', 'rejected')),
 *     reviewed_by  uuid REFERENCES public.profiles(id),
 *     reviewed_at  timestamptz,
 *     created_at   timestamptz DEFAULT now()
 *   );
 *   ALTER TABLE public.schedule_requests ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Clinic isolation — schedule_requests"
 *     ON public.schedule_requests FOR ALL TO authenticated
 *     USING (clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
 *     WITH CHECK (clinic_id = (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));
 *   CREATE INDEX IF NOT EXISTS idx_schedule_requests_clinic_id ON public.schedule_requests(clinic_id);
 *   CREATE INDEX IF NOT EXISTS idx_schedule_requests_profile_id ON public.schedule_requests(profile_id);
 *
 * cancelled_by column (run AFTER creating the table above):
 *   ALTER TABLE public.schedule_requests
 *   ADD COLUMN IF NOT EXISTS cancelled_by text
 *     CHECK (cancelled_by IN ('admin', 'user'));
 *
 *   -- Migrate old 'rejected' rows:
 *   UPDATE public.schedule_requests
 *   SET status = 'cancelled', cancelled_by = 'admin'
 *   WHERE status IN ('rejected', 'cancelled') AND cancelled_by IS NULL;
 *
 * is_seen_by_requester column (employee notification badge):
 *   ALTER TABLE public.schedule_requests
 *   ADD COLUMN IF NOT EXISTS is_seen_by_requester boolean DEFAULT false;
 */

"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useClinic } from "@/contexts/ClinicContext";
import { supabase } from "@/lib/supabaseClient";
import { formatDateStandard, formatPhoneLocal, formatScheduleTime } from "@/lib/helpers";
import { EditModal } from "@/components/EditModal";
import { DatePickerField } from "@/components/DatePickerField";
import { Spinner } from "@/components/Spinner";
import { UndoToast } from "@/components/shared/UndoToast";
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

const DENTIST_SPECIALTIES = [
  "General Dentist",
  "Associate Dentist",
  "Orthodontist",
  "Periodontist",
  "Endodontist",
  "Oral Surgeon",
  "Pediatric Dentist",
  "Prosthodontist",
  "Dental Hygienist",
] as const;

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
type DayKey = typeof DAY_KEYS[number];

const DAY_SHORT: Record<DayKey, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed",
  thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun",
};

const DAY_KEY_TO_CLINIC_ID: Record<DayKey, string> = {
  monday: "mon", tuesday: "tue", wednesday: "wed",
  thursday: "thu", friday: "fri", saturday: "sat", sunday: "sun",
};

// DB stores day_of_week as smallint (JS day-of-week convention: 0=Sun, 6=Sat)
const DAY_KEY_TO_INT: Record<DayKey, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};
const INT_TO_DAY_KEY: Partial<Record<number, DayKey>> = {
  0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday", 5: "friday", 6: "saturday",
};

const WEEK_ORDER: { header: string; key: DayKey }[] = [
  { header: "Sun", key: "sunday" },
  { header: "Mon", key: "monday" },
  { header: "Tue", key: "tuesday" },
  { header: "Wed", key: "wednesday" },
  { header: "Thu", key: "thursday" },
  { header: "Fri", key: "friday" },
  { header: "Sat", key: "saturday" },
];

const STAFF_ROLES = [
  "Dental Assistant",
  "Receptionist",
  "Secretary",
  "Other",
] as const;

const TIME_OPTIONS: { value: number; label: string }[] = [];
for (let h = 7; h <= 20; h++) {
  for (const m of [0, 30]) {
    const v = h + (m === 30 ? 0.5 : 0);
    const period = h < 12 ? "AM" : "PM";
    const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
    TIME_OPTIONS.push({ value: v, label: `${dh}:${m === 0 ? "00" : "30"} ${period}` });
  }
}

type DentistRow = {
  id: string; full_name: string; nickname: string | null;
  prc_number: string | null; ptr_number: string | null;
  date_of_birth: string | null; is_active: boolean; color: string | null;
  photo_url: string | null; specialty: string | null; phone: string | null;
  salary_rate: number | null; profile_id: string | null;
};
type StaffRow = {
  id: string; full_name: string; nickname: string | null; role: string;
  date_of_birth: string | null; is_active: boolean;
  can_access_clinical: boolean | null;
  photo_url: string | null; phone: string | null;
  salary_rate: number | null;
  profile_id: string | null;
};
type InviteRow = {
  id: string; email: string; role: string;
  status: "pending" | "accepted" | "expired";
  created_at: string; expires_at: string;
};
type BlockoutRow = {
  id: string; dentist_id: string | null; staff_id: string | null;
  start_date: string; end_date: string; reason: string | null;
};
type DaySchedule = { is_working: boolean; start_time: number; end_time: number };
type DentistSchedule = Record<DayKey, DaySchedule>;
type HandlerDentistRef = { id: string; full_name: string; nickname: string | null };
type HandlerGroupRow = {
  staffId: string;
  staffName: string;
  staffNickname: string | null;
  dentists: HandlerDentistRef[];
};
type ScheduleRequestRow = {
  id: string;
  profile_id: string;
  request_type: string;
  from_date: string;
  to_date: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'cancelled';
  cancelled_by: 'admin' | 'user' | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  is_seen_by_requester: boolean | null;
  profiles?: { full_name: string | null; role: string | null } | null;
};

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

// dentist_schedules stores times as "HH:MM" strings; staff_schedules stores as numeric
function parseTime(v: unknown, fallback: number): number {
  if (v == null) return fallback;
  if (typeof v === "string") {
    const m = v.match(/^(\d{1,2}):(\d{2})/);
    if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
    const n = Number(v);
    return isFinite(n) ? n : fallback;
  }
  if (typeof v === "number") return isFinite(v) ? v : fallback;
  return fallback;
}

function decimalToTime(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function formatDayCell(ds: DaySchedule | undefined): string {
  if (!ds || !ds.is_working) return "—";
  if (!isFinite(ds.start_time) || !isFinite(ds.end_time)) return "—";
  return `${formatScheduleTime(ds.start_time)}–${formatScheduleTime(ds.end_time)}`;
}

function LoadingBlock() {
  return <div className="flex items-center justify-center py-16"><Spinner /></div>;
}

export default function TeamSettingsPage() {
  const { clinicId, clinicName, profileId, userFullName, isAdmin, isPro, isLoading: clinicLoading } = useClinic();
  const [dentists, setDentists] = useState<DentistRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [handlers, setHandlers] = useState<HandlerGroupRow[]>([]);
  const [blockouts, setBlockouts] = useState<BlockoutRow[]>([]);
  const [staffAccessCount, setStaffAccessCount] = useState(0);
  const [clinicHours, setClinicHours] = useState<ClinicHoursEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Schedule editor state
  const [schedules, setSchedules] = useState<Record<string, DentistSchedule>>({});
  const [editingScheduleFor, setEditingScheduleFor] = useState<{ id: string; name: string } | null>(null);
  const [scheduleEdit, setScheduleEdit] = useState<DentistSchedule>(DEFAULT_SCHEDULE);

  // Staff schedule editor state
  const [staffSchedules, setStaffSchedules] = useState<Record<string, DentistSchedule>>({});
  const [editingStaffScheduleFor, setEditingStaffScheduleFor] = useState<{ id: string; name: string } | null>(null);
  const [staffScheduleEdit, setStaffScheduleEdit] = useState<DentistSchedule>(DEFAULT_SCHEDULE);

  // Dentist modal state
  const [showAddDentistModal, setShowAddDentistModal] = useState(false);
  const [editingDentist, setEditingDentist] = useState<DentistRow | null>(null);
  const [dentistName, setDentistName] = useState("");
  const [dentistNickname, setDentistNickname] = useState("");
  const [dentistDob, setDentistDob] = useState("");
  const [dentistPrc, setDentistPrc] = useState("");
  const [dentistPtr, setDentistPtr] = useState("");
  const [dentistSpecialty, setDentistSpecialty] = useState("");
  const [dentistPhone, setDentistPhone] = useState("");
  const [dentistInviteEmail, setDentistInviteEmail] = useState("");
  const [dentistInviteSuccess, setDentistInviteSuccess] = useState<string | null>(null);
  const [dentistExistingInvite, setDentistExistingInvite] = useState<InviteRow | null>(null);
  const dentistDobRef = useRef<HTMLInputElement | null>(null);

  // Staff modal state
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffRow | null>(null);
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState("");
  const [staffDob, setStaffDob] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffHandlerDentistIds, setStaffHandlerDentistIds] = useState<string[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [staffExistingInvite, setStaffExistingInvite] = useState<InviteRow | null>(null);
  const staffDobRef = useRef<HTMLInputElement | null>(null);

  // Blockout modal state — blockoutPerson format: "dentist:{id}" or "staff:{id}"
  const [showBlockoutModal, setShowBlockoutModal] = useState(false);
  const [editingBlockout, setEditingBlockout] = useState<BlockoutRow | null>(null);
  const [blockoutPerson, setBlockoutPerson] = useState("");
  const [blockoutStart, setBlockoutStart] = useState("");
  const [blockoutEnd, setBlockoutEnd] = useState("");
  const [blockoutReason, setBlockoutReason] = useState("");

  const [dentistDeleteText, setDentistDeleteText] = useState("");
  const [staffDeleteText, setStaffDeleteText] = useState("");
  const [blockoutDeleteText, setBlockoutDeleteText] = useState("");

  // Salary rate state
  const [dentistSalaryRate, setDentistSalaryRate] = useState<string>("");
  const [staffSalaryRate, setStaffSalaryRate] = useState<string>("");

  // Photo state — admin uploads team member photos
  const [dentistPhotoFile, setDentistPhotoFile] = useState<File | null>(null);
  const [dentistPhotoPreview, setDentistPhotoPreview] = useState<string | null>(null);
  const dentistPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [staffPhotoFile, setStaffPhotoFile] = useState<File | null>(null);
  const [staffPhotoPreview, setStaffPhotoPreview] = useState<string | null>(null);
  const staffPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Leave request state
  const [leaveRequests, setLeaveRequests] = useState<ScheduleRequestRow[]>([]);
  const [leaveRequestsTab, setLeaveRequestsTab] = useState<'approved' | 'cancelled' | 'pending'>('approved');
  const [unseenDecisionCount, setUnseenDecisionCount] = useState(0);
  const [undoToast, setUndoToast] = useState<{ message: string; row: ScheduleRequestRow } | null>(null);
  const [showRequestLeaveModal, setShowRequestLeaveModal] = useState(false);
  const [reqLeaveFrom, setReqLeaveFrom] = useState('');
  const [reqLeaveTo, setReqLeaveTo] = useState('');
  const [reqLeaveReason, setReqLeaveReason] = useState('');
  const [leaveSubmitSuccess, setLeaveSubmitSuccess] = useState<string | null>(null);
  const [editingLeaveRow, setEditingLeaveRow] = useState<ScheduleRequestRow | null>(null);

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
      const loadedStaff = (staffRes.data ?? []) as StaffRow[];
      if (!staffRes.error) setStaff(loadedStaff);
      if (!inviteRes.error) setInvites((inviteRes.data ?? []) as InviteRow[]);

      // Load blockouts — query by dentist_id list (avoids missing clinic_id column error)
      const dentistIds = loadedDentists.map((d) => d.id);
      const staffIds = loadedStaff.map((s) => s.id);

      let allBlockouts: BlockoutRow[] = [];

      if (dentistIds.length > 0) {
        const dentistBlockoutRes = await supabase
          .from("dentist_blockouts")
          .select("id, dentist_id, start_date, end_date, reason")
          .in("dentist_id", dentistIds)
          .order("start_date");
        if (!dentistBlockoutRes.error && dentistBlockoutRes.data) {
          allBlockouts = (dentistBlockoutRes.data as Omit<BlockoutRow, "staff_id">[]).map((b) => ({
            ...b,
            staff_id: null,
          }));
        }
      }

      if (staffIds.length > 0) {
        try {
          const staffBlockoutRes = await supabase
            .from("dentist_blockouts")
            .select("id, staff_id, start_date, end_date, reason")
            .in("staff_id", staffIds)
            .order("start_date");
          if (!staffBlockoutRes.error && staffBlockoutRes.data) {
            const staffBlockouts: BlockoutRow[] = (staffBlockoutRes.data as Omit<BlockoutRow, "dentist_id">[]).map((b) => ({
              ...b,
              dentist_id: null,
            }));
            allBlockouts = [...allBlockouts, ...staffBlockouts].sort((a, b) =>
              a.start_date.localeCompare(b.start_date)
            );
          }
        } catch {
          // Staff blockout column not yet migrated — silently ignore
        }
      }

      setBlockouts(allBlockouts);

      const { count: accessCount } = await supabase
        .from("staff_invites")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("role", "staff")
        .in("status", ["pending", "accepted"]);
      setStaffAccessCount(accessCount ?? 0);

      if (profileRes.data?.clinic_hours) {
        setClinicHours(profileRes.data.clinic_hours as ClinicHoursEntry[]);
      }

      try {
        const handlerRes = await supabase
          .from("dentist_handlers")
          .select("profile_id, dentist_id")
          .eq("clinic_id", clinicId);
        if (!handlerRes.error && handlerRes.data && staffRes.data && dentistRes.data) {
          const loadedDentistMap = new Map<string, DentistRow>(loadedDentists.map((d) => [d.id, d]));
          // Key by profile_id since dentist_handlers uses profile_id (not staff.id)
          const staffByProfileId = new Map<string, StaffRow>();
          for (const s of loadedStaff) {
            if (s.profile_id) staffByProfileId.set(s.profile_id, s);
          }
          const groupMap = new Map<string, HandlerGroupRow>();
          for (const row of handlerRes.data as { profile_id: string; dentist_id: string }[]) {
            const staffMember = staffByProfileId.get(row.profile_id);
            const dentist = loadedDentistMap.get(row.dentist_id);
            if (!staffMember || !dentist) continue;
            if (!groupMap.has(staffMember.id)) {
              groupMap.set(staffMember.id, {
                staffId: staffMember.id,
                staffName: staffMember.full_name,
                staffNickname: staffMember.nickname ?? null,
                dentists: [],
              });
            }
            groupMap.get(staffMember.id)!.dentists.push({
              id: dentist.id,
              full_name: dentist.full_name,
              nickname: dentist.nickname ?? null,
            });
          }
          setHandlers(Array.from(groupMap.values()));
        }
      } catch {
        // dentist_handlers columns not yet migrated — silently ignore
      }

      // Load leave requests from schedule_requests (best-effort — table may not exist yet)
      await loadLeaveRequests();

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
              const day = INT_TO_DAY_KEY[row.day_of_week as number];
              if (day && DAY_KEYS.includes(day)) {
                sched[day] = {
                  is_working: row.is_working ?? false,
                  start_time: parseTime(row.start_time, 8),
                  end_time: parseTime(row.end_time, 17),
                };
              }
            }
            newSchedules[d.id] = sched;
          }
          setSchedules(newSchedules);
        }
      }
      // Load staff schedules
      const staffArr = loadedStaff ?? [];
      if (staffArr.length > 0) {
        const staffSchedRes = await supabase
          .from("staff_schedules")
          .select("staff_id, day_of_week, is_working, start_time, end_time")
          .eq("clinic_id", clinicId)
          .in("staff_id", staffArr.map((s) => s.id));

        if (!staffSchedRes.error && staffSchedRes.data) {
          const newStaffSchedules: Record<string, DentistSchedule> = {};
          for (const s of staffArr) {
            const sched: DentistSchedule = {
              monday: { ...DEFAULT_SCHEDULE.monday },
              tuesday: { ...DEFAULT_SCHEDULE.tuesday },
              wednesday: { ...DEFAULT_SCHEDULE.wednesday },
              thursday: { ...DEFAULT_SCHEDULE.thursday },
              friday: { ...DEFAULT_SCHEDULE.friday },
              saturday: { ...DEFAULT_SCHEDULE.saturday },
              sunday: { ...DEFAULT_SCHEDULE.sunday },
            };
            const rows = staffSchedRes.data.filter((r) => r.staff_id === s.id);
            for (const row of rows) {
              const day = INT_TO_DAY_KEY[row.day_of_week as number];
              if (day && DAY_KEYS.includes(day)) {
                sched[day] = {
                  is_working: row.is_working ?? false,
                  start_time: parseTime(row.start_time, 8),
                  end_time: parseTime(row.end_time, 17),
                };
              }
            }
            newStaffSchedules[s.id] = sched;
          }
          setStaffSchedules(newStaffSchedules);
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
    const dentist = dentists.find((d) => d.id === id);
    const name = dentist?.nickname || dentist?.full_name || "";
    setScheduleEdit({ ...(schedules[id] ?? DEFAULT_SCHEDULE) });
    setEditingScheduleFor({ id, name });
  }

  async function saveSchedule() {
    if (!editingScheduleFor) return;
    setBusy(true); setError(null);
    try {
      // dentist_schedules has no clinic_id column; times stored as "HH:MM" strings
      const rows = DAY_KEYS.map((day) => ({
        dentist_id: editingScheduleFor.id,
        day_of_week: DAY_KEY_TO_INT[day],
        is_working: scheduleEdit[day].is_working,
        start_time: decimalToTime(scheduleEdit[day].start_time),
        end_time: decimalToTime(scheduleEdit[day].end_time),
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

  function openStaffScheduleEdit(id: string) {
    const s = staff.find((x) => x.id === id);
    const name = s?.full_name || "";
    setStaffScheduleEdit({ ...(staffSchedules[id] ?? DEFAULT_SCHEDULE) });
    setEditingStaffScheduleFor({ id, name });
  }

  async function saveStaffSchedule() {
    if (!editingStaffScheduleFor) return;
    setBusy(true); setError(null);
    try {
      const rows = DAY_KEYS.map((day) => ({
        clinic_id: clinicId,
        staff_id: editingStaffScheduleFor.id,
        day_of_week: DAY_KEY_TO_INT[day],
        is_working: staffScheduleEdit[day].is_working,
        start_time: staffScheduleEdit[day].start_time,
        end_time: staffScheduleEdit[day].end_time,
      }));
      const { error: upsertErr } = await supabase
        .from("staff_schedules")
        .upsert(rows, { onConflict: "staff_id,day_of_week" });
      if (upsertErr) throw upsertErr;
      setStaffSchedules((p) => ({ ...p, [editingStaffScheduleFor.id]: { ...staffScheduleEdit } }));
      setEditingStaffScheduleFor(null);
      setSuccess("Schedule saved."); setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save schedule");
    } finally { setBusy(false); }
  }

  // ── Photo handlers (admin uploads team member photos) ─────────────────────────
  function handleDentistPhotoSelect(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Photo must be JPG, PNG, or WebP."); return; }
    if (file.size > 2 * 1024 * 1024) { setError("Photo must be under 2 MB."); return; }
    if (dentistPhotoPreview?.startsWith("blob:")) URL.revokeObjectURL(dentistPhotoPreview);
    setDentistPhotoFile(file);
    setDentistPhotoPreview(URL.createObjectURL(file));
  }
  function handleStaffPhotoSelect(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Photo must be JPG, PNG, or WebP."); return; }
    if (file.size > 2 * 1024 * 1024) { setError("Photo must be under 2 MB."); return; }
    if (staffPhotoPreview?.startsWith("blob:")) URL.revokeObjectURL(staffPhotoPreview);
    setStaffPhotoFile(file);
    setStaffPhotoPreview(URL.createObjectURL(file));
  }

  // ── Dentist CRUD ──────────────────────────────────────────────────────────────
  function openAddDentist() {
    setEditingDentist(null); setDentistName(""); setDentistNickname("");
    setDentistDob(""); setDentistPrc(""); setDentistPtr("");
    setDentistSpecialty(""); setDentistPhone(""); setDentistSalaryRate(""); setDentistInviteEmail(""); setDentistInviteSuccess(null);
    setDentistPhotoFile(null);
    if (dentistPhotoPreview?.startsWith("blob:")) URL.revokeObjectURL(dentistPhotoPreview);
    setDentistPhotoPreview(null);
    setShowAddDentistModal(true);
  }
  async function openEditDentist(d: DentistRow) {
    setEditingDentist(d); setDentistName(d.full_name); setDentistNickname(d.nickname ?? "");
    setDentistDob(d.date_of_birth ?? ""); setDentistPrc(d.prc_number ?? "");
    setDentistPtr(d.ptr_number ?? "");
    setDentistSpecialty(d.specialty ?? ""); setDentistPhone(d.phone ? formatPhoneLocal(d.phone) : "");
    setDentistSalaryRate(d.salary_rate != null ? String(d.salary_rate) : "");
    setDentistInviteEmail(""); setDentistInviteSuccess(null); setDentistExistingInvite(null);
    setDentistPhotoFile(null);
    if (dentistPhotoPreview?.startsWith("blob:")) URL.revokeObjectURL(dentistPhotoPreview);
    setDentistPhotoPreview(d.photo_url ?? null);
    setDentistDeleteText("");
    // Check for existing pending invite linked to this dentist
    const { data: existingInvite } = await supabase
      .from("staff_invites")
      .select("id, email, role, status, created_at, expires_at")
      .eq("clinic_id", clinicId)
      .eq("status", "pending")
      .eq("dentist_id", d.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingInvite) {
      setDentistExistingInvite(existingInvite as InviteRow);
      setDentistInviteEmail((existingInvite as InviteRow).email);
    }
    setShowAddDentistModal(true);
  }
  function closeDentistModal() {
    setDentistDeleteText("");
    if (dentistPhotoPreview?.startsWith("blob:")) URL.revokeObjectURL(dentistPhotoPreview);
    setDentistPhotoFile(null); setDentistPhotoPreview(null);
    setShowAddDentistModal(false); setEditingDentist(null);
    setDentistName(""); setDentistNickname(""); setDentistDob(""); setDentistPrc(""); setDentistPtr("");
    setDentistSpecialty(""); setDentistPhone(""); setDentistSalaryRate(""); setDentistInviteEmail(""); setDentistInviteSuccess(null); setDentistExistingInvite(null);
  }
  async function saveDentist() {
    if (!dentistName.trim()) return;
    setBusy(true); setError(null);
    try {
      // Auto-assign color on new dentist; keep existing color on edit
      const assignedColor = editingDentist
        ? (editingDentist.color ?? DENTIST_COLORS[dentists.length % DENTIST_COLORS.length].hex)
        : DENTIST_COLORS[dentists.length % DENTIST_COLORS.length].hex;

      const payload = {
        clinic_id: clinicId, full_name: dentistName.trim(),
        nickname: dentistNickname.trim() || null, date_of_birth: dentistDob || null,
        prc_number: dentistPrc.trim() || null, ptr_number: dentistPtr ? parseInt(dentistPtr) : null,
        color: assignedColor, specialty: dentistSpecialty || null,
        phone: dentistPhone.replace(/\D/g, "") || null,
        salary_rate: dentistSalaryRate ? Number(dentistSalaryRate) : null,
      };
      let dentistId: string;
      if (editingDentist) {
        const { error } = await supabase.from("dentists").update(payload).eq("id", editingDentist.id);
        if (error) throw error;
        dentistId = editingDentist.id;
      } else {
        const { data, error } = await supabase.from("dentists")
          .insert({ ...payload, is_active: true })
          .select("id").single();
        if (error) throw error;
        dentistId = (data as { id: string }).id;
      }
      if (dentistPhotoFile) {
        const ext = dentistPhotoFile.name.split(".").pop() ?? "jpg";
        const path = `dentist-photos/${dentistId}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("clinic-assets")
          .upload(path, dentistPhotoFile, { upsert: true, contentType: dentistPhotoFile.type });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("clinic-assets").getPublicUrl(path);
          await supabase.from("dentists").update({ photo_url: `${urlData.publicUrl}?v=${Date.now()}` }).eq("id", dentistId);
        }
      }
      if (dentistPhotoPreview?.startsWith("blob:")) URL.revokeObjectURL(dentistPhotoPreview);
      closeDentistModal();
      await loadData();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save dentist"); }
    finally { setBusy(false); }
  }
  async function deleteDentist(id: string) {
    if (dentistDeleteText !== "DELETE") return;
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
      const normalizedEmail = dentistInviteEmail.trim().toLowerCase();
      let token: string | null = null;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        token = session.access_token;
      } else {
        const { data: refreshed } = await supabase.auth.refreshSession();
        token = refreshed.session?.access_token ?? null;
      }
      if (!token) { setError("Session expired. Please sign in again."); return; }
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: normalizedEmail,
          clinicId,
          clinicName,
          inviterName: userFullName ?? "",
          role: "dentist",
          dentistId: editingDentist?.id ?? undefined,
        }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to send invite email");
      setDentistInviteSuccess(`✅ Invite sent to ${normalizedEmail}. They'll receive an email with a link to set up their account.`);
      setDentistInviteEmail("");
      await loadData();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to send invite"); }
    finally { setBusy(false); }
  }

  // ── Staff CRUD ────────────────────────────────────────────────────────────────
  function openAddStaff() {
    setEditingStaff(null); setStaffName(""); setStaffRole(""); setStaffDob(""); setStaffPhone("");
    setStaffSalaryRate(""); setStaffHandlerDentistIds([]); setInviteEmail(""); setInviteSuccess(null);
    setStaffPhotoFile(null);
    if (staffPhotoPreview?.startsWith("blob:")) URL.revokeObjectURL(staffPhotoPreview);
    setStaffPhotoPreview(null);
    setShowAddStaffModal(true);
  }
  async function openEditStaff(s: StaffRow) {
    setEditingStaff(s); setStaffName(s.full_name);
    setStaffRole(s.role); setStaffDob(s.date_of_birth ?? ""); setStaffPhone(s.phone ? formatPhoneLocal(s.phone) : "");
    setStaffSalaryRate(s.salary_rate != null ? String(s.salary_rate) : "");
    setInviteEmail(""); setInviteSuccess(null); setStaffExistingInvite(null);
    setStaffPhotoFile(null);
    if (staffPhotoPreview?.startsWith("blob:")) URL.revokeObjectURL(staffPhotoPreview);
    setStaffPhotoPreview(s.photo_url ?? null);
    if (s.profile_id) {
      const { data: hRows } = await supabase
        .from("dentist_handlers")
        .select("dentist_id")
        .eq("profile_id", s.profile_id)
        .eq("clinic_id", clinicId);
      setStaffHandlerDentistIds(hRows ? (hRows as { dentist_id: string }[]).map((r) => r.dentist_id) : []);
    } else {
      setStaffHandlerDentistIds([]);
    }
    // Check for existing pending invite for staff role at this clinic
    const { data: existingInvite } = await supabase
      .from("staff_invites")
      .select("id, email, role, status, created_at, expires_at")
      .eq("clinic_id", clinicId)
      .eq("status", "pending")
      .eq("role", "staff")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingInvite) {
      setStaffExistingInvite(existingInvite as InviteRow);
      setInviteEmail((existingInvite as InviteRow).email);
    }
    setStaffDeleteText("");
    setShowAddStaffModal(true);
  }
  function closeStaffModal() {
    setStaffDeleteText("");
    if (staffPhotoPreview?.startsWith("blob:")) URL.revokeObjectURL(staffPhotoPreview);
    setStaffPhotoFile(null); setStaffPhotoPreview(null);
    setShowAddStaffModal(false); setEditingStaff(null);
    setStaffName(""); setStaffRole(""); setStaffDob(""); setStaffPhone("");
    setStaffSalaryRate(""); setStaffHandlerDentistIds([]); setInviteEmail(""); setInviteSuccess(null); setStaffExistingInvite(null);
  }
  async function saveStaff() {
    if (!staffName.trim() || !staffRole.trim()) return;
    setBusy(true); setError(null);
    try {
      const payload = {
        clinic_id: clinicId, full_name: staffName.trim(),
        nickname: null,
        role: staffRole.trim(), date_of_birth: staffDob || null,
        can_access_clinical: staffHandlerDentistIds.length > 0,
        phone: staffPhone.replace(/\D/g, "") || null,
        salary_rate: staffSalaryRate ? Number(staffSalaryRate) : null,
      };
      let staffId: string;
      if (editingStaff) {
        const { error } = await supabase.from("staff").update(payload).eq("id", editingStaff.id);
        if (error) throw error;
        staffId = editingStaff.id;
      } else {
        const { data, error } = await supabase
          .from("staff")
          .insert({ ...payload, is_active: true, created_by: profileId })
          .select("id")
          .single();
        if (error) throw error;
        staffId = (data as { id: string }).id;
      }
      // dentist_handlers uses profile_id (auth UUID), not staff.id
      const staffProfileId = editingStaff?.profile_id ?? null;
      if (staffProfileId) {
        // Read current DB state before mutating, so we can compute removals accurately
        const { data: existingHandlers } = await supabase
          .from("dentist_handlers")
          .select("dentist_id")
          .eq("profile_id", staffProfileId)
          .eq("clinic_id", clinicId);
        const existingIds = (existingHandlers ?? []).map((h: { dentist_id: string }) => h.dentist_id);
        const toRemove = existingIds.filter((id) => !staffHandlerDentistIds.includes(id));

        // Upsert checked dentists
        if (staffHandlerDentistIds.length > 0) {
          const { error: upsertError } = await supabase
            .from("dentist_handlers")
            .upsert(
              staffHandlerDentistIds.map((dentistId) => ({
                clinic_id: clinicId,
                dentist_id: dentistId,
                profile_id: staffProfileId,
                can_record_treatments: true,
                can_create_invoices: true,
              })),
              { onConflict: "clinic_id,dentist_id,profile_id" }
            );
          if (upsertError) {
            console.error("Handler save error:", upsertError);
            setError(`Failed to save handler assignments: ${upsertError.message}`);
            setBusy(false);
            return;
          }
        }

        // Delete unchecked dentists
        if (toRemove.length > 0) {
          const { error: deleteError } = await supabase
            .from("dentist_handlers")
            .delete()
            .eq("profile_id", staffProfileId)
            .eq("clinic_id", clinicId)
            .in("dentist_id", toRemove);
          if (deleteError) {
            console.error("Handler delete error:", deleteError);
          }
        }

        // Re-fetch to confirm persistence
        const { data: refreshedHandlers } = await supabase
          .from("dentist_handlers")
          .select("dentist_id")
          .eq("profile_id", staffProfileId)
          .eq("clinic_id", clinicId);
        setStaffHandlerDentistIds(refreshedHandlers?.map((h: { dentist_id: string }) => h.dentist_id) ?? []);
      }
      if (staffPhotoFile) {
        const ext = staffPhotoFile.name.split(".").pop() ?? "jpg";
        const path = `staff-photos/${staffId}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("clinic-assets")
          .upload(path, staffPhotoFile, { upsert: true, contentType: staffPhotoFile.type });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("clinic-assets").getPublicUrl(path);
          await supabase.from("staff").update({ photo_url: `${urlData.publicUrl}?v=${Date.now()}` }).eq("id", staffId);
        }
      }
      if (staffPhotoPreview?.startsWith("blob:")) URL.revokeObjectURL(staffPhotoPreview);
      closeStaffModal();
      await loadData();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save staff"); }
    finally { setBusy(false); }
  }
  async function deleteStaff(id: string) {
    if (staffDeleteText !== "DELETE") return;
    setBusy(true);
    const staffMember = staff.find((s) => s.id === id);
    if (staffMember?.profile_id) {
      await supabase.from("dentist_handlers").delete()
        .eq("profile_id", staffMember.profile_id)
        .eq("clinic_id", clinicId);
    }
    const { error } = await supabase.from("staff").delete().eq("id", id);
    if (error) setError(error.message);
    else { closeStaffModal(); await loadData(); }
    setBusy(false);
  }
  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setBusy(true); setInviteSuccess(null);
    try {
      const normalizedEmail = inviteEmail.trim().toLowerCase();
      let token: string | null = null;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        token = session.access_token;
      } else {
        const { data: refreshed } = await supabase.auth.refreshSession();
        token = refreshed.session?.access_token ?? null;
      }
      if (!token) { setError("Session expired. Please sign in again."); return; }
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: normalizedEmail,
          clinicId,
          clinicName,
          inviterName: userFullName ?? "",
          role: "staff",
          full_name: editingStaff?.full_name ?? staffName.trim() ?? null,
        }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to send invite email");
      setInviteSuccess(`✅ Invite sent to ${normalizedEmail}. They'll receive an email with a link to set up their account.`);
      setInviteEmail(""); await loadData();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to send invite"); }
    finally { setBusy(false); }
  }

  // ── Invite actions (resend / cancel) ─────────────────────────────────────────
  async function resendInvite(inv: InviteRow) {
    setBusy(true);
    try {
      let token: string | null = null;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        token = session.access_token;
      } else {
        const { data: refreshed } = await supabase.auth.refreshSession();
        token = refreshed.session?.access_token ?? null;
      }
      if (!token) { setError("Session expired. Please sign in again."); return; }
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: inv.email,
          clinicId,
          clinicName,
          inviterName: userFullName ?? "",
          role: inv.role,
        }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to resend");
      setSuccess(`Resent ✓ to ${inv.email}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to resend"); }
    finally { setBusy(false); }
  }

  async function cancelInvite(invId: string) {
    setBusy(true);
    const { error } = await supabase
      .from("staff_invites")
      .update({ status: "expired" })
      .eq("id", invId)
      .eq("clinic_id", clinicId);
    setBusy(false);
    if (error) { setError(error.message); return; }
    await loadData();
  }

  // ── Blockout CRUD ─────────────────────────────────────────────────────────────
  function openAddBlockout() {
    setEditingBlockout(null);
    const defaultPerson = dentists[0] ? `dentist:${dentists[0].id}` : staff[0] ? `staff:${staff[0].id}` : "";
    setBlockoutPerson(defaultPerson);
    setBlockoutStart(""); setBlockoutEnd(""); setBlockoutReason("");
    setShowBlockoutModal(true);
  }
  function openEditBlockout(b: BlockoutRow) {
    setEditingBlockout(b);
    if (b.dentist_id) {
      setBlockoutPerson(`dentist:${b.dentist_id}`);
    } else if (b.staff_id) {
      setBlockoutPerson(`staff:${b.staff_id}`);
    } else {
      setBlockoutPerson("");
    }
    setBlockoutStart(b.start_date); setBlockoutEnd(b.end_date); setBlockoutReason(b.reason ?? "");
    setBlockoutDeleteText("");
    setShowBlockoutModal(true);
  }
  function closeBlockoutModal() {
    setBlockoutDeleteText("");
    setShowBlockoutModal(false); setEditingBlockout(null);
    setBlockoutPerson(""); setBlockoutStart(""); setBlockoutEnd(""); setBlockoutReason("");
  }
  async function saveBlockout() {
    if (!blockoutPerson || !blockoutStart || !blockoutEnd || !blockoutReason.trim()) return;
    setBusy(true); setError(null);
    try {
      const [personType, personId] = blockoutPerson.split(":");
      const isDentistBlockout = personType === "dentist";

      const basePayload = {
        start_date: blockoutStart,
        end_date: blockoutEnd,
        reason: blockoutReason.trim(),
        dentist_id: isDentistBlockout ? personId : null,
      };

      if (isDentistBlockout) {
        const payload = { ...basePayload, clinic_id: clinicId };
        if (editingBlockout) {
          const { error } = await supabase.from("dentist_blockouts").update(payload).eq("id", editingBlockout.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("dentist_blockouts").insert(payload);
          if (error) throw error;
        }
      } else {
        // Staff blockout — staff_id column may not exist yet
        try {
          const staffPayload = { ...basePayload, staff_id: personId, dentist_id: null };
          if (editingBlockout) {
            const { error } = await supabase.from("dentist_blockouts").update(staffPayload).eq("id", editingBlockout.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from("dentist_blockouts").insert(staffPayload);
            if (error) throw error;
          }
        } catch {
          throw new Error("Staff off days require the database migration to be run first.");
        }
      }

      closeBlockoutModal();
      await loadData();
      setSuccess("Blockout saved."); setTimeout(() => setSuccess(null), 3000);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save blockout"); }
    finally { setBusy(false); }
  }
  async function deleteBlockout(id: string) {
    if (blockoutDeleteText !== "DELETE") return;
    setBusy(true);
    const { error } = await supabase.from("dentist_blockouts").delete().eq("id", id);
    if (error) setError(error.message);
    else { closeBlockoutModal(); await loadData(); }
    setBusy(false);
  }

  async function loadLeaveRequests() {
    if (!clinicId) return;

    const { data: requests, error } = await supabase
      .from('schedule_requests')
      .select(`
        id,
        profile_id,
        request_type,
        from_date,
        to_date,
        reason,
        status,
        cancelled_by,
        reviewed_by,
        reviewed_at,
        created_at,
        is_seen_by_requester,
        profiles!schedule_requests_profile_id_fkey (
          full_name,
          role
        )
      `)
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('schedule_requests fetch error:', error.message);
      return;
    }

    setLeaveRequests((requests ?? []) as unknown as ScheduleRequestRow[]);
  }

  function dispatchLeaveCountRefresh() {
    window.dispatchEvent(new CustomEvent('teamLeaveCountChanged'));
  }

  async function markLeaveRowsAsSeen(tab: 'approved' | 'cancelled' | 'pending') {
    if (isAdmin) return;
    // Mark unseen rows visible on this tab as seen
    const unseenIds = leaveRequests
      .filter(
        (r) =>
          r.profile_id === profileId &&
          !r.is_seen_by_requester &&
          (tab === 'approved'
            ? r.status === 'approved'
            : tab === 'pending'
            ? r.status === 'pending'
            : false)
      )
      .map((r) => r.id);
    if (unseenIds.length === 0) return;
    // Optimistic update
    setLeaveRequests((prev) =>
      prev.map((r) => (unseenIds.includes(r.id) ? { ...r, is_seen_by_requester: true } : r))
    );
    setUnseenDecisionCount(0);
    await supabase
      .from('schedule_requests')
      .update({ is_seen_by_requester: true })
      .in('id', unseenIds);
    dispatchLeaveCountRefresh();
  }

  function handleLeaveTabClick(tab: 'approved' | 'cancelled' | 'pending') {
    setLeaveRequestsTab(tab);
    void markLeaveRowsAsSeen(tab);
  }

  async function approveLeaveRequest(req: ScheduleRequestRow) {
    setBusy(true); setError(null);
    try {
      const { error: updateErr } = await supabase
        .from('schedule_requests')
        .update({ status: 'approved', reviewed_by: profileId, reviewed_at: new Date().toISOString() })
        .eq('id', req.id);
      if (updateErr) throw updateErr;

      const matchedStaff = staff.find((s) => s.profile_id === req.profile_id);
      const matchedDentist = dentists.find((d) => d.profile_id === req.profile_id);

      if (matchedStaff) {
        await supabase.from('dentist_blockouts').insert({
          clinic_id: clinicId, staff_id: matchedStaff.id, dentist_id: null,
          start_date: req.from_date, end_date: req.to_date, reason: req.reason,
        });
      } else if (matchedDentist) {
        await supabase.from('dentist_blockouts').insert({
          clinic_id: clinicId, dentist_id: matchedDentist.id, staff_id: null,
          start_date: req.from_date, end_date: req.to_date, reason: req.reason,
        });
      }

      await loadData();
      dispatchLeaveCountRefresh();
      setSuccess('Leave request approved.'); setTimeout(() => setSuccess(null), 3000);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to approve request'); }
    finally { setBusy(false); }
  }

  async function rejectLeaveRequest(id: string) {
    setBusy(true); setError(null);
    try {
      const { error: updateErr } = await supabase
        .from('schedule_requests')
        .update({ status: 'cancelled', cancelled_by: 'admin', reviewed_by: profileId, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (updateErr) throw updateErr;
      setLeaveRequests((prev) => prev.map((r) =>
        r.id === id ? { ...r, status: 'cancelled' as const, cancelled_by: 'admin' as const } : r
      ));
      dispatchLeaveCountRefresh();
      setSuccess('Leave request rejected.'); setTimeout(() => setSuccess(null), 3000);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to reject request'); }
    finally { setBusy(false); }
  }

  async function submitLeaveRequest() {
    if (!reqLeaveFrom || !reqLeaveTo || !reqLeaveReason.trim()) return;
    setBusy(true); setError(null);
    try {
      if (editingLeaveRow) {
        const { error: updateErr } = await supabase.from('schedule_requests').update({
          from_date: reqLeaveFrom, to_date: reqLeaveTo,
          reason: reqLeaveReason.trim(), status: 'pending',
          reviewed_by: null, reviewed_at: null, cancelled_by: null,
        }).eq('id', editingLeaveRow.id);
        if (updateErr) throw updateErr;
        setLeaveSubmitSuccess('Request updated and sent back for admin review.');
      } else {
        const { error: insertErr } = await supabase.from('schedule_requests').insert({
          clinic_id: clinicId, profile_id: profileId, request_type: 'leave',
          from_date: reqLeaveFrom, to_date: reqLeaveTo,
          reason: reqLeaveReason.trim(), status: 'pending',
        });
        if (insertErr) throw insertErr;
        setLeaveSubmitSuccess('Leave request submitted. Your admin will review it.');
      }
      setTimeout(() => {
        setLeaveSubmitSuccess(null);
        setShowRequestLeaveModal(false);
        setEditingLeaveRow(null);
        setReqLeaveFrom(''); setReqLeaveTo(''); setReqLeaveReason('');
        void loadData();
      }, 2000);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to submit leave request'); }
    finally { setBusy(false); }
  }

  function openEditLeave(row: ScheduleRequestRow) {
    setEditingLeaveRow(row);
    setReqLeaveFrom(row.from_date);
    setReqLeaveTo(row.to_date);
    setReqLeaveReason(row.reason ?? '');
    setLeaveSubmitSuccess(null);
    setShowRequestLeaveModal(true);
  }

  async function withdrawLeaveRequest(id: string) {
    setBusy(true); setError(null);
    try {
      const { error: updateErr } = await supabase.from('schedule_requests')
        .update({ status: 'cancelled', cancelled_by: 'user' })
        .eq('id', id);
      if (updateErr) throw updateErr;
      setLeaveRequests((prev) => prev.map((r) =>
        r.id === id ? { ...r, status: 'cancelled' as const, cancelled_by: 'user' as const } : r
      ));
      setLeaveSubmitSuccess('Leave withdrawn. Your admin has been notified.');
      setTimeout(() => {
        setLeaveSubmitSuccess(null);
        setShowRequestLeaveModal(false);
        setEditingLeaveRow(null);
      }, 2000);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to withdraw leave'); }
    finally { setBusy(false); }
  }

  function deleteLeaveRow(row: ScheduleRequestRow) {
    setLeaveRequests((prev) => prev.filter((r) => r.id !== row.id));
    setUndoToast({ message: 'Leave record deleted', row });
  }

  // Helpers for blockout table display
  function getBlockoutPersonName(b: BlockoutRow): string {
    if (b.dentist_id) {
      const d = dentists.find((x) => x.id === b.dentist_id);
      return d ? (d.nickname || d.full_name) : "—";
    }
    if (b.staff_id) {
      const s = staff.find((x) => x.id === b.staff_id);
      return s ? s.full_name : "—";
    }
    return "—";
  }
  function getBlockoutPersonAvatar(b: BlockoutRow): { photoUrl: string | null; color: string | null; initial: string; isStaff: boolean } {
    if (b.dentist_id) {
      const d = dentists.find((x) => x.id === b.dentist_id);
      return {
        photoUrl: d?.photo_url ?? null,
        color: d?.color ?? DENTIST_COLORS[0].hex,
        initial: (d?.nickname || d?.full_name || "?").slice(0, 1).toUpperCase(),
        isStaff: false,
      };
    }
    if (b.staff_id) {
      const s = staff.find((x) => x.id === b.staff_id);
      return {
        photoUrl: s?.photo_url ?? null,
        color: null,
        initial: (s?.full_name || "?").slice(0, 1).toUpperCase(),
        isStaff: true,
      };
    }
    return { photoUrl: null, color: null, initial: "?", isStaff: false };
  }
  function getLeaveRequestPersonAvatar(req: ScheduleRequestRow): { photoUrl: string | null; color: string | null; initial: string; isStaff: boolean } {
    const dentistMatch = dentists.find((d) => d.profile_id === req.profile_id);
    if (dentistMatch) {
      return {
        photoUrl: dentistMatch.photo_url,
        color: dentistMatch.color ?? DENTIST_COLORS[0].hex,
        initial: (dentistMatch.nickname || dentistMatch.full_name).slice(0, 1).toUpperCase(),
        isStaff: false,
      };
    }
    const staffMatch = staff.find((s) => s.profile_id === req.profile_id);
    if (staffMatch) {
      return { photoUrl: staffMatch.photo_url, color: null, initial: staffMatch.full_name.slice(0, 1).toUpperCase(), isStaff: true };
    }
    const name = req.profiles?.full_name ?? '?';
    return { photoUrl: null, color: null, initial: name.slice(0, 1).toUpperCase(), isStaff: false };
  }

  const atStaffLimit = !isPro && staffAccessCount >= 1;
  const hasPeople = dentists.length > 0 || staff.length > 0;

  const today = new Date().toISOString().slice(0, 10);
  const sortedBlockouts = useMemo(() => {
    return [...blockouts].sort((a, b) => {
      const aIsPast = a.end_date < today;
      const bIsPast = b.end_date < today;
      if (aIsPast !== bIsPast) return aIsPast ? 1 : -1;
      return a.start_date.localeCompare(b.start_date);
    });
  }, [blockouts, today]);

  // Pending badge: genuinely pending rows only (status='pending', not user-withdrawn)
  const pendingLeaveCount = leaveRequests.filter((r) => r.status === 'pending').length;
  // Cancelled badge: user-withdrawn rows admin still needs to action
  const userWithdrawnCount = leaveRequests.filter(
    (r) => r.status === 'cancelled' && r.cancelled_by === 'user'
  ).length;
  // Employee badge: own rows with a decision (approved or admin-cancelled) not yet seen
  const computedUnseenCount = !isAdmin
    ? leaveRequests.filter(
        (r) =>
          r.profile_id === profileId &&
          (r.status === 'approved' || (r.status === 'cancelled' && r.cancelled_by === 'admin')) &&
          !r.is_seen_by_requester
      ).length
    : 0;

  // Tab content for Leave Schedule card — filtering differs by role
  const leaveTabContent = useMemo(() => {
    if (isAdmin) {
      return leaveRequests.filter((r) => r.status === leaveRequestsTab);
    }
    // Non-admin: Cancelled tab is hidden; Approved tab shows all team; Pending shows own only
    if (leaveRequestsTab === 'approved') {
      return leaveRequests
        .filter((r) => r.status === 'approved')
        .sort((a, b) => a.from_date.localeCompare(b.from_date));
    }
    return leaveRequests.filter(
      (r) => r.status === 'pending' && r.profile_id === profileId
    );
  }, [leaveRequests, leaveRequestsTab, isAdmin, profileId]);

  if (loading) return <LoadingBlock />;

  return (
    <>
      {error && <div className="error-banner mb-4">{error}</div>}
      {success && <div className="success-banner mb-4">{success}</div>}

      <div className="flex flex-col gap-4">

        {/* ── ROW 1: DENTISTS ── */}
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
                <col className="col-35" />
                <col className="col-20" />
                <col className="col-20" />
                <col className="col-10" />
                <col className="col-15" />
              </colgroup>
              <thead className="data-table-head">
                <tr>
                  <th className="data-table-head-cell">Name</th>
                  <th className="data-table-head-cell">Specialty</th>
                  <th className="data-table-head-cell">Phone</th>
                  <th className="data-table-head-cell">PTR No.</th>
                  <th className="data-table-head-cell">License No.</th>
                </tr>
              </thead>
              <tbody>
                {dentists.length === 0 ? (
                  <tr><td className="data-table-empty" colSpan={5}>No dentists yet.</td></tr>
                ) : dentists.map((d, idx) => (
                  <tr
                    key={d.id}
                    className={cn(
                      "data-table-row",
                      idx % 2 === 0 ? "data-table-row-even" : "data-table-row-odd",
                      isAdmin && "cursor-pointer"
                    )}
                    onClick={isAdmin ? () => openEditDentist(d) : undefined}
                    onKeyDown={isAdmin ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEditDentist(d); } } : undefined}
                    tabIndex={isAdmin ? 0 : undefined}
                    role={isAdmin ? "button" : undefined}
                    aria-label={isAdmin ? d.full_name : undefined}
                  >
                    <td className="data-table-cell">
                      <div className="flex items-center gap-2">
                        {d.photo_url ? (
                          <img src={d.photo_url} alt={d.full_name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                        ) : (
                          <span
                            className="inline-flex w-6 h-6 rounded-full shrink-0 items-center justify-center text-white text-xs font-bold"
                            style={{ background: d.color ?? DENTIST_COLORS[0].hex }}
                          >
                            {d.full_name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span className="font-medium">{d.full_name}</span>
                        {!d.is_active && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">Inactive</span>
                        )}
                      </div>
                    </td>
                    <td className="data-table-cell text-slate-500 text-sm">{d.specialty ?? "—"}</td>
                    <td className="data-table-cell text-slate-500 text-sm">{d.phone ?? "—"}</td>
                    <td className="data-table-cell text-slate-600">{d.ptr_number ?? "—"}</td>
                    <td className="data-table-cell text-slate-600">{d.prc_number ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── ROW 2: STAFF ── */}
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
                <col className="col-35" />
                <col className="col-20" />
                <col className="col-20" />
                <col className="col-25" />
              </colgroup>
              <thead className="data-table-head">
                <tr>
                  <th className="data-table-head-cell">Name</th>
                  <th className="data-table-head-cell">Role</th>
                  <th className="data-table-head-cell">Phone</th>
                  <th className="data-table-head-cell">Handles for</th>
                </tr>
              </thead>
              <tbody>
                {staff.length === 0 ? (
                  <tr><td className="data-table-empty" colSpan={4}>No staff members yet.</td></tr>
                ) : staff.map((s, idx) => {
                  const handlerEntry = handlers.find((h) => h.staffId === s.id);
                  const handlesFor = handlerEntry
                    ? handlerEntry.dentists.map((d) => d.nickname || d.full_name).join(", ")
                    : null;
                  return (
                    <tr
                      key={s.id}
                      className={cn(
                        "data-table-row",
                        idx % 2 === 0 ? "data-table-row-even" : "data-table-row-odd",
                        isAdmin && "cursor-pointer"
                      )}
                      onClick={isAdmin ? () => openEditStaff(s) : undefined}
                      onKeyDown={isAdmin ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void openEditStaff(s); } } : undefined}
                      tabIndex={isAdmin ? 0 : undefined}
                      role={isAdmin ? "button" : undefined}
                      aria-label={isAdmin ? s.full_name : undefined}
                    >
                      <td className="data-table-cell">
                        <div className="flex items-center gap-2">
                          {s.photo_url ? (
                            <img src={s.photo_url} alt={s.full_name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                          ) : (
                            <span className="inline-flex w-6 h-6 rounded-full shrink-0 items-center justify-center bg-slate-300 text-white text-xs font-bold">
                              {s.full_name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <span className="font-medium">{s.full_name}</span>
                          {!s.is_active && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">Inactive</span>
                          )}
                        </div>
                      </td>
                      <td className="data-table-cell text-slate-500">{s.role || "—"}</td>
                      <td className="data-table-cell text-slate-500 text-sm">{s.phone ?? "—"}</td>
                      <td className="data-table-cell text-slate-500 text-sm">
                        {handlesFor
                          ? <span className="text-blue-600">{handlesFor}</span>
                          : <span className="text-slate-300">—</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {invites.length > 0 && isAdmin && (
            <div className="border-t border-slate-100 px-4 pt-4 pb-2">
              <p className="field-label-text mb-2">Pending Invitations</p>
              <div className="table-wrapper overflow-x-auto">
                <table className="data-table">
                  <thead className="data-table-head">
                    <tr>
                      <th className="data-table-head-cell">Email</th>
                      <th className="data-table-head-cell">Role</th>
                      <th className="data-table-head-cell">Status</th>
                      <th className="data-table-head-cell">Expires</th>
                      <th className="data-table-head-cell-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((inv, idx) => (
                      <tr key={inv.id} className={cn("data-table-row", idx % 2 === 0 ? "data-table-row-even" : "data-table-row-odd")}>
                        <td className="data-table-cell text-sm">{inv.email}</td>
                        <td className="data-table-cell">
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-100 capitalize">
                            {inv.role}
                          </span>
                        </td>
                        <td className="data-table-cell">
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-100">
                            Pending
                          </span>
                        </td>
                        <td className="data-table-cell text-xs text-slate-400">
                          {formatDateStandard(inv.expires_at.split("T")[0])}
                        </td>
                        <td className="data-table-cell-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              className="data-table-btn"
                              disabled={busy}
                              onClick={() => void resendInvite(inv)}
                            >
                              Resend
                            </button>
                            <button
                              type="button"
                              className="data-table-btn-danger"
                              disabled={busy}
                              onClick={() => void cancelInvite(inv.id)}
                            >
                              ×
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── ROW 3: WEEKLY SCHEDULE — full width, two sections ── */}
        <div className="card w-full">
          <div className="card-header">
            <h2 className="card-title">Weekly Schedule</h2>
          </div>
          {clinicHours.length > 0 && (
            <p className="hint-text px-0 pb-2">Times constrained to clinic operating hours.</p>
          )}
          {dentists.length === 0 && staff.length === 0 ? (
            <div className="data-table-empty">Add dentists or staff above to manage schedules.</div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* DENTISTS section */}
              {dentists.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1 pb-1">Dentists</p>
                  <div className="table-wrapper overflow-x-auto">
                    <table className="data-table min-w-[640px]">
                      <thead className="data-table-head">
                        <tr>
                          <th className="data-table-head-cell w-40 shrink-0">Name</th>
                          {WEEK_ORDER.map(({ header, key }) => (
                            <th key={key} className="data-table-head-cell text-center text-xs">{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dentists.map((d, rowIdx) => {
                          const isEditing = editingScheduleFor?.id === d.id;
                          return (
                            <tr
                              key={d.id}
                              className={cn(
                                "data-table-row",
                                rowIdx % 2 === 0 ? "data-table-row-even" : "data-table-row-odd",
                                isAdmin && "cursor-pointer hover:bg-blue-50/40"
                              )}
                              onClick={isAdmin ? () => openScheduleEdit(d.id) : undefined}
                              onKeyDown={isAdmin ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openScheduleEdit(d.id); } } : undefined}
                              tabIndex={isAdmin ? 0 : undefined}
                              role={isAdmin ? "button" : undefined}
                            >
                              <td className={cn("data-table-cell", isEditing && "bg-blue-50")}>
                                <div className="flex items-center gap-2 pointer-events-none">
                                  {d.photo_url ? (
                                    <img src={d.photo_url} alt={d.nickname || d.full_name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                                  ) : (
                                    <span
                                      className="inline-flex w-6 h-6 rounded-full shrink-0 items-center justify-center text-white text-xs font-bold"
                                      style={{ background: d.color ?? DENTIST_COLORS[0].hex }}
                                    >
                                      {(d.nickname || d.full_name).slice(0, 1).toUpperCase()}
                                    </span>
                                  )}
                                  <span className="text-xs font-medium">{d.nickname || d.full_name}</span>
                                </div>
                              </td>
                              {WEEK_ORDER.map(({ key }) => {
                                const ds = schedules[d.id]?.[key];
                                const isWorking = ds?.is_working ?? false;
                                return (
                                  <td key={key} className={cn("data-table-cell text-center", isEditing && "bg-blue-50")}>
                                    {isWorking ? (
                                      <span className="text-blue-600 text-xs font-medium tabular-nums whitespace-nowrap">
                                        {formatDayCell(ds)}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300 text-xs">—</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* STAFF section */}
              {staff.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1 pb-1">Staff</p>
                  <div className="table-wrapper overflow-x-auto">
                    <table className="data-table min-w-[640px]">
                      <thead className="data-table-head">
                        <tr>
                          <th className="data-table-head-cell w-40 shrink-0">Name</th>
                          {WEEK_ORDER.map(({ header, key }) => (
                            <th key={key} className="data-table-head-cell text-center text-xs">{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {staff.map((s, rowIdx) => (
                          <tr
                            key={s.id}
                            className={cn(
                              "data-table-row",
                              rowIdx % 2 === 0 ? "data-table-row-even" : "data-table-row-odd",
                              isAdmin && "cursor-pointer hover:bg-blue-50/40"
                            )}
                            onClick={isAdmin ? () => openStaffScheduleEdit(s.id) : undefined}
                            onKeyDown={isAdmin ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openStaffScheduleEdit(s.id); } } : undefined}
                            tabIndex={isAdmin ? 0 : undefined}
                            role={isAdmin ? "button" : undefined}
                          >
                            <td className="data-table-cell">
                              <div className="flex items-center gap-2 pointer-events-none">
                                {s.photo_url ? (
                                  <img src={s.photo_url} alt={s.full_name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                                ) : (
                                  <span className="inline-flex w-6 h-6 rounded-full shrink-0 items-center justify-center bg-slate-300 text-white text-xs font-bold">
                                    {s.full_name.slice(0, 1).toUpperCase()}
                                  </span>
                                )}
                                <span className="text-xs text-slate-600">{s.full_name}</span>
                              </div>
                            </td>
                            {WEEK_ORDER.map(({ key }) => {
                              const ss = staffSchedules[s.id]?.[key];
                              const isWorking = ss?.is_working ?? false;
                              return (
                                <td key={key} className="data-table-cell text-center">
                                  {isWorking ? (
                                    <span className="text-slate-600 text-xs font-medium tabular-nums whitespace-nowrap">
                                      {formatDayCell(ss)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 text-xs">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── ROW 4: LEAVE SCHEDULE — full width, tabbed ── */}
        <div className="card w-full">
          <div className="card-header">
            <h2 className="card-title">Leave Schedule</h2>
            {!isAdmin && (
              <button
                className="save-btn"
                onClick={() => { setEditingLeaveRow(null); setReqLeaveFrom(''); setReqLeaveTo(''); setReqLeaveReason(''); setLeaveSubmitSuccess(null); setShowRequestLeaveModal(true); }}
                disabled={busy}
              >
                + Request Leave
              </button>
            )}
          </div>

          {/* Tab bar — Approved | Cancelled (admin only) | Pending */}
          <div className="action-row mb-3">
            {(['approved', 'cancelled', 'pending'] as const)
              .filter((tab) => isAdmin || tab !== 'cancelled')
              .map((tab) => (
                <button
                  key={tab}
                  className={leaveRequestsTab === tab ? 'toggle-btn-active' : 'toggle-btn'}
                  onClick={() => handleLeaveTabClick(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {isAdmin && tab === 'pending' && pendingLeaveCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold min-w-[16px] h-4 px-1">
                      {pendingLeaveCount}
                    </span>
                  )}
                  {isAdmin && tab === 'cancelled' && userWithdrawnCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold min-w-[16px] h-4 px-1">
                      {userWithdrawnCount}
                    </span>
                  )}
                  {!isAdmin && tab === 'approved' && computedUnseenCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold min-w-[16px] h-4 px-1">
                      {computedUnseenCount}
                    </span>
                  )}
                </button>
              ))}
          </div>

          {/* ── APPROVED tab ── */}
          {leaveRequestsTab === 'approved' && (
            leaveTabContent.length === 0 ? (
              <div className="data-table-empty">No approved leaves yet.</div>
            ) : (
              <div className="table-wrapper overflow-x-auto">
                <table className="data-table min-w-[720px]">
                  <colgroup>
                    <col className="w-56" />
                    <col className="w-28" />
                    <col className="w-28" />
                    <col className="w-56" />
                  </colgroup>
                  <thead className="data-table-head">
                    <tr>
                      <th className="data-table-head-cell">Person</th>
                      <th className="data-table-head-cell whitespace-nowrap">From</th>
                      <th className="data-table-head-cell whitespace-nowrap">To</th>
                      <th className="data-table-head-cell">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveTabContent.map((req, idx) => {
                      const avatar = getLeaveRequestPersonAvatar(req);
                      const personName = req.profiles?.full_name ?? '—';
                      const isOwn = req.profile_id === profileId;
                      return (
                        <tr
                          key={req.id}
                          className={cn(
                            'data-table-row',
                            idx % 2 === 0 ? 'data-table-row-even' : 'data-table-row-odd',
                            !isAdmin && isOwn && 'cursor-pointer hover:bg-blue-50/40'
                          )}
                          onClick={!isAdmin && isOwn ? () => openEditLeave(req) : undefined}
                        >
                          <td className="data-table-cell">
                            <div className="flex items-center gap-1.5">
                              {avatar.photoUrl ? (
                                <img src={avatar.photoUrl} alt={personName} className="w-5 h-5 rounded-full object-cover shrink-0" />
                              ) : avatar.isStaff ? (
                                <span className="inline-flex w-5 h-5 rounded-full shrink-0 items-center justify-center bg-slate-300 text-white text-xs font-bold">{avatar.initial}</span>
                              ) : (
                                <span className="inline-flex w-5 h-5 rounded-full shrink-0 items-center justify-center text-white text-xs font-bold" style={{ background: avatar.color ?? DENTIST_COLORS[0].hex }}>{avatar.initial}</span>
                              )}
                              <span className="text-sm font-medium">{personName}</span>
                              {isOwn && <span className="text-xs text-slate-400">(you)</span>}
                            </div>
                          </td>
                          <td className="data-table-cell text-slate-600 text-sm whitespace-nowrap">{formatDateStandard(req.from_date)}</td>
                          <td className="data-table-cell text-slate-600 text-sm whitespace-nowrap">{req.to_date === req.from_date ? '—' : formatDateStandard(req.to_date)}</td>
                          <td className="data-table-cell text-slate-500 text-sm">{req.reason ?? <span className="text-slate-300">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* ── CANCELLED tab (admin only) ── */}
          {leaveRequestsTab === 'cancelled' && isAdmin && (
            leaveTabContent.length === 0 ? (
              <div className="data-table-empty">No cancelled leave records.</div>
            ) : (
              <div className="table-wrapper overflow-x-auto">
                <table className="data-table min-w-[820px]">
                  <colgroup>
                    <col className="w-56" />
                    <col className="w-28" />
                    <col className="w-28" />
                    <col className="w-56" />
                    <col className="w-20" />
                  </colgroup>
                  <thead className="data-table-head">
                    <tr>
                      <th className="data-table-head-cell">Person</th>
                      <th className="data-table-head-cell whitespace-nowrap">From</th>
                      <th className="data-table-head-cell whitespace-nowrap">To</th>
                      <th className="data-table-head-cell">Reason</th>
                      <th className="data-table-head-cell-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveTabContent.map((req, idx) => {
                      const avatar = getLeaveRequestPersonAvatar(req);
                      const personName = req.profiles?.full_name ?? '—';
                      const isUserWithdrawn = req.cancelled_by === 'user';
                      return (
                        <tr
                          key={req.id}
                          className={cn(
                            'data-table-row',
                            idx % 2 === 0 ? 'data-table-row-even' : 'data-table-row-odd',
                            isUserWithdrawn && 'bg-amber-50/60'
                          )}
                        >
                          <td className="data-table-cell">
                            <div className="flex items-center gap-1.5">
                              {isUserWithdrawn && <span className="text-amber-500 shrink-0" title="Withdrawn by user">🔔</span>}
                              {avatar.photoUrl ? (
                                <img src={avatar.photoUrl} alt={personName} className="w-5 h-5 rounded-full object-cover shrink-0" />
                              ) : avatar.isStaff ? (
                                <span className={cn("inline-flex w-5 h-5 rounded-full shrink-0 items-center justify-center text-xs font-bold", isUserWithdrawn ? "bg-amber-300 text-white" : "bg-slate-300 text-white")}>{avatar.initial}</span>
                              ) : (
                                <span className={cn("inline-flex w-5 h-5 rounded-full shrink-0 items-center justify-center text-white text-xs font-bold", isUserWithdrawn ? "opacity-100" : "opacity-50")} style={{ background: avatar.color ?? DENTIST_COLORS[0].hex }}>{avatar.initial}</span>
                              )}
                              <span className={cn("text-sm font-medium", !isUserWithdrawn && "text-slate-400")}>{personName}</span>
                            </div>
                          </td>
                          <td className={cn("data-table-cell text-sm whitespace-nowrap", isUserWithdrawn ? "text-slate-600" : "text-slate-400")}>{formatDateStandard(req.from_date)}</td>
                          <td className={cn("data-table-cell text-sm whitespace-nowrap", isUserWithdrawn ? "text-slate-600" : "text-slate-400")}>{req.to_date === req.from_date ? '—' : formatDateStandard(req.to_date)}</td>
                          <td className={cn("data-table-cell text-sm", isUserWithdrawn ? "text-slate-500" : "text-slate-400")}>{req.reason ?? <span className="text-slate-300">—</span>}</td>
                          <td className="data-table-cell-right">
                            <button
                              type="button"
                              className="data-table-btn-danger"
                              disabled={busy}
                              onClick={() => deleteLeaveRow(req)}
                              title="Delete record"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* ── PENDING tab ── */}
          {leaveRequestsTab === 'pending' && (
            leaveTabContent.length === 0 ? (
              <div className="data-table-empty">
                {isAdmin ? 'No pending leave requests.' : 'No pending requests from you.'}
              </div>
            ) : (
              <div className="table-wrapper overflow-x-auto">
                <table className={cn("data-table", isAdmin ? "min-w-[820px]" : "min-w-[720px]")}>
                  <colgroup>
                    <col className="w-56" />
                    <col className="w-28" />
                    <col className="w-28" />
                    <col className="w-56" />
                    {isAdmin && <col className="w-28" />}
                  </colgroup>
                  <thead className="data-table-head">
                    <tr>
                      <th className="data-table-head-cell">Person</th>
                      <th className="data-table-head-cell whitespace-nowrap">From</th>
                      <th className="data-table-head-cell whitespace-nowrap">To</th>
                      <th className="data-table-head-cell">Reason</th>
                      {isAdmin && <th className="data-table-head-cell-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {leaveTabContent.map((req, idx) => {
                      const avatar = getLeaveRequestPersonAvatar(req);
                      const personName = req.profiles?.full_name ?? '—';
                      return (
                        <tr key={req.id} className={cn('data-table-row', idx % 2 === 0 ? 'data-table-row-even' : 'data-table-row-odd')}>
                          <td className="data-table-cell">
                            <div className="flex items-center gap-1.5">
                              {avatar.photoUrl ? (
                                <img src={avatar.photoUrl} alt={personName} className="w-5 h-5 rounded-full object-cover shrink-0" />
                              ) : avatar.isStaff ? (
                                <span className="inline-flex w-5 h-5 rounded-full shrink-0 items-center justify-center bg-slate-300 text-white text-xs font-bold">{avatar.initial}</span>
                              ) : (
                                <span className="inline-flex w-5 h-5 rounded-full shrink-0 items-center justify-center text-white text-xs font-bold" style={{ background: avatar.color ?? DENTIST_COLORS[0].hex }}>{avatar.initial}</span>
                              )}
                              <span className="text-sm font-medium">{personName}</span>
                            </div>
                          </td>
                          <td className="data-table-cell text-slate-600 text-sm whitespace-nowrap">{formatDateStandard(req.from_date)}</td>
                          <td className="data-table-cell text-slate-600 text-sm whitespace-nowrap">{req.to_date === req.from_date ? '—' : formatDateStandard(req.to_date)}</td>
                          <td className="data-table-cell text-slate-500 text-sm">{req.reason ?? <span className="text-slate-300">—</span>}</td>
                          {isAdmin && (
                            <td className="data-table-cell-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  className="data-table-btn"
                                  disabled={busy}
                                  onClick={() => void approveLeaveRequest(req)}
                                  title="Approve"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="data-table-btn-danger"
                                  disabled={busy}
                                  onClick={() => void rejectLeaveRequest(req.id)}
                                  title="Reject"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

      </div>

      {/* ── SCHEDULE EDITOR MODAL ── */}
      <EditModal
        open={editingScheduleFor !== null}
        title={editingScheduleFor?.name ? `Edit Schedule — ${editingScheduleFor.name}` : "Edit Schedule"}
        onClose={() => setEditingScheduleFor(null)}
      >
        <div className="spacing-vertical-lg">
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
            {DAY_KEYS.map((day) => {
              const ds = scheduleEdit[day];
              const ch = clinicHours.find((h) => h.id === DAY_KEY_TO_CLINIC_ID[day]);
              const isClinicClosed = !!ch && !ch.is_open;
              const constrainedOptions = getConstrainedTimeOptions(day);
              return (
                <div key={day} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-800 w-24">{DAY_SHORT[day]}</span>
                      {isClinicClosed && (
                        <span className="text-xs text-amber-600">Clinic closed</span>
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
                          ds.is_working ? "bg-blue-500" : "bg-slate-300"
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

      {/* ── STAFF SCHEDULE EDITOR MODAL ── */}
      <EditModal
        open={editingStaffScheduleFor !== null}
        title={editingStaffScheduleFor?.name ? `Edit Schedule — ${editingStaffScheduleFor.name}` : "Edit Schedule"}
        onClose={() => setEditingStaffScheduleFor(null)}
      >
        <div className="spacing-vertical-lg">
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
            {DAY_KEYS.map((day) => {
              const ds = staffScheduleEdit[day];
              const ch = clinicHours.find((h) => h.id === DAY_KEY_TO_CLINIC_ID[day]);
              const isClinicClosed = !!ch && !ch.is_open;
              const constrainedOptions = getConstrainedTimeOptions(day);
              return (
                <div key={day} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-800 w-24">{DAY_SHORT[day]}</span>
                      {isClinicClosed && (
                        <span className="text-xs text-amber-600">Clinic closed</span>
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
                            setStaffScheduleEdit((p) => ({ ...p, [day]: { ...p[day], is_working: !p[day].is_working } }));
                          }
                        }}
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
                          isClinicClosed ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                          ds.is_working ? "bg-blue-500" : "bg-slate-300"
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
                          onChange={(e) => setStaffScheduleEdit((p) => ({ ...p, [day]: { ...p[day], start_time: Number(e.target.value) } }))}
                        >
                          {constrainedOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Closes</label>
                        <select
                          className="input-standard w-full"
                          value={ds.end_time}
                          onChange={(e) => setStaffScheduleEdit((p) => ({ ...p, [day]: { ...p[day], end_time: Number(e.target.value) } }))}
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
              <button className="cancel-btn" onClick={() => setEditingStaffScheduleFor(null)} disabled={busy}>Cancel</button>
              <button className="save-btn" onClick={saveStaffSchedule} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      </EditModal>

      {/* ── ADD/EDIT DENTIST MODAL ── */}
      <EditModal open={showAddDentistModal} title={editingDentist ? "Edit Dentist" : "Add Dentist"} onClose={closeDentistModal}>
        <div className="spacing-vertical-lg">
          {/* Profile Photo — admin uploads for this dentist */}
          <div>
            <span className="field-label-text block mb-2">Profile Photo <span className="text-slate-400 font-normal text-xs">(optional)</span></span>
            <div className="flex items-center gap-3">
              {(dentistPhotoPreview ?? editingDentist?.photo_url) ? (
                <img
                  src={dentistPhotoPreview ?? editingDentist?.photo_url ?? ""}
                  alt=""
                  className="w-14 h-14 rounded-full object-cover shrink-0"
                />
              ) : (
                <span
                  className="inline-flex w-14 h-14 rounded-full shrink-0 items-center justify-center text-white font-bold text-xl"
                  style={{ background: editingDentist?.color ?? DENTIST_COLORS[dentists.length % DENTIST_COLORS.length].hex }}
                >
                  {dentistName.slice(0, 1).toUpperCase() || "?"}
                </span>
              )}
              <div>
                <p className="text-xs text-slate-400 mb-1.5">JPG, PNG, or WebP · Max 2 MB</p>
                <button
                  type="button"
                  className="cancel-btn text-sm"
                  onClick={() => dentistPhotoInputRef.current?.click()}
                  disabled={busy}
                >
                  Upload photo
                </button>
              </div>
              <input
                ref={dentistPhotoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDentistPhotoSelect(f); e.target.value = ""; }}
              />
            </div>
          </div>

          {/* Full name */}
          <label className="field-label">
            <span className="field-label-text">Full name <span className="text-red-400">*</span></span>
            <input className="field-input" value={dentistName} onChange={(e) => setDentistName(e.target.value)} disabled={busy} />
          </label>

          {/* Specialty / Role */}
          <label className="field-label">
            <span className="field-label-text">Specialty / Role</span>
            <select className="field-input" value={dentistSpecialty} onChange={(e) => setDentistSpecialty(e.target.value)} disabled={busy}>
              <option value="">Select specialty</option>
              {DENTIST_SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          {/* Date of Birth */}
          <DatePickerField label="Date of Birth" value={dentistDob} onChange={setDentistDob} inputRef={dentistDobRef} variant="case-modal" max={new Date().toISOString().split("T")[0]} />

          {/* Nickname */}
          <label className="field-label">
            <span className="field-label-text">Nickname <span className="text-slate-400 font-normal">(optional)</span></span>
            <input className="field-input" placeholder="e.g. Doc Daisy" value={dentistNickname} onChange={(e) => setDentistNickname(e.target.value)} disabled={busy} />
          </label>

          {/* PRC / License No. */}
          <label className="field-label">
            <span className="field-label-text">PRC / License No.</span>
            <input className="field-input" placeholder="Permanent registration number" value={dentistPrc} onChange={(e) => setDentistPrc(e.target.value)} disabled={busy} />
          </label>

          {/* PTR No. */}
          <label className="field-label">
            <span className="field-label-text">PTR No.</span>
            <input type="number" className="field-input" placeholder="Annual professional tax receipt" value={dentistPtr} onChange={(e) => setDentistPtr(e.target.value)} disabled={busy} />
          </label>

          {/* Salary Rate */}
          <label className="field-label">
            <span className="field-label-text">Daily Rate <span className="text-slate-400 font-normal text-xs">(₱/day, optional)</span></span>
            <input
              type="number"
              min="0"
              step="0.01"
              className="field-input"
              placeholder="e.g. 30000"
              value={dentistSalaryRate}
              onChange={(e) => setDentistSalaryRate(e.target.value)}
              disabled={busy}
            />
          </label>

          {/* Phone */}
          <label className="field-label">
            <span className="field-label-text">Phone</span>
            <input
              className="field-input"
              placeholder="09XX XXX XXXX"
              value={dentistPhone}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                setDentistPhone(formatPhoneLocal(digits));
              }}
              disabled={busy}
            />
          </label>

          {/* 9. Invite email */}
          {isAdmin && (
            <div>
              <label className="field-label">
                <span className="field-label-text">
                  Invite email <span className="text-slate-400 font-normal text-xs">(optional)</span>
                </span>
              </label>
              {dentistInviteSuccess && <div className="success-banner mb-2">{dentistInviteSuccess}</div>}
              <div className="flex gap-2">
                <input
                  type="email"
                  className="field-input flex-1"
                  placeholder="email@example.com"
                  value={dentistInviteEmail}
                  onChange={(e) => setDentistInviteEmail(e.target.value)}
                  disabled={busy || !isPro}
                />
                {editingDentist && !dentistExistingInvite && (
                  <button
                    type="button"
                    className="save-btn shrink-0"
                    onClick={sendDentistInvite}
                    disabled={busy || !dentistInviteEmail.trim() || !isPro}
                  >
                    Send
                  </button>
                )}
              </div>
              {dentistExistingInvite && (
                <div className="flex items-center justify-between mt-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                  <span className="text-xs text-amber-700">
                    ⏳ Invite pending — expires {formatDateStandard(dentistExistingInvite.expires_at.split("T")[0])}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                      onClick={() => void resendInvite(dentistExistingInvite)}
                      disabled={busy}
                    >
                      Resend
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-red-500 hover:text-red-700"
                      onClick={() => {
                        void cancelInvite(dentistExistingInvite.id);
                        setDentistExistingInvite(null);
                        setDentistInviteEmail("");
                      }}
                      disabled={busy}
                    >
                      Cancel invite
                    </button>
                  </div>
                </div>
              )}
              {!isPro && <p className="hint-text mt-1">Requires Pro plan.</p>}
            </div>
          )}

          {editingDentist && (
            <div className="delete-confirmation">
              <div className="delete-confirmation-title">Delete dentist?</div>
              <div className="delete-confirmation-hint">Type <span className="delete-confirmation-code">DELETE</span> to confirm</div>
              <input className="delete-confirmation-input" value={dentistDeleteText} onChange={(e) => setDentistDeleteText(e.target.value)} placeholder="DELETE" disabled={busy} />
            </div>
          )}
          <div className="modal-actions">
            {editingDentist && (
              <button type="button" className="delete-btn" onClick={() => deleteDentist(editingDentist.id)} disabled={busy || dentistDeleteText !== "DELETE"}>Delete</button>
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
          {/* Profile Photo — admin uploads for this staff member */}
          <div>
            <span className="field-label-text block mb-2">Profile Photo <span className="text-slate-400 font-normal text-xs">(optional)</span></span>
            <div className="flex items-center gap-3">
              {(staffPhotoPreview ?? editingStaff?.photo_url) ? (
                <img
                  src={staffPhotoPreview ?? editingStaff?.photo_url ?? ""}
                  alt=""
                  className="w-14 h-14 rounded-full object-cover shrink-0"
                />
              ) : (
                <span className="inline-flex w-14 h-14 rounded-full shrink-0 items-center justify-center bg-slate-300 text-white font-bold text-xl">
                  {staffName.slice(0, 1).toUpperCase() || "?"}
                </span>
              )}
              <div>
                <p className="text-xs text-slate-400 mb-1.5">JPG, PNG, or WebP · Max 2 MB</p>
                <button
                  type="button"
                  className="cancel-btn text-sm"
                  onClick={() => staffPhotoInputRef.current?.click()}
                  disabled={busy}
                >
                  Upload photo
                </button>
              </div>
              <input
                ref={staffPhotoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleStaffPhotoSelect(f); e.target.value = ""; }}
              />
            </div>
          </div>

          {/* Full name */}
          <label className="field-label">
            <span className="field-label-text">Full name <span className="text-red-400">*</span></span>
            <input className="field-input" value={staffName} onChange={(e) => setStaffName(e.target.value)} disabled={busy} />
          </label>

          {/* Role / Job title */}
          <label className="field-label">
            <span className="field-label-text">Role / Job title <span className="text-red-400">*</span></span>
            <select className="field-input" value={staffRole} onChange={(e) => setStaffRole(e.target.value)} disabled={busy}>
              <option value="">Select role</option>
              {STAFF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>

          {/* Date of Birth */}
          <DatePickerField label="Date of Birth" value={staffDob} onChange={setStaffDob} inputRef={staffDobRef} variant="case-modal" max={new Date().toISOString().split("T")[0]} />

          {/* Salary Rate */}
          <label className="field-label">
            <span className="field-label-text">Daily Rate <span className="text-slate-400 font-normal text-xs">(₱/day, optional)</span></span>
            <input
              type="number"
              min="0"
              step="0.01"
              className="field-input"
              placeholder="e.g. 18000"
              value={staffSalaryRate}
              onChange={(e) => setStaffSalaryRate(e.target.value)}
              disabled={busy}
            />
          </label>

          {/* Phone */}
          <label className="field-label">
            <span className="field-label-text">Phone</span>
            <input
              className="field-input"
              placeholder="09XX XXX XXXX"
              value={staffPhone}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                setStaffPhone(formatPhoneLocal(digits));
              }}
              disabled={busy}
            />
          </label>

          {/* 6. Account status / Invite email */}
          {isAdmin && (
            editingStaff?.profile_id ? (
              <div>
                <p className="field-label-text mb-1.5">Account Status</p>
                <span className="inline-flex items-center gap-1.5 text-sm text-green-600 font-medium">
                  ✓ Active — has Molaris account
                </span>
              </div>
            ) : (
              <div>
                <label className="field-label">
                  <span className="field-label-text">
                    Invite email <span className="text-slate-400 font-normal text-xs">(optional)</span>
                  </span>
                </label>
                {inviteSuccess && <div className="success-banner mb-2">{inviteSuccess}</div>}
                <div className="flex gap-2">
                  <input
                    type="email"
                    className="field-input flex-1"
                    placeholder="email@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    disabled={busy || atStaffLimit}
                  />
                  {editingStaff && !staffExistingInvite && (
                    <button
                      type="button"
                      className="save-btn shrink-0"
                      onClick={sendInvite}
                      disabled={busy || !inviteEmail.trim() || atStaffLimit}
                    >
                      Send
                    </button>
                  )}
                </div>
                {staffExistingInvite && (
                  <div className="flex items-center justify-between mt-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                    <span className="text-xs text-amber-700">
                      ⏳ Invite pending — expires {formatDateStandard(staffExistingInvite.expires_at.split("T")[0])}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-xs font-medium text-blue-600 hover:text-blue-800"
                        onClick={() => void resendInvite(staffExistingInvite)}
                        disabled={busy}
                      >
                        Resend
                      </button>
                      <button
                        type="button"
                        className="text-xs font-medium text-red-500 hover:text-red-700"
                        onClick={() => {
                          void cancelInvite(staffExistingInvite.id);
                          setStaffExistingInvite(null);
                          setInviteEmail("");
                        }}
                        disabled={busy}
                      >
                        Cancel invite
                      </button>
                    </div>
                  </div>
                )}
                {atStaffLimit && <p className="hint-text mt-1 text-amber-600">Free plan includes up to 1 staff account.</p>}
              </div>
            )
          )}

          {/* 7. Clinical Access — visible once staff has joined */}
          {editingStaff?.profile_id && (
            <div className="section-divider">
              <p className="field-label-text mb-1">Clinical Access</p>
              <p className="hint-text mb-3">
                Assign this staff member to act on behalf of a dentist. They can record treatments,
                create invoices, manage ortho, and generate documents on behalf of assigned dentists.
              </p>
              {dentists.length === 0 ? (
                <p className="hint-text text-slate-400">Add dentists first to assign handlers.</p>
              ) : (
                <div className="space-y-2">
                  {dentists.map((d) => {
                    const isChecked = staffHandlerDentistIds.includes(d.id);
                    return (
                      <label
                        key={d.id}
                        className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            setStaffHandlerDentistIds((prev) =>
                              e.target.checked
                                ? [...prev, d.id]
                                : prev.filter((id) => id !== d.id)
                            );
                          }}
                          disabled={busy}
                          className="h-4 w-4 rounded"
                        />
                        <span
                          className="inline-block w-3 h-3 rounded-full shrink-0"
                          style={{ background: d.color ?? DENTIST_COLORS[0].hex }}
                        />
                        <span className="text-sm text-slate-700">
                          {d.full_name}
                          {d.nickname && <span className="ml-1 text-slate-400">({d.nickname})</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {editingStaff && (
            <div className="delete-confirmation">
              <div className="delete-confirmation-title">Delete staff member?</div>
              <div className="delete-confirmation-hint">Type <span className="delete-confirmation-code">DELETE</span> to confirm</div>
              <input className="delete-confirmation-input" value={staffDeleteText} onChange={(e) => setStaffDeleteText(e.target.value)} placeholder="DELETE" disabled={busy} />
            </div>
          )}
          <div className="modal-actions">
            {editingStaff && isAdmin && (
              <button type="button" className="delete-btn" onClick={() => deleteStaff(editingStaff.id)} disabled={busy || staffDeleteText !== "DELETE"}>Delete</button>
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

      {/* ── ADD/EDIT BLOCKOUT MODAL ── */}
      <EditModal
        open={showBlockoutModal}
        title={editingBlockout ? "Edit Leave Schedule" : "Add Leave Schedule"}
        onClose={closeBlockoutModal}
      >
        <div className="spacing-vertical-lg">
          {/* Person selector — Dentists and Staff in optgroups */}
          <label className="field-label">
            <span className="field-label-text">Person <span className="text-red-400">*</span></span>
            <select
              className="field-input"
              value={blockoutPerson}
              onChange={(e) => setBlockoutPerson(e.target.value)}
              disabled={busy}
            >
              <option value="">Select person</option>
              {dentists.length > 0 && (
                <optgroup label="Dentists">
                  {dentists.map((d) => (
                    <option key={d.id} value={`dentist:${d.id}`}>
                      {d.nickname ? `${d.full_name} (${d.nickname})` : d.full_name}
                    </option>
                  ))}
                </optgroup>
              )}
              {staff.length > 0 && (
                <optgroup label="Staff">
                  {staff.map((s) => (
                    <option key={s.id} value={`staff:${s.id}`}>{s.full_name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>

          {/* Date range — styled date pickers */}
          <div>
            <span className="field-label-text block mb-2">Date Range <span className="text-red-400">*</span></span>
            <div className="flex items-start gap-2">
              <DatePickerField
                label="From"
                value={blockoutStart}
                onChange={setBlockoutStart}
                wrapperClassName="grid gap-1 flex-1"
              />
              <span className="text-slate-400 shrink-0 mt-7 text-lg">→</span>
              <DatePickerField
                label="To"
                value={blockoutEnd}
                onChange={(v) => { if (!blockoutStart || v >= blockoutStart) setBlockoutEnd(v); }}
                min={blockoutStart || undefined}
                initialMonth={blockoutStart || undefined}
                wrapperClassName="grid gap-1 flex-1"
              />
            </div>
          </div>

          {/* Reason — required */}
          <label className="field-label">
            <span className="field-label-text">Reason <span className="text-red-400">*</span></span>
            <input
              className="field-input"
              placeholder="e.g. Vacation, Conference, Medical leave"
              value={blockoutReason}
              onChange={(e) => setBlockoutReason(e.target.value)}
              disabled={busy}
            />
          </label>

          {editingBlockout && (
            <div className="delete-confirmation">
              <div className="delete-confirmation-title">Delete leave entry?</div>
              <div className="delete-confirmation-hint">Type <span className="delete-confirmation-code">DELETE</span> to confirm</div>
              <input className="delete-confirmation-input" value={blockoutDeleteText} onChange={(e) => setBlockoutDeleteText(e.target.value)} placeholder="DELETE" disabled={busy} />
            </div>
          )}
          <div className="modal-actions">
            {editingBlockout && isAdmin && (
              <button type="button" className="delete-btn" onClick={() => deleteBlockout(editingBlockout.id)} disabled={busy || blockoutDeleteText !== "DELETE"}>Delete</button>
            )}
            <div className="modal-actions-right">
              <button type="button" className="cancel-btn" onClick={closeBlockoutModal} disabled={busy}>Cancel</button>
              <button
                type="button"
                className="save-btn"
                onClick={saveBlockout}
                disabled={busy || !blockoutPerson || !blockoutStart || !blockoutEnd || !blockoutReason.trim()}
              >
                {busy ? "Saving…" : editingBlockout ? "Update" : "Add"}
              </button>
            </div>
          </div>
        </div>
      </EditModal>

      {/* ── REQUEST LEAVE MODAL (non-admin) ── */}
      <EditModal
        open={showRequestLeaveModal}
        title={editingLeaveRow ? 'Edit Leave Request' : 'Request Leave'}
        wide
        onClose={() => {
          setShowRequestLeaveModal(false);
          setEditingLeaveRow(null);
          setReqLeaveFrom(''); setReqLeaveTo(''); setReqLeaveReason('');
          setLeaveSubmitSuccess(null);
        }}
      >
        <div className="spacing-vertical-lg">
          {leaveSubmitSuccess && <div className="success-banner">{leaveSubmitSuccess}</div>}
          <div>
            <span className="field-label-text block mb-2">Date Range <span className="text-red-400">*</span></span>
            <div className="flex items-start gap-2">
              <DatePickerField
                label="From"
                value={reqLeaveFrom}
                onChange={(v) => {
                  setReqLeaveFrom(v);
                  if (reqLeaveTo && reqLeaveTo < v) setReqLeaveTo('');
                }}
                min={today}
                wrapperClassName="grid gap-1 flex-1"
              />
              <span className="text-slate-400 shrink-0 mt-7 text-lg">→</span>
              <DatePickerField
                label="To"
                value={reqLeaveTo}
                onChange={setReqLeaveTo}
                min={reqLeaveFrom || today}
                initialMonth={reqLeaveFrom || undefined}
                wrapperClassName="grid gap-1 flex-1"
              />
            </div>
          </div>
          <label className="field-label">
            <span className="field-label-text">Reason <span className="text-red-400">*</span></span>
            <input
              className="field-input"
              placeholder="e.g. Vacation, Medical leave, Personal"
              value={reqLeaveReason}
              onChange={(e) => setReqLeaveReason(e.target.value)}
              disabled={busy}
            />
          </label>
          {/* Re-approval note — only when editing an approved leave */}
          {editingLeaveRow?.status === 'approved' && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Saving changes will move this request back to <strong>Pending</strong> for admin review and re-approval.
            </div>
          )}

          <div className="modal-actions">
            <div className="flex items-center gap-2 flex-1">
              {/* Withdraw button — only when editing an approved leave */}
              {editingLeaveRow?.status === 'approved' && (
                <button
                  className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-3 py-2 transition-colors disabled:opacity-50"
                  onClick={() => void withdrawLeaveRequest(editingLeaveRow.id)}
                  disabled={busy}
                >
                  Withdraw Leave
                </button>
              )}
            </div>
            <div className="modal-actions-right">
              <button
                className="cancel-btn"
                onClick={() => {
                  setShowRequestLeaveModal(false);
                  setEditingLeaveRow(null);
                  setReqLeaveFrom(''); setReqLeaveTo(''); setReqLeaveReason('');
                  setLeaveSubmitSuccess(null);
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                className="save-btn"
                onClick={() => void submitLeaveRequest()}
                disabled={busy || !reqLeaveFrom || !reqLeaveTo || !reqLeaveReason.trim()}
              >
                {busy ? 'Submitting…' : editingLeaveRow ? 'Update Request' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      </EditModal>

      {/* ── UNDO TOAST — delete cancelled leave record ── */}
      {undoToast && (
        <UndoToast
          message={undoToast.message}
          onUndo={() => {
            setLeaveRequests((prev) =>
              [...prev, undoToast.row].sort((a, b) => b.created_at.localeCompare(a.created_at))
            );
          }}
          onConfirm={async () => {
            await supabase
              .from('schedule_requests')
              .delete()
              .eq('id', undoToast.row.id)
              .eq('clinic_id', clinicId);
            dispatchLeaveCountRefresh();
          }}
          onDismiss={() => setUndoToast(null)}
        />
      )}

    </>
  );
}
