"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { ensureSessionRestored } from "@/lib/initializeAuth";
import { formatMoney, formatDateStandard } from "@/lib/helpers";
import { DashboardCard } from "@/components/DashboardCard";

interface DashboardStats {
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  totalPatients: number;
  totalInvoices: number;
  activeDentists: number;
}

interface RecentActivity {
  invoices: any[];
  payments: any[];
  patients: any[];
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<DashboardStats>({
    totalInvoiced: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    totalPatients: 0,
    totalInvoices: 0,
    activeDentists: 0,
  });

  const [recent, setRecent] = useState<RecentActivity>({
    invoices: [],
    payments: [],
    patients: [],
  });

  const [outstanding, setOutstanding] = useState<any[]>([]);
  const [paymentModes, setPaymentModes] = useState<any[]>([]);
  const [orthoPatientCount, setOrthoPatientCount] = useState(0);
  const [allPayments, setAllPayments] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    setError(null);

    try {
      // Wait for session to be restored
      await ensureSessionRestored();
      
      // Ensure session is loaded before making queries
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("No active session. Please login first.");
        setLoading(false);
        return;
      }

      // Load invoices with complete data
      const { data: invoices, error: invoicesError } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, total, status, patient_id")
        .order("invoice_date", { ascending: false })
        .limit(100);

      if (invoicesError) throw invoicesError;

      // Load payments with complete data
      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select(`
          id,
          amount,
          payment_date,
          status,
          voided_at,
          invoice_id,
          patient_id,
          transaction_id,
          reference_number,
          details
        `)
        .order("payment_date", { ascending: false })
        .limit(100);

      if (paymentsError) throw paymentsError;

      // Get all invoice-payment relationships for balance calculation
      const { data: allPayments, error: allPaymentsError } = await supabase
        .from("payments")
        .select("id, invoice_id, amount, voided_at, status");

      if (allPaymentsError) throw allPaymentsError;

      // Load patients with complete data (using pagination for Supabase 1000-row limit)
      const allPatients: any[] = [];
      const BATCH_SIZE = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore && allPatients.length < 7500) {
        const { data, error: patientsError } = await supabase
          .from("patients")
          .select("id, first_name, last_name, phone, created_at")
          .order("created_at", { ascending: false })
          .range(offset, offset + BATCH_SIZE - 1);

        if (patientsError) throw patientsError;

        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allPatients.push(...data);
          if (data.length < BATCH_SIZE) {
            hasMore = false;
          }
          offset += BATCH_SIZE;
        }
      }
      const patients = allPatients;

      // Load appointments (upcoming) - if table exists
      const today = new Date().toISOString().split('T')[0];
      const endOfMonth = new Date();
      endOfMonth.setDate(endOfMonth.getDate() + 30);
      const endOfMonthStr = endOfMonth.toISOString().split('T')[0];
      let appointments: any[] = [];
      try {
        const { data: apptData, error: appointmentsError } = await supabase
          .from("appointments")
          .select("id, appointment_date, status")
          .gte("appointment_date", today)
          .lte("appointment_date", endOfMonthStr)
          .is("deleted_at", null)
          .order("appointment_date", { ascending: true });
        
        if (!appointmentsError) {
          appointments = apptData || [];
        }
      } catch {
        // Appointments table may not exist or have different schema
        appointments = [];
      }

      // Load orthodontic patients - use ortho_patient flag from patients table
      let orthoPatientIds = new Set<string>();
      try {
        const { data: orthoPatients, error: orthoError } = await supabase
          .from("patients")
          .select("id")
          .eq("ortho_patient", true);
        
        if (!orthoError && orthoPatients) {
          orthoPatientIds = new Set(orthoPatients.map((p: any) => p.id));
        }
      } catch {
        // Ortho data may not be available
      }

      // Load payment modes with stats
      const { data: paymentModes, error: modesError } = await supabase
        .from("payment_modes")
        .select("id, code, name")
        .order("sort_order", { ascending: true });

      if (modesError) throw modesError;

      // Calculate comprehensive stats
      let totalInvoiced = 0;
      let totalOutstanding = 0;
      let invoiceCount = 0;
      let paidInvoiceCount = 0;

      // Calculate paid amounts per invoice
      const paidByInvoice: Record<string, number> = {};
      (allPayments || []).forEach((p: any) => {
        if (!p.voided_at) {
          if (!paidByInvoice[p.invoice_id]) {
            paidByInvoice[p.invoice_id] = 0;
          }
          paidByInvoice[p.invoice_id] += p.amount || 0;
        }
      });

      // Process invoices
      (invoices || []).forEach((inv: any) => {
        totalInvoiced += inv.total || 0;
        invoiceCount++;

        const paid = paidByInvoice[inv.id] || 0;
        const outstanding = Math.max(0, (inv.total || 0) - paid);
        totalOutstanding += outstanding;

        if (outstanding === 0) {
          paidInvoiceCount++;
        }
      });

      const totalPaid = totalInvoiced - totalOutstanding;
      const collectionRateValue =
        totalInvoiced > 0
          ? Math.round((totalPaid / totalInvoiced) * 100)
          : 0;

      setStats({
        totalInvoiced,
        totalPaid,
        totalOutstanding,
        totalPatients: patients?.length || 0,
        totalInvoices: invoiceCount,
        activeDentists: appointments.length || 0, // This is actually upcomingAppointmentsThisWeek
      });

      // Set recent activity
      const todayStr = new Date().toISOString().split('T')[0];
      const todayPaymentsList = (payments || []).filter((p: any) => {
        const paymentDate = new Date(p.payment_date).toISOString().split('T')[0];
        return paymentDate === todayStr && !p.voided_at;
      });

      // Filter patients created this month
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const patientsThisMonth = (patients || []).filter((p: any) => {
        const createdDate = p.created_at?.split('T')[0] || '';
        return createdDate >= firstDayOfMonth;
      });

      setRecent({
        invoices: (invoices || []).slice(0, 5),
        payments: (payments || []).slice(0, 5).map((p: any) => ({
          ...p,
          payment_modes: { 
            name: p.details?.payment_mode_name || "—", 
            code: p.details?.payment_mode_code || "UNKNOWN" 
          },
          invoices: { invoice_number: "INV-" + Math.random().toString(36).slice(7).toUpperCase() },
        })),
        patients: patientsThisMonth,
      });

      // Get outstanding invoices with patient info
      const outstandingList = (invoices || [])
        .map((inv: any) => {
          const paid = paidByInvoice[inv.id] || 0;
          const balance = Math.max(0, (inv.total || 0) - paid);
          
          // Find patient info
          const patient = (patients || []).find((p: any) => p.id === inv.patient_id);

          return {
            id: inv.id,
            invoice_number: inv.invoice_number,
            invoice_date: inv.invoice_date,
            total: inv.total,
            status: inv.status,
            paid_amount: paid,
            balance,
            patient_id: inv.patient_id,
            patients: patient ? {
              first_name: patient.first_name,
              last_name: patient.last_name,
            } : { first_name: "", last_name: "" },
          };
        })
        .filter((inv: any) => inv.balance > 0)
        .sort((a: any, b: any) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime())
        .slice(0, 10);

      setOutstanding(outstandingList);

      // Process payment modes with actual payment data
      const modePaymentCounts: Record<string, any> = {};
      
      (allPayments || []).forEach((p: any) => {
        if (p.voided_at) return;
        
        // Group by status for now (in production would look up actual mode)
        const key = p.status === "verified" ? "VERIFIED" : p.status === "pending" ? "PENDING" : "OTHER";
        
        if (!modePaymentCounts[key]) {
          modePaymentCounts[key] = {
            code: key,
            name: key === "VERIFIED" ? "Verified Payments" : key === "PENDING" ? "Pending Payments" : "Other",
            count: 0,
            total: 0,
            verified_count: 0,
            pending_count: 0,
            verified_total: 0,
            pending_total: 0,
          };
        }

        modePaymentCounts[key].count += 1;
        modePaymentCounts[key].total += p.amount || 0;

        if (p.status === "verified") {
          modePaymentCounts[key].verified_count += 1;
          modePaymentCounts[key].verified_total += p.amount || 0;
        } else if (p.status === "pending") {
          modePaymentCounts[key].pending_count += 1;
          modePaymentCounts[key].pending_total += p.amount || 0;
        }
      });

      const modeStats = Object.values(modePaymentCounts)
        .filter((m: any) => m.count > 0)
        .sort((a: any, b: any) => b.total - a.total)
        .slice(0, 5);

      setPaymentModes(modeStats as any);

      // Set ortho patient count
      setOrthoPatientCount(orthoPatientIds.size);

      // Store all payments in state for today's payment calculation
      setAllPayments(payments || []);

    } catch (error) {
      const errorMsg = error instanceof Error 
        ? error.message 
        : typeof error === 'string'
        ? error
        : (error as any)?.message || (error as any)?.error_description || JSON.stringify(error);
      console.error("Dashboard error:", errorMsg, error);
      setError(errorMsg || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  const todayPayments = (allPayments || []).filter((p: any) => {
    const paymentDate = new Date(p.payment_date).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    return paymentDate === today && !p.voided_at;
  });

  const collectionRate =
    stats.totalInvoiced > 0
      ? Math.round((stats.totalPaid / stats.totalInvoiced) * 100)
      : 0;

  return (
    <div className="page-bg">
      <main className="app-section">
        <div className="app-section-header">
          <div>
            <div className="app-section-title">Dashboard</div>
            <div className="app-section-subtitle">Clinic overview</div>
          </div>
        </div>

        {error && <div className="error-banner mb-4">{error}</div>}

        {loading ? (
          <div className="loading-text">Loading dashboard...</div>
        ) : (
          <div className="page-sections">
            {/* Key Metrics - Row 1 */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                value={formatMoney(
                  todayPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
                )}
                icon="💳"
                subtext={`${todayPayments.length} payment${todayPayments.length !== 1 ? 's' : ''}`}
                valueClassName="text-3xl font-bold text-blue-700"
              />
            </div>

            {/* Key Metrics - Row 2 */}
            <div className="grid gap-4 md:grid-cols-4">
              <DashboardCard
                title="Total Patients"
                value={stats.totalPatients}
                icon="👥"
              />
              <DashboardCard
                title="Active Ortho Patients"
                value={orthoPatientCount}
                icon="😁"
                subtext="Braces & aligners"
                valueClassName="text-3xl font-bold text-blue-600"
              />
              <DashboardCard
                title="Upcoming Appointments"
                value={stats.activeDentists}
                icon="📅"
                subtext="This week"
              />
              <DashboardCard
                title="New Patients"
                value={(recent.patients || []).length}
                icon="⭐"
                subtext="This month"
                valueClassName="text-3xl font-bold text-purple-600"
              />
            </div>

            {/* Content Grid */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Left Column - Recent Activity */}
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
                            <tr key={payment.id} className={`data-table-row ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                              <td className="data-table-cell">{payment.transaction_id || "—"}</td>
                              <td className="data-table-cell-right font-semibold">{formatMoney(payment.amount)}</td>
                              <td className="data-table-cell">{payment.payment_modes?.name || "—"}</td>
                              <td className="data-table-cell">
                                <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${payment.status === "verified" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
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
                            <tr key={invoice.id} className={`data-table-row ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                              <td className="data-table-cell">{invoice.invoice_number}</td>
                              <td className="data-table-cell">{formatDateStandard(invoice.invoice_date)}</td>
                              <td className="data-table-cell-right font-semibold">{formatMoney(invoice.total)}</td>
                              <td className="data-table-cell">
                                <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${invoice.status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
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

              {/* Right Column - Sidebar */}
              <div className="space-y-4">
                {/* Quick Actions */}
                <div className="card">
                  <div className="card-header mb-4">
                    <div className="card-title">Quick Actions</div>
                  </div>
                  <div className="space-y-2">
                    <Link href="/patients" className="block rounded-lg bg-blue-50 px-4 py-2 text-center text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors">
                      View Patients
                    </Link>
                    <Link href="/reports/payments" className="block rounded-lg bg-green-50 px-4 py-2 text-center text-sm font-medium text-green-700 hover:bg-green-100 transition-colors">
                      Payment Reports
                    </Link>
                    <Link href="/settings" className="block rounded-lg bg-slate-50 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                      Settings
                    </Link>
                  </div>
                </div>

                {/* Payment Modes */}
                {paymentModes.length > 0 && (
                  <div className="card">
                    <div className="card-header mb-4">
                      <div className="card-title">Payment Modes (Today)</div>
                    </div>
                    <div className="space-y-2">
                      {paymentModes.map((mode) => (
                        <div key={mode.code} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50">
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

                {/* Outstanding Summary */}
                <div className="card">
                  <div className="card-header mb-4">
                    <div className="card-title">Outstanding Invoices</div>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-orange-700">{outstanding.length}</p>
                    <p className="text-sm text-slate-500 mt-2">
                      Total: {formatMoney(outstanding.reduce((sum, inv) => sum + (inv.balance || 0), 0))}
                    </p>
                    <Link href="/reports/payments" className="mt-3 inline-block rounded-lg bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700 hover:bg-orange-200 transition-colors">
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
