"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatMoney } from "@/lib/helpers";
import { DashboardCard, DashIcons } from "@/components/DashboardCard";
import { PageLoader } from "@/components/Spinner";

/* ── Helpers ──────────────────────────────────────────────── */
function fmt12Hr(time: string) {
  const t = time.substring(0, 5);
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function fmtApptDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const DENTIST_COLORS = [
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-blue-100",   text: "text-blue-700"   },
  { bg: "bg-emerald-100",text: "text-emerald-700" },
  { bg: "bg-amber-100",  text: "text-amber-700"   },
  { bg: "bg-rose-100",   text: "text-rose-700"    },
  { bg: "bg-cyan-100",   text: "text-cyan-700"    },
];

function dentistColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return DENTIST_COLORS[Math.abs(h) % DENTIST_COLORS.length];
}

/* ── Types ────────────────────────────────────────────────── */
interface MonthStats {
  invoiced:     number;
  collected:    number;
  patientsSeen: number;
  newPatients:  number;
}

interface UpcomingAppt {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  patients: { full_name: string | null } | null;
  dentists:  { full_name: string | null } | null;
}

/* ══════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const [loading, setLoading]               = useState(true);
  const [loadingTooLong, setLoadingTooLong] = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [monthStats, setMonthStats]         = useState<MonthStats>({ invoiced: 0, collected: 0, patientsSeen: 0, newPatients: 0 });
  const [upcoming, setUpcoming]             = useState<UpcomingAppt[]>([]);

  const now        = new Date();
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  useEffect(() => {
    const slowTimer = setTimeout(() => setLoadingTooLong(true), 10_000);
    loadData().finally(() => clearTimeout(slowTimer));
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    setLoadingTooLong(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("No active session. Please log in."); return; }

      const today       = now.toISOString().split("T")[0];
      const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const monthEnd    = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      const upcomingEnd = new Date(now.getTime() + 30 * 86_400_000).toISOString().split("T")[0];

      const withTimeout = <T,>(p: Promise<T>, ms = 20_000): Promise<T> =>
        Promise.race([p, new Promise<T>((_, rej) =>
          setTimeout(() => rej(new Error("Database timeout — please retry")), ms)
        )]);

      const [
        monthInvoicesRes,
        monthPaymentsRes,
        newPatientsRes,
        monthApptsRes,
        upcomingRes,
      ] = await withTimeout(Promise.all([
        // This month's invoices
        supabase
          .from("invoices")
          .select("id, total")
          .gte("invoice_date", monthStart)
          .lte("invoice_date", monthEnd)
          .is("deleted_at", null),

        // This month's non-voided payments
        supabase
          .from("payments")
          .select("id, amount")
          .gte("payment_date", monthStart)
          .lte("payment_date", monthEnd)
          .is("voided_at", null),

        // New patients this month
        supabase
          .from("patients")
          .select("id", { count: "exact" })
          .limit(1)
          .gte("created_at", monthStart + "T00:00:00"),

        // Patients seen: month-to-date only (exclude future appointments)
        supabase
          .from("appointments")
          .select("patient_id")
          .gte("appointment_date", monthStart)
          .lte("appointment_date", today)
          .is("deleted_at", null)
          .neq("status", "cancelled"),

        // Upcoming appointments with names
        supabase
          .from("appointments")
          .select("id, appointment_date, appointment_time, status, patients(full_name), dentists(full_name)")
          .gte("appointment_date", today)
          .lte("appointment_date", upcomingEnd)
          .is("deleted_at", null)
          .neq("status", "cancelled")
          .order("appointment_date", { ascending: true })
          .order("appointment_time",  { ascending: true })
          .limit(20),
      ]));

      const monthInvoiced  = (monthInvoicesRes.data ?? []).reduce((s, r) => s + (r.total  ?? 0), 0);
      const monthCollected = (monthPaymentsRes.data  ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
      const patientsSeen   = new Set(
        (monthApptsRes.data ?? []).map((a: any) => a.patient_id).filter(Boolean)
      ).size;

      setMonthStats({
        invoiced:    monthInvoiced,
        collected:   monthCollected,
        patientsSeen,
        newPatients: newPatientsRes.count ?? 0,
      });
      setUpcoming((upcomingRes.data as unknown as UpcomingAppt[]) ?? []);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="page-bg">
      <main className="app-section">
        <div className="app-section-header">
          <div className="app-section-title">Dashboard</div>
        </div>

        {error && (
          <div className="error-banner flex items-center justify-between gap-3">
            <span>{error}</span>
            <button onClick={loadData} className="cancel-btn h-8 px-3 text-xs">Retry</button>
          </div>
        )}

        {loading ? (
          <PageLoader>
            {loadingTooLong && (
              <div className="flex flex-col items-center gap-2 mt-3">
                <p className="text-sm text-slate-500">Taking longer than usual…</p>
                <button onClick={loadData} className="cancel-btn h-8 px-3 text-xs">Retry</button>
              </div>
            )}
          </PageLoader>
        ) : (
          <div className="flex flex-col gap-4">

            <div className="flex items-center gap-2">
              <span className="dash-month-label">{monthLabel}</span>
              <span className="text-xs text-slate-400">— monthly overview</span>
            </div>

            {/*
              Desktop (lg): 3-col grid
                Col 1, Row 1 → Total Invoiced
                Col 2, Row 1 → Total Collected
                Col 3, Rows 1–2 → Appointment list (row-span-2)
                Col 1, Row 2 → Patients Seen
                Col 2, Row 2 → New Patients

              Tablet (md): 2-col, appointment list spans full width
              Mobile: single column stack
            */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">

              {/* Col 1, Row 1 */}
              <DashboardCard
                title="Total Invoiced"
                value={formatMoney(monthStats.invoiced)}
                icon={DashIcons.receipt}
                href="/reports/payments"
              />

              {/* Col 2, Row 1 */}
              <DashboardCard
                title="Total Collected"
                value={formatMoney(monthStats.collected)}
                icon={DashIcons.checkCircle}
                valueClassName="text-2xl font-bold text-emerald-600"
                href="/reports/payments"
              />

              {/* Col 3, Rows 1–2 (appointment list) */}
              <div className="md:col-span-2 lg:col-span-1 lg:row-span-2">
                <div className="card h-full">
                  <div className="card-header mb-3">
                    <div className="card-title">Upcoming Appointments</div>
                  </div>

                  {upcoming.length === 0 ? (
                    <p className="text-center text-sm text-slate-400 py-8">No upcoming appointments in the next 30 days</p>
                  ) : (
                    <div className="overflow-x-auto -mx-5">
                      <table className="data-table-compact w-full">
                        <thead className="data-table-head">
                          <tr>
                            <th className="data-table-head-cell whitespace-nowrap">Date</th>
                            <th className="data-table-head-cell whitespace-nowrap">Time</th>
                            <th className="data-table-head-cell">Patient</th>
                            <th className="data-table-head-cell">Dentist</th>
                          </tr>
                        </thead>
                        <tbody>
                          {upcoming.map((apt, i) => (
                            <tr
                              key={apt.id}
                              className={i % 2 === 0 ? "data-table-row data-table-row-even" : "data-table-row data-table-row-odd"}
                            >
                              <td className="data-table-cell-compact whitespace-nowrap text-xs">{fmtApptDate(apt.appointment_date)}</td>
                              <td className="data-table-cell-compact whitespace-nowrap text-xs">{fmt12Hr(apt.appointment_time)}</td>
                              <td className="data-table-cell-compact text-xs font-medium">{apt.patients?.full_name ?? "—"}</td>
                              <td className="data-table-cell-compact">
                                {apt.dentists?.full_name ? (() => {
                                  const c = dentistColor(apt.dentists.full_name!);
                                  return (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${c.bg} ${c.text}`}>
                                      {apt.dentists.full_name}
                                    </span>
                                  );
                                })() : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Col 1, Row 2 */}
              <DashboardCard
                title="Patients Seen"
                value={monthStats.patientsSeen}
                icon={DashIcons.activity}
                subtext="Unique patients with visit"
                href="/patients"
              />

              {/* Col 2, Row 2 */}
              <DashboardCard
                title="New Patients"
                value={monthStats.newPatients}
                icon={DashIcons.userPlus}
                subtext="Registered this month"
                href="/patients"
              />

            </div>
          </div>
        )}
      </main>
    </div>
  );
}
