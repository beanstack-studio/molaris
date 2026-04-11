"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getVisitReasonLabel } from "@/lib/visitReasonHelpers";
import { formatPhoneLocal } from "@/lib/helpers";
import { Appointment, Patient, DentistRow } from "@/lib/types";
import { CreateAppointmentModal } from "./CreateAppointmentModal";
import { EditAppointmentModal } from "./EditAppointmentModal";
import { PageLoader } from "@/components/Spinner";

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
  const router = useRouter();
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
  const [sundayEndHour, setSundayEndHour] = useState(11);

  useEffect(() => {
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("Connection timed out")), 10000)
    );
    Promise.race([
      Promise.all([loadAppointments(), loadDentists(), loadPatients(), loadClinicHours()]),
      timeout,
    ])
      .catch((e) => setError(e.message || "Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  const loadClinicHours = async () => {
    try {
      const { data, error: err } = await supabase
        .from("clinic_profile")
        .select("sunday_end_hour")
        .limit(1)
        .single();
      if (!err && data?.sunday_end_hour) {
        setSundayEndHour(data.sunday_end_hour);
      }
    } catch {
      // clinic hours unavailable, use default
    }
  };

  const loadAppointments = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const { data, error: err } = await supabase
        .from("appointments")
        .select("*, patients(id, full_name, phone), dentists(id, full_name)")
        .is("deleted_at", null)
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true });
      if (err) throw err;
      setAppointments(data as any);
    } catch {
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
    } catch {
      // dentists unavailable
    }
  };

  const loadPatients = async () => {
    try {
      let allPatients: { id: string; full_name: string }[] = [];
      let offset = 0;
      const pageSize = 10000;

      while (true) {
        const { data, error: err } = await supabase
          .from("patients")
          .select("id, full_name")
          .order("full_name")
          .range(offset, offset + pageSize - 1);

        if (err) throw err;
        if (!data || data.length === 0) break;

        allPatients = [...allPatients, ...data];
        if (data.length < pageSize) break;
        offset += data.length;
      }

      setPatients(allPatients as Patient[]);
    } catch {
      setPatients([]);
    }
  };

  const getDayOfWeek = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
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
      <PageLoader text="Loading appointments…" />
    );
  }

  return (
    <main className="app-section">
      <div className="app-section-header">
        <div>
          <div className="app-section-title">Appointments</div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          + New Appointment
        </button>
      </div>

      <div className="card">
        <div className="flex flex-col gap-4">
          {error && (
            <div className="error-msg">{error}</div>
          )}

            {/* View mode toggle */}
            <div className="action-row">
              <button
                onClick={() => setViewMode("list")}
                className={viewMode === "list" ? "toggle-btn-active" : "toggle-btn"}
              >
                List View
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={viewMode === "calendar" ? "toggle-btn-active" : "toggle-btn"}
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
                      <div className="divider-rows">
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
                                <p className="text-muted">
                                  📞 {apt.patients?.phone ? formatPhoneLocal(apt.patients.phone) : "No phone"}
                                </p>
                                {apt.dentists && (
                                  <p className="text-muted">
                                    🦷 Dr. {apt.dentists.full_name}
                                  </p>
                                )}
                                {(apt as any).concern_type && (
                                  <p className="text-sm text-slate-700 mt-2 italic bg-amber-50 p-2 rounded">
                                    📋 {getVisitReasonLabel((apt as any).concern_type)}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => setEditingAppointment(apt)}
                                className="data-table-btn"
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
                      className="cancel-btn"
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={() => setCurrentDate(new Date())}
                      className="save-btn"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                      className="cancel-btn"
                    >
                      Next →
                    </button>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-0.5 md:gap-1 mb-8">
                  {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => (
                    <div key={day} className="text-center font-bold text-slate-700 py-2 md:py-3 bg-slate-100 rounded text-xs md:text-sm">
                      {day.slice(0, 3)}
                    </div>
                  ))}

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
                              <circle cx="300" cy="300" r="60" fill="#FCD116" />
                              <g fill="#FCD116">
                                <polygon points="300,140 320,220 280,220" />
                                <polygon points="300,460 280,380 320,380" />
                                <polygon points="140,300 220,280 220,320" />
                                <polygon points="460,300 380,320 380,280" />
                              </g>
                              <rect x="0" y="0" width="900" height="300" fill="#0066B2" />
                              <rect x="0" y="300" width="900" height="300" fill="#CE1126" />
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
                        weekday: "long", month: "long", day: "numeric",
                      })}
                    </h3>

                    {PH_HOLIDAYS_2026.includes(selectedDate) && (
                      <div className="mb-4 p-3 bg-amber-50 border-l-4 border-amber-400 rounded">
                        <p className="font-semibold text-amber-700">🇵🇭 {PH_HOLIDAY_NAMES[selectedDate]}</p>
                        <p className="text-sm text-amber-600 mt-1">Sundays & Holidays - By Appointment Only</p>
                      </div>
                    )}

                    <div className="space-y-2 md:space-y-3">
                      {appointmentsByDate[selectedDate]?.map((apt) => {
                        return (
                          <div key={apt.id} className="bg-white p-3 md:p-4 rounded-lg border border-indigo-200 hover:shadow-md transition flex flex-col md:flex-row md:items-start md:justify-between gap-2 md:gap-3">
                            <div className="flex-1">
                              <p className="font-bold text-base md:text-lg text-slate-900">{formatTime12Hr(apt.appointment_time)}</p>
                              <p className="font-semibold text-slate-800 text-sm md:text-base">{apt.patients?.full_name}</p>
                              <p className="text-xs md:text-sm text-slate-600">📞 {apt.patients?.phone ? formatPhoneLocal(apt.patients.phone) : "—"}</p>
                              {apt.dentists && <p className="text-xs md:text-sm text-slate-600">🦷 Dr. {apt.dentists.full_name}</p>}
                              {(apt as any).concern_type && <p className="text-xs md:text-sm text-slate-700 mt-2 italic bg-amber-50 p-2 rounded">📋 {getVisitReasonLabel((apt as any).concern_type)}</p>}
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
                                onClick={() => setEditingAppointment(apt)}
                                className="data-table-btn"
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
        </div>
      </div>

      <CreateAppointmentModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={loadAppointments}
        dentists={dentists}
        patients={patients}
        selectedDate={selectedDate}
        sundayEndHour={sundayEndHour}
      />

      <EditAppointmentModal
        appointment={editingAppointment}
        onClose={() => setEditingAppointment(null)}
        onUpdated={loadAppointments}
        dentists={dentists}
        patients={patients}
        sundayEndHour={sundayEndHour}
      />
    </main>
  );
}
