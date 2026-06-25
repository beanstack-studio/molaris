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

type OperatingExpense = {
  id: string;
  clinic_id: string;
  expense_date: string;
  category: "Supplies" | "Gasoline" | "Maintenance" | "Other";
  description: string | null;
  amount: number;
  payment_mode: string | null;
  status: "paid" | "unpaid";
  date_paid: string | null;
  remarks: string | null;
  created_at: string;
};

type PaymentMode = {
  code: string;
  name: string;
};

const CATEGORIES = ["Supplies", "Gasoline", "Maintenance", "Other"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_COLORS: Record<Category, string> = {
  Supplies:    "badge badge-secondary",
  Gasoline:    "badge bg-amber-100 text-amber-700 border border-amber-200",
  Maintenance: "badge bg-orange-100 text-orange-700 border border-orange-200",
  Other:       "badge bg-slate-100 text-slate-600 border border-slate-200",
};

type FormState = {
  expense_date: string;
  category: Category;
  description: string;
  amount: string;
  payment_mode: string;
  remarks: string;
};

function blankForm(): FormState {
  return {
    expense_date: new Date().toISOString().slice(0, 10),
    category: "Supplies",
    description: "",
    amount: "",
    payment_mode: "",
    remarks: "",
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OperatingPage() {
  const { clinicId, isAdmin } = useClinic();

  const [expenses, setExpenses]       = useState<OperatingExpense[]>([]);
  const [payModes, setPayModes]       = useState<PaymentMode[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [successMsg, setSuccessMsg]   = useState<string | null>(null);

  // Add modal
  const [showAdd, setShowAdd]         = useState(false);
  const [form, setForm]               = useState<FormState>(blankForm());
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState<string | null>(null);

  // Pay modal
  const [payTarget, setPayTarget]     = useState<OperatingExpense | null>(null);
  const [payMode, setPayMode]         = useState("");
  const [payDate, setPayDate]         = useState(new Date().toISOString().slice(0, 10));
  const [paying, setPaying]           = useState(false);
  const [payError, setPayError]       = useState<string | null>(null);

  // Edit modal (admin only)
  const [editTarget, setEditTarget]   = useState<OperatingExpense | null>(null);
  const [editForm, setEditForm]       = useState<FormState>(blankForm());
  const [editSaving, setEditSaving]   = useState(false);
  const [editError, setEditError]     = useState<string | null>(null);

  // ─── Load data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const [expRes, pmRes] = await Promise.all([
      supabase
        .from("clinic_operating_expenses")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("payment_modes")
        .select("code, name")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    if (expRes.error) {
      setError(expRes.error.message);
    } else {
      setExpenses(expRes.data as OperatingExpense[]);
    }

    if (!pmRes.error && pmRes.data) {
      setPayModes(pmRes.data as PaymentMode[]);
    }

    setIsLoading(false);
  }, [clinicId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 3000);
    return () => clearTimeout(t);
  }, [successMsg]);

  // ─── Add expense ───────────────────────────────────────────────────────────

  function openAdd() {
    setForm(blankForm());
    setFormError(null);
    setShowAdd(true);
  }

  async function handleAdd() {
    if (!form.expense_date) { setFormError("Date is required."); return; }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      setFormError("Amount must be a positive number.");
      return;
    }
    setSaving(true);
    setFormError(null);

    const isPaid = Boolean(form.payment_mode);
    const { error: err } = await supabase.from("clinic_operating_expenses").insert({
      clinic_id:    clinicId,
      expense_date: form.expense_date,
      category:     form.category,
      description:  form.description || null,
      amount:       Number(form.amount),
      payment_mode: form.payment_mode || null,
      status:       isPaid ? "paid" : "unpaid",
      date_paid:    isPaid ? form.expense_date : null,
      remarks:      form.remarks || null,
    });

    setSaving(false);
    if (err) { setFormError(err.message); return; }
    setShowAdd(false);
    setSuccessMsg("Expense added.");
    await loadData();
  }

  // ─── Pay (mark unpaid → paid) ──────────────────────────────────────────────

  function openPay(exp: OperatingExpense) {
    setPayTarget(exp);
    setPayMode("");
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayError(null);
  }

  async function handlePay() {
    if (!payMode) { setPayError("Payment method is required."); return; }
    if (!payDate) { setPayError("Date paid is required."); return; }
    if (!payTarget) return;
    setPaying(true);
    setPayError(null);

    const { error: err } = await supabase
      .from("clinic_operating_expenses")
      .update({ status: "paid", payment_mode: payMode, date_paid: payDate })
      .eq("id", payTarget.id)
      .eq("clinic_id", clinicId);

    setPaying(false);
    if (err) { setPayError(err.message); return; }
    setPayTarget(null);
    setSuccessMsg("Marked as paid.");
    await loadData();
  }

  // ─── Edit (admin only) ─────────────────────────────────────────────────────

  function openEdit(exp: OperatingExpense) {
    setEditTarget(exp);
    setEditForm({
      expense_date: exp.expense_date,
      category:     exp.category,
      description:  exp.description ?? "",
      amount:       String(exp.amount),
      payment_mode: exp.payment_mode ?? "",
      remarks:      exp.remarks ?? "",
    });
    setEditError(null);
  }

  async function handleEdit() {
    if (!editTarget) return;
    if (!editForm.amount || isNaN(Number(editForm.amount)) || Number(editForm.amount) <= 0) {
      setEditError("Amount must be a positive number.");
      return;
    }
    setEditSaving(true);
    setEditError(null);

    const isPaid = Boolean(editForm.payment_mode);
    const { error: err } = await supabase
      .from("clinic_operating_expenses")
      .update({
        expense_date: editForm.expense_date,
        category:     editForm.category,
        description:  editForm.description || null,
        amount:       Number(editForm.amount),
        payment_mode: editForm.payment_mode || null,
        status:       isPaid ? "paid" : "unpaid",
        date_paid:    isPaid ? (editTarget.date_paid ?? editForm.expense_date) : null,
        remarks:      editForm.remarks || null,
      })
      .eq("id", editTarget.id)
      .eq("clinic_id", clinicId);

    setEditSaving(false);
    if (err) { setEditError(err.message); return; }
    setEditTarget(null);
    setSuccessMsg("Expense updated.");
    await loadData();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this expense? This cannot be undone.")) return;
    const { error: err } = await supabase
      .from("clinic_operating_expenses")
      .delete()
      .eq("id", id)
      .eq("clinic_id", clinicId);
    if (err) { setError(err.message); return; }
    setSuccessMsg("Expense deleted.");
    await loadData();
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="spacing-vertical-lg">
      {successMsg && <div className="success-banner">{successMsg}</div>}
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Operating Expenses</h2>
          <button type="button" className="save-btn" onClick={openAdd}>
            + Add Expense
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : expenses.length === 0 ? (
          <div className="data-table-empty">
            No operating expenses recorded yet. Click &quot;Add Expense&quot; to get started.
          </div>
        ) : (
          <div className="table-wrapper overflow-x-auto">
            <table className="data-table min-w-[640px]">
              <thead className="data-table-head">
                <tr>
                  <th className="data-table-head-cell">Date</th>
                  <th className="data-table-head-cell">Category</th>
                  <th className="data-table-head-cell">Description</th>
                  <th className="data-table-head-cell-right">Amount</th>
                  <th className="data-table-head-cell">Via</th>
                  <th className="data-table-head-cell">Status</th>
                  <th className="data-table-head-cell"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp, idx) => (
                  <tr
                    key={exp.id}
                    className={cn("data-table-row", idx % 2 === 0 ? "data-table-row-even" : "data-table-row-odd")}
                  >
                    <td className="data-table-cell text-sm">{formatDateStandard(exp.expense_date)}</td>
                    <td className="data-table-cell">
                      <span className={CATEGORY_COLORS[exp.category]}>{exp.category}</span>
                    </td>
                    <td className="data-table-cell text-sm text-slate-600">{exp.description ?? "—"}</td>
                    <td className="data-table-cell-right text-sm font-medium tabular-nums">{formatMoney(exp.amount)}</td>
                    <td className="data-table-cell text-sm text-slate-600">{exp.payment_mode ?? "—"}</td>
                    <td className="data-table-cell">
                      {exp.status === "paid" ? (
                        <span className="badge bg-emerald-100 text-emerald-700 border border-emerald-200">Paid</span>
                      ) : (
                        <span className="badge bg-rose-100 text-rose-600 border border-rose-200">Unpaid</span>
                      )}
                    </td>
                    <td className="data-table-cell">
                      <div className="flex items-center gap-1 justify-end">
                        {exp.status === "unpaid" && (
                          <button type="button" className="data-table-btn" onClick={() => openPay(exp)}>
                            Pay
                          </button>
                        )}
                        {isAdmin && (
                          <>
                            <button type="button" className="data-table-btn" onClick={() => openEdit(exp)}>
                              Edit
                            </button>
                            <button type="button" className="data-table-btn-danger" onClick={() => handleDelete(exp.id)}>
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Expense Modal ── */}
      <EditModal open={showAdd} title="Add Operating Expense" onClose={() => setShowAdd(false)}>
        <div className="flex flex-col gap-4">
          {formError && <div className="error-banner">{formError}</div>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="field-label">
              <span className="field-label-text">Category <span className="text-rose-500">*</span></span>
              <select
                className="field-input"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))}
                disabled={saving}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <DatePickerField
              label="Date *"
              value={form.expense_date}
              onChange={(v) => setForm((f) => ({ ...f, expense_date: v }))}
            />
          </div>

          <label className="field-label">
            <span className="field-label-text">Description</span>
            <input
              type="text"
              className="field-input"
              placeholder="e.g. Office supplies from SM"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              disabled={saving}
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="field-label">
              <span className="field-label-text">Amount <span className="text-rose-500">*</span></span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="field-input"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                disabled={saving}
              />
            </label>

            <label className="field-label">
              <span className="field-label-text">Payment Method <span className="text-slate-400 font-normal text-xs">(blank = Unpaid)</span></span>
              <select
                className="field-input"
                value={form.payment_mode}
                onChange={(e) => setForm((f) => ({ ...f, payment_mode: e.target.value }))}
                disabled={saving}
              >
                <option value="">— Unpaid —</option>
                {payModes.map((pm) => <option key={pm.code} value={pm.name}>{pm.name}</option>)}
              </select>
            </label>
          </div>

          <label className="field-label">
            <span className="field-label-text">Remarks</span>
            <textarea
              className="field-textarea"
              rows={2}
              placeholder="Optional notes"
              value={form.remarks}
              onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              disabled={saving}
            />
          </label>

          <div className="modal-footer-buttons">
            <button type="button" className="cancel-btn" onClick={() => setShowAdd(false)} disabled={saving}>Cancel</button>
            <button type="button" className="save-btn" onClick={handleAdd} disabled={saving}>
              {saving ? "Saving…" : "Save Expense"}
            </button>
          </div>
        </div>
      </EditModal>

      {/* ── Pay Modal ── */}
      <EditModal open={Boolean(payTarget)} title="Mark as Paid" onClose={() => setPayTarget(null)}>
        <div className="flex flex-col gap-4">
          {payError && <div className="error-banner">{payError}</div>}
          {payTarget && (
            <p className="text-sm text-slate-600">
              Marking <span className="font-semibold">{payTarget.description ?? payTarget.category}</span> ({formatMoney(payTarget.amount)}) as paid.
            </p>
          )}

          <label className="field-label">
            <span className="field-label-text">Payment Method <span className="text-rose-500">*</span></span>
            <select
              className="field-input"
              value={payMode}
              onChange={(e) => setPayMode(e.target.value)}
              disabled={paying}
            >
              <option value="">Select…</option>
              {payModes.map((pm) => <option key={pm.code} value={pm.name}>{pm.name}</option>)}
            </select>
          </label>

          <DatePickerField
            label="Date Paid *"
            value={payDate}
            onChange={setPayDate}
          />

          <div className="modal-footer-buttons">
            <button type="button" className="cancel-btn" onClick={() => setPayTarget(null)} disabled={paying}>Cancel</button>
            <button type="button" className="save-btn" onClick={handlePay} disabled={paying}>
              {paying ? "Saving…" : "Mark Paid"}
            </button>
          </div>
        </div>
      </EditModal>

      {/* ── Edit Modal (admin only) ── */}
      <EditModal open={Boolean(editTarget) && isAdmin} title="Edit Expense" onClose={() => setEditTarget(null)}>
        <div className="flex flex-col gap-4">
          {editError && <div className="error-banner">{editError}</div>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="field-label">
              <span className="field-label-text">Category</span>
              <select
                className="field-input"
                value={editForm.category}
                onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value as Category }))}
                disabled={editSaving}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <DatePickerField
              label="Date"
              value={editForm.expense_date}
              onChange={(v) => setEditForm((f) => ({ ...f, expense_date: v }))}
            />
          </div>

          <label className="field-label">
            <span className="field-label-text">Description</span>
            <input
              type="text"
              className="field-input"
              value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              disabled={editSaving}
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="field-label">
              <span className="field-label-text">Amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="field-input"
                value={editForm.amount}
                onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                disabled={editSaving}
              />
            </label>

            <label className="field-label">
              <span className="field-label-text">Payment Method <span className="text-slate-400 font-normal text-xs">(blank = Unpaid)</span></span>
              <select
                className="field-input"
                value={editForm.payment_mode}
                onChange={(e) => setEditForm((f) => ({ ...f, payment_mode: e.target.value }))}
                disabled={editSaving}
              >
                <option value="">— Unpaid —</option>
                {payModes.map((pm) => <option key={pm.code} value={pm.name}>{pm.name}</option>)}
              </select>
            </label>
          </div>

          <label className="field-label">
            <span className="field-label-text">Remarks</span>
            <textarea
              className="field-textarea"
              rows={2}
              value={editForm.remarks}
              onChange={(e) => setEditForm((f) => ({ ...f, remarks: e.target.value }))}
              disabled={editSaving}
            />
          </label>

          <div className="modal-footer-buttons">
            <button
              type="button"
              className="delete-btn"
              onClick={() => { const id = editTarget!.id; setEditTarget(null); handleDelete(id); }}
              disabled={editSaving}
            >
              Delete
            </button>
            <div className="flex gap-2">
              <button type="button" className="cancel-btn" onClick={() => setEditTarget(null)} disabled={editSaving}>Cancel</button>
              <button type="button" className="save-btn" onClick={handleEdit} disabled={editSaving}>
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </EditModal>
    </div>
  );
}
