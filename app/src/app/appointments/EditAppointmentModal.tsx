"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { DatePickerField } from "@/components/DatePickerField";
import { VISIT_REASONS, VisitReasonType } from "@/lib/visitReasonHelpers";
import { EditModal } from "@/components/EditModal";
import type { Patient, DentistRow, Appointment } from "@/lib/types";

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

interface AppointmentWithRelations extends Appointment {
  patients?: Patient;
  dentists?: DentistRow;
}

interface Props {
  appointment: AppointmentWithRelations | null;
  onClose: () => void;
  onUpdated: () => void;
  dentists: DentistRow[];
  patients: Patient[];
  sundayEndHour: number;
}

export function EditAppointmentModal({ appointment, onClose, onUpdated, dentists, patients, sundayEndHour }: Props) {
  const [editFormData, setEditFormData] = useState({
    patientId: "",
    appointmentDate: "",
    appointmentTime: "",
    dentistId: "",
    concernType: "" as VisitReasonType | "",
    status: "confirmed",
  });
  const [patientSearchInput, setPatientSearchInput] = useState("");
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [isOrthoPatient, setIsOrthoPatient] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);

  async function checkOrthoStatus(patientId: string) {
    if (!patientId) { setIsOrthoPatient(false); return; }
    const { data } = await supabase
      .from("ortho_cases")
      .select("id")
      .eq("patient_id", patientId)
      .limit(1);
    setIsOrthoPatient((data?.length ?? 0) > 0);
  }

  useEffect(() => {
    if (appointment) {
      setEditFormData({
        patientId: appointment.patient_id,
        appointmentDate: appointment.appointment_date,
        appointmentTime: appointment.appointment_time,
        dentistId: appointment.dentist_id || "",
        concernType: (appointment as any).concern_type || "",
        status: appointment.status,
      });
      setDeleteConfirmText("");
      setError(null);
      setShowPatientDropdown(false);
      checkOrthoStatus(appointment.patient_id);

      // Pre-populate patient name from the joined relation or from the patients list
      const relName = appointment.patients
        ? (appointment.patients.full_name || `${(appointment.patients as any).first_name ?? ""} ${(appointment.patients as any).last_name ?? ""}`.trim())
        : "";
      if (relName) {
        setPatientSearchInput(relName);
      } else {
        // Fallback: look up in the patients prop array
        const found = patients.find((p) => p.id === appointment.patient_id);
        if (found) {
          const name = found.full_name || `${(found as any).first_name ?? ""} ${(found as any).last_name ?? ""}`.trim();
          setPatientSearchInput(name);
        } else {
          setPatientSearchInput("");
        }
      }
    }
  }, [appointment]);

  async function handleUpdate() {
    if (!appointment) return;
    try {
      const { error: err } = await supabase
        .from("appointments")
        .update({
          patient_id: editFormData.patientId,
          appointment_date: editFormData.appointmentDate,
          appointment_time: editFormData.appointmentTime,
          dentist_id: editFormData.dentistId || null,
          concern_type: editFormData.concernType || null,
          status: editFormData.status,
        })
        .eq("id", appointment.id);
      if (err) throw err;
      onUpdated();
      onClose();
    } catch (err) {
      console.error("Error updating appointment:", err);
      setError("Failed to update appointment");
    }
  }

  async function handleDelete() {
    if (!appointment) return;
    if (deleteConfirmText.toUpperCase() !== "DELETE") {
      setError("Type DELETE to confirm");
      return;
    }
    try {
      const { error: err } = await supabase
        .from("appointments")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", appointment.id);
      if (err) throw err;
      onUpdated();
      onClose();
    } catch (err) {
      console.error("Error deleting appointment:", err);
      setError("Failed to delete appointment");
    }
  }

  function getValidHours(dateStr: string) {
    const dayOfWeek = new Date(dateStr + "T00:00:00").getDay();
    const isHoliday = PH_HOLIDAYS_2026.includes(dateStr);
    return (dayOfWeek === 0 || isHoliday)
      ? Array.from({ length: sundayEndHour - 7 }, (_, i) => 8 + i)
      : [8, 9, 10, 11, 12, 14, 15, 16];
  }

  const filteredPatients = (() => {
    if (patientSearchInput.length < 3) return [];
    const q = patientSearchInput.toLowerCase();
    return patients
      .filter((p) => {
        const full = (p.full_name ?? "").toLowerCase();
        const first = ((p as any).first_name ?? "").toLowerCase();
        const last = ((p as any).last_name ?? "").toLowerCase();
        return full.includes(q) || first.includes(q) || last.includes(q);
      })
      .slice(0, 5);
  })();

  return (
    <EditModal open={!!appointment} title="Edit appointment" onClose={onClose}>
      <div className="grid gap-4">
        {/* Patient - Searchable */}
        <div className="relative">
          <label className="grid gap-1 text-sm">
            <span className="text-slate-700">Patient</span>
            <input
              type="text"
              value={patientSearchInput}
              onChange={(e) => {
                setPatientSearchInput(e.target.value);
                setShowPatientDropdown(e.target.value.length >= 3);
              }}
              onBlur={() => setTimeout(() => setShowPatientDropdown(false), 200)}
              className="input-standard"
              placeholder="Search patient name"
            />
          </label>
          {showPatientDropdown && filteredPatients.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-violet-100 rounded-lg shadow-lg z-10 overflow-hidden">
              {filteredPatients.map((p) => {
                const displayName = p.full_name || `${(p as any).first_name ?? ""} ${(p as any).last_name ?? ""}`.trim();
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setEditFormData({ ...editFormData, patientId: p.id, concernType: "" });
                      setPatientSearchInput(displayName);
                      setShowPatientDropdown(false);
                      checkOrthoStatus(p.id);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-violet-50 text-sm text-slate-700"
                  >
                    {displayName}
                  </button>
                );
              })}
              {patientSearchInput.length >= 3 && filteredPatients.length === 0 && (
                <div className="px-3 py-2 text-sm text-slate-500">No matches for "{patientSearchInput}"</div>
              )}
            </div>
          )}
          {showPatientDropdown && patientSearchInput.length >= 3 && filteredPatients.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-violet-100 rounded-lg shadow-lg z-10 overflow-hidden">
              <div className="px-3 py-2 text-sm text-slate-500">No matches for "{patientSearchInput}"</div>
            </div>
          )}
        </div>

        {/* Date */}
        <DatePickerField
          label="Date"
          value={editFormData.appointmentDate}
          onChange={(val) => setEditFormData({ ...editFormData, appointmentDate: val })}
          inputRef={dateRef}
          min={new Date().toISOString().split("T")[0]}
        />

        {/* Time */}
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">Time</span>
          <select
            value={editFormData.appointmentTime}
            onChange={(e) => setEditFormData({ ...editFormData, appointmentTime: e.target.value })}
            className="input-standard"
          >
            {getValidHours(editFormData.appointmentDate).map((hour) => {
              const timeStr = `${String(hour).padStart(2, "0")}:00`;
              return <option key={hour} value={timeStr}>{formatTime12Hr(timeStr)}</option>;
            })}
          </select>
        </label>

        {/* Dentist */}
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">Dentist (optional)</span>
          <select
            value={editFormData.dentistId}
            onChange={(e) => setEditFormData({ ...editFormData, dentistId: e.target.value })}
            className="input-standard"
          >
            <option value="">Select dentist</option>
            {dentists.map((d) => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </select>
        </label>

        {/* Status */}
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">Status</span>
          <select
            value={editFormData.status}
            onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
            className="input-standard"
          >
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>

        {/* Concern Type */}
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">Concern / reason (optional)</span>
          <select
            value={editFormData.concernType}
            onChange={(e) => setEditFormData({ ...editFormData, concernType: e.target.value as VisitReasonType | "" })}
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
          {!isOrthoPatient && (
            <span className="text-xs text-slate-400">Ortho reasons are only available for patients with an ortho case.</span>
          )}
        </label>

        {/* Delete Section */}
        <div className="delete-confirmation">
          <div className="delete-confirmation-title">Delete appointment?</div>
          <div className="delete-confirmation-hint">
            Type <span className="delete-confirmation-code">DELETE</span> to confirm deletion
          </div>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="DELETE"
            className="delete-confirmation-input"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="modal-actions">
          <button
            onClick={handleDelete}
            disabled={deleteConfirmText.toUpperCase() !== "DELETE"}
            className="delete-btn"
          >
            Delete
          </button>
          <div className="modal-actions-right">
            <button onClick={onClose} className="cancel-btn">Close</button>
            <button onClick={handleUpdate} className="save-btn">Save</button>
          </div>
        </div>
      </div>
    </EditModal>
  );
}
