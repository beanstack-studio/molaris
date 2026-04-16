"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { formatMoney, formatDateStandard } from "@/lib/helpers";
import { DashboardCard } from "@/components/DashboardCard";
import { PageLoader } from "@/components/Spinner";


interface DashboardStats {
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  totalPatients: number;
  totalInvoices: number;
  upcomingAppointments: number;
}

interface RecentActivity {
  invoices: any[];
  payments: any[];
  newPatientCount: number;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [loadingTooLong, setLoadingTooLong] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<DashboardStats>({
    totalInvoiced: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    totalPatients: 0,
    totalInvoices: 0,
    upcomingAppointments: 0,
  });

  const [recent, setRecent] = useState<RecentActivity>({
    invoices: [],
    payments: [],
    newPatientCount: 0,
  });

  const [outstanding, setOutstanding] = useState<any[]>([]);
  const [paymentModes, setPaymentModes] = useState<any[]>([]);
  const [orthoPatientCount, setOrthoPatientCount] = useState(0);
  const [todayPayments, setTodayPayments] = useState<any[]>([]);

  useEffect(() => {
    setLoadingTooLong(false);
    const slowTimer = setTimeout(() => setLoadingTooLong(true), 8000);
    loadDashboardData().finally(() => clearTimeout(slowTimer));
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("No active session. Please login first.");
        setLoading(false);
        return;
      }

      const today = new Date().toISOString().split("T")[0];
      const endOfMonth = new Date(Date.now() + 30 * 86_400_000).toISOString().split("T")[0];
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Run all independent queries in parallel with a 15-second timeout
      const withTimeout = <T,>(p: Promise<T>, ms = 15_000): Promise<T> =>
        Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("Query timed out — check your connection")), ms))]);

      const [
        invoicesRes,
        paymentsRes,
        patientCountRes,
        orthoCountRes,
        newPatientsRes,
        appointmentsRes,
        paymentModesRes,
      ] = await withTimeout(Promise.all([
        supabase
          .from("invoices")
          .select("id, invoice_number, invoice_date, total, status, patient_id")
          .order("invoice_date", { ascending: false })
          .limit(200),
        supabase
          .from("payments")
          .select("id, amount, payment_date, status, voided_at, invoice_id, patient_id, transaction_id, reference_number, details")
          .order("payment_date", { ascending: false })
          .limit(500),
        // Use limit(1) + count instead of head:true — more compatible with all Supabase plans
        supabase.from("patients").select("id", { count: "exact" }).limit(1),
        supabase.from("patients").select("id", { count: "exact" }).limit(1).eq("ortho_patient", true),
        supabase.from("patients").select("id").gte("created_at", firstDayOfMonth),
        supabase
          .from("appointments")
          .select("id")
          .gte("appointment_date", today)
          .lte("appointment_date", endOfMonth)
          .is("deleted_at", null),
        supabase.from("payment_modes").select("id, code, name").order("sort_order", { ascending: true }),
      ]));

      if (invoicesRes.error) throw invoicesRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const invoices = invoicesRes.data || [];
      const payments = paymentsRes.data || [];

      // Calculate paid amounts per invoice
      const paidByInvoice: Record<string, number> = {};
      payments.forEach((p: any) => {
        if (!p.voided_at && p.invoice_id) {
          paidByInvoice[p.invoice_id] = (paidByInvoice[p.invoice_id] || 0) + (p.amount || 0);
        }
      });

      // Aggregate stats
      let totalInvoiced = 0;
      let totalOutstanding = 0;
      invoices.forEach((inv: any) => {
        totalInvoiced += inv.total || 0;
        const paid = paidByInvoice[inv.id] || 0;
        totalOutstanding += Math.max(0, (inv.total || 0) - paid);
      });
      const totalPaid = totalInvoiced - totalOutstanding;

      setStats({
        totalInvoiced,
        totalPaid,
        totalOutstanding,
        totalPatients: patientCountRes.count || 0,
        totalInvoices: invoices.length,
        upcomingAppointments: (appointmentsRes as any)?.data?.length || 0,
      });

      setOrthoPatientCount(orthoCountRes.count || 0);

      // Outstanding invoices (top 10) + load patient names for just those
      const outstandingList = invoices
        .map((inv: any) => {
          const paid = paidByInvoice[inv.id] || 0;
          const balance = Math.max(0, (inv.total || 0) - paid);
          return { ...inv, paid_amount: paid, balance, patients: { first_name: "", last_name: "" } };
        })
        .filter((inv: any) => inv.balance > 0)
        .sort((a: any, b: any) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime())
        .slice(0, 10);

      const patientIds = [...new Set(outstandingList.map((inv: any) => inv.patient_id).filter(Boolean))];
      if (patientIds.length > 0) {
        const { data: patientData } = await supabase
          .from("patients")
          .select("id, first_name, last_name")
          .in("id", patientIds);
        if (patientData) {
          const pMap = Object.fromEntries(patientData.map((p: any) => [p.id, p]));
          outstandingList.forEach((inv: any) => {
            const p = pMap[inv.patient_id];
            if (p) inv.patients = { first_name: p.first_name, last_name: p.last_name };
          });
        }
      }
      setOutstanding(outstandingList);

      // Today's payments
      const todayList = payments.filter((p: any) => {
        const d = new Date(p.payment_date).toISOString().split("T")[0];
        return d === today && !p.voided_at;
      });
      setTodayPayments(todayList);

      setRecent({
        invoices: invoices.slice(0, 5),
        payments: payments.slice(0, 5).map((p: any) => ({
          ...p,
          payment_modes: { name: p.details?.payment_mode_name || "—", code: p.details?.payment_mode_code || "" },
        })),
        newPatientCount: newPatientsRes.data?.length || 0,
      });

      // Payment mode breakdown
      const modeCounts: Record<string, any> = {};
      payments.forEach((p: any) => {
        if (p.voided_at) return;
        const key = p.status === "verified" ? "VERIFIED" : p.status === "pending" ? "PENDING" : "OTHER";
        if (!modeCounts[key]) {
          modeCounts[key] = {
            code: key,
            name: key === "VERIFIED" ? "Verified Payments" : key === "PENDING" ? "Pending Payments" : "Other",
            count: 0,
            total: 0,
          };
        }
        modeCounts[key].count += 1;
        modeCounts[key].total += p.amount || 0;
      });
      setPaymentModes(
        Object.values(modeCounts)
          .filter((m: any) => m.count > 0)
          .sort((a: any, b: any) => b.total - a.total)
          .slice(0, 5) as any
      );

    } catch (err) {
      const msg = err instanceof Error ? err.message : (err as any)?.message || "Failed to load dashboard";
      console.error("Dashboard error:", msg, err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const collectionRate =
    stats.totalInvoiced > 0 ? Math.round((stats.totalPaid / stats.totalInvoiced) * 100) : 0;

  return (
    <div className="page-bg">
      <main className="app-section">
        <div className="app-section-header">
          <div>
            <div className="app-section-title">Dashboard</div>
          </div>
        </div>

        {error && <div className="error-banner mb-4">{error}</div>}

        {loading ? (
          <PageLoader>
            {loadingTooLong && (
              <div className="flex flex-col items-center gap-2 mt-3">
                <p className="text-sm text-slate-500">Taking longer than usual…</p>
                <button
                  onClick={() => {
                    setLoadingTooLong(false);
                    const slowTimer = setTimeout(() => setLoadingTooLong(true), 8000);
                    loadDashboardData().finally(() => clearTimeout(slowTimer));
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-white/60 hover:bg-white/80 text-slate-700 border border-slate-200 transition-all"
                >
                  Retry
                </button>
              </div>
            )}
          </PageLoader>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Key Metrics - Row 1 */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DashboardCard
                title="Total Invoiced"
                value={formatMoney(stats.totalInvoiced)}
                icon="📋"
                subtext={`${stats.totalInvoices} invoices`}
              />
              <DashboardCard
                title="Total Collected"
                value={formatMoney(stats.totalPaid)}
                icon="✓"
                subtext={`${collectionRate}% collection rate`}
                valueClassName="text-3xl font-bold text-green-700"
              />
              <DashboardCard
                title="Outstanding"
                value={formatMoney(stats.totalOutstanding)}
                icon="⏳"
                subtext="Requires payment"
                valueClassName="text-3xl font-bold text-orange-700"
              />
              <DashboardCard
                title="Today's Payments"
                value={formatMoney(todayPayments.reduce((s, p) => s + (p.amount || 0), 0))}
                icon="💳"
                subtext={`${todayPayments.length} payment${todayPayments.length !== 1 ? "s" : ""}`}
                valueClassName="text-3xl font-bold text-blue-700"
              />
            </div>

            {/* Key Metrics - Row 2 */}
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <DashboardCard title="Total Patients" value={stats.totalPatients} icon="👥" />
              <DashboardCard
                title="Active Ortho Patients"
                value={orthoPatientCount}
                icon="😁"
                subtext="Braces & aligners"
                valueClassName="text-3xl font-bold text-blue-600"
              />
              <DashboardCard
                title="Upcoming Appointments"
                value={stats.upcomingAppointments}
                icon="📅"
                subtext="Next 30 days"
              />
              <DashboardCard
                title="New Patients"
                value={recent.newPatientCount}
                icon="⭐"
                subtext="This month"
                valueClassName="text-3xl font-bold text-violet-600"
              />
            </div>

            {/* Content Grid */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-4">
                {/* Recent Payments */}
                <div className="card">
                  <div className="card-header mb-4">
                    <div className="card-title">Recent Payments</div>
                  </div>
                  {recent.payments.length > 0 ? (
                    <div className="table-wrapper">
                      <table className="data-table">
                        <colgroup>
                          <col className="col-30" />
                          <col className="col-20" />
                          <col className="col-25" />
                          <col className="col-25" />
                        </colgroup>
                        <thead className="data-table-head">
                          <tr>
                            <th className="data-table-head-cell">Transaction ID</th>
                            <th className="data-table-head-cell-right">Amount</th>
                            <th className="data-table-head-cell">Mode</th>
                            <th className="data-table-head-cell">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recent.payments.map((payment, index) => (
                            <tr
                              key={payment.id}
                              className={`data-table-row ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}
                            >
                              <td className="data-table-cell">{payment.transaction_id || "—"}</td>
                              <td className="data-table-cell-right font-semibold">{formatMoney(payment.amount)}</td>
                              <td className="data-table-cell">{payment.payment_modes?.name || "—"}</td>
                              <td className="data-table-cell">
                                <span
                                  className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                                    payment.status === "verified"
                                      ? "bg-green-100 text-green-700"
                                      : "bg-yellow-100 text-yellow-700"
                                  }`}
                                >
                                  {payment.status === "verified" ? "Verified" : "Pending"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="data-table-empty">No recent payments</p>
                  )}
                </div>

                {/* Recent Invoices */}
                <div className="card">
                  <div className="card-header mb-4">
                    <div className="card-title">Recent Invoices</div>
                  </div>
                  {recent.invoices.length > 0 ? (
                    <div className="table-wrapper">
                      <table className="data-table">
                        <colgroup>
                          <col className="col-30" />
                          <col className="col-25" />
                          <col className="col-20" />
                          <col className="col-25" />
                        </colgroup>
                        <thead className="data-table-head">
                          <tr>
                            <th className="data-table-head-cell">Invoice</th>
                            <th className="data-table-head-cell">Date</th>
                            <th className="data-table-head-cell-right">Amount</th>
                            <th className="data-table-head-cell">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recent.invoices.map((invoice, index) => (
                            <tr
                              key={invoice.id}
                              className={`data-table-row ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}
                            >
                              <td className="data-table-cell">{invoice.invoice_number}</td>
                              <td className="data-table-cell">{formatDateStandard(invoice.invoice_date)}</td>
                              <td className="data-table-cell-right font-semibold">{formatMoney(invoice.total)}</td>
                              <td className="data-table-cell">
                                <span
                                  className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                                    invoice.status === "paid"
                                      ? "bg-green-100 text-green-700"
                                      : "bg-yellow-100 text-yellow-700"
                                  }`}
                                >
                                  {invoice.status === "paid" ? "Paid" : "Pending"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="data-table-empty">No recent invoices</p>
                  )}
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div className="card">
                  <div className="card-header mb-4">
                    <div className="card-title">Quick Actions</div>
                  </div>
                  <div className="space-y-2">
                    <Link
                      href="/patients"
                      className="block rounded-lg bg-blue-50 px-4 py-2 text-center text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      View Patients
                    </Link>
                    <Link
                      href="/reports/payments"
                      className="block rounded-lg bg-green-50 px-4 py-2 text-center text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
                    >
                      Payment Reports
                    </Link>
                    <Link
                      href="/settings"
                      className="block rounded-lg bg-slate-50 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      Settings
                    </Link>
                  </div>
                </div>

                {paymentModes.length > 0 && (
                  <div className="card">
                    <div className="card-header mb-4">
                      <div className="card-title">Payment Breakdown</div>
                    </div>
                    <div className="space-y-2">
                      {paymentModes.map((mode) => (
                        <div
                          key={mode.code}
                          className="flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50"
                        >
                          <div className="text-sm">
                            <p className="font-medium text-slate-900">{mode.name}</p>
                            <p className="text-muted-xs">{mode.count} payments</p>
                          </div>
                          <p className="item-value">{formatMoney(mode.total)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="card">
                  <div className="card-header mb-4">
                    <div className="card-title">Outstanding Invoices</div>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-orange-700">{outstanding.length}</p>
                    <p className="text-sm text-slate-500 mt-2">
                      Total: {formatMoney(outstanding.reduce((s, inv) => s + (inv.balance || 0), 0))}
                    </p>
                    <Link
                      href="/reports/payments"
                      className="mt-3 inline-block rounded-lg bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700 hover:bg-orange-200 transition-colors"
                    >
                      View details →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
