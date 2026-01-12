"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatMoney, formatDatePH } from "@/lib/helpers";

export default function PaymentReportsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [outstanding, setOutstanding] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErr(null);

    try {
      // Load recent payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("id, amount, payment_date, status, invoice_id, reference_number")
        .order("payment_date", { ascending: false })
        .limit(50);

      if (paymentsError) throw paymentsError;

      // Load outstanding invoices
      const { data: invoicesData, error: invoicesError } = await supabase
        .from("invoices")
        .select("id, invoice_number, total, status, patient_id, created_at")
        .order("created_at", { ascending: false });

      if (invoicesError) throw invoicesError;

      // Load all payments for balance calculation
      const { data: allPayments, error: allPaymentsError } = await supabase
        .from("payments")
        .select("id, invoice_id, amount, voided_at, status");

      if (allPaymentsError) throw allPaymentsError;

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

      // Calculate summary stats
      let totalInvoiced = 0;
      let totalPaid = 0;
      let totalOutstanding = 0;

      const outstandingList = (invoicesData || [])
        .map((inv: any) => {
          const paid = paidByInvoice[inv.id] || 0;
          const balance = Math.max(0, (inv.total || 0) - paid);
          totalInvoiced += inv.total || 0;
          totalPaid += paid;
          totalOutstanding += balance;

          return {
            id: inv.id,
            invoice_number: inv.invoice_number,
            total: inv.total,
            paid_amount: paid,
            balance,
            created_at: inv.created_at,
          };
        })
        .filter((inv: any) => inv.balance > 0)
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setPayments(paymentsData || []);
      setOutstanding(outstandingList);
      setSummary({
        totalInvoiced,
        totalPaid,
        totalOutstanding,
        collectionRate: totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to load payment data";
      console.error("Payment report error:", errorMsg);
      setErr(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-600">Loading...</div>;
  }

  return (
    <div>
      {err && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{err}</p>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">Total Invoiced</p>
            <p className="text-2xl font-bold text-slate-900">{formatMoney(summary.totalInvoiced)}</p>
          </div>
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">Total Paid</p>
            <p className="text-2xl font-bold text-green-700">{formatMoney(summary.totalPaid)}</p>
          </div>
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">Outstanding</p>
            <p className="text-2xl font-bold text-orange-700">{formatMoney(summary.totalOutstanding)}</p>
          </div>
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">Collection Rate</p>
            <p className="text-2xl font-bold text-blue-700">{summary.collectionRate}%</p>
          </div>
        </div>
      )}

      {/* Outstanding Invoices */}
      <div className="mb-6 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Outstanding Invoices</h2>
        {outstanding.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Invoice</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">Total</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">Paid</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {outstanding.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium">{inv.invoice_number}</td>
                    <td className="px-4 py-2 text-right">{formatMoney(inv.total)}</td>
                    <td className="px-4 py-2 text-right text-green-700">{formatMoney(inv.paid_amount)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-orange-700">{formatMoney(inv.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-slate-500">No outstanding invoices</p>
        )}
      </div>

      {/* Recent Payments */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Recent Payments</h2>
        {payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Invoice ID</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">Amount</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Date</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">{payment.invoice_id}</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatMoney(payment.amount)}</td>
                    <td className="px-4 py-2 text-sm">{formatDatePH(payment.payment_date)}</td>
                    <td className="px-4 py-2">
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
          <p className="text-center text-slate-500">No payments</p>
        )}
      </div>
    </div>
  );
}
