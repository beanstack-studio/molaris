"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatDateStandard } from "@/lib/helpers";
import { VISIT_REASONS, VisitReasonType, getOrthoOnlyReasons, getVisitReasonLabel, isOrthoReason } from "@/lib/visitReasonHelpers";
import { Appointment, Patient, DentistRow } from "@/lib/types";
import { DatePickerField } from "@/components/DatePickerField";

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

const PH_HOLIDAY_NAMES: Record<string, string> = {
  "2026-01-01": "New Year's Day",
  "2026-02-10": "EDSA Revolution Day",
  "2026-02-25": "EDSA Revolution Anniversary",
  "2026-04-09": "Day of Valor",
  "2026-04-10": "Good Friday",
  "2026-04-14": "Araw ng Kagitingan",
  "2026-06-12": "Independence Day",
  "2026-08-21": "Ninoy Aquino Day",
  "2026-11-01": "All Saints' Day",
  "2026-11-30": "Bonifacio Day",
  "2026-12-08": "Feast of the Immaculate Conception",
  "2026-12-25": "Christmas Day",
  "2026-12-30": "Rizal Day",
};

const formatTime12Hr = (time24: string): string => {
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dentists, setDentists] = useState<DentistRow[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithRelations | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [patientSearchInput, setPatientSearchInput] = useState("");
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [sundayEndHour, setSundayEndHour] = useState(11);
  const createAppointmentDateRef = useRef<HTMLInputElement | null>(null);
  const editAppointmentDateRef = useRef<HTMLInputElement | null>(null);
  const [editFormData, setEditFormData] = useState({
    patientId: "",
    appointmentDate: "",
    appointmentTime: "",
    dentistId: "",
    concernType: "" as VisitReasonType | "",
    status: "confirmed",
  });

  const [formData, setFormData] = useState({
    patientId: "",
    appointmentDate: new Date().toISOString().split("T")[0],
    appointmentTime: "08:00",
    dentistId: "",
    concernType: "" as VisitReasonType | "",
  });

  useEffect(() => {
    Promise.all([loadAppointments(), loadDentists(), loadPatients(), loadClinicHours()]).finally(
      () => setLoading(false)
    );
  }, []);

  const loadClinicHours = async () => {
    try {
      const { data, error: err } = await supabase
        .from("clinic_profile")
        .select("sunday_end_hour")
        .limit(1)
        .single();

      if (err) {
        console.warn("Could not load clinic hours (table may be empty):", err.message);
        return;
      }
      if (data?.sunday_end_hour) {
        setSundayEndHour(data.sunday_end_hour);
      }
    } catch (err) {
      console.warn("Error fetching clinic hours:", err);
    }
  };

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
      let allPatients: { id: string; full_name: string }[] = [];
      let offset = 0;
      const pageSize = 10000;
      let hasMore = true;

      // Fetch all patients in batches of 10000
      while (hasMore) {
        const { data, error: err, count } = await supabase
          .from('patients')
          .select('id, full_name', { count: 'exact' })
          .order('full_name')
          .range(offset, offset + pageSize - 1);

        if (err) {
          console.error('Error loading patients:', err);
          throw err;
        }

        if (!data || data.length === 0) {
          hasMore = false;
          console.log(`Pagination batch ${Math.floor(offset / pageSize)}: No data, stopping`);
        } else {
          console.log(`Pagination batch ${Math.floor(offset / pageSize)}: Fetched ${data.length} records (offset: ${offset})`);
          allPatients = [...allPatients, ...data];
          offset += data.length; // Increment by actual records returned, not pageSize
          hasMore = data.length > 0; // Continue if we got any data
        }
      }

      setPatients((allPatients || []) as Patient[]);
      console.log(`Loaded ${allPatients.length} patients from database`);
    } catch (err) {
      console.error('Failed to load patients:', err);
      setPatients([]);
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
        concern_type: formData.concernType || null,
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
        concernType: "",
      });
      await loadAppointments();
    } catch (err) {
      console.error("Error creating appointment:", err);
      setError("Failed to create appointment");
    }
  };

  const openEditModal = (apt: AppointmentWithRelations) => {
    setEditingAppointment(apt);
    setEditFormData({
      patientId: apt.patient_id,
      appointmentDate: apt.appointment_date,
      appointmentTime: apt.appointment_time,
      dentistId: apt.dentist_id || "",
      concernType: (apt as any).concern_type || "",
      status: apt.status,
    });
    setDeleteConfirmText("");
  };

  const closeEditModal = () => {
    setEditingAppointment(null);
    setDeleteConfirmText("");
  };

  const handleUpdateAppointment = async () => {
    if (!editingAppointment) return;
    
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
        .eq("id", editingAppointment.id);

      if (err) throw err;

      await loadAppointments();
      closeEditModal();
    } catch (err) {
      console.error("Error updating appointment:", err);
      setError("Failed to update appointment");
    }
  };

  const handleDeleteAppointment = async () => {
    if (!editingAppointment) return;
    if (deleteConfirmText.toUpperCase() !== "DELETE") {
      setError("Type DELETE to confirm");
      return;
    }

    try {
      const { error: err } = await supabase
        .from("appointments")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", editingAppointment.id);

      if (err) throw err;

      await loadAppointments();
      closeEditModal();
    } catch (err) {
      console.error("Error deleting appointment:", err);
      setError("Failed to delete appointment");
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

    let validHours = dayOfWeek === 0 || isHoliday 
      ? Array.from({ length: sundayEndHour - 7 }, (_, i) => 8 + i)
      : [8, 9, 10, 11, 12, 14, 15, 16, 17];

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
    <main className="app-section">
      <div className="app-section-header">
        <div>
          <div className="app-section-title">Appointments</div>
          <div className="app-section-subtitle">Manage patient appointments and calendar</div>
        </div>

        <button className="btn btn-primary" onClick={() => {
          setShowCreateModal(true);
          setPatientSearchInput("");
          setFormData({
            patientId: "",
            appointmentDate: selectedDate || new Date().toISOString().split("T")[0],
            appointmentTime: "08:00",
            dentistId: "",
            concernType: "",
          });
        }}>
          + New Appointment
        </button>
      </div>

      <div className="app-section-body">
        <div className="p-4">
          <div className="grid gap-4">
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* View mode toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("list")}
                className={`px-4 py-2 rounded-lg transition text-sm ${
                  viewMode === "list"
                    ? "bg-blue-100 text-blue-700 font-medium"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                List View
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`px-4 py-2 rounded-lg transition text-sm ${
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
        <div className="rounded-lg border border-slate-200 p-4 space-y-4">
          {datesList.length === 0 ? (
            <div className="text-center py-12 bg-slate-100 rounded-lg">
              <p className="text-slate-600">No appointments scheduled</p>
            </div>
          ) : (
            datesList.map((date) => (
              <div key={date} className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-indigo-50 border-b border-indigo-200 px-4 py-3 font-semibold text-indigo-900">
                  {getDayOfWeek(date)}, {new Date(date + "T00:00:00").toLocaleDateString()}
                </div>
                <div className="divide-y divide-slate-200">
                  {appointmentsByDate[date].map((apt) => (
                    <div key={apt.id} className="p-4 bg-white hover:bg-slate-50 transition">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-slate-900">
                              {formatTime12Hr(apt.appointment_time)}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded font-medium ${
                              apt.status === "confirmed"
                                ? "bg-emerald-100 text-emerald-800"
                                : apt.status === "completed"
                                ? "bg-indigo-100 text-indigo-800"
                                : "bg-amber-100 text-amber-800"
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
                          {(apt as any).concern_type && (
                            <p className="text-sm text-slate-700 mt-2 italic bg-amber-50 p-2 rounded">
                              📋 {getVisitReasonLabel((apt as any).concern_type)}
                            </p>
                          )}
                          {apt.concerns && !(apt as any).concern_type && (
                            <p className="text-sm text-slate-700 mt-2 italic bg-amber-50 p-2 rounded">
                              📋 {apt.concerns}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => openEditModal(apt)}
                          className="text-xs px-3 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                        >
                          Edit
                        </button>
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
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
            <h2 className="text-xl font-bold text-slate-900">
              {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                className="px-3 py-2 md:px-4 md:py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm"
              >
                ← Prev
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-2 md:px-4 md:py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition font-medium text-sm"
              >
                Today
              </button>
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                className="px-3 py-2 md:px-4 md:py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm"
              >
                Next →
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-0.5 md:gap-1 mb-8">
            {/* Day headers */}
            {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => (
              <div key={day} className="text-center font-bold text-slate-700 py-2 md:py-3 bg-slate-100 rounded text-xs md:text-sm">
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
              const isPast = dateStr && new Date(dateStr) < new Date() && !isToday;
              const isHoliday = dateStr ? PH_HOLIDAYS_2026.includes(dateStr) : false;

              return (
                <div
                  key={i}
                  onClick={() => dateStr && !isPast && setSelectedDate(selectedDate === dateStr ? null : dateStr)}
                  className={`min-h-20 md:min-h-32 p-1 md:p-2 rounded border-2 transition text-xs md:text-sm ${
                    isCurrentMonth
                      ? isPast
                        ? "bg-slate-100 border-slate-300 text-slate-500 cursor-not-allowed opacity-60"
                        : selectedDate === dateStr
                        ? "bg-indigo-100 border-indigo-500 shadow-md cursor-pointer"
                        : isHoliday
                        ? "bg-red-50 border-red-400 cursor-pointer"
                        : isToday
                        ? "bg-emerald-50 border-emerald-300 cursor-pointer"
                        : dayAppointments.length > 0
                        ? "bg-orange-50 border-orange-300 hover:border-orange-400 cursor-pointer"
                        : "bg-white border-slate-200 hover:border-slate-400 cursor-pointer"
                      : "bg-slate-50 border-slate-100"
                  }`}
                >
                  <div className={`text-xs md:text-sm font-bold mb-0.5 md:mb-1 flex justify-between items-center ${
                    isCurrentMonth
                      ? isPast
                        ? "text-slate-400"
                        : isHoliday
                        ? "text-red-700"
                        : isToday
                        ? "text-emerald-700"
                        : "text-slate-900"
                      : "text-slate-400"
                  }`}>
                    <span>{isCurrentMonth ? dayNum : ""}</span>
                    {isHoliday && (
                      <svg className="w-4 h-4" viewBox="0 0 900 600" xmlns="http://www.w3.org/2000/svg">
                        {/* Yellow sun */}
                        <circle cx="300" cy="300" r="60" fill="#FCD116" />
                        {/* Sun rays */}
                        <g fill="#FCD116">
                          <polygon points="300,140 320,220 280,220" />
                          <polygon points="300,460 280,380 320,380" />
                          <polygon points="140,300 220,280 220,320" />
                          <polygon points="460,300 380,320 380,280" />
                        </g>
                        {/* Blue stripe */}
                        <rect x="0" y="0" width="900" height="300" fill="#0066B2" />
                        {/* Red stripe */}
                        <rect x="0" y="300" width="900" height="300" fill="#CE1126" />
                        {/* White triangle */}
                        <polygon points="0,0 450,300 0,600" fill="#FFFFFF" />
                      </svg>
                    )}
                  </div>
                  
                  {dayAppointments.length > 0 && (
                    <div className="space-y-0.5">
                      {dayAppointments.slice(0, 2).map((apt) => (
                        <div key={apt.id} className={`text-xs md:text-xs p-0.5 md:p-1 rounded font-medium truncate ${
                          isPast ? "bg-slate-300 text-slate-600" : "bg-indigo-400 text-white"
                        }`}>
                          {formatTime12Hr(apt.appointment_time)}
                        </div>
                      ))}
                      {dayAppointments.length > 2 && (
                        <div className="text-xs text-indigo-600 font-semibold px-0.5 md:px-1">
                          +{dayAppointments.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected date details */}
          {selectedDate && (
            <div className="mt-6 md:mt-8 p-4 md:p-6 bg-gradient-to-r from-indigo-50 to-indigo-100 border-2 border-indigo-300 rounded-lg">
              <h3 className="font-bold text-base md:text-lg text-slate-900 mb-3 md:mb-4">
                📅 {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric"
                })}
              </h3>

              {/* PH Holiday Info */}
              {PH_HOLIDAYS_2026.includes(selectedDate) && (
                <div className="mb-4 p-3 bg-amber-50 border-l-4 border-amber-400 rounded">
                  <p className="font-semibold text-amber-700">🇵🇭 {PH_HOLIDAY_NAMES[selectedDate]}</p>
                  <p className="text-sm text-amber-600 mt-1">Sundays & Holidays - By Appointment Only</p>
                </div>
              )}

              <div className="space-y-2 md:space-y-3">
                {appointmentsByDate[selectedDate]?.map((apt) => {
                  const isPastApt = new Date(selectedDate) < new Date() && selectedDate !== new Date().toISOString().split("T")[0];
                  return (
                    <div key={apt.id} className="bg-white p-3 md:p-4 rounded-lg border border-indigo-200 hover:shadow-md transition flex flex-col md:flex-row md:items-start md:justify-between gap-2 md:gap-3">
                      <div className="flex-1">
                        <p className="font-bold text-base md:text-lg text-slate-900">{formatTime12Hr(apt.appointment_time)}</p>
                        <p className="font-semibold text-slate-800 text-sm md:text-base">{apt.patients?.full_name}</p>
                        <p className="text-xs md:text-sm text-slate-600">📞 {apt.patients?.phone}</p>
                        {apt.dentists && <p className="text-xs md:text-sm text-slate-600">🦷 Dr. {apt.dentists.full_name}</p>}
                        {(apt as any).concern_type && <p className="text-xs md:text-sm text-slate-700 mt-2 italic bg-amber-50 p-2 rounded">📋 {getVisitReasonLabel((apt as any).concern_type)}</p>}
                        {apt.concerns && !(apt as any).concern_type && <p className="text-xs md:text-sm text-slate-700 mt-2 italic bg-amber-50 p-2 rounded">📋 {apt.concerns}</p>}
                      </div>
                      <div className="flex flex-row md:flex-col gap-2">
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                          apt.status === "confirmed"
                            ? "bg-emerald-100 text-emerald-800"
                            : apt.status === "completed"
                            ? "bg-indigo-100 text-indigo-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {apt.status}
                        </span>
                        <button
                          onClick={() => openEditModal(apt)}
                          className="text-xs px-3 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <div 
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onDoubleClick={() => setShowCreateModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4"
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900 mb-4">Create Appointment</h3>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              {/* Patient - Searchable */}
              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Patient *
                </label>
                <input
                  type="text"
                  value={patientSearchInput}
                  onChange={(e) => {
                    setPatientSearchInput(e.target.value);
                    setShowPatientDropdown(e.target.value.length >= 3);
                  }}
                  onBlur={() => setTimeout(() => setShowPatientDropdown(false), 200)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Start typing to search"
                />
                {showPatientDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {(() => {
                      if (patientSearchInput.length < 3) return null;
                      const filtered = patients.filter((p) => p.full_name?.toLowerCase().includes(patientSearchInput.toLowerCase()));
                      
                      return filtered.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-slate-500">No matches for "{patientSearchInput}"</div>
                      ) : (
                        filtered.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, patientId: p.id });
                              setPatientSearchInput(p.full_name || "");
                              setShowPatientDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm text-slate-700"
                          >
                            {p.full_name}
                          </button>
                        ))
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
                inputRef={createAppointmentDateRef}
                variant="case-modal"
              />

              {/* Time */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Time *
                </label>
                <select
                  value={formData.appointmentTime}
                  onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {(() => {
                    const selectedDate = formData.appointmentDate;
                    const dayOfWeek = new Date(selectedDate + "T00:00:00").getDay();
                    const isHoliday = PH_HOLIDAYS_2026.includes(selectedDate);
                    const validHours = (dayOfWeek === 0 || isHoliday) ? Array.from({length: sundayEndHour - 7}, (_, i) => 8 + i) : [8, 9, 10, 11, 12, 14, 15, 16];
                    return validHours.map((hour) => {
                      const timeStr = `${String(hour).padStart(2, "0")}:00`;
                      return (
                        <option key={hour} value={timeStr}>
                          {formatTime12Hr(timeStr)}
                        </option>
                      );
                    });
                  })()}
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Select dentist --</option>
                  {dentists.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Concern Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Concern / Reason for Visit (Optional)
                </label>
                <select
                  value={formData.concernType}
                  onChange={(e) => setFormData({ ...formData, concernType: e.target.value as VisitReasonType | "" })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Select a reason --</option>
                  {VISIT_REASONS.map((group) => (
                    <optgroup key={group.group} label={group.group}>
                      {group.reasons.map((reason) => (
                        <option key={reason.value} value={reason.value}>
                          {reason.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAppointment}
                className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition font-medium"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Appointment Modal */}
      {editingAppointment && (
        <div 
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onDoubleClick={closeEditModal}
        >
          <div 
            className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4"
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900 mb-4">Edit Appointment</h3>

            <div className="space-y-4">
              {/* Patient */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Patient
                </label>
                <select
                  value={editFormData.patientId}
                  onChange={(e) => setEditFormData({ ...editFormData, patientId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <DatePickerField
                label="Date"
                value={editFormData.appointmentDate}
                onChange={(val) => setEditFormData({ ...editFormData, appointmentDate: val })}
                inputRef={editAppointmentDateRef}
                variant="case-modal"
              />

              {/* Time */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Time
                </label>
                <select
                  value={editFormData.appointmentTime}
                  onChange={(e) => setEditFormData({ ...editFormData, appointmentTime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {(() => {
                    const selectedDate = editFormData.appointmentDate;
                    const dayOfWeek = new Date(selectedDate + "T00:00:00").getDay();
                    const isHoliday = PH_HOLIDAYS_2026.includes(selectedDate);
                    const validHours = (dayOfWeek === 0 || isHoliday) ? Array.from({length: sundayEndHour - 7}, (_, i) => 8 + i) : [8, 9, 10, 11, 12, 14, 15, 16];
                    return validHours.map((hour) => {
                      const timeStr = `${String(hour).padStart(2, "0")}:00`;
                      return (
                        <option key={hour} value={timeStr}>
                          {formatTime12Hr(timeStr)}
                        </option>
                      );
                    });
                  })()}
                </select>
              </div>

              {/* Dentist */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Dentist (Optional)
                </label>
                <select
                  value={editFormData.dentistId}
                  onChange={(e) => setEditFormData({ ...editFormData, dentistId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Select dentist --</option>
                  {dentists.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Concern Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Concern / Reason (Optional)
                </label>
                <select
                  value={editFormData.concernType}
                  onChange={(e) => setEditFormData({ ...editFormData, concernType: e.target.value as VisitReasonType | "" })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Select a reason --</option>
                  {VISIT_REASONS.map((group) => (
                    <optgroup key={group.group} label={group.group}>
                      {group.reasons.map((reason) => (
                        <option key={reason.value} value={reason.value}>
                          {reason.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Delete Section */}
              <div className="delete-confirmation">
                <div className="delete-confirmation-title text-red-700">Delete appointment?</div>
                <div className="delete-confirmation-hint">
                  Type <span className="delete-confirmation-code">DELETE</span> to confirm deletion
                </div>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="delete-confirmation-input"
                  disabled={false}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="modal-actions">
              <button
                onClick={handleDeleteAppointment}
                disabled={deleteConfirmText.toUpperCase() !== "DELETE"}
                className="delete-btn"
              >
                Delete
              </button>
              <div className="modal-actions-right">
                <button
                  onClick={closeEditModal}
                  className="modal-btn-secondary"
                >
                  Close
                </button>
                <button
                  onClick={handleUpdateAppointment}
                  className="modal-btn-primary"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
          </div>
        </div>
      </div>
    </main>
  );
}
