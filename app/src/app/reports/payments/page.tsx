"use client";

import { useEffect, useState } from "react";
import { useClinic } from "@/contexts/ClinicContext";
import { supabase } from "@/lib/supabaseClient";
import { formatMoney, formatDateStandard } from "@/lib/helpers";
import { downloadCSV } from "@/lib/exportHelpers";
import { PageLoader, Spinner } from "@/components/Spinner";


export default function PaymentReportsPage() {
  const { clinicId, isLoading: clinicLoading } = useClinic();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [outstanding, setOutstanding] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [byPatient, setByPatient] = useState<any[]>([]);
  const [paymentSort, setPaymentSort] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">("date_desc");
  const [patientSort, setPatientSort] = useState<"paid" | "invoiced" | "outstanding" | "name">("paid");

  useEffect(() => {
    if (clinicLoading || !clinicId) return;
    loadData();
  }, [clinicLoading, clinicId]);

  async function loadData() {
    if (!clinicId) return;
    setLoading(true);
    setError(null);

    try {
      // Load recent payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("id, transaction_id, amount, payment_date, status, invoice_id, reference_number")
        .eq("clinic_id", clinicId)
        .order("payment_date", { ascending: false })
        .limit(200);

      if (paymentsError) throw paymentsError;

      // Load outstanding invoices
      const { data: invoicesData, error: invoicesError } = await supabase
        .from("invoices")
        .select("id, invoice_number, total, status, patient_id, created_at, invoice_date")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });

      if (invoicesError) throw invoicesError;

      // Load all payments for balance calculation
      const { data: allPayments, error: allPaymentsError } = await supabase
        .from("payments")
        .select("id, invoice_id, amount, voided_at, status")
        .eq("clinic_id", clinicId);

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

      // Build by-patient breakdown
      const patientIds = [...new Set((invoicesData || []).map((i: any) => i.patient_id).filter(Boolean))];
      const { data: patientsData } = await supabase.from("patients").select("id, full_name").in("id", patientIds);
      const patientNameMap: Record<string, string> = {};
      for (const p of patientsData || []) patientNameMap[p.id] = p.full_name;

      const byPatientMap: Record<string, any> = {};
      for (const inv of invoicesData || []) {
        const pid = inv.patient_id;
        if (!pid) continue;
        const paid = paidByInvoice[inv.id] || 0;
        const total = inv.total || 0;
        if (!byPatientMap[pid]) byPatientMap[pid] = { patient_id: pid, full_name: patientNameMap[pid] || "Unknown", invoiced: 0, paid: 0, outstanding: 0, last_invoice_date: "" };
        byPatientMap[pid].invoiced += total;
        byPatientMap[pid].paid += paid;
        byPatientMap[pid].outstanding += Math.max(0, total - paid);
        if (!byPatientMap[pid].last_invoice_date || (inv.invoice_date || "") > byPatientMap[pid].last_invoice_date) {
          byPatientMap[pid].last_invoice_date = inv.invoice_date || "";
        }
      }
      setByPatient(Object.values(byPatientMap));

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
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <PageLoader />
    );
  }

  return (
    <>
      {error ? <div className="error-banner">{error}</div> : null}

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="card">
            <div className="text-muted">Total Invoiced</div>
            <div className="text-2xl font-bold text-slate-900 mt-2">{formatMoney(summary.totalInvoiced)}</div>
          </div>
          <div className="card">
            <div className="text-muted">Total Paid</div>
            <div className="text-2xl font-bold text-green-700 mt-2">{formatMoney(summary.totalPaid)}</div>
          </div>
          <div className="card">
            <div className="text-muted">Outstanding</div>
            <div className="text-2xl font-bold text-orange-700 mt-2">{formatMoney(summary.totalOutstanding)}</div>
          </div>
          <div className="card">
            <div className="text-muted">Collection Rate</div>
            <div className="text-2xl font-bold text-blue-700 mt-2">{summary.collectionRate}%</div>
          </div>
        </div>
      )}

      {/* Outstanding Invoices */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Outstanding Invoices</div>
          <button
            className="cancel-btn"
            onClick={() =>
              downloadCSV(
                outstanding.map((inv) => ({
                  "Invoice #": inv.invoice_number,
                  "Total (₱)": inv.total,
                  "Paid (₱)": inv.paid_amount,
                  "Balance (₱)": inv.balance,
                  Date: formatDateStandard(inv.created_at),
                })),
                "outstanding-invoices"
              )
            }
          >
            Download CSV
          </button>
        </div>
        {outstanding.length > 0 ? (
          <div className="table-wrapper">
            <table className="data-table">
              <colgroup>
                <col className="col-40" />
                <col className="col-20" />
                <col className="col-20" />
                <col className="col-20" />
              </colgroup>
              <thead className="data-table-head">
                <tr>
                  <th className="data-table-head-cell">Invoice</th>
                  <th className="data-table-head-cell-right">Total</th>
                  <th className="data-table-head-cell-right">Paid</th>
                  <th className="data-table-head-cell-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {outstanding.map((inv, index) => (
                  <tr key={inv.id} className={`data-table-row ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                    <td className="data-table-cell font-medium">{inv.invoice_number}</td>
                    <td className="data-table-cell-right">{formatMoney(inv.total)}</td>
                    <td className="data-table-cell-right text-green-700">{formatMoney(inv.paid_amount)}</td>
                    <td className="data-table-cell-right font-semibold text-orange-700">{formatMoney(inv.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-slate-500 py-4">No outstanding invoices</p>
        )}
      </div>

      {/* Recent Payments */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Recent Payments</div>
          <div className="inline-row">
            <select className="form-select-standard" value={paymentSort} onChange={(e) => setPaymentSort(e.target.value as any)}>
              <option value="date_desc">Newest first</option>
              <option value="date_asc">Oldest first</option>
              <option value="amount_desc">Highest amount</option>
              <option value="amount_asc">Lowest amount</option>
            </select>
            <button className="cancel-btn" onClick={() => downloadCSV(payments.map((p) => ({
              "Transaction ID": p.transaction_id ?? "",
              "Amount (₱)": p.amount,
              Date: formatDateStandard(p.payment_date),
              Status: p.status,
              Reference: p.reference_number ?? "",
            })), "payments")}>
              Download CSV
            </button>
          </div>
        </div>
        {payments.length > 0 ? (
          <div className="table-wrapper">
            <table className="data-table">
              <colgroup>
                <col className="col-25" />
                <col className="col-25" />
                <col className="col-25" />
                <col className="col-25" />
              </colgroup>
              <thead className="data-table-head">
                <tr>
                  <th className="data-table-head-cell">Transaction ID</th>
                  <th className="data-table-head-cell-right">Amount</th>
                  <th className="data-table-head-cell">Date</th>
                  <th className="data-table-head-cell">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...payments].sort((a, b) => {
                  if (paymentSort === "date_asc") return a.payment_date?.localeCompare(b.payment_date);
                  if (paymentSort === "amount_desc") return (b.amount || 0) - (a.amount || 0);
                  if (paymentSort === "amount_asc") return (a.amount || 0) - (b.amount || 0);
                  return (b.payment_date || "").localeCompare(a.payment_date || "");
                }).map((payment, index) => (
                  <tr key={payment.id} className={`data-table-row ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                    <td className="data-table-cell">{payment.transaction_id || "—"}</td>
                    <td className="data-table-cell-right font-semibold">{formatMoney(payment.amount)}</td>
                    <td className="data-table-cell text-sm">{formatDateStandard(payment.payment_date)}</td>
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
          <p className="text-center text-slate-500 py-4">No payments</p>
        )}
      </div>

      {/* By Patient */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">By Patient</div>
          <div className="inline-row">
            <select className="form-select-standard" value={patientSort} onChange={(e) => setPatientSort(e.target.value as any)}>
              <option value="paid">Highest paid</option>
              <option value="invoiced">Highest invoiced</option>
              <option value="outstanding">Most outstanding</option>
              <option value="name">Name A–Z</option>
            </select>
            <button className="cancel-btn" onClick={() => downloadCSV([...byPatient].sort((a, b) => patientSort === "name" ? a.full_name.localeCompare(b.full_name) : patientSort === "invoiced" ? b.invoiced - a.invoiced : patientSort === "outstanding" ? b.outstanding - a.outstanding : b.paid - a.paid).map((r) => ({
              "Patient": r.full_name,
              "Invoiced (₱)": r.invoiced.toFixed(2),
              "Paid (₱)": r.paid.toFixed(2),
              "Outstanding (₱)": r.outstanding.toFixed(2),
            })), "patient-revenue")}>
              Download CSV
            </button>
          </div>
        </div>
        {byPatient.length === 0 ? (
          <p className="text-center text-slate-500 py-4">No patient data</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <colgroup><col className="col-30" /><col className="col-23" /><col className="col-23" /><col className="col-24" /></colgroup>
              <thead className="data-table-head">
                <tr>
                  <th className="data-table-head-cell">Patient</th>
                  <th className="data-table-head-cell-right">Invoiced</th>
                  <th className="data-table-head-cell-right">Paid</th>
                  <th className="data-table-head-cell-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {[...byPatient].sort((a, b) => patientSort === "name" ? a.full_name.localeCompare(b.full_name) : patientSort === "invoiced" ? b.invoiced - a.invoiced : patientSort === "outstanding" ? b.outstanding - a.outstanding : b.paid - a.paid).map((r, i) => (
                  <tr key={r.patient_id} className={`data-table-row ${i % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                    <td className="data-table-cell font-medium">{r.full_name}</td>
                    <td className="data-table-cell-right">{formatMoney(r.invoiced)}</td>
                    <td className="data-table-cell-right text-green-700">{formatMoney(r.paid)}</td>
                    <td className={`data-table-cell-right font-semibold ${r.outstanding > 0 ? "text-orange-700" : "text-slate-400"}`}>{r.outstanding > 0 ? formatMoney(r.outstanding) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
