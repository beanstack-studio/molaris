"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { DentistRow, Patient } from "@/lib/types";
import { DatePickerField } from "@/components/DatePickerField";
import { EditModal } from "@/components/EditModal";

interface AppointmentModalProps {
  patients: Patient[];
  onConfirm: (date: string, time: string, patientId: string, dentistId?: string, concerns?: string) => void;
  onCancel: () => void;
  isSending: boolean;
}

const PH_HOLIDAYS_2026 = [
  "2026-01-01", "2026-02-10", "2026-02-25", "2026-04-09", "2026-04-10",
  "2026-04-14", "2026-06-12", "2026-08-21", "2026-11-01", "2026-11-30",
  "2026-12-08", "2026-12-25", "2026-12-30",
];

const formatTime12Hr = (h: number) => {
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:00 ${period}`;
};

export default function AppointmentModal({ patients, onConfirm, onCancel, isSending }: AppointmentModalProps) {
  const [patientId, setPatientId]           = useState(patients[0]?.id ?? "");
  const [appointmentDate, setAppointmentDate] = useState(new Date().toISOString().split("T")[0]);
  const [appointmentTime, setAppointmentTime] = useState("");
  const [dentistId, setDentistId]           = useState("");
  const [concerns, setConcerns]             = useState("");
  const [dentists, setDentists]             = useState<DentistRow[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);

  const MAX_PER_SLOT = 2;

  useEffect(() => {
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from("dentists")
          .select("id, full_name")
          .eq("is_active", true)
          .order("full_name", { ascending: true });
        if (err) throw err;
        setDentists(data ?? []);
      } catch {
        setError("Failed to load dentists");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Regenerate slots whenever date OR dentist changes
  useEffect(() => {
    if (appointmentDate) generateSlots(appointmentDate, dentistId);
  }, [appointmentDate, dentistId]);

  async function generateSlots(dateStr: string, forDentistId: string) {
    const dayOfWeek = new Date(dateStr + "T00:00:00").getDay();
    const isHoliday = PH_HOLIDAYS_2026.includes(dateStr);
    const isToday   = dateStr === new Date().toISOString().split("T")[0];
    const now       = new Date();
    const endHour   = dayOfWeek === 0 || isHoliday ? 12 : 17;

    const slots: string[] = [];
    for (let h = 8; h < endHour; h++) {
      if (h === 12) continue;
      const timeStr = `${String(h).padStart(2, "0")}:00`;
      if (isToday && new Date(dateStr + `T${timeStr}:00`) <= now) continue;
      let query = supabase
        .from("appointments")
        .select("id")
        .eq("appointment_date", dateStr)
        .eq("appointment_time", timeStr)
        .in("status", ["pending", "confirmed"])
        .is("deleted_at", null);
      // When dentist selected: 1 appointment per slot (can't double-book)
      // When no dentist: fall back to 2 total per slot
      if (forDentistId) query = query.eq("dentist_id", forDentistId);
      const { data } = await query;
      const maxPerSlot = forDentistId ? 1 : MAX_PER_SLOT;
      if ((data?.length ?? 0) < maxPerSlot) slots.push(timeStr);
    }
    setAvailableSlots(slots);
    if (appointmentTime && !slots.includes(appointmentTime)) setAppointmentTime("");
  }

  function handleConfirm() {
    if (!patientId)        { setError("Please select a patient"); return; }
    if (!appointmentTime)  { setError("Please select a time"); return; }
    if (!dentistId)        { setError("Please select a dentist"); return; }
    onConfirm(appointmentDate, appointmentTime, patientId, dentistId, concerns || undefined);
  }

  return (
    <EditModal open={true} title="Create Appointment" onClose={onCancel}>
      <div className="grid gap-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Dentist — first to enable per-dentist slot filtering */}
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">Dentist *</span>
          {loading ? (
            <p className="text-sm text-slate-400">Loading dentists…</p>
          ) : (
            <select value={dentistId} onChange={(e) => setDentistId(e.target.value)} className="input-standard">
              <option value="">Select dentist</option>
              {dentists.map((d) => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          )}
        </label>

        {/* Patient — always shown */}
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">Patient *</span>
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className="input-standard">
            <option value="">Select patient</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
        </label>

        {/* Date */}
        <DatePickerField
          label="Date *"
          value={appointmentDate}
          onChange={setAppointmentDate}
          min={new Date().toISOString().split("T")[0]}
        />

        {/* Time */}
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">Time *</span>
          {availableSlots.length === 0 ? (
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
              <p className="text-sm text-amber-700">No available slots for this date{dentistId ? " and dentist" : ""} (closed or fully booked)</p>
            </div>
          ) : (
            <select value={appointmentTime} onChange={(e) => setAppointmentTime(e.target.value)} className="input-standard">
              <option value="">Select time</option>
              {availableSlots.map((t) => {
                const h = parseInt(t.split(":")[0], 10);
                return <option key={t} value={t}>{formatTime12Hr(h)}</option>;
              })}
            </select>
          )}
          <span className="text-xs text-slate-400">Mon–Sat: 8am–5pm · Sun/Holidays: 8am–12nn · Lunch closed 12–1pm</span>
        </label>

        {/* Concerns */}
        <label className="grid gap-1 text-sm">
          <span className="text-slate-700">Concern / reason (optional)</span>
          <textarea
            value={concerns}
            onChange={(e) => setConcerns(e.target.value)}
            placeholder="e.g., Toothache, cleaning, checkup…"
            className="input-standard resize-none"
            rows={3}
          />
        </label>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button onClick={onCancel} disabled={isSending} className="cancel-btn">Cancel</button>
          <button onClick={handleConfirm} disabled={isSending || !appointmentTime} className="save-btn">
            {isSending ? "Creating…" : "Confirm"}
          </button>
        </div>
      </div>
    </EditModal>
  );
}
