"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  getDailyPaymentSummary,
  getMonthlyPaymentSummary,
  getOutstandingInvoices,
  getPaymentReconciliation,
  getPaymentModeStats,
  getInvoiceBalanceOverview,
  getOverpaidInvoices,
} from "@/lib/paymentReportHelpers";
import { formatMoney, formatDatePH, todayLocalISO } from "@/lib/helpers";

type TabType = "daily" | "monthly" | "outstanding" | "reconciliation" | "modes" | "overview";

export default function PaymentReportsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Daily/Monthly summaries
  const [selectedDate, setSelectedDate] = useState(() => todayLocalISO());
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  });
  const [dailySummary, setDailySummary] = useState<any[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<any>(null);

  // Outstanding invoices
  const [outstanding, setOutstanding] = useState<any[]>([]);

  // Reconciliation
  const [reconStartDate, setReconStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [reconEndDate, setReconEndDate] = useState(() => todayLocalISO());
  const [reconciliation, setReconciliation] = useState<any>(null);

  // Payment mode stats
  const [modeStats, setModeStats] = useState<any[]>([]);

  // Overview
  const [overview, setOverview] = useState<any>(null);
  const [overpaid, setOverpaid] = useState<any[]>([]);

  // Load daily summary
  const loadDailySummary = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      // For now, we'll calculate this from outstanding invoices as RPC might not exist
      const outstanding = await getOutstandingInvoices();
      const summary = outstanding.filter((inv) => inv.invoice_date === selectedDate);
      setDailySummary(summary.length > 0 ? summary : []);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to load daily summary");
      setDailySummary([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Load monthly summary
  const loadMonthlySummary = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const summary = await getMonthlyPaymentSummary(selectedMonth);
      setMonthlySummary(summary);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to load monthly summary");
      setMonthlySummary(null);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  // Load outstanding invoices
  const loadOutstanding = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await getOutstandingInvoices();
      setOutstanding(data);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to load outstanding invoices");
      setOutstanding([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load reconciliation
  const loadReconciliation = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await getPaymentReconciliation(reconStartDate, reconEndDate);
      setReconciliation(data.summary);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to load reconciliation");
      setReconciliation(null);
    } finally {
      setLoading(false);
    }
  }, [reconStartDate, reconEndDate]);

  // Load mode stats
  const loadModeStats = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const stats = await getPaymentModeStats();
      setModeStats(stats);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to load payment mode stats");
      setModeStats([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load overview
  const loadOverview = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await getInvoiceBalanceOverview();
      const overpaidData = await getOverpaidInvoices();
      setOverview(data);
      setOverpaid(overpaidData);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to load overview");
      setOverview(null);
      setOverpaid([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === "daily") loadDailySummary();
    else if (activeTab === "monthly") loadMonthlySummary();
    else if (activeTab === "outstanding") loadOutstanding();
    else if (activeTab === "reconciliation") loadReconciliation();
    else if (activeTab === "modes") loadModeStats();
    else if (activeTab === "overview") loadOverview();
  }, [
    activeTab,
    loadDailySummary,
    loadMonthlySummary,
    loadOutstanding,
    loadReconciliation,
    loadModeStats,
    loadOverview,
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Payment Reports</h1>
          <p className="mt-2 text-slate-600">Analyze payments, invoices, and financial performance</p>
        </div>

        {/* Action Buttons */}
        <div className="mb-6 flex gap-4">
          <Link
            href="/reports/bulk-payments"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            <span>📥</span> Bulk Payments
          </Link>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-slate-300">
          {[
            { key: "overview", label: "📊 Overview" },
            { key: "daily", label: "📅 Daily" },
            { key: "monthly", label: "📈 Monthly" },
            { key: "outstanding", label: "⏳ Outstanding" },
            { key: "reconciliation", label: "✓ Reconciliation" },
            { key: "modes", label: "💳 Payment Modes" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error message */}
        {err && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">
            <p className="font-semibold">Error</p>
            <p>{err}</p>
          </div>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="text-slate-600">Loading...</div>
          </div>
        )}

        {/* Tab content */}
        {!loading && (
          <div className="rounded-lg bg-white p-6 shadow-lg">
            {/* OVERVIEW TAB */}
            {activeTab === "overview" && overview && (
              <div className="space-y-6">
                {/* Key metrics cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg bg-gradient-to-br from-green-50 to-green-100 p-4">
                    <p className="text-sm text-slate-600">Total Paid</p>
                    <p className="text-2xl font-bold text-green-700">
                      {formatMoney(overview.total_paid)}
                    </p>
                    <p className="text-xs text-slate-500">from {overview.paid_count} invoices</p>
                  </div>

                  <div className="rounded-lg bg-gradient-to-br from-orange-50 to-orange-100 p-4">
                    <p className="text-sm text-slate-600">Outstanding</p>
                    <p className="text-2xl font-bold text-orange-700">
                      {formatMoney(overview.total_outstanding)}
                    </p>
                    <p className="text-xs text-slate-500">{overview.outstanding_count} invoices</p>
                  </div>

                  <div className="rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 p-4">
                    <p className="text-sm text-slate-600">Total Invoiced</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {formatMoney(overview.total_invoiced)}
                    </p>
                    <p className="text-xs text-slate-500">{overview.invoice_count} invoices</p>
                  </div>

                  <div className="rounded-lg bg-gradient-to-br from-red-50 to-red-100 p-4">
                    <p className="text-sm text-slate-600">Overpaid</p>
                    <p className="text-2xl font-bold text-red-700">
                      {formatMoney(overview.total_overpaid)}
                    </p>
                    <p className="text-xs text-slate-500">{overpaid.length} invoices</p>
                  </div>
                </div>

                {/* Overpaid invoices */}
                {overpaid.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-lg font-semibold text-slate-900">Overpaid Invoices</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-2 text-left font-semibold text-slate-700">
                              Invoice
                            </th>
                            <th className="px-4 py-2 text-left font-semibold text-slate-700">
                              Patient
                            </th>
                            <th className="px-4 py-2 text-right font-semibold text-slate-700">
                              Total
                            </th>
                            <th className="px-4 py-2 text-right font-semibold text-slate-700">
                              Paid
                            </th>
                            <th className="px-4 py-2 text-right font-semibold text-slate-700">
                              Overpayment
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {overpaid.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2">{inv.invoice_number}</td>
                              <td className="px-4 py-2">
                                {inv.patients?.first_name} {inv.patients?.last_name}
                              </td>
                              <td className="px-4 py-2 text-right">{formatMoney(inv.total)}</td>
                              <td className="px-4 py-2 text-right">
                                {formatMoney(inv.paid_amount)}
                              </td>
                              <td className="px-4 py-2 text-right text-red-700 font-semibold">
                                {formatMoney(inv.paid_amount - inv.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* DAILY TAB */}
            {activeTab === "daily" && (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="rounded-lg border border-slate-300 px-4 py-2"
                  />
                  <button
                    onClick={loadDailySummary}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                  >
                    Refresh
                  </button>
                </div>

                {dailySummary.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold text-slate-700">
                            Invoice
                          </th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-700">
                            Patient
                          </th>
                          <th className="px-4 py-2 text-right font-semibold text-slate-700">
                            Total
                          </th>
                          <th className="px-4 py-2 text-right font-semibold text-slate-700">
                            Balance
                          </th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-700">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {dailySummary.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2">{inv.invoice_number}</td>
                            <td className="px-4 py-2">
                              {inv.patients?.first_name} {inv.patients?.last_name}
                            </td>
                            <td className="px-4 py-2 text-right">{formatMoney(inv.total)}</td>
                            <td
                              className={`px-4 py-2 text-right font-semibold ${
                                inv.balance > 0 ? "text-orange-700" : "text-green-700"
                              }`}
                            >
                              {formatMoney(inv.balance)}
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                                  inv.status === "paid"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-orange-100 text-orange-700"
                                }`}
                              >
                                {inv.status === "paid" ? "Paid" : "Pending"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-600">No payments recorded for this date</p>
                )}
              </div>
            )}

            {/* MONTHLY TAB */}
            {activeTab === "monthly" && monthlySummary && (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="rounded-lg border border-slate-300 px-4 py-2"
                  />
                  <button
                    onClick={loadMonthlySummary}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                  >
                    Refresh
                  </button>
                </div>

                <div>
                  <h3 className="mb-3 text-lg font-semibold text-slate-900">By Payment Mode</h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(monthlySummary.byMode || {}).map(([mode, stats]: [string, any]) => (
                      <div
                        key={mode}
                        className="rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow"
                      >
                        <p className="font-semibold text-slate-900">{mode}</p>
                        <p className="text-2xl font-bold text-blue-600">{formatMoney(stats.total)}</p>
                        <p className="text-xs text-slate-600">{stats.count} payments</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* OUTSTANDING TAB */}
            {activeTab === "outstanding" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Outstanding Invoices ({outstanding.length})
                  </h3>
                  <button
                    onClick={loadOutstanding}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                  >
                    Refresh
                  </button>
                </div>

                {outstanding.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold text-slate-700">
                            Invoice
                          </th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-700">
                            Patient
                          </th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-700">
                            Date
                          </th>
                          <th className="px-4 py-2 text-right font-semibold text-slate-700">
                            Total
                          </th>
                          <th className="px-4 py-2 text-right font-semibold text-slate-700">
                            Paid
                          </th>
                          <th className="px-4 py-2 text-right font-semibold text-slate-700">
                            Balance
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {outstanding.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2">{inv.invoice_number}</td>
                            <td className="px-4 py-2">
                              {inv.patients?.first_name} {inv.patients?.last_name}
                            </td>
                            <td className="px-4 py-2">{formatDatePH(inv.invoice_date)}</td>
                            <td className="px-4 py-2 text-right">{formatMoney(inv.total)}</td>
                            <td className="px-4 py-2 text-right text-green-700 font-semibold">
                              {formatMoney(inv.paid_amount)}
                            </td>
                            <td className="px-4 py-2 text-right text-orange-700 font-semibold">
                              {formatMoney(inv.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-600">All invoices are paid!</p>
                )}
              </div>
            )}

            {/* RECONCILIATION TAB */}
            {activeTab === "reconciliation" && reconciliation && (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <input
                    type="date"
                    value={reconStartDate}
                    onChange={(e) => setReconStartDate(e.target.value)}
                    className="rounded-lg border border-slate-300 px-4 py-2"
                  />
                  <span className="flex items-center text-slate-600">to</span>
                  <input
                    type="date"
                    value={reconEndDate}
                    onChange={(e) => setReconEndDate(e.target.value)}
                    className="rounded-lg border border-slate-300 px-4 py-2"
                  />
                  <button
                    onClick={loadReconciliation}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                  >
                    Refresh
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg bg-blue-50 p-4">
                    <p className="text-sm text-slate-600">Total Invoiced</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {formatMoney(reconciliation.invoices.total)}
                    </p>
                    <p className="text-xs text-slate-500">{reconciliation.invoices.count} invoices</p>
                  </div>

                  <div className="rounded-lg bg-green-50 p-4">
                    <p className="text-sm text-slate-600">Total Collected</p>
                    <p className="text-2xl font-bold text-green-700">
                      {formatMoney(reconciliation.payments.active.total)}
                    </p>
                    <p className="text-xs text-slate-500">{reconciliation.payments.active.count} payments</p>
                  </div>
                </div>

                <div
                  className={`rounded-lg p-4 ${
                    reconciliation.variance === 0
                      ? "bg-green-50"
                      : reconciliation.variance > 0
                        ? "bg-orange-50"
                        : "bg-red-50"
                  }`}
                >
                  <p className="text-sm text-slate-600">Variance</p>
                  <p
                    className={`text-2xl font-bold ${
                      reconciliation.variance === 0
                        ? "text-green-700"
                        : reconciliation.variance > 0
                          ? "text-orange-700"
                          : "text-red-700"
                    }`}
                  >
                    {formatMoney(reconciliation.variance)}
                  </p>
                  <p className="text-xs text-slate-600">
                    {reconciliation.variance === 0
                      ? "✓ Balanced"
                      : reconciliation.variance > 0
                        ? "Outstanding balance"
                        : "Overpayment"}
                  </p>
                </div>
              </div>
            )}

            {/* PAYMENT MODES TAB */}
            {activeTab === "modes" && modeStats.length > 0 && (
              <div className="space-y-4">
                <button
                  onClick={loadModeStats}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  Refresh
                </button>

                <div className="grid gap-4 md:grid-cols-2">
                  {modeStats.map((mode) => (
                    <div
                      key={mode.code}
                      className="rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow"
                    >
                      <h4 className="mb-2 font-semibold text-slate-900">{mode.name}</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Total</span>
                          <span className="font-semibold">{formatMoney(mode.total)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Payments</span>
                          <span className="font-semibold">{mode.count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Verified</span>
                          <span className="text-green-700 font-semibold">{mode.verified_count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Pending</span>
                          <span className="text-orange-700 font-semibold">{mode.pending_count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
