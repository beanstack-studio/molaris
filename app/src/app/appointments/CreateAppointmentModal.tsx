"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { DatePickerField } from "@/components/DatePickerField";
import { VISIT_REASONS, VisitReasonType } from "@/lib/visitReasonHelpers";
import { EditModal } from "@/components/EditModal";
import type { Patient, DentistRow } from "@/lib/types";

const PH_HOLIDAYS_2026 = [
  "2026-01-01", "2026-02-10", "2026-02-25", "2026-04-09", "2026-04-10",
  "2026-04-14", "2026-06-12", "2026-08-21", "2026-11-01", "2026-11-30",
  "2026-12-08", "2026-12-25", "2026-12-30",
];

const formatTime12Hr = (time24: string): string => {
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  dentists: DentistRow[];
  patients: Patient[];
  selectedDate: string | null;
  sundayEndHour: number;
}

export function CreateAppointmentModal({ open, onClose, onCreated, dentists, patients, selectedDate, sundayEndHour }: Props) {
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

  useEffect(() => {
    if (open) {
      setPatientSearchInput("");
      setError(null);
      setIsOrthoPatient(false);
      setFormData({
        patientId: "",
        appointmentDate: selectedDate || new Date().toISOString().split("T")[0],
        appointmentTime: "08:00",
        dentistId: "",
        concernType: "",
      });
    }
  }, [open, selectedDate]);

  async function checkOrthoStatus(patientId: string) {
    if (!patientId) { setIsOrthoPatient(false); return; }
    const { data } = await supabase
      .from("ortho_cases")
      .select("id")
      .eq("patient_id", patientId)
      .limit(1);
    setIsOrthoPatient((data?.length ?? 0) > 0);
  }

  async function handleCreate() {
    if (!formData.patientId || !formData.appointmentDate || !formData.appointmentTime) {
      setError("Please fill in required fields");
      return;
    }
    try {
      const { error: err } = await supabase.from("appointments").insert({
        patient_id: formData.patientId,
        appointment_date: formData.appointmentDate,
        appointment_time: formData.appointmentTime,
        dentist_id: formData.dentistId || null,
        concern_type: formData.concernType || null,
        status: "confirmed",
        notes: "Created manually",
      });
      if (err) throw err;
      onCreated();
      onClose();
    } catch (err) {
      console.error("Error creating appointment:", err);
      setError("Failed to create appointment");
    }
  }

  function getValidHours(dateStr: string) {
    const dayOfWeek = new Date(dateStr + "T00:00:00").getDay();
    const isHoliday = PH_HOLIDAYS_2026.includes(dateStr);
    return (dayOfWeek === 0 || isHoliday)
      ? Array.from({ length: sundayEndHour - 7 }, (_, i) => 8 + i)
      : [8, 9, 10, 11, 12, 14, 15, 16];
  }

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

        {/* Date */}
        <DatePickerField
          label="Date *"
          value={formData.appointmentDate}
          onChange={(val) => setFormData({ ...formData, appointmentDate: val })}
          inputRef={dateRef}
          variant="case-modal"
          min={new Date().toISOString().split("T")[0]}
        />

        {/* Time */}
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">Time *</span>
          <select
            value={formData.appointmentTime}
            onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })}
            className="input-standard"
          >
            {getValidHours(formData.appointmentDate).map((hour) => {
              const timeStr = `${String(hour).padStart(2, "0")}:00`;
              return (
                <option key={hour} value={timeStr}>{formatTime12Hr(timeStr)}</option>
              );
            })}
          </select>
        </label>

        {/* Dentist */}
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">Dentist (optional)</span>
          <select
            value={formData.dentistId}
            onChange={(e) => setFormData({ ...formData, dentistId: e.target.value })}
            className="input-standard"
          >
            <option value="">Select dentist</option>
            {dentists.map((d) => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </select>
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
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button onClick={handleCreate} className="save-btn">Create</button>
        </div>
      </div>
    </EditModal>
  );
}
