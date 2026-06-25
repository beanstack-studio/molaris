"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useClinic } from "@/contexts/ClinicContext";
import { formatMoney, formatDateStandard } from "@/lib/helpers";
import { cn } from "@/lib/cn";
import { Spinner } from "@/components/Spinner";
import { DatePickerField } from "@/components/DatePickerField";
import { EditModal } from "@/components/EditModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type PayrollRun = {
  id: string;
  clinic_id: string;
  period_start: string;
  period_end: string;
  payment_date: string;
  payment_mode: string | null;
  total_amount: number;
  created_at: string;
};

type PaymentMode = {
  code: string;
  name: string;
};

type DentistRow = {
  id: string;
  full_name: string;
  nickname: string | null;
  salary_rate: number | null;
};

type StaffRow = {
  id: string;
  full_name: string;
  salary_rate: number | null;
};

type PayrollEntry = {
  person_type: "dentist" | "staff";
  person_id: string;
  person_name: string;
  salary_rate: number | null;
  daily_rate: number;
  days_worked: string;
  included: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeDailyRate(salaryRate: number | null): number {
  if (!salaryRate || salaryRate <= 0) return 0;
  return salaryRate / 22;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PayrollPage() {
  const { clinicId, isAdmin } = useClinic();

  const [runs, setRuns]               = useState<PayrollRun[]>([]);
  const [payModes, setPayModes]       = useState<PaymentMode[]>([]);
  const [dentists, setDentists]       = useState<DentistRow[]>([]);
  const [staff, setStaff]             = useState<StaffRow[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [successMsg, setSuccessMsg]   = useState<string | null>(null);

  const [showRun, setShowRun]         = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd]     = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState("");
  const [entries, setEntries]         = useState<PayrollEntry[]>([]);
  const [runSaving, setRunSaving]     = useState(false);
  const [runError, setRunError]       = useState<string | null>(null);

  // ─── Load data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!clinicId) return;
    setIsLoading(true);
    setError(null);

    const [runRes, pmRes, dentistRes, staffRes] = await Promise.all([
      supabase
        .from("payroll_runs")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("payment_date", { ascending: false }),
      supabase
        .from("payment_modes")
        .select("code, name")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("dentists")
        .select("id, full_name, nickname, salary_rate")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("full_name"),
      supabase
        .from("staff")
        .select("id, full_name, salary_rate")
        .eq("clinic_id", clinicId)
        .order("full_name"),
    ]);

    if (runRes.error) {
      setError(runRes.error.message);
    } else {
      setRuns(runRes.data as PayrollRun[]);
    }

    if (!pmRes.error && pmRes.data) setPayModes(pmRes.data as PaymentMode[]);
    if (!dentistRes.error && dentistRes.data) setDentists(dentistRes.data as DentistRow[]);
    if (!staffRes.error && staffRes.data) setStaff(staffRes.data as StaffRow[]);

    setIsLoading(false);
  }, [clinicId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 3000);
    return () => clearTimeout(t);
  }, [successMsg]);

  // ─── Open Run Payroll modal ──────────────────────────────────────────────────

  function openRunPayroll() {
    // Auto-fill period_start as the day after the most recent run's period_end
    const lastRun = runs[0]; // already sorted desc by payment_date
    let defaultStart = "";
    if (lastRun?.period_end) {
      const d = new Date(lastRun.period_end);
      d.setDate(d.getDate() + 1);
      defaultStart = d.toISOString().slice(0, 10);
    }
    setPeriodStart(defaultStart);
    setPeriodEnd("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMode("");
    setRunError(null);

    const initialEntries: PayrollEntry[] = [
      ...dentists.map((d) => ({
        person_type: "dentist" as const,
        person_id:   d.id,
        person_name: d.nickname ?? d.full_name,
        salary_rate: d.salary_rate,
        daily_rate:  computeDailyRate(d.salary_rate),
        days_worked: "22",
        included:    true,
      })),
      ...staff.map((s) => ({
        person_type: "staff" as const,
        person_id:   s.id,
        person_name: s.full_name,
        salary_rate: s.salary_rate,
        daily_rate:  computeDailyRate(s.salary_rate),
        days_worked: "22",
        included:    true,
      })),
    ];

    setEntries(initialEntries);
    setShowRun(true);
  }

  function updateDaysWorked(idx: number, value: string) {
    setEntries((prev) =>
      prev.map((e, i) => i === idx ? { ...e, days_worked: value } : e)
    );
  }

  function toggleIncluded(idx: number) {
    setEntries((prev) =>
      prev.map((e, i) => i === idx ? { ...e, included: !e.included } : e)
    );
  }

  // ─── Submit payroll run ────────────────────────────────────────────────────────

  async function handleRunPayroll() {
    if (!paymentDate) { setRunError("Payment date is required."); return; }

    const validEntries = entries.filter((e) => {
      if (!e.included) return false;
      const days = Number(e.days_worked);
      return !isNaN(days) && days > 0 && e.daily_rate > 0;
    });

    if (validEntries.length === 0) {
      setRunError("No entries with valid salary rates and days worked.");
      return;
    }

    const totalAmount = validEntries.reduce(
      (sum, e) => sum + e.daily_rate * Number(e.days_worked),
      0
    );

    setRunSaving(true);
    setRunError(null);

    const { data: runData, error: runErr } = await supabase
      .from("payroll_runs")
      .insert({
        clinic_id:    clinicId,
        period_start: periodStart || paymentDate,
        period_end:   periodEnd || paymentDate,
        payment_date: paymentDate,
        payment_mode: paymentMode || null,
        total_amount: totalAmount,
      })
      .select("id")
      .single();

    if (runErr || !runData) {
      setRunSaving(false);
      setRunError(runErr?.message ?? "Failed to create payroll run.");
      return;
    }

    const runId = (runData as { id: string }).id;

    const lineItems = validEntries.map((e) => ({
      payroll_run_id: runId,
      clinic_id:      clinicId,
      person_type:    e.person_type,
      person_id:      e.person_id,
      person_name:    e.person_name,
      salary_rate:    e.salary_rate,
      daily_rate:     e.daily_rate,
      days_worked:    Number(e.days_worked),
      total_amount:   e.daily_rate * Number(e.days_worked),
    }));

    const { error: entriesErr } = await supabase
      .from("payroll_run_entries")
      .insert(lineItems);

    setRunSaving(false);
    if (entriesErr) { setRunError(entriesErr.message); return; }

    setShowRun(false);
    setSuccessMsg("Payroll run recorded.");
    await loadData();
  }

  // ─── Delete run ───────────────────────────────────────────────────────────────

  async function handleDeleteRun(id: string) {
    if (!window.confirm("Delete this payroll run? This cannot be undone.")) return;
    const { error: err } = await supabase
      .from("payroll_runs")
      .delete()
      .eq("id", id)
      .eq("clinic_id", clinicId);
    if (err) { setError(err.message); return; }
    setSuccessMsg("Payroll run deleted.");
    await loadData();
  }

  // ─── Grand total ──────────────────────────────────────────────────────────────

  const grandTotal = entries.reduce((sum, e) => {
    if (!e.included) return sum;
    const days = Number(e.days_worked);
    if (isNaN(days) || days <= 0) return sum;
    return sum + e.daily_rate * days;
  }, 0);

  // ─── Non-admin guard ──────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div className="spacing-vertical-lg">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Payroll</h2>
          </div>
          <div className="data-table-empty">Payroll is restricted to admins only.</div>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="spacing-vertical-lg">
      {successMsg && <div className="success-banner">{successMsg}</div>}
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Payroll Runs</h2>
          <button type="button" className="save-btn" onClick={openRunPayroll}>
            + Run Payroll
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : runs.length === 0 ? (
          <div className="data-table-empty">
            No payroll runs yet. Click &quot;Run Payroll&quot; to record the first run.
          </div>
        ) : (
          <div className="table-wrapper overflow-x-auto">
            <table className="data-table min-w-[560px]">
              <thead className="data-table-head">
                <tr>
                  <th className="data-table-head-cell">Period</th>
                  <th className="data-table-head-cell">Payment Date</th>
                  <th className="data-table-head-cell">Via</th>
                  <th className="data-table-head-cell-right">Total</th>
                  <th className="data-table-head-cell"></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, idx) => (
                  <tr
                    key={run.id}
                    className={cn("data-table-row", idx % 2 === 0 ? "data-table-row-even" : "data-table-row-odd")}
                  >
                    <td className="data-table-cell text-sm">
                      {run.period_start === run.period_end
                        ? formatDateStandard(run.period_start)
                        : `${formatDateStandard(run.period_start)} – ${formatDateStandard(run.period_end)}`}
                    </td>
                    <td className="data-table-cell text-sm">{formatDateStandard(run.payment_date)}</td>
                    <td className="data-table-cell text-sm text-slate-600">{run.payment_mode ?? "—"}</td>
                    <td className="data-table-cell-right text-sm font-semibold tabular-nums">{formatMoney(run.total_amount)}</td>
                    <td className="data-table-cell">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          className="data-table-btn-danger"
                          onClick={() => handleDeleteRun(run.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Run Payroll Modal ── */}
      <EditModal open={showRun} title="Run Payroll" onClose={() => setShowRun(false)} wide>
        <div className="flex flex-col gap-4">
          {runError && <div className="error-banner">{runError}</div>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatePickerField label="Period Start" value={periodStart} onChange={setPeriodStart} />
            <DatePickerField label="Period End" value={periodEnd} onChange={setPeriodEnd} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatePickerField label="Payment Date *" value={paymentDate} onChange={setPaymentDate} />

            <label className="field-label">
              <span className="field-label-text">Payment Method</span>
              <select
                className="field-input"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                disabled={runSaving}
              >
                <option value="">— None —</option>
                {payModes.map((pm) => <option key={pm.code} value={pm.name}>{pm.name}</option>)}
              </select>
            </label>
          </div>

          {/* Days worked table */}
          {entries.length > 0 ? (
            <div>
              <p className="field-label-text mb-2">Days Worked</p>
              <div className="table-wrapper overflow-x-auto rounded-xl border border-slate-100">
                <table className="data-table min-w-[440px]">
                  <thead className="data-table-head">
                    <tr>
                      <th className="data-table-head-cell w-8 text-center">✓</th>
                      <th className="data-table-head-cell">Name</th>
                      <th className="data-table-head-cell-right">₱/day</th>
                      <th className="data-table-head-cell text-center w-20">Days</th>
                      <th className="data-table-head-cell-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, idx) => {
                      const days = Number(e.days_worked);
                      const rowTotal = isNaN(days) ? 0 : e.daily_rate * days;
                      return (
                        <tr
                          key={e.person_id}
                          className={cn(
                            "data-table-row",
                            idx % 2 === 0 ? "data-table-row-even" : "data-table-row-odd",
                            !e.included && "opacity-40"
                          )}
                        >
                          <td className="data-table-cell text-center">
                            <input
                              type="checkbox"
                              checked={e.included}
                              onChange={() => toggleIncluded(idx)}
                              className="h-4 w-4 rounded"
                              disabled={runSaving}
                            />
                          </td>
                          <td className="data-table-cell text-sm">
                            <div>
                              <span>{e.person_name}</span>
                              <span className="ml-1 text-xs text-slate-400">
                                {e.person_type === "dentist" ? "(Dentist)" : "(Staff)"}
                              </span>
                            </div>
                            {e.salary_rate ? (
                              <div className="text-xs text-slate-400">{formatMoney(e.salary_rate)}/mo</div>
                            ) : (
                              <div className="text-xs text-rose-400">No salary rate set</div>
                            )}
                          </td>
                          <td className="data-table-cell-right text-sm tabular-nums">
                            {e.daily_rate > 0 ? formatMoney(e.daily_rate) : "—"}
                          </td>
                          <td className="data-table-cell text-center px-2">
                            <input
                              type="number"
                              min="0"
                              max="31"
                              step="0.5"
                              className="field-input input-xs text-center w-16 mx-auto"
                              value={e.days_worked}
                              onChange={(ev) => updateDaysWorked(idx, ev.target.value)}
                              disabled={runSaving || e.daily_rate === 0 || !e.included}
                            />
                          </td>
                          <td className="data-table-cell-right text-sm font-medium tabular-nums">
                            {e.included && e.daily_rate > 0 ? formatMoney(rowTotal) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50">
                      <td colSpan={4} className="data-table-cell text-sm font-semibold text-slate-700">Grand Total</td>
                      <td className="data-table-cell-right text-sm font-bold tabular-nums text-slate-800">
                        {formatMoney(grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="hint-text">
              Add dentists and staff with salary rates in Settings → Team to use payroll.
            </div>
          )}

          <div className="modal-footer-buttons">
            <button type="button" className="cancel-btn" onClick={() => setShowRun(false)} disabled={runSaving}>
              Cancel
            </button>
            <button
              type="button"
              className="save-btn"
              onClick={handleRunPayroll}
              disabled={runSaving || entries.length === 0}
            >
              {runSaving ? "Saving…" : "Confirm Payroll Run"}
            </button>
          </div>
        </div>
      </EditModal>
    </div>
  );
}
