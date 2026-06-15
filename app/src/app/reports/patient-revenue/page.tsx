"use client";

import { useEffect, useState } from "react";
import { useClinic } from "@/contexts/ClinicContext";
import { supabase } from "@/lib/supabaseClient";
import { formatMoney, formatDateStandard } from "@/lib/helpers";
import { downloadCSV } from "@/lib/exportHelpers";
import { PageLoader } from "@/components/Spinner";

interface PatientRow {
  patient_id: string;
  full_name: string;
  invoiced: number;
  paid: number;
  outstanding: number;
  invoice_count: number;
  last_invoice_date: string;
}

export default function PatientRevenueReportPage() {
  const { clinicId, isLoading: clinicLoading } = useClinic();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [summary, setSummary] = useState({ invoiced: 0, paid: 0, outstanding: 0 });
  const [sort, setSort] = useState<"paid" | "invoiced" | "outstanding" | "name">("paid");

  useEffect(() => {
    if (clinicLoading || !clinicId) return;
    loadData();
  }, [clinicLoading, clinicId]);

  async function loadData() {
    if (!clinicId) return;
    setLoading(true);
    setError(null);
    try {
      const [{ data: invoices }, { data: payments }, { data: patients }] = await Promise.all([
        supabase.from("invoices").select("id, patient_id, total, invoice_date").eq("clinic_id", clinicId),
        supabase.from("payments").select("invoice_id, amount, voided_at").eq("clinic_id", clinicId),
        supabase.from("patients").select("id, full_name").eq("clinic_id", clinicId),
      ]);

      const patientMap: Record<string, string> = {};
      for (const p of patients || []) patientMap[p.id] = p.full_name;

      const paidByInvoice: Record<string, number> = {};
      for (const p of payments || []) {
        if (!p.voided_at && p.invoice_id) {
          paidByInvoice[p.invoice_id] = (paidByInvoice[p.invoice_id] || 0) + (p.amount || 0);
        }
      }

      const byPatient: Record<string, PatientRow> = {};
      for (const inv of invoices || []) {
        const pid = inv.patient_id;
        if (!pid) continue;
        const paid = paidByInvoice[inv.id] || 0;
        const total = inv.total || 0;
        if (!byPatient[pid]) {
          byPatient[pid] = {
            patient_id: pid,
            full_name: patientMap[pid] || "Unknown",
            invoiced: 0, paid: 0, outstanding: 0,
            invoice_count: 0, last_invoice_date: "",
          };
        }
        byPatient[pid].invoiced += total;
        byPatient[pid].paid += paid;
        byPatient[pid].outstanding += Math.max(0, total - paid);
        byPatient[pid].invoice_count++;
        if (!byPatient[pid].last_invoice_date || inv.invoice_date > byPatient[pid].last_invoice_date) {
          byPatient[pid].last_invoice_date = inv.invoice_date;
        }
      }

      const result = Object.values(byPatient);
      let totalInvoiced = 0, totalPaid = 0, totalOutstanding = 0;
      result.forEach((r) => { totalInvoiced += r.invoiced; totalPaid += r.paid; totalOutstanding += r.outstanding; });
      setSummary({ invoiced: totalInvoiced, paid: totalPaid, outstanding: totalOutstanding });
      setRows(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  const sorted = [...rows].sort((a, b) => {
    if (sort === "name") return a.full_name.localeCompare(b.full_name);
    if (sort === "invoiced") return b.invoiced - a.invoiced;
    if (sort === "outstanding") return b.outstanding - a.outstanding;
    return b.paid - a.paid;
  });

  if (loading) return <PageLoader />;

  return (
    <>
      {error && <div className="error-banner">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="text-muted">Total Invoiced</div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{formatMoney(summary.invoiced)}</div>
        </div>
        <div className="card">
          <div className="text-muted">Total Collected</div>
          <div className="text-2xl font-bold text-green-700 mt-2">{formatMoney(summary.paid)}</div>
        </div>
        <div className="card">
          <div className="text-muted">Total Outstanding</div>
          <div className="text-2xl font-bold text-orange-700 mt-2">{formatMoney(summary.outstanding)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Revenue by Patient</div>
          <div className="inline-row">
            <select className="form-select-standard" value={sort} onChange={(e) => setSort(e.target.value as any)}>
              <option value="paid">Sort: Highest Paid</option>
              <option value="invoiced">Sort: Highest Invoiced</option>
              <option value="outstanding">Sort: Most Outstanding</option>
              <option value="name">Sort: Name A–Z</option>
            </select>
            <button className="cancel-btn" onClick={() => downloadCSV(sorted.map((r) => ({
              "Patient": r.full_name,
              "Invoices": r.invoice_count,
              "Last Invoice": formatDateStandard(r.last_invoice_date),
              "Invoiced (₱)": r.invoiced.toFixed(2),
              "Paid (₱)": r.paid.toFixed(2),
              "Outstanding (₱)": r.outstanding.toFixed(2),
            })), "patient-revenue")}>
              Download CSV
            </button>
          </div>
        </div>
        {sorted.length === 0 ? (
          <p className="text-center text-slate-500 py-6">No invoice data yet.</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <colgroup>
                <col className="col-25" />
                <col className="col-10" />
                <col className="col-15" />
                <col className="col-17" />
                <col className="col-17" />
                <col className="col-16" />
              </colgroup>
              <thead className="data-table-head">
                <tr>
                  <th className="data-table-head-cell">Patient</th>
                  <th className="data-table-head-cell-right">Invoices</th>
                  <th className="data-table-head-cell">Last Invoice</th>
                  <th className="data-table-head-cell-right">Invoiced</th>
                  <th className="data-table-head-cell-right">Paid</th>
                  <th className="data-table-head-cell-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr key={r.patient_id} className={`data-table-row ${i % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                    <td className="data-table-cell font-medium">{r.full_name}</td>
                    <td className="data-table-cell-right text-slate-500">{r.invoice_count}</td>
                    <td className="data-table-cell text-slate-500">{formatDateStandard(r.last_invoice_date)}</td>
                    <td className="data-table-cell-right">{formatMoney(r.invoiced)}</td>
                    <td className="data-table-cell-right text-green-700">{formatMoney(r.paid)}</td>
                    <td className={`data-table-cell-right font-semibold ${r.outstanding > 0 ? "text-orange-700" : "text-slate-400"}`}>
                      {r.outstanding > 0 ? formatMoney(r.outstanding) : "—"}
                    </td>
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
