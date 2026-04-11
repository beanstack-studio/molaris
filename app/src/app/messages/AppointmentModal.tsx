"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { DentistRow } from "@/lib/types";
import { DatePickerField } from "@/components/DatePickerField";

interface AppointmentModalProps {
  patientId: string;
  onConfirm: (date: string, time: string, dentistId?: string, concerns?: string) => void;
  onCancel: () => void;
  isSending: boolean;
}

// Kalibo-Aklan PH holidays (2026)
const PH_HOLIDAYS_2026 = [
  "2026-01-01", // New Year
  "2026-02-10", // EDSA Revolution
  "2026-02-25", // EDSA Revolution (continuation)
  "2026-04-09", // Araw ng Kagitingan
  "2026-04-10", // Good Friday
  "2026-04-14", // Flores de Mayo
  "2026-06-12", // Independence Day
  "2026-08-21", // Ninoy Aquino Day
  "2026-11-01", // All Saints Day
  "2026-11-30", // Bonifacio Day
  "2026-12-08", // Feast of Immaculate Conception
  "2026-12-25", // Christmas Day
  "2026-12-30", // Rizal Day
];

export default function AppointmentModal({
  patientId,
  onConfirm,
  onCancel,
  isSending,
}: AppointmentModalProps) {
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [dentistId, setDentistId] = useState("");
  const [concerns, setConcerns] = useState("");
  const [dentists, setDentists] = useState<DentistRow[]>([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const MAX_DENTISTS_PER_SLOT = 2;

  useEffect(() => {
    loadDentists();
    // Set minimum date to today
    const today = new Date().toISOString().split("T")[0];
    setAppointmentDate(today);
    generateTimeSlots(today);
  }, []);

  // Regenerate time slots when date changes
  useEffect(() => {
    if (appointmentDate) {
      generateTimeSlots(appointmentDate);
    }
  }, [appointmentDate]);

  const getBookedSlotCount = async (dateStr: string, timeStr: string): Promise<number> => {
    const { data, error: err } = await supabase
      .from("appointments")
      .select("id")
      .eq("appointment_date", dateStr)
      .eq("appointment_time", timeStr)
      .in("status", ["pending", "confirmed"])
      .is("deleted_at", null);

    if (err) {
      console.error("Error checking booked slots:", err);
      return 0;
    }
    return data?.length || 0;
  };

  const loadDentists = async () => {
    try {
      const { data, error: err } = await supabase
        .from("dentists")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      if (err) throw err;
      setDentists(data || []);
    } catch (err) {
      console.error("Error loading dentists:", err);
      setError("Failed to load dentists");
    } finally {
      setLoading(false);
    }
  };

  const generateTimeSlots = async (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    const isHoliday = PH_HOLIDAYS_2026.includes(dateStr);
    const isToday = dateStr === new Date().toISOString().split("T")[0];
    const now = new Date();

    let startHour = 8;
    let endHour = 17; // 5 PM

    // Sunday or Holiday: 8am-12nn
    if (dayOfWeek === 0 || isHoliday) {
      endHour = 12;
    }

    const slots: string[] = [];

    for (let hour = startHour; hour < endHour; hour++) {
      // Skip lunch break 12-1pm
      if (hour === 12) continue;

      const timeStr = `${String(hour).padStart(2, "0")}:00`;

      // Skip past times for today
      if (isToday) {
        const slotTime = new Date(dateStr + `T${timeStr}:00`);
        if (slotTime <= now) continue;
      }

      // Check if slot is fully booked (2 dentists max per slot)
      const bookedCount = await getBookedSlotCount(dateStr, timeStr);
      if (bookedCount < MAX_DENTISTS_PER_SLOT) {
        slots.push(timeStr);
      }
    }

    setAvailableTimeSlots(slots);
    // Reset time selection when date changes
    if (appointmentTime && !slots.includes(appointmentTime)) {
      setAppointmentTime("");
    }
  };

  const handleConfirm = () => {
    if (!appointmentDate || !appointmentTime) {
      setError("Please select date and time");
      return;
    }
    onConfirm(appointmentDate, appointmentTime, dentistId || undefined, concerns || undefined);
  };

  const getMinDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  return (
    <div className="modal-container">
      <div className="modal-wrapper">
        <h3 className="modal-heading">Create Appointment</h3>

        {error && (
          <div className="error-msg">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Date */}
          <DatePickerField
            label="Date"
            value={appointmentDate}
            onChange={setAppointmentDate}
            min={getMinDate()}
          />

          {/* Time */}
          <div>
            <label className="text-label-block">
              Time (Hourly Slots)
            </label>
            {availableTimeSlots.length === 0 ? (
              <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-sm">
                No available slots for this date (closed or only lunch hours)
              </div>
            ) : (
              <select
                value={appointmentTime}
                onChange={(e) => setAppointmentTime(e.target.value)}
                className="input-full"
              >
                <option value="">-- Select time --</option>
                {availableTimeSlots.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            )}
            <p className="text-caption mt-1">
              Mon-Sat: 8am-5pm | Sun/Holidays: 8am-12nn | Lunch: 12-1pm (closed)
            </p>
          </div>

          {/* Dentist */}
          <div>
            <label className="text-label-block">
              Dentist (Optional)
            </label>
            {loading ? (
              <div className="p-2 text-slate-600 text-sm">Loading dentists...</div>
            ) : (
              <select
                value={dentistId}
                onChange={(e) => setDentistId(e.target.value)}
                className="input-full"
              >
                <option value="">-- Select dentist --</option>
                {dentists.map((dentist) => (
                  <option key={dentist.id} value={dentist.id}>
                    {dentist.full_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Concerns */}
          <div>
            <label className="text-label-block">
              Concern / Reason for Visit (Optional)
            </label>
            <textarea
              value={concerns}
              onChange={(e) => setConcerns(e.target.value)}
              placeholder="e.g., Toothache, cleaning, checkup, emergency..."
              className="form-textarea-full-focus"
              rows={3}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="button-group">
          <button
            onClick={onCancel}
            disabled={isSending}
            className="flex-1 cancel-btn"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSending || availableTimeSlots.length === 0}
            className="flex-1 save-btn"
          >
            {isSending ? "Creating..." : "Confirm & Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
