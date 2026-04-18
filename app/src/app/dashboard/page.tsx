"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  return {
    day:   d.getDate(),
    month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    dow:   d.toLocaleDateString("en-US", { weekday: "short" }),
  };
}

/* ── Types ────────────────────────────────────────────────── */
interface MonthStats {
  invoiced:     number;
  collected:    number;
  patientsSeen: number;
  newPatients:  number;
}

interface OverviewStats {
  totalPatients: number;
  orthoPatients: number;
  outstandingCount:  number;
  outstandingAmount: number;
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
  const [loading, setLoading]           = useState(true);
  const [loadingTooLong, setLoadingTooLong] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [monthStats, setMonthStats]     = useState<MonthStats>({ invoiced: 0, collected: 0, patientsSeen: 0, newPatients: 0 });
  const [overview, setOverview]         = useState<OverviewStats>({ totalPatients: 0, orthoPatients: 0, outstandingCount: 0, outstandingAmount: 0 });
  const [upcoming, setUpcoming]         = useState<UpcomingAppt[]>([]);

  const now       = new Date();
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

      // ── Date ranges ────────────────────────────────────────
      const today      = now.toISOString().split("T")[0];
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      const upcomingEnd = new Date(now.getTime() + 30 * 86_400_000).toISOString().split("T")[0];

      const withTimeout = <T,>(p: Promise<T>, ms = 20_000): Promise<T> =>
        Promise.race([p, new Promise<T>((_, rej) =>
          setTimeout(() => rej(new Error("Database timeout — please retry")), ms)
        )]);

      // ── All queries in parallel (targeted, no big full-table scans) ──
      const [
        monthInvoicesRes,
        monthPaymentsRes,
        pendingInvoicesRes,
        totalPatientsRes,
        orthoPatientsRes,
        newPatientsRes,
        monthApptsRes,
        upcomingRes,
      ] = await withTimeout(Promise.all([
        // This month's invoices — for total invoiced
        supabase
          .from("invoices")
          .select("id, total")
          .gte("invoice_date", monthStart)
          .lte("invoice_date", monthEnd)
          .is("deleted_at", null),

        // This month's non-voided payments — for total collected
        supabase
          .from("payments")
          .select("id, amount")
          .gte("payment_date", monthStart)
          .lte("payment_date", monthEnd)
          .is("voided_at", null),

        // All unpaid invoices — for outstanding balance
        supabase
          .from("invoices")
          .select("id, total")
          .not("status", "eq", "paid")
          .is("deleted_at", null),

        // Total patient count
        supabase.from("patients").select("id", { count: "exact" }).limit(1),

        // Ortho patient count
        supabase.from("patients").select("id", { count: "exact" }).limit(1).eq("ortho_patient", true),

        // New patients this month
        supabase
          .from("patients")
          .select("id", { count: "exact" })
          .limit(1)
          .gte("created_at", monthStart + "T00:00:00"),

        // Appointments this month — for patients seen
        supabase
          .from("appointments")
          .select("patient_id")
          .gte("appointment_date", monthStart)
          .lte("appointment_date", monthEnd)
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
          .limit(12),
      ]));

      // ── Compute month stats ────────────────────────────────
      const monthInvoiced  = (monthInvoicesRes.data  ?? []).reduce((s, r) => s + (r.total  ?? 0), 0);
      const monthCollected = (monthPaymentsRes.data   ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
      const patientsSeen   = new Set(
        (monthApptsRes.data ?? []).map((a: any) => a.patient_id).filter(Boolean)
      ).size;

      // ── Compute overview stats ─────────────────────────────
      const pendingList       = pendingInvoicesRes.data ?? [];
      const outstandingAmount = pendingList.reduce((s, r) => s + (r.total ?? 0), 0);

      setMonthStats({
        invoiced:     monthInvoiced,
        collected:    monthCollected,
        patientsSeen,
        newPatients:  newPatientsRes.count ?? 0,
      });

      setOverview({
        totalPatients:    totalPatientsRes.count  ?? 0,
        orthoPatients:    orthoPatientsRes.count  ?? 0,
        outstandingCount:  pendingList.length,
        outstandingAmount,
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
          <div className="flex flex-col gap-5">

            {/* ── Monthly stats ──────────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="dash-month-label">{monthLabel}</span>
                <span className="text-xs text-slate-400">— monthly overview</span>
              </div>
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <DashboardCard
                  title="Total Invoiced"
                  value={formatMoney(monthStats.invoiced)}
                  icon={DashIcons.receipt}
                  href="/reports/payments"
                />
                <DashboardCard
                  title="Total Collected"
                  value={formatMoney(monthStats.collected)}
                  icon={DashIcons.checkCircle}
                  valueClassName="text-2xl font-bold text-emerald-600"
                  href="/reports/payments"
                />
                <DashboardCard
                  title="Patients Seen"
                  value={monthStats.patientsSeen}
                  icon={DashIcons.activity}
                  subtext="Unique patients with appt"
                  href="/patients"
                />
                <DashboardCard
                  title="New Patients"
                  value={monthStats.newPatients}
                  icon={DashIcons.userPlus}
                  subtext="Registered this month"
                  href="/patients"
                />
              </div>
            </div>

            {/* ── All-time overview ──────────────────────────── */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
              <DashboardCard
                title="Total Patients"
                value={overview.totalPatients.toLocaleString()}
                icon={DashIcons.users}
                href="/patients"
              />
              <DashboardCard
                title="Active Ortho"
                value={overview.orthoPatients}
                icon={DashIcons.tooth}
                subtext="Braces & aligners"
                href="/patients"
              />
              <DashboardCard
                title="Outstanding Balance"
                value={formatMoney(overview.outstandingAmount)}
                icon={DashIcons.alertCircle}
                subtext={`${overview.outstandingCount} unpaid invoice${overview.outstandingCount !== 1 ? "s" : ""}`}
                valueClassName="text-2xl font-bold text-orange-600"
                href="/reports/payments"
              />
            </div>

            {/* ── Main content ───────────────────────────────── */}
            <div className="grid gap-4 lg:grid-cols-3">

              {/* Upcoming appointments */}
              <div className="lg:col-span-2">
                <div className="card">
                  <div className="card-header mb-4">
                    <div className="card-title">Upcoming Appointments</div>
                    <Link href="/appointments" className="dash-card-link">View all →</Link>
                  </div>

                  {upcoming.length === 0 ? (
                    <p className="text-center text-sm text-slate-400 py-8">No upcoming appointments in the next 30 days</p>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {upcoming.map((apt) => {
                        const { day, month, dow } = fmtApptDate(apt.appointment_date);
                        return (
                          <div key={apt.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                            {/* Date block */}
                            <div className="flex-shrink-0 w-12 text-center">
                              <p className="text-[10px] font-semibold text-slate-400 uppercase leading-none">{dow}</p>
                              <p className="text-xl font-bold text-slate-800 leading-tight">{day}</p>
                              <p className="text-[10px] font-medium uppercase leading-none" style={{ color: "var(--accent-text)" }}>{month}</p>
                            </div>
                            <div className="w-px h-8 bg-slate-100 flex-shrink-0" />
                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">
                                {apt.patients?.full_name ?? "—"}
                              </p>
                              <p className="text-xs text-slate-400 truncate">
                                {fmt12Hr(apt.appointment_time)}
                                {apt.dentists?.full_name ? ` · ${apt.dentists.full_name}` : ""}
                              </p>
                            </div>
                            <span className={`badge flex-shrink-0 ${apt.status === "confirmed" ? "badge-success" : "badge-secondary"}`}>
                              {apt.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right sidebar */}
              <div className="flex flex-col gap-4">
                {/* Quick stats card */}
                <div className="card">
                  <div className="card-header mb-4">
                    <div className="card-title">Quick Links</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: "Appointments",    href: "/appointments" },
                      { label: "Messages",         href: "/messages" },
                      { label: "Patients",         href: "/patients" },
                      { label: "Payment Reports",  href: "/reports/payments" },
                      { label: "Settings",         href: "/settings" },
                    ].map(({ label, href }) => (
                      <Link
                        key={href}
                        href={href}
                        className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors group"
                        style={{ background: "var(--color-violet-50)" }}
                      >
                        <span>{label}</span>
                        <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Collection rate */}
                {monthStats.invoiced > 0 && (
                  <div className="card">
                    <div className="card-title mb-3">Collection Rate</div>
                    <div className="text-center py-2">
                      <p className="text-4xl font-bold" style={{ color: "var(--accent-text)" }}>
                        {Math.round((monthStats.collected / monthStats.invoiced) * 100)}%
                      </p>
                      <p className="text-xs text-slate-400 mt-1">{monthLabel}</p>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.round((monthStats.collected / monthStats.invoiced) * 100))}%`,
                          background: "var(--color-violet-500)",
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5 text-[11px] text-slate-400">
                      <span>Collected {formatMoney(monthStats.collected)}</span>
                      <span>of {formatMoney(monthStats.invoiced)}</span>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}
