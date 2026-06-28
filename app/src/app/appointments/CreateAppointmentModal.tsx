"use client";

import { useEffect, useRef, useState } from "react";
import { useClinic } from "@/contexts/ClinicContext";
import { supabase } from "@/lib/supabaseClient";
import { DatePickerField } from "@/components/DatePickerField";
import { VISIT_REASONS, VisitReasonType } from "@/lib/visitReasonHelpers";
import { EditModal } from "@/components/EditModal";
import type { Patient, DentistRow, ClinicHoursEntry } from "@/lib/types";
import { dentistLabel } from "@/lib/types";

const formatTime12Hr = (time24: string): string => {
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
};

const DAY_IDS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  dentists: DentistRow[];
  patients: Patient[];
  selectedDate: string | null;
  clinicHours: ClinicHoursEntry[];
  holidayOverrides?: Set<string>;
  prefillPatient?: { id: string; name: string };
}

export function CreateAppointmentModal({ open, onClose, onCreated, dentists, patients, selectedDate, clinicHours, holidayOverrides, prefillPatient }: Props) {
  const { clinicId } = useClinic();
  const [formData, setFormData] = useState({
    patientId: "",
    appointmentDate: new Date().toISOString().split("T")[0],
    appointmentTime: "08:00",
    dentistId: "",
    concernType: "" as VisitReasonType | "",
  });
  const [patientSearchInput, setPatientSearchInput] = useState("");
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [isOrthoPatient, setIsOrthoPatient] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);
  const [dentistSchedule, setDentistSchedule] = useState<{ day_of_week: number; start_time: string; end_time: string; is_working: boolean }[]>([]);
  const [dentistBlockouts, setDentistBlockouts] = useState<{ start_date: string; end_date: string; reason: string | null }[]>([]);
  const [phHolidays, setPhHolidays] = useState<string[]>([]);
  const [dentistAvailability, setDentistAvailability] = useState<Record<string, boolean>>({});
  const [phHolidayNames, setPhHolidayNames] = useState<Record<string, string>>({});

  // Fetch PH holidays for the current year (and next, if near year-end)
  useEffect(() => {
    const year = new Date().getFullYear();
    const fetchHolidays = async (y: number) => {
      try {
        const res = await fetch(`/api/holidays?year=${y}`);
        if (res.ok) {
          const { dates, names }: { dates: string[]; names: Record<string, string> } = await res.json();
          setPhHolidays((prev) => [...new Set([...prev, ...dates])]);
          setPhHolidayNames((prev) => ({ ...prev, ...names }));
        }
      } catch { /* fail open */ }
    };
    fetchHolidays(year);
    // Pre-fetch next year too if we're in Q4
    if (new Date().getMonth() >= 9) fetchHolidays(year + 1);
  }, []);

  useEffect(() => {
    if (open) {
      setPatientSearchInput(prefillPatient?.name ?? "");
      setError(null);
      setIsOrthoPatient(false);
      setFormData({
        patientId: prefillPatient?.id ?? "",
        appointmentDate: selectedDate || new Date().toISOString().split("T")[0],
        appointmentTime: "08:00",
        dentistId: "",
        concernType: "",
      });
      if (prefillPatient?.id) checkOrthoStatus(prefillPatient.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedDate, prefillPatient?.id]);

  useEffect(() => {
    if (open && formData.appointmentDate && dentists.length > 0) {
      void loadDentistAvailabilityForDate(formData.appointmentDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, formData.appointmentDate, dentists]);

  useEffect(() => {
    if (formData.dentistId && Object.keys(dentistAvailability).length > 0 && dentistAvailability[formData.dentistId] === false) {
      setFormData((prev) => ({ ...prev, dentistId: "", appointmentTime: "08:00" }));
      setDentistSchedule([]);
      setDentistBlockouts([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dentistAvailability]);

  async function loadDentistSchedule(dentistId: string) {
    if (!dentistId) { setDentistSchedule([]); setDentistBlockouts([]); return; }
    const [sched, block] = await Promise.all([
      supabase.from("dentist_schedules").select("day_of_week, start_time, end_time, is_working").eq("dentist_id", dentistId).eq("clinic_id", clinicId),
      supabase.from("dentist_blockouts").select("start_date, end_date, reason").eq("dentist_id", dentistId),
    ]);
    setDentistSchedule(sched.data ?? []);
    setDentistBlockouts(block.data ?? []);
  }

  const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

  async function loadDentistAvailabilityForDate(dateStr: string) {
    if (!dentists.length || !clinicId) return;
    try {
      const dayOfWeek = new Date(dateStr + "T00:00:00").getDay();
      const dentistIds = dentists.map((d) => d.id);
      const [schedRes, blockRes] = await Promise.all([
        supabase.from("dentist_schedules")
          .select("dentist_id, is_working")
          .in("dentist_id", dentistIds)
          .eq("clinic_id", clinicId)
          .eq("day_of_week", dayOfWeek),
        supabase.from("dentist_blockouts")
          .select("dentist_id")
          .in("dentist_id", dentistIds)
          .lte("start_date", dateStr)
          .gte("end_date", dateStr),
      ]);
      const blockedIds = new Set((blockRes.data ?? []).map((b: { dentist_id: string }) => b.dentist_id));
      const offIds = new Set(
        (schedRes.data ?? [])
          .filter((s: { dentist_id: string; is_working: boolean }) => !s.is_working)
          .map((s: { dentist_id: string; is_working: boolean }) => s.dentist_id)
      );
      const avail: Record<string, boolean> = {};
      for (const d of dentists) {
        avail[d.id] = !blockedIds.has(d.id) && !offIds.has(d.id);
      }
      setDentistAvailability(avail);
    } catch {
      // Fail open — show all dentists if availability can't be determined
      setDentistAvailability({});
    }
  }

  async function checkOrthoStatus(patientId: string) {
    if (!patientId || !clinicId) { setIsOrthoPatient(false); return; }
    const { data } = await supabase
      .from("ortho_cases")
      .select("id")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .limit(1);
    setIsOrthoPatient((data?.length ?? 0) > 0);
  }

  async function handleCreate() {
    if (!formData.patientId || !formData.appointmentDate || !formData.appointmentTime || !formData.dentistId) {
      setError("Please fill in all required fields");
      return;
    }
    try {
      const { data: inserted, error: err } = await supabase.from("appointments").insert({
        clinic_id: clinicId,
        patient_id: formData.patientId,
        appointment_date: formData.appointmentDate,
        appointment_time: formData.appointmentTime,
        dentist_id: formData.dentistId,
        concern_type: formData.concernType || null,
        status: "confirmed",
        notes: "Created manually",
      }).select("id").single();
      if (err) throw err;
      onCreated();
      onClose();
    } catch (err) {
      console.error("Error creating appointment:", err);
      setError("Failed to create appointment");
    }
  }

  function isBlockedOut(dateStr: string) {
    return dentistBlockouts.some((b) => b.start_date <= dateStr && b.end_date >= dateStr);
  }

  function getValidHours(dateStr: string) {
    const dayOfWeek = new Date(dateStr + "T00:00:00").getDay();
    const isPhHoliday = phHolidays.includes(dateStr);
    const isWorkingHoliday = holidayOverrides?.has(dateStr) ?? false;
    const isHoliday = isPhHoliday && !isWorkingHoliday;

    if (isBlockedOut(dateStr)) return [];

    const daySched = dentistSchedule.find((s) => s.day_of_week === dayOfWeek);
    if (daySched) {
      if (!daySched.is_working) return [];
      const start = parseInt(daySched.start_time.split(":")[0]);
      const end = parseInt(daySched.end_time.split(":")[0]);
      return Array.from({ length: end - start }, (_, i) => start + i).filter((h) => h !== 13);
    }

    // Use clinic hours: look up by day-of-week or "holiday"
    const dayId = isHoliday ? "holiday" : DAY_IDS[dayOfWeek];
    const clinicHour = clinicHours.find((h) => h.id === dayId);
    if (!clinicHour || clinicHour.is_open === false) return [];
    const openH = Math.floor(clinicHour.open_hour);
    const closeH = Math.floor(clinicHour.close_hour);
    return Array.from({ length: closeH - openH }, (_, i) => openH + i).filter((h) => h !== 13);
  }

  const isHoliday = phHolidays.includes(formData.appointmentDate) && !(holidayOverrides?.has(formData.appointmentDate) ?? false);
  const validHours = getValidHours(formData.appointmentDate);
  const blocked = isBlockedOut(formData.appointmentDate);
  const canConfirm = !!(formData.patientId && formData.dentistId && formData.appointmentDate && !blocked && validHours.length > 0);

  return (
    <EditModal open={open} title="Create appointment" onClose={onClose}>
      <div className="grid gap-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Patient - Searchable */}
        <div className="relative">
          <label className="grid gap-1 text-sm">
            <span className="text-slate-700">Patient *</span>
            <input
              type="text"
              value={patientSearchInput}
              onChange={(e) => {
                setPatientSearchInput(e.target.value);
                setShowPatientDropdown(e.target.value.length >= 3);
              }}
              onBlur={() => setTimeout(() => setShowPatientDropdown(false), 200)}
              className="input-standard"
              placeholder="Start typing to search"
            />
          </label>
          {showPatientDropdown && patientSearchInput.length >= 3 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-violet-100 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
              {(() => {
                const q = patientSearchInput.toLowerCase();
                const filtered = patients.filter((p) => {
                  const full = (p.full_name ?? "").toLowerCase();
                  const first = ((p as any).first_name ?? "").toLowerCase();
                  const last = ((p as any).last_name ?? "").toLowerCase();
                  return full.includes(q) || first.includes(q) || last.includes(q);
                });
                return filtered.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500">No matches for "{patientSearchInput}"</div>
                ) : (
                  filtered.map((p) => {
                    const displayName = p.full_name || `${(p as any).first_name ?? ""} ${(p as any).last_name ?? ""}`.trim();
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, patientId: p.id, concernType: "" });
                          setPatientSearchInput(displayName);
                          setShowPatientDropdown(false);
                          checkOrthoStatus(p.id);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-violet-50 text-sm text-slate-700"
                      >
                        {displayName}
                      </button>
                    );
                  })
                );
              })()}
            </div>
          )}
        </div>

        {/* Dentist — first so schedule filters the date/time below */}
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">Dentist *</span>
          <select
            value={formData.dentistId}
            onChange={(e) => { setFormData({ ...formData, dentistId: e.target.value }); loadDentistSchedule(e.target.value); }}
            className="input-standard"
          >
            <option value="">Select dentist</option>
            {dentists
              .filter((d) => dentistAvailability[d.id] !== false)
              .map((d) => (
                <option key={d.id} value={d.id}>{dentistLabel(d)}</option>
              ))}
          </select>
        </label>

        {/* Date */}
        <DatePickerField
          label="Date *"
          value={formData.appointmentDate}
          onChange={(val) => setFormData({ ...formData, appointmentDate: val })}
          inputRef={dateRef}
          variant="case-modal"
          min={new Date().toISOString().split("T")[0]}
        />

        {/* Warnings: holiday / clinic closed */}
        {isHoliday && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 font-medium">
            ⚠️ {phHolidayNames[formData.appointmentDate] || "Public holiday"} — confirm the clinic will be open.
          </div>
        )}
        {!isHoliday && validHours.length === 0 && !formData.dentistId && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-500">
            The clinic is closed on this day based on configured hours.
          </div>
        )}

        {/* Time */}
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">Time *</span>
          {isBlockedOut(formData.appointmentDate) ? (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 font-medium">
              {(() => { const b = dentistBlockouts.find((x) => x.start_date <= formData.appointmentDate && x.end_date >= formData.appointmentDate); return b ? `Dentist unavailable${b.reason ? ` — ${b.reason}` : ""}` : "Dentist unavailable on this date"; })()}
            </div>
          ) : getValidHours(formData.appointmentDate).length === 0 && formData.dentistId ? (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-500">
              Dentist is off on this day
            </div>
          ) : (
            <select
              value={formData.appointmentTime}
              onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })}
              className="input-standard"
            >
              {getValidHours(formData.appointmentDate).map((hour) => {
                const timeStr = `${String(hour).padStart(2, "0")}:00`;
                return <option key={hour} value={timeStr}>{formatTime12Hr(timeStr)}</option>;
              })}
            </select>
          )}
        </label>

        {/* Concern Type */}
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">Concern / reason for visit (optional)</span>
          <select
            value={formData.concernType}
            onChange={(e) => setFormData({ ...formData, concernType: e.target.value as VisitReasonType | "" })}
            className="input-standard"
          >
            <option value="">Select a reason</option>
            {VISIT_REASONS
              .filter((group) => group.group === "General" || isOrthoPatient)
              .map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.reasons.map((reason) => (
                    <option key={reason.value} value={reason.value}>{reason.label}</option>
                  ))}
                </optgroup>
              ))}
          </select>
          {!isOrthoPatient && formData.patientId && (
            <span className="text-xs text-slate-400">Ortho reasons are only available for patients with an ortho case.</span>
          )}
        </label>

        {/* Actions */}
        <div className="modal-footer-buttons pt-1">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button onClick={handleCreate} className="save-btn" disabled={!canConfirm}>Confirm</button>
        </div>
      </div>
    </EditModal>
  );
}
