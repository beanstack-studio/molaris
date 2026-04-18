"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { supabase } from "@/lib/supabaseClient";
import { formatMoney } from "@/lib/helpers";
import { DashboardCard, DashIcons } from "@/components/DashboardCard";
import { PageLoader } from "@/components/Spinner";

/* ── Chart palette ────────────────────────────────────────── */
const BAR_INVOICED  = "#6366f1";
const BAR_COLLECTED = "#10b981";
const PIE_PALETTE   = ["#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#84cc16"];

/* ── Helpers ──────────────────────────────────────────────── */
function fmt12Hr(time: string) {
  const t = time.substring(0, 5);
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function fmtApptDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}


function buildChartData(
  invoices: { invoice_date: string; total: number }[],
  payments: { payment_date: string; amount: number }[],
  now: Date,
) {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const y = d.getFullYear();
    const mo = d.getMonth();
    const month = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const invoiced = invoices
      .filter(r => { const x = new Date(r.invoice_date); return x.getFullYear() === y && x.getMonth() === mo; })
      .reduce((s, r) => s + (r.total ?? 0), 0);
    const collected = payments
      .filter(r => { const x = new Date(r.payment_date); return x.getFullYear() === y && x.getMonth() === mo; })
      .reduce((s, r) => s + (r.amount ?? 0), 0);
    return { month, invoiced, collected };
  });
}

function buildPieData(
  treatments: { procedure: string | null; dentist_name: string | null }[],
  dentistFilter: string,
) {
  const filtered = dentistFilter === "all"
    ? treatments
    : treatments.filter(t => t.dentist_name === dentistFilter);
  const counts: Record<string, number> = {};
  for (const t of filtered) counts[t.procedure?.trim() || "Other"] = (counts[t.procedure?.trim() || "Other"] || 0) + 1;
  return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
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
  dentists:  { full_name: string | null; color: string | null } | null;
}
interface Transaction {
  id: string;
  invoice_date: string;
  invoice_number: string | null;
  total: number;
  status: string;
  patient_id: string;
  patients: { full_name: string | null } | null;
}

/* ── Tooltip formatter ────────────────────────────────────── */
const TOOLTIP_STYLE = {
  borderRadius: "12px", border: "1px solid #e2e8f0",
  fontSize: "12px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
};

/* ══════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const [loading, setLoading]               = useState(true);
  const [loadingTooLong, setLoadingTooLong] = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [mounted, setMounted]               = useState(false); // for SSR-safe recharts

  const [monthStats, setMonthStats]     = useState<MonthStats>({ invoiced: 0, collected: 0, patientsSeen: 0, newPatients: 0 });
  const [upcoming, setUpcoming]         = useState<UpcomingAppt[]>([]);
  const [chartInvoices, setChartInvoices] = useState<{ invoice_date: string; total: number }[]>([]);
  const [chartPayments, setChartPayments] = useState<{ payment_date: string; amount: number }[]>([]);
  const [monthTreatments, setMonthTreatments] = useState<{ procedure: string | null; dentist_name: string | null }[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dentistFilter, setDentistFilter] = useState("all");

  const router     = useRouter();
  const now        = new Date();

  useEffect(() => { setMounted(true); }, []);

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

      const today        = now.toISOString().split("T")[0];
      const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const monthEnd     = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      const upcomingEnd  = new Date(now.getTime() + 30 * 86_400_000).toISOString().split("T")[0];
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split("T")[0];

      const withTimeout = <T,>(p: Promise<T>, ms = 20_000): Promise<T> =>
        Promise.race([p, new Promise<T>((_, rej) =>
          setTimeout(() => rej(new Error("Database timeout — please retry")), ms)
        )]);

      const [
        monthInvoicesRes, monthPaymentsRes, newPatientsRes, monthApptsRes,
        upcomingRes, chartInvoicesRes, chartPaymentsRes, treatmentsRes, transactionsRes,
      ] = await withTimeout(Promise.all([
        // ── Stat card queries ────────────────────────────────
        supabase.from("invoices").select("id, total")
          .gte("invoice_date", monthStart).lte("invoice_date", monthEnd).is("deleted_at", null),

        supabase.from("payments").select("id, amount")
          .gte("payment_date", monthStart).lte("payment_date", monthEnd).is("voided_at", null),

        supabase.from("patients").select("id", { count: "exact" }).limit(1)
          .gte("created_at", monthStart + "T00:00:00"),

        supabase.from("appointments").select("patient_id")
          .gte("appointment_date", monthStart).lte("appointment_date", today)
          .is("deleted_at", null).neq("status", "cancelled"),

        // ── Upcoming appointments ────────────────────────────
        supabase.from("appointments")
          .select("id, appointment_date, appointment_time, status, patients(full_name), dentists(full_name, color)")
          .gte("appointment_date", today).lte("appointment_date", upcomingEnd)
          .is("deleted_at", null).neq("status", "cancelled")
          .order("appointment_date", { ascending: true }).order("appointment_time", { ascending: true })
          .limit(10),

        // ── 6-month bar chart ────────────────────────────────
        supabase.from("invoices").select("invoice_date, total")
          .gte("invoice_date", sixMonthsAgo).lte("invoice_date", monthEnd).is("deleted_at", null),

        supabase.from("payments").select("payment_date, amount")
          .gte("payment_date", sixMonthsAgo).lte("payment_date", monthEnd).is("voided_at", null),

        // ── Treatments pie ───────────────────────────────────
        supabase.from("treatments").select("procedure, dentist_name")
          .gte("treatment_date", monthStart).lte("treatment_date", today),

        // ── Transaction history ──────────────────────────────
        supabase.from("invoices")
          .select("id, invoice_date, invoice_number, total, status, patient_id, patients(full_name)")
          .is("deleted_at", null)
          .order("invoice_date", { ascending: false })
          .limit(10),
      ]));

      // Stat cards
      const monthInvoiced  = (monthInvoicesRes.data ?? []).reduce((s, r) => s + (r.total  ?? 0), 0);
      const monthCollected = (monthPaymentsRes.data  ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
      const patientsSeen   = new Set((monthApptsRes.data ?? []).map((a: any) => a.patient_id).filter(Boolean)).size;

      setMonthStats({ invoiced: monthInvoiced, collected: monthCollected, patientsSeen, newPatients: newPatientsRes.count ?? 0 });
      setUpcoming((upcomingRes.data as unknown as UpcomingAppt[]) ?? []);
      setChartInvoices((chartInvoicesRes.data ?? []) as { invoice_date: string; total: number }[]);
      setChartPayments((chartPaymentsRes.data ?? []) as { payment_date: string; amount: number }[]);
      setMonthTreatments((treatmentsRes.data ?? []) as { procedure: string | null; dentist_name: string | null }[]);
      setTransactions((transactionsRes.data as unknown as Transaction[]) ?? []);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  /* ── Computed chart data ──────────────────────────────────── */
  const chartData  = useMemo(() => buildChartData(chartInvoices, chartPayments, now), [chartInvoices, chartPayments]);
  const dentistList = useMemo(
    () => Array.from(new Set(monthTreatments.map(t => t.dentist_name).filter(Boolean))) as string[],
    [monthTreatments],
  );
  const pieData = useMemo(() => buildPieData(monthTreatments, dentistFilter), [monthTreatments, dentistFilter]);
  const pieTotal = useMemo(() => pieData.reduce((s, d) => s + d.value, 0), [pieData]);

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

            {/* ── Row 1: Stat cards + Appointment list ───────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">

              <DashboardCard title="Total Invoiced"  value={formatMoney(monthStats.invoiced)}  icon={DashIcons.receipt}     href="/reports/payments" subtext="For this month" />
              <DashboardCard title="Total Collected" value={formatMoney(monthStats.collected)} icon={DashIcons.checkCircle} href="/reports/payments" subtext="For this month"
                valueClassName="text-2xl font-bold text-emerald-600" />

              {/* Appointment list — cols 3-4, rows 1-2 */}
              <div className="md:col-span-2 lg:row-span-2 h-full">
                <div className="card h-full flex flex-col">
                  <p className="dash-month-label mb-3">Upcoming Appointments</p>
                  {upcoming.length === 0 ? (
                    <p className="flex-1 flex items-center justify-center text-sm text-slate-400">No upcoming appointments in the next 30 days</p>
                  ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto -mx-5">
                      <table className="data-table-compact w-full">
                        <thead className="data-table-head sticky top-0 z-10">
                          <tr>
                            <th className="data-table-head-cell whitespace-nowrap">Date</th>
                            <th className="data-table-head-cell whitespace-nowrap">Time</th>
                            <th className="data-table-head-cell">Patient</th>
                            <th className="data-table-head-cell">Dentist</th>
                          </tr>
                        </thead>
                        <tbody>
                          {upcoming.map((apt, i) => {
                            const dentistHex = apt.dentists?.color || "#6366f1";
                            return (
                              <tr
                                key={apt.id}
                                className={`${i % 2 === 0 ? "data-table-row data-table-row-even" : "data-table-row data-table-row-odd"} cursor-pointer`}
                                onClick={() => router.push(`/appointments?date=${apt.appointment_date}&view=list`)}
                              >
                                <td className="data-table-cell-compact whitespace-nowrap text-xs">{fmtApptDate(apt.appointment_date)}</td>
                                <td className="data-table-cell-compact whitespace-nowrap text-xs">{fmt12Hr(apt.appointment_time)}</td>
                                <td className="data-table-cell-compact text-xs font-medium">{apt.patients?.full_name ?? "—"}</td>
                                <td className="data-table-cell-compact">
                                  {apt.dentists?.full_name ? (
                                    <span
                                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                                      style={{ backgroundColor: dentistHex + "22", color: dentistHex }}
                                    >
                                      {apt.dentists.full_name}
                                    </span>
                                  ) : <span className="text-xs text-slate-400">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <DashboardCard title="Patients Seen"  value={monthStats.patientsSeen} icon={DashIcons.activity} subtext="Patients with appts this month" href="/patients" />
              <DashboardCard title="New Patients"   value={monthStats.newPatients}  icon={DashIcons.userPlus} subtext="Registered this month"    href="/patients" />
            </div>

            {/* ── Row 2: Revenue bar chart + Treatments pie ───── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Bar chart — invoiced vs collected */}
              <div className="card">
                <p className="dash-month-label mb-4">Invoiced vs Collected — Last 6 Months</p>
                {mounted ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 0, right: 8, left: -16, bottom: 0 }} barCategoryGap="28%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(v: any) => formatMoney(Number(v))}
                        labelStyle={{ fontWeight: 600, color: "#475569", marginBottom: 4 }}
                      />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                      <Bar dataKey="invoiced"  name="Invoiced"  fill={BAR_INVOICED}  radius={[4,4,0,0]} maxBarSize={32} />
                      <Bar dataKey="collected" name="Collected" fill={BAR_COLLECTED} radius={[4,4,0,0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="h-[220px]" />}
              </div>

              {/* Pie chart — treatments by procedure */}
              <div className="card flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <p className="dash-month-label">Treatments This Month</p>
                  {dentistList.length > 0 && (
                    <select
                      value={dentistFilter}
                      onChange={e => setDentistFilter(e.target.value)}
                      className="input-standard h-7 text-xs py-0 px-2 w-auto"
                    >
                      <option value="all">All Dentists</option>
                      {dentistList.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  )}
                </div>

                {pieData.length === 0 ? (
                  <p className="flex-1 flex items-center justify-center text-sm text-slate-400">No treatments recorded this month</p>
                ) : (
                  <div className="flex items-center gap-4">
                    {mounted && (
                      <PieChart width={140} height={140} className="flex-shrink-0">
                        <Pie data={pieData} cx={65} cy={65} innerRadius={38} outerRadius={65} dataKey="value" paddingAngle={2}>
                          {pieData.map((_, idx) => <Cell key={idx} fill={PIE_PALETTE[idx % PIE_PALETTE.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v} treatment${Number(v) !== 1 ? "s" : ""}`, ""]} />
                      </PieChart>
                    )}
                    <div className="flex-1 min-w-0 space-y-1.5 overflow-y-auto max-h-[140px]">
                      {pieData.map((d, idx) => (
                        <div key={d.name} className="flex items-center gap-2 text-xs">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_PALETTE[idx % PIE_PALETTE.length] }} />
                          <span className="flex-1 truncate text-slate-700">{d.name}</span>
                          <span className="text-slate-400 font-medium flex-shrink-0">{d.value} ({Math.round(d.value / pieTotal * 100)}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Row 3: Recent transactions ───────────────────── */}
            <div className="card">
              <p className="dash-month-label mb-3">Recent Transactions</p>
              {transactions.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No transactions found</p>
              ) : (
                <div className="overflow-x-auto -mx-5">
                  <table className="data-table-compact w-full">
                    <thead className="data-table-head">
                      <tr>
                        <th className="data-table-head-cell whitespace-nowrap">Date</th>
                        <th className="data-table-head-cell">Patient</th>
                        <th className="data-table-head-cell whitespace-nowrap">Invoice #</th>
                        <th className="data-table-head-cell-right whitespace-nowrap">Amount</th>
                        <th className="data-table-head-cell">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx, i) => (
                        <tr
                          key={tx.id}
                          className={`${i % 2 === 0 ? "data-table-row data-table-row-even" : "data-table-row data-table-row-odd"} cursor-pointer`}
                          onClick={() => router.push(`/patients/${tx.patient_id}/billing`)}
                        >
                          <td className="data-table-cell-compact whitespace-nowrap text-xs">{fmtDate(tx.invoice_date)}</td>
                          <td className="data-table-cell-compact text-xs font-medium">{tx.patients?.full_name ?? "—"}</td>
                          <td className="data-table-cell-compact text-xs text-slate-500">{tx.invoice_number ?? "—"}</td>
                          <td className="data-table-cell-compact-right text-xs font-semibold">{formatMoney(tx.total ?? 0)}</td>
                          <td className="data-table-cell-compact">
                            <span className={`badge ${
                              tx.status === "paid"    ? "badge-success"   :
                              tx.status === "partial" ? "badge-warning"   :
                              "badge-danger"
                            }`}>
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
