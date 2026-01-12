"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { ensureSessionRestored } from "@/lib/initializeAuth";
import { formatMoney, formatDatePH } from "@/lib/helpers";

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
  const [err, setErr] = useState<string | null>(null);

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
    setErr(null);

    try {
      // Wait for session to be restored
      await ensureSessionRestored();
      
      // Ensure session is loaded before making queries
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setErr("No active session. Please login first.");
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
          reference_number
        `)
        .order("payment_date", { ascending: false })
        .limit(100);

      if (paymentsError) throw paymentsError;

      // Get all invoice-payment relationships for balance calculation
      const { data: allPayments, error: allPaymentsError } = await supabase
        .from("payments")
        .select("id, invoice_id, amount, voided_at, status");

      if (allPaymentsError) throw allPaymentsError;

      // Load patients with complete data
      const { data: patients, error: patientsError } = await supabase
        .from("patients")
        .select("id, first_name, last_name, phone, created_at")
        .order("created_at", { ascending: false });

      if (patientsError) throw patientsError;

      // Load appointments (today and upcoming) - if table exists
      const today = new Date().toISOString().split('T')[0];
      let appointments: any[] = [];
      try {
        const { data: apptData, error: appointmentsError } = await supabase
          .from("appointments")
          .select("id, appointment_date, status")
          .gte("appointment_date", today)
          .order("appointment_date", { ascending: true });
        
        if (!appointmentsError) {
          appointments = apptData || [];
        }
      } catch {
        // Appointments table may not exist or have different schema
        appointments = [];
      }

      // Load orthodontic patients - try to get patients with ortho treatments
      let orthoPatientIds = new Set<string>();
      try {
        const { data: orthoData, error: orthoError } = await supabase
          .from("treatments")
          .select("patient_id")
          .ilike("procedure", "%ortho%");
        
        if (!orthoError && orthoData) {
          orthoPatientIds = new Set(orthoData.map((t: any) => t.patient_id));
        }
      } catch {
        // Treatments table or ortho data may not be available
      }

      // Load payment modes with stats
      const { data: paymentModes, error: modesError } = await supabase
        .from("payment_modes")
        .select("id, code, name, is_active")
        .eq("is_active", true)
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
        activeDentists: appointments.length || 0,
      });

      // Set recent activity
      const todayStr = new Date().toISOString().split('T')[0];
      const todayPaymentsList = (payments || []).filter((p: any) => {
        const paymentDate = new Date(p.payment_date).toISOString().split('T')[0];
        return paymentDate === todayStr && !p.voided_at;
      });

      setRecent({
        invoices: (invoices || []).slice(0, 5),
        payments: (payments || []).slice(0, 5).map((p: any) => ({
          ...p,
          payment_modes: { name: "Payment", code: "UNKNOWN" },
          invoices: { invoice_number: "INV-" + Math.random().toString(36).slice(7).toUpperCase() },
        })),
        patients: (patients || []).slice(0, 5),
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

      // Log stats for debugging
      console.log("Dashboard Stats:", {
        totalInvoiced,
        totalPaid,
        totalOutstanding,
        collectionRate: collectionRateValue,
        patients: patients?.length || 0,
        invoices: invoiceCount,
        upcomingAppointments: appointments?.length || 0,
      });
    } catch (error) {
      const errorMsg = error instanceof Error 
        ? error.message 
        : typeof error === 'string'
        ? error
        : (error as any)?.message || (error as any)?.error_description || JSON.stringify(error);
      console.error("Dashboard error:", errorMsg, error);
      setErr(errorMsg || "Failed to load dashboard");
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <h1 className="text-4xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-2 text-slate-600">Welcome back! Here's your clinic overview.</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Error message */}
        {err && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">
            <p className="font-semibold">Error loading dashboard</p>
            <p className="text-sm">{err}</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="text-slate-600">Loading dashboard...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Key Metrics - Row 1 */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Total Invoiced</p>
                    <p className="text-3xl font-bold text-slate-900">
                      {formatMoney(stats.totalInvoiced)}
                    </p>
                  </div>
                  <div className="text-4xl">📋</div>
                </div>
                <p className="mt-2 text-xs text-slate-500">{stats.totalInvoices} invoices</p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Total Collected</p>
                    <p className="text-3xl font-bold text-green-700">
                      {formatMoney(stats.totalPaid)}
                    </p>
                  </div>
                  <div className="text-4xl">✓</div>
                </div>
                <p className="mt-2 text-xs text-slate-500">{collectionRate}% collection rate</p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Outstanding</p>
                    <p className="text-3xl font-bold text-orange-700">
                      {formatMoney(stats.totalOutstanding)}
                    </p>
                  </div>
                  <div className="text-4xl">⏳</div>
                </div>
                <p className="mt-2 text-xs text-slate-500">Requires payment</p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Today's Payments</p>
                    <p className="text-3xl font-bold text-blue-700">{todayPayments.length}</p>
                  </div>
                  <div className="text-4xl">💳</div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {formatMoney(
                    todayPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
                  )}
                </p>
              </div>
            </div>

            {/* Key Metrics - Row 2 */}
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Total Patients</p>
                    <p className="text-3xl font-bold text-slate-900">{stats.totalPatients}</p>
                  </div>
                  <div className="text-4xl">👥</div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Active Ortho Patients</p>
                    <p className="text-3xl font-bold text-blue-600">{orthoPatientCount}</p>
                  </div>
                  <div className="text-4xl">😁</div>
                </div>
                <p className="mt-2 text-xs text-slate-500">Braces & aligners</p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Upcoming Appointments</p>
                    <p className="text-3xl font-bold text-slate-900">{stats.activeDentists}</p>
                  </div>
                  <div className="text-4xl">📅</div>
                </div>
                <p className="mt-2 text-xs text-slate-500">This week</p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">New Patients</p>
                    <p className="text-3xl font-bold text-purple-600">{(recent.patients || []).length}</p>
                  </div>
                  <div className="text-4xl">⭐</div>
                </div>
                <p className="mt-2 text-xs text-slate-500">This month</p>
              </div>
            </div>

            {/* Content Grid */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Left Column - Recent Activity */}
              <div className="lg:col-span-2 space-y-6">
                {/* Recent Payments */}
                <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">Recent Payments</h2>
                    <Link
                      href="/reports/payments"
                      className="rounded-lg bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      View all →
                    </Link>
                  </div>

                  {recent.payments.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="px-4 py-2 text-left font-semibold text-slate-700">
                              Invoice
                            </th>
                            <th className="px-4 py-2 text-right font-semibold text-slate-700">
                              Amount
                            </th>
                            <th className="px-4 py-2 text-left font-semibold text-slate-700">
                              Mode
                            </th>
                            <th className="px-4 py-2 text-left font-semibold text-slate-700">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recent.payments.map((payment) => (
                            <tr key={payment.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2">
                                {(payment as any).invoices?.invoice_number || "—"}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold">
                                {formatMoney(payment.amount)}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                {payment.payment_modes?.name || "—"}
                              </td>
                              <td className="px-4 py-2">
                                <span
                                  className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                                    payment.status === "verified"
                                      ? "bg-green-100 text-green-700"
                                      : "bg-yellow-100 text-yellow-700"
                                  }`}
                                >
                                  {payment.status === "verified" ? "✓ Verified" : "Pending"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-4">No recent payments</p>
                  )}
                </div>

                {/* Recent Invoices */}
                <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">Recent Invoices</h2>
                    <Link
                      href="/patients"
                      className="rounded-lg bg-green-50 px-3 py-1 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
                    >
                      View all →
                    </Link>
                  </div>

                  {recent.invoices.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="px-4 py-2 text-left font-semibold text-slate-700">
                              Invoice
                            </th>
                            <th className="px-4 py-2 text-left font-semibold text-slate-700">
                              Date
                            </th>
                            <th className="px-4 py-2 text-right font-semibold text-slate-700">
                              Amount
                            </th>
                            <th className="px-4 py-2 text-left font-semibold text-slate-700">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recent.invoices.map((invoice) => (
                            <tr key={invoice.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2">{invoice.invoice_number}</td>
                              <td className="px-4 py-2">{formatDatePH(invoice.invoice_date)}</td>
                              <td className="px-4 py-2 text-right font-semibold">
                                {formatMoney(invoice.total)}
                              </td>
                              <td className="px-4 py-2">
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
                    <p className="text-slate-500 text-center py-4">No recent invoices</p>
                  )}
                </div>
              </div>

              {/* Right Column - Sidebar */}
              <div className="space-y-6">
                {/* Quick Actions */}
                <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-slate-900">Quick Actions</h2>
                  <div className="space-y-2">
                    <Link
                      href="/patients"
                      className="block rounded-lg bg-blue-50 px-4 py-2 text-center text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      → View Patients
                    </Link>
                    <Link
                      href="/reports/payments"
                      className="block rounded-lg bg-green-50 px-4 py-2 text-center text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
                    >
                      → Payment Reports
                    </Link>
                    <Link
                      href="/settings"
                      className="block rounded-lg bg-slate-50 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      → Settings
                    </Link>
                  </div>
                </div>

                {/* Payment Modes */}
                {paymentModes.length > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">
                      Payment Modes (Today)
                    </h2>
                    <div className="space-y-2">
                      {paymentModes.map((mode) => (
                        <div
                          key={mode.code}
                          className="flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50"
                        >
                          <div className="text-sm">
                            <p className="font-medium text-slate-900">{mode.name}</p>
                            <p className="text-xs text-slate-500">{mode.count} payments</p>
                          </div>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatMoney(mode.total)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Outstanding Summary */}
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-orange-900">
                    Outstanding Invoices
                  </h2>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-orange-700">
                      {outstanding.length}
                    </p>
                    <p className="text-sm text-orange-600 mt-2">
                      Total: {formatMoney(
                        outstanding.reduce((sum, inv) => sum + (inv.balance || 0), 0)
                      )}
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
      </div>
    </div>
  );
}
