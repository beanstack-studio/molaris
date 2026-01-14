"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Appointment, Patient, DentistRow } from "@/lib/types";

interface AppointmentWithRelations extends Appointment {
  patients?: Patient;
  dentists?: DentistRow;
}

// PH holidays 2026
const PH_HOLIDAYS_2026 = [
  "2026-01-01", "2026-02-10", "2026-02-25", "2026-04-09", "2026-04-10",
  "2026-04-14", "2026-06-12", "2026-08-21", "2026-11-01", "2026-11-30",
  "2026-12-08", "2026-12-25", "2026-12-30",
];

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dentists, setDentists] = useState<DentistRow[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [formData, setFormData] = useState({
    patientId: "",
    appointmentDate: new Date().toISOString().split("T")[0],
    appointmentTime: "08:00",
    dentistId: "",
    concerns: "",
  });

  useEffect(() => {
    Promise.all([loadAppointments(), loadDentists(), loadPatients()]).finally(
      () => setLoading(false)
    );
  }, []);

  const loadAppointments = async () => {
    try {
      const { data, error: err } = await supabase
        .from("appointments")
        .select("*, patients(id, full_name, phone), dentists(id, full_name)")
        .is("deleted_at", null)
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true });

      if (err) throw err;
      setAppointments(data as any);
    } catch (err) {
      console.error("Error loading appointments:", err);
      setError("Failed to load appointments");
    }
  };

  const loadDentists = async () => {
    try {
      const { data, error: err } = await supabase
        .from("dentists")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");

      if (err) throw err;
      setDentists(data || []);
    } catch (err) {
      console.error("Error loading dentists:", err);
    }
  };

  const loadPatients = async () => {
    try {
      const { data, error: err } = await supabase
        .from("patients")
        .select("id, full_name, first_name, last_name, phone, birth_date, address, occupation, email, gender, notes")
        .order("full_name");

      if (err) throw err;
      setPatients((data || []) as Patient[]);
    } catch (err) {
      console.error("Error loading patients:", err);
    }
  };

  const handleCreateAppointment = async () => {
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
        concerns: formData.concerns || null,
        status: "confirmed",
        notes: "Created manually",
      });

      if (err) throw err;

      setShowCreateModal(false);
      setFormData({
        patientId: "",
        appointmentDate: new Date().toISOString().split("T")[0],
        appointmentTime: "08:00",
        dentistId: "",
        concerns: "",
      });
      await loadAppointments();
    } catch (err) {
      console.error("Error creating appointment:", err);
      setError("Failed to create appointment");
    }
  };

  const getDayOfWeek = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[date.getDay()];
  };

  const isOfficeHours = (dateStr: string, timeStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const dayOfWeek = date.getDay();
    const isHoliday = PH_HOLIDAYS_2026.includes(dateStr);

    let validHours = dayOfWeek === 0 || isHoliday ? [8, 9, 10, 11] : [8, 9, 10, 11, 12, 14, 15, 16, 17];

    const hour = parseInt(timeStr.split(":")[0]);
    return validHours.includes(hour);
  };

  const appointmentsByDate = appointments.reduce((acc, apt) => {
    const date = apt.appointment_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(apt);
    return acc;
  }, {} as Record<string, AppointmentWithRelations[]>);

  const datesList = Object.keys(appointmentsByDate).sort();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-600">Loading appointments...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Appointments</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          + New Appointment
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* View mode toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setViewMode("list")}
          className={`px-4 py-2 rounded-lg transition ${
            viewMode === "list"
              ? "bg-blue-100 text-blue-700 font-medium"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          List View
        </button>
        <button
          onClick={() => setViewMode("calendar")}
          className={`px-4 py-2 rounded-lg transition ${
            viewMode === "calendar"
              ? "bg-blue-100 text-blue-700 font-medium"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Calendar View
        </button>
      </div>

      {/* List View */}
      {viewMode === "list" && (
        <div className="space-y-4">
          {datesList.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <p className="text-slate-600">No appointments scheduled</p>
            </div>
          ) : (
            datesList.map((date) => (
              <div key={date} className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-4 py-3 font-semibold text-slate-900">
                  {getDayOfWeek(date)}, {new Date(date + "T00:00:00").toLocaleDateString()}
                </div>
                <div className="divide-y">
                  {appointmentsByDate[date].map((apt) => (
                    <div key={apt.id} className="p-4 hover:bg-slate-50 transition">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-slate-900">
                              {apt.appointment_time}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              apt.status === "confirmed"
                                ? "bg-green-100 text-green-800"
                                : apt.status === "completed"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}>
                              {apt.status}
                            </span>
                          </div>
                          <p className="font-semibold text-slate-900">
                            {apt.patients?.full_name || "Unknown Patient"}
                          </p>
                          <p className="text-sm text-slate-600">
                            📞 {apt.patients?.phone || "No phone"}
                          </p>
                          {apt.dentists && (
                            <p className="text-sm text-slate-600">
                              🦷 Dr. {apt.dentists.full_name}
                            </p>
                          )}
                          {apt.concerns && (
                            <p className="text-sm text-slate-700 mt-2 italic">
                              Concern: {apt.concerns}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-slate-900">
              {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium"
              >
                ← Prev
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition font-medium"
              >
                Today
              </button>
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium"
              >
                Next →
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-8">
            {/* Day headers */}
            {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => (
              <div key={day} className="text-center font-bold text-slate-700 py-3 bg-slate-100 rounded">
                {day.slice(0, 3)}
              </div>
            ))}

            {/* Calendar days */}
            {Array.from({ length: 42 }, (_, i) => {
              const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
              const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
              const dayNum = i - firstDay + 1;
              const isCurrentMonth = dayNum > 0 && dayNum <= daysInMonth;
              const date = isCurrentMonth
                ? new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNum)
                : null;
              const dateStr = date ? date.toISOString().split("T")[0] : null;
              const dayAppointments = dateStr ? appointmentsByDate[dateStr] || [] : [];
              const isToday = dateStr === new Date().toISOString().split("T")[0];

              return (
                <div
                  key={i}
                  onClick={() => dateStr && setSelectedDate(selectedDate === dateStr ? null : dateStr)}
                  className={`min-h-32 p-2 rounded border-2 cursor-pointer transition ${
                    isCurrentMonth
                      ? selectedDate === dateStr
                        ? "bg-blue-100 border-blue-500 shadow-md"
                        : isToday
                        ? "bg-green-50 border-green-300"
                        : dayAppointments.length > 0
                        ? "bg-amber-50 border-amber-300 hover:border-amber-400"
                        : "bg-white border-slate-200 hover:border-slate-400"
                      : "bg-slate-50 border-slate-100"
                  }`}
                >
                  <div className={`text-sm font-bold mb-1 ${
                    isCurrentMonth
                      ? isToday
                        ? "text-green-700"
                        : "text-slate-900"
                      : "text-slate-400"
                  }`}>
                    {isCurrentMonth ? dayNum : ""}
                  </div>
                  
                  {dayAppointments.length > 0 && (
                    <div className="space-y-1">
                      {dayAppointments.slice(0, 3).map((apt) => (
                        <div key={apt.id} className="text-xs bg-blue-500 text-white p-1 rounded font-medium truncate">
                          {apt.appointment_time}
                        </div>
                      ))}
                      {dayAppointments.length > 3 && (
                        <div className="text-xs text-blue-600 font-semibold px-1">
                          +{dayAppointments.length - 3} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected date details */}
          {selectedDate && appointmentsByDate[selectedDate] && (
            <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg">
              <h3 className="font-bold text-lg text-slate-900 mb-4">
                📅 {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric"
                })}
              </h3>
              <div className="space-y-3">
                {appointmentsByDate[selectedDate].map((apt) => (
                  <div key={apt.id} className="bg-white p-4 rounded-lg border border-blue-200 hover:shadow-md transition">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-lg text-slate-900">{apt.appointment_time}</p>
                        <p className="font-semibold text-slate-800">{apt.patients?.full_name}</p>
                        <p className="text-sm text-slate-600">📞 {apt.patients?.phone}</p>
                        {apt.dentists && <p className="text-sm text-slate-600">🦷 Dr. {apt.dentists.full_name}</p>}
                        {apt.concerns && <p className="text-sm text-slate-700 mt-2 italic bg-yellow-50 p-2 rounded">💭 {apt.concerns}</p>}
                      </div>
                      <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                        apt.status === "confirmed"
                          ? "bg-green-100 text-green-800"
                          : apt.status === "completed"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {apt.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Appointment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Create Appointment</h3>

            <div className="space-y-4">
              {/* Patient */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Patient *
                </label>
                <select
                  value={formData.patientId}
                  onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={formData.appointmentDate}
                  onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Time */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Time *
                </label>
                <select
                  value={formData.appointmentTime}
                  onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[8, 9, 10, 11, 14, 15, 16, 17].map((hour) => (
                    <option key={hour} value={`${String(hour).padStart(2, "0")}:00`}>
                      {String(hour).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </div>

              {/* Dentist */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Dentist (Optional)
                </label>
                <select
                  value={formData.dentistId}
                  onChange={(e) => setFormData({ ...formData, dentistId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select dentist --</option>
                  {dentists.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Concerns */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Concern / Reason for Visit (Optional)
                </label>
                <textarea
                  value={formData.concerns}
                  onChange={(e) => setFormData({ ...formData, concerns: e.target.value })}
                  placeholder="e.g., Toothache, cleaning, checkup..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAppointment}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
