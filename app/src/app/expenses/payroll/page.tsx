"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useClinic } from "@/contexts/ClinicContext";
import { formatMoney, formatMoneyCompact, formatDateStandard } from "@/lib/helpers";
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
  return salaryRate; // salary_rate is stored as daily rate
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

  // Run payroll modal
  const [showRun, setShowRun]         = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd]     = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState("");
  const [entries, setEntries]         = useState<PayrollEntry[]>([]);
  const [runSaving, setRunSaving]     = useState(false);
  const [runError, setRunError]       = useState<string | null>(null);

  // View/delete run modal
  const [viewRun, setViewRun]           = useState<PayrollRun | null>(null);
  const [runDeleteText, setRunDeleteText] = useState("");
  const [runDeleting, setRunDeleting]   = useState(false);

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
    const lastRun = runs[0];
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
        days_worked: "",
        included:    true,
      })),
      ...staff.map((s) => ({
        person_type: "staff" as const,
        person_id:   s.id,
        person_name: s.full_name,
        salary_rate: s.salary_rate,
        daily_rate:  computeDailyRate(s.salary_rate),
        days_worked: "",
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

  // ─── View/delete run ──────────────────────────────────────────────────────────

  function openViewRun(run: PayrollRun) {
    setViewRun(run);
    setRunDeleteText("");
  }

  async function handleDeleteRun() {
    if (!viewRun || runDeleteText !== "DELETE") return;
    setRunDeleting(true);
    const { error: err } = await supabase
      .from("payroll_runs")
      .delete()
      .eq("id", viewRun.id)
      .eq("clinic_id", clinicId);
    setRunDeleting(false);
    if (err) { setError(err.message); return; }
    setViewRun(null);
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
          <button type="button" className="save-btn ml-auto" onClick={openRunPayroll}>
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
          <div className="w-full overflow-x-auto lg:overflow-x-visible">
            <table className="data-table min-w-[480px]">
              <thead className="data-table-head">
                <tr>
                  <th className="data-table-head-cell">Period</th>
                  <th className="data-table-head-cell">Payment Date</th>
                  <th className="data-table-head-cell">Via</th>
                  <th className="data-table-head-cell-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, idx) => (
                  <tr
                    key={run.id}
                    className={cn("data-table-row cursor-pointer", idx % 2 === 0 ? "data-table-row-even" : "data-table-row-odd")}
                    onClick={() => openViewRun(run)}
                  >
                    <td className="data-table-cell text-sm">
                      {run.period_start === run.period_end
                        ? formatDateStandard(run.period_start)
                        : `${formatDateStandard(run.period_start)} – ${formatDateStandard(run.period_end)}`}
                    </td>
                    <td className="data-table-cell text-sm">{formatDateStandard(run.payment_date)}</td>
                    <td className="data-table-cell text-sm text-slate-600">{run.payment_mode ?? "—"}</td>
                    <td className="data-table-cell-right text-sm font-semibold tabular-nums">{formatMoney(run.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── View Run Modal ── */}
      <EditModal open={Boolean(viewRun)} title="Payroll Run" onClose={() => setViewRun(null)}>
        {viewRun && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="field-label-text mb-0.5">Period</div>
                <div className="text-slate-700">
                  {viewRun.period_start === viewRun.period_end
                    ? formatDateStandard(viewRun.period_start)
                    : `${formatDateStandard(viewRun.period_start)} – ${formatDateStandard(viewRun.period_end)}`}
                </div>
              </div>
              <div>
                <div className="field-label-text mb-0.5">Payment Date</div>
                <div className="text-slate-700">{formatDateStandard(viewRun.payment_date)}</div>
              </div>
              <div>
                <div className="field-label-text mb-0.5">Via</div>
                <div className="text-slate-700">{viewRun.payment_mode ?? "—"}</div>
              </div>
              <div>
                <div className="field-label-text mb-0.5">Total Amount</div>
                <div className="font-semibold text-slate-800">{formatMoney(viewRun.total_amount)}</div>
              </div>
            </div>

            <div className="delete-confirmation">
              <div className="delete-confirmation-title">Delete payroll run?</div>
              <div className="delete-confirmation-hint">Type <span className="delete-confirmation-code">DELETE</span> to confirm</div>
              <input
                className="delete-confirmation-input"
                value={runDeleteText}
                onChange={(e) => setRunDeleteText(e.target.value)}
                placeholder="DELETE"
                disabled={runDeleting}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="delete-btn"
                onClick={handleDeleteRun}
                disabled={runDeleting || runDeleteText !== "DELETE"}
              >
                Delete
              </button>
              <div className="modal-actions-right">
                <button type="button" className="cancel-btn" onClick={() => setViewRun(null)} disabled={runDeleting}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </EditModal>

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
              <div className="w-full overflow-x-auto lg:overflow-x-visible rounded-xl border border-slate-100">
                <table className="data-table min-w-[480px]">
                  <colgroup>
                    <col className="w-8" />
                    <col className="w-36" />
                    <col className="w-28" />
                    <col className="w-24" />
                    <col className="w-28" />
                  </colgroup>
                  <thead className="data-table-head">
                    <tr>
                      <th className="data-table-head-cell text-center">✓</th>
                      <th className="data-table-head-cell">Name</th>
                      <th className="data-table-head-cell-right">₱/day</th>
                      <th className="data-table-head-cell text-center">Days</th>
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
                            <span>{e.person_name}</span>
                            <span className="ml-1 text-xs text-slate-400">
                              {e.person_type === "dentist" ? "(Dr)" : "(Staff)"}
                            </span>
                            {!e.salary_rate && (
                              <div className="text-xs text-rose-400">No daily rate set</div>
                            )}
                          </td>
                          <td className="data-table-cell-right text-sm tabular-nums">
                            {e.daily_rate > 0 ? formatMoneyCompact(e.daily_rate) : "—"}
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
                            {e.included && e.daily_rate > 0 && days > 0 ? formatMoneyCompact(rowTotal) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50">
                      <td colSpan={4} className="data-table-cell text-sm font-semibold text-slate-700">Grand Total</td>
                      <td className="data-table-cell-right text-sm font-bold tabular-nums text-slate-800">
                        {formatMoneyCompact(grandTotal)}
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

          <div className="modal-actions">
            <div className="modal-actions-right">
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
        </div>
      </EditModal>
    </div>
  );
}
