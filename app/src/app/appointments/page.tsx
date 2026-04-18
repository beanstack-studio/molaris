"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getVisitReasonLabel } from "@/lib/visitReasonHelpers";
import { formatPhoneLocal, combineFullName } from "@/lib/helpers";
import { Appointment, Patient, DentistRow } from "@/lib/types";
import { CreateAppointmentModal } from "./CreateAppointmentModal";
import { EditAppointmentModal } from "./EditAppointmentModal";
import { ContactPatientModal } from "./ContactPatientModal";
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
  const [viewMode, setViewMode] = useState<"list" | "calendar">(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "list" : "calendar"
  );
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithRelations | null>(null);
  const [contactingAppointment, setContactingAppointment] = useState<AppointmentWithRelations | null>(null);
  const [sundayEndHour, setSundayEndHour] = useState(11);

  useEffect(() => {
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("Connection timed out")), 30000)
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
        .select("id, full_name, color")
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
      let allPatients: Patient[] = [];
      let offset = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error: err } = await supabase
          .from("patients")
          .select("id, full_name, first_name, last_name")
          .range(offset, offset + pageSize - 1);

        if (err) throw err;
        if (!data || data.length === 0) break;

        // Normalize: ensure full_name is always a usable string
        const normalized = data.map((p: any) => ({
          ...p,
          full_name: p.full_name?.trim() || combineFullName(p.first_name, p.last_name),
        }));

        allPatients = [...allPatients, ...normalized];
        if (data.length < 1000) break;
        offset += data.length;
      }

      // Sort by last_name then first_name client-side
      allPatients.sort((a, b) => {
        const aLast = (a.last_name ?? "").toLowerCase();
        const bLast = (b.last_name ?? "").toLowerCase();
        if (aLast !== bLast) return aLast.localeCompare(bLast);
        return (a.first_name ?? "").toLowerCase().localeCompare((b.first_name ?? "").toLowerCase());
      });

      setPatients(allPatients);
    } catch {
      setPatients([]);
    }
  };

  const dentistColorMap: Record<string, string> = {};
  for (const d of dentists) dentistColorMap[d.id] = d.color || "#6366f1";

  const getAptColor = (apt: AppointmentWithRelations, isPast: boolean) => {
    if (isPast) return "#94a3b8";
    return apt.dentist_id ? (dentistColorMap[apt.dentist_id] || "#6366f1") : "#6366f1";
  };

  const formatDateHeading = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      confirmed: "badge badge-success",
      completed: "badge badge-info",
      cancelled: "badge badge-secondary",
      pending: "badge badge-warning",
    };
    return map[status] ?? "badge badge-secondary";
  };

  const AppointmentsTable = ({ rows }: { rows: AppointmentWithRelations[] }) => (
    <>
      {/* Desktop table */}
      <div className="table-wrapper hidden md:block">
        <table className="data-table min-w-[700px]">
          <thead className="data-table-head">
            <tr>
              <th className="data-table-head-cell w-28">Time</th>
              <th className="data-table-head-cell">Patient</th>
              <th className="data-table-head-cell">Concern / Reason</th>
              <th className="data-table-head-cell">Dentist</th>
              <th className="data-table-head-cell w-28">Status</th>
              <th className="data-table-head-cell w-44">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((apt, idx) => (
              <tr key={apt.id} className={idx % 2 === 0 ? "data-table-row-even data-table-row" : "data-table-row-odd data-table-row"}>
                <td className="data-table-cell font-semibold text-slate-800 whitespace-nowrap">
                  {formatTime12Hr(apt.appointment_time)}
                </td>
                <td className="data-table-cell">
                  <div className="font-medium text-slate-900">{apt.patients?.full_name || "—"}</div>
                </td>
                <td className="data-table-cell text-slate-600 italic">
                  {(apt as any).concern_type ? getVisitReasonLabel((apt as any).concern_type) : <span className="text-slate-300">—</span>}
                </td>
                <td className="data-table-cell">
                  {apt.dentists?.full_name ? (
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-sm font-medium"
                      style={{
                        backgroundColor: (dentistColorMap[apt.dentist_id!] || "#6366f1") + "22",
                        color: dentistColorMap[apt.dentist_id!] || "#6366f1",
                      }}
                    >
                      {apt.dentists.full_name}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="data-table-cell">
                  <span className={statusBadge(apt.status)}>{apt.status}</span>
                </td>
                <td className="data-table-cell">
                  <div className="flex gap-1">
                    <button
                      onClick={() => setContactingAppointment(apt)}
                      className="data-table-btn text-blue-600 border-blue-200 hover:bg-blue-50 justify-center"
                      title="Contact patient"
                    >
                      Contact
                    </button>
                    <button onClick={() => setEditingAppointment(apt)} className="data-table-btn justify-center">
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-2 md:hidden">
        {rows.map((apt) => (
          <div key={apt.id} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 text-sm">{apt.patients?.full_name || "—"}</div>
              </div>
              <span className={statusBadge(apt.status)}>{apt.status}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
              <span className="font-medium text-slate-800">{formatTime12Hr(apt.appointment_time)}</span>
              {apt.dentists?.full_name && (
                <span
                  className="rounded-full px-2 py-0.5 font-medium"
                  style={{
                    backgroundColor: (dentistColorMap[apt.dentist_id!] || "#6366f1") + "22",
                    color: dentistColorMap[apt.dentist_id!] || "#6366f1",
                  }}
                >
                  {apt.dentists.full_name}
                </span>
              )}
              {(apt as any).concern_type && (
                <span className="italic text-slate-500">{getVisitReasonLabel((apt as any).concern_type)}</span>
              )}
            </div>
            <div className="mt-2 flex justify-end gap-1">
              <button onClick={() => setContactingAppointment(apt)} className="data-table-btn text-blue-600 border-blue-200 hover:bg-blue-50">Contact</button>
              <button onClick={() => setEditingAppointment(apt)} className="data-table-btn">Edit</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );

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
              <div className="space-y-6">
                {datesList.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-slate-500">No appointments scheduled</p>
                  </div>
                ) : (
                  datesList.map((date) => (
                    <div key={date}>
                      <div className="px-1 pb-2 flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700">{formatDateHeading(date)}</span>
                        {PH_HOLIDAYS_2026.includes(date) && (
                          <span className="badge badge-warning">🇵🇭 {PH_HOLIDAY_NAMES[date]}</span>
                        )}
                      </div>
                      <AppointmentsTable rows={appointmentsByDate[date]} />
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
                    const isPast = !!(dateStr && new Date(dateStr) < new Date() && !isToday);
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
                              <div
                                key={apt.id}
                                className="text-xs md:text-xs p-0.5 md:p-1 rounded font-medium truncate text-white"
                                style={{ backgroundColor: getAptColor(apt, isPast) }}
                              >
                                {formatTime12Hr(apt.appointment_time)}
                              </div>
                            ))}
                            {dayAppointments.length > 2 && (
                              <div className="text-xs font-semibold px-0.5 md:px-1" style={{ color: getAptColor(dayAppointments[0], isPast) }}>
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
                  <div className="mt-6">
                    <div className="px-1 pb-2 flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-700">{formatDateHeading(selectedDate)}</span>
                      {PH_HOLIDAYS_2026.includes(selectedDate) && (
                        <span className="badge badge-warning">🇵🇭 {PH_HOLIDAY_NAMES[selectedDate]}</span>
                      )}
                    </div>
                    {appointmentsByDate[selectedDate]?.length > 0 ? (
                      <AppointmentsTable rows={appointmentsByDate[selectedDate]} />
                    ) : (
                      <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-slate-500 text-sm">No appointments for this date</p>
                      </div>
                    )}
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

      <ContactPatientModal
        open={!!contactingAppointment}
        patient={contactingAppointment?.patients ?? null}
        appointment={contactingAppointment}
        onClose={() => setContactingAppointment(null)}
      />
    </main>
  );
}
