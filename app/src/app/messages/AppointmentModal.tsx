"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { DentistRow } from "@/lib/types";

interface AppointmentModalProps {
  patientId: string;
  onConfirm: (date: string, time: string, dentistId?: string) => void;
  onCancel: () => void;
  isSending: boolean;
}

export default function AppointmentModal({
  patientId,
  onConfirm,
  onCancel,
  isSending,
}: AppointmentModalProps) {
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [dentistId, setDentistId] = useState("");
  const [dentists, setDentists] = useState<DentistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDentists();
    // Set minimum date to today
    const today = new Date().toISOString().split("T")[0];
    setAppointmentDate(today);
  }, []);

  const loadDentists = async () => {
    try {
      const { data, error: err } = await supabase
        .from("staff")
        .select("id, full_name")
        .eq("role", "dentist")
        .is("deleted_at", null)
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

  const handleConfirm = () => {
    if (!appointmentDate || !appointmentTime) {
      setError("Please select date and time");
      return;
    }
    onConfirm(appointmentDate, appointmentTime, dentistId || undefined);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Create Appointment</h3>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Time */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Time
            </label>
            <input
              type="time"
              value={appointmentTime}
              onChange={(e) => setAppointmentTime(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Dentist */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Dentist (Optional)
            </label>
            {loading ? (
              <div className="p-2 text-slate-600 text-sm">Loading dentists...</div>
            ) : (
              <select
                value={dentistId}
                onChange={(e) => setDentistId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={isSending}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSending}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {isSending ? "Creating..." : "Confirm & Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
