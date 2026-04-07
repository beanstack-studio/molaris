"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { DatePickerField } from "@/components/DatePickerField";
import { VISIT_REASONS, VisitReasonType } from "@/lib/visitReasonHelpers";
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
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);

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

  if (!appointment) return null;

  return (
    <div
      className="modal-container"
      onDoubleClick={onClose}
    >
      <div
        className="modal-panel-raised"
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <h3 className="modal-heading">Edit Appointment</h3>

        <div className="space-y-4">
          {/* Patient */}
          <div>
            <label className="input-label">Patient</label>
            <select
              value={editFormData.patientId}
              onChange={(e) => setEditFormData({ ...editFormData, patientId: e.target.value })}
              className="input-full"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <DatePickerField
            label="Date"
            value={editFormData.appointmentDate}
            onChange={(val) => setEditFormData({ ...editFormData, appointmentDate: val })}
            inputRef={dateRef}
            variant="case-modal"
          />

          {/* Time */}
          <div>
            <label className="input-label">Time</label>
            <select
              value={editFormData.appointmentTime}
              onChange={(e) => setEditFormData({ ...editFormData, appointmentTime: e.target.value })}
              className="input-full"
            >
              {getValidHours(editFormData.appointmentDate).map((hour) => {
                const timeStr = `${String(hour).padStart(2, "0")}:00`;
                return (
                  <option key={hour} value={timeStr}>{formatTime12Hr(timeStr)}</option>
                );
              })}
            </select>
          </div>

          {/* Dentist */}
          <div>
            <label className="input-label">Dentist (Optional)</label>
            <select
              value={editFormData.dentistId}
              onChange={(e) => setEditFormData({ ...editFormData, dentistId: e.target.value })}
              className="input-full"
            >
              <option value="">-- Select dentist --</option>
              {dentists.map((d) => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="input-label">Status</label>
            <select
              value={editFormData.status}
              onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
              className="input-full"
            >
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Concern Type */}
          <div>
            <label className="input-label">
              Concern / Reason (Optional)
            </label>
            <select
              value={editFormData.concernType}
              onChange={(e) => setEditFormData({ ...editFormData, concernType: e.target.value as VisitReasonType | "" })}
              className="input-full"
            >
              <option value="">-- Select a reason --</option>
              {VISIT_REASONS.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.reasons.map((reason) => (
                    <option key={reason.value} value={reason.value}>{reason.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

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
            <div className="p-3 bg-red-100 text-red-800 rounded-lg text-sm">{error}</div>
          )}
        </div>

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
    </div>
  );
}
