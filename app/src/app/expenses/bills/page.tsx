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

type ClinicBill = {
  id: string;
  clinic_id: string;
  category: string;
  due_date: string | null;
  date_paid: string | null;
  amount: number;
  payment_mode: string | null;
  remarks: string | null;
  receipt_url: string | null;
  created_at: string;
};

type PaymentMode = {
  code: string;
  name: string;
};

const BILL_CATEGORIES = ["Electricity", "Rent", "Water", "Internet", "Cable", "Other"] as const;
type BillCategory = (typeof BILL_CATEGORIES)[number];

const CATEGORY_COLORS: Record<BillCategory, string> = {
  Electricity: "badge bg-yellow-100 text-yellow-700 border border-yellow-200",
  Rent:        "badge bg-violet-100 text-violet-700 border border-violet-200",
  Water:       "badge bg-blue-100 text-blue-700 border border-blue-200",
  Internet:    "badge bg-cyan-100 text-cyan-700 border border-cyan-200",
  Cable:       "badge bg-slate-100 text-slate-600 border border-slate-200",
  Other:       "badge badge-secondary",
};

type FormState = {
  category: BillCategory;
  due_date: string;
  date_paid: string;
  amount: string;
  payment_mode: string;
  remarks: string;
};

function blankForm(): FormState {
  return {
    category:     "Electricity",
    due_date:     "",
    date_paid:    "",
    amount:       "",
    payment_mode: "",
    remarks:      "",
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillsPage() {
  const { clinicId, isAdmin } = useClinic();

  const [bills, setBills]             = useState<ClinicBill[]>([]);
  const [payModes, setPayModes]       = useState<PaymentMode[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [successMsg, setSuccessMsg]   = useState<string | null>(null);

  const [showAdd, setShowAdd]           = useState(false);
  const [form, setForm]                 = useState<FormState>(blankForm());
  const [receiptFile, setReceiptFile]   = useState<File | null>(null);
  const [saving, setSaving]             = useState(false);
  const [formError, setFormError]       = useState<string | null>(null);

  const [editTarget, setEditTarget]           = useState<ClinicBill | null>(null);
  const [editForm, setEditForm]               = useState<FormState>(blankForm());
  const [editReceiptFile, setEditReceiptFile] = useState<File | null>(null);
  const [editSaving, setEditSaving]           = useState(false);
  const [editError, setEditError]             = useState<string | null>(null);

  // ─── Load data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!clinicId) return;
    setIsLoading(true);
    setError(null);

    const [billRes, pmRes] = await Promise.all([
      supabase
        .from("clinic_bills")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false }),
      supabase
        .from("payment_modes")
        .select("code, name")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    if (billRes.error) {
      setError(billRes.error.message);
    } else {
      setBills(billRes.data as ClinicBill[]);
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

  // ─── Add bill ─────────────────────────────────────────────────────────────

  function openAdd() {
    setForm(blankForm());
    setReceiptFile(null);
    setFormError(null);
    setShowAdd(true);
  }

  async function handleAdd() {
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      setFormError("Amount must be a positive number.");
      return;
    }
    setSaving(true);
    setFormError(null);

    let receiptUrl: string | null = null;
    if (receiptFile) {
      const path = `bills/${clinicId}/${crypto.randomUUID()}-${receiptFile.name}`;
      const up = await supabase.storage.from("clinic-files").upload(path, receiptFile);
      if (up.error) { setSaving(false); setFormError(up.error.message); return; }
      const { data: pub } = supabase.storage.from("clinic-files").getPublicUrl(path);
      receiptUrl = pub.publicUrl;
    }

    const { error: err } = await supabase.from("clinic_bills").insert({
      clinic_id:    clinicId,
      category:     form.category,
      due_date:     form.due_date || null,
      date_paid:    form.date_paid || null,
      amount:       Number(form.amount),
      payment_mode: form.payment_mode || null,
      remarks:      form.remarks || null,
      receipt_url:  receiptUrl,
    });

    setSaving(false);
    if (err) { setFormError(err.message); return; }
    setShowAdd(false);
    setSuccessMsg("Bill added.");
    await loadData();
  }

  // ─── Edit (admin only) ─────────────────────────────────────────────────────

  function openEdit(bill: ClinicBill) {
    setEditTarget(bill);
    setEditForm({
      category:     bill.category as BillCategory,
      due_date:     bill.due_date ?? "",
      date_paid:    bill.date_paid ?? "",
      amount:       String(bill.amount),
      payment_mode: bill.payment_mode ?? "",
      remarks:      bill.remarks ?? "",
    });
    setEditReceiptFile(null);
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

    let receiptUrl: string | null = editTarget.receipt_url ?? null;
    if (editReceiptFile) {
      const path = `bills/${clinicId}/${crypto.randomUUID()}-${editReceiptFile.name}`;
      const up = await supabase.storage.from("clinic-files").upload(path, editReceiptFile);
      if (up.error) { setEditSaving(false); setEditError(up.error.message); return; }
      const { data: pub } = supabase.storage.from("clinic-files").getPublicUrl(path);
      receiptUrl = pub.publicUrl;
    }

    const { error: err } = await supabase
      .from("clinic_bills")
      .update({
        category:     editForm.category,
        due_date:     editForm.due_date || null,
        date_paid:    editForm.date_paid || null,
        amount:       Number(editForm.amount),
        payment_mode: editForm.payment_mode || null,
        remarks:      editForm.remarks || null,
        receipt_url:  receiptUrl,
      })
      .eq("id", editTarget.id)
      .eq("clinic_id", clinicId);

    setEditSaving(false);
    if (err) { setEditError(err.message); return; }
    setEditTarget(null);
    setSuccessMsg("Bill updated.");
    await loadData();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this bill? This cannot be undone.")) return;
    const { error: err } = await supabase
      .from("clinic_bills")
      .delete()
      .eq("id", id)
      .eq("clinic_id", clinicId);
    if (err) { setError(err.message); return; }
    setSuccessMsg("Bill deleted.");
    await loadData();
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="spacing-vertical-lg">
      {successMsg && <div className="success-banner">{successMsg}</div>}
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Bills</h2>
          <button type="button" className="save-btn" onClick={openAdd}>
            + Add Bill
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : bills.length === 0 ? (
          <div className="data-table-empty">
            No bills recorded yet. Click &quot;Add Bill&quot; to get started.
          </div>
        ) : (
          <div className="table-wrapper overflow-x-auto">
            <table className="data-table min-w-[640px]">
              <thead className="data-table-head">
                <tr>
                  <th className="data-table-head-cell">Type</th>
                  <th className="data-table-head-cell">Due Date</th>
                  <th className="data-table-head-cell">Status</th>
                  <th className="data-table-head-cell">Date Paid</th>
                  <th className="data-table-head-cell">Via</th>
                  <th className="data-table-head-cell-right">Amount</th>
                  <th className="data-table-head-cell"></th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill, idx) => {
                  const isPaid = Boolean(bill.date_paid);
                  return (
                    <tr
                      key={bill.id}
                      className={cn("data-table-row", idx % 2 === 0 ? "data-table-row-even" : "data-table-row-odd")}
                    >
                      <td className="data-table-cell">
                        <span className={CATEGORY_COLORS[bill.category as BillCategory] ?? "badge badge-secondary"}>
                          {bill.category}
                        </span>
                      </td>
                      <td className="data-table-cell text-sm">{formatDateStandard(bill.due_date)}</td>
                      <td className="data-table-cell">
                        {isPaid ? (
                          <span className="badge bg-emerald-100 text-emerald-700 border border-emerald-200">Paid</span>
                        ) : (
                          <span className="badge bg-rose-100 text-rose-600 border border-rose-200">Unpaid</span>
                        )}
                      </td>
                      <td className="data-table-cell text-sm">{formatDateStandard(bill.date_paid)}</td>
                      <td className="data-table-cell text-sm text-slate-600">{bill.payment_mode ?? "—"}</td>
                      <td className="data-table-cell-right text-sm font-medium tabular-nums">{formatMoney(bill.amount)}</td>
                      <td className="data-table-cell">
                        {isAdmin && (
                          <div className="flex items-center gap-1 justify-end">
                            <button type="button" className="data-table-btn" onClick={() => openEdit(bill)}>
                              Edit
                            </button>
                            <button type="button" className="data-table-btn-danger" onClick={() => handleDelete(bill.id)}>
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Bill Modal ── */}
      <EditModal open={showAdd} title="Add Bill" onClose={() => setShowAdd(false)}>
        <div className="flex flex-col gap-4">
          {formError && <div className="error-banner">{formError}</div>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="field-label">
              <span className="field-label-text">Category <span className="text-rose-500">*</span></span>
              <select
                className="field-input"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as BillCategory }))}
                disabled={saving}
              >
                {BILL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

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
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatePickerField
              label="Due Date"
              value={form.due_date}
              onChange={(v) => setForm((f) => ({ ...f, due_date: v }))}
            />

            <DatePickerField
              label="Date Paid (blank = Unpaid)"
              value={form.date_paid}
              onChange={(v) => setForm((f) => ({ ...f, date_paid: v }))}
            />
          </div>

          <label className="field-label">
            <span className="field-label-text">Payment Method</span>
            <select
              className="field-input"
              value={form.payment_mode}
              onChange={(e) => setForm((f) => ({ ...f, payment_mode: e.target.value }))}
              disabled={saving}
            >
              <option value="">— None —</option>
              {payModes.map((pm) => <option key={pm.code} value={pm.name}>{pm.name}</option>)}
            </select>
          </label>

          <label className="field-label">
            <span className="field-label-text">Receipt <span className="text-slate-400 font-normal text-xs">(optional)</span></span>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="field-input text-sm py-1.5"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              disabled={saving}
            />
            {receiptFile && <span className="text-xs text-slate-500">{receiptFile.name}</span>}
          </label>

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
              {saving ? "Saving…" : "Save Bill"}
            </button>
          </div>
        </div>
      </EditModal>

      {/* ── Edit Bill Modal (admin only) ── */}
      <EditModal open={Boolean(editTarget) && isAdmin} title="Edit Bill" onClose={() => setEditTarget(null)}>
        <div className="flex flex-col gap-4">
          {editError && <div className="error-banner">{editError}</div>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="field-label">
              <span className="field-label-text">Category</span>
              <select
                className="field-input"
                value={editForm.category}
                onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value as BillCategory }))}
                disabled={editSaving}
              >
                {BILL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

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
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatePickerField
              label="Due Date"
              value={editForm.due_date}
              onChange={(v) => setEditForm((f) => ({ ...f, due_date: v }))}
            />

            <DatePickerField
              label="Date Paid (blank = Unpaid)"
              value={editForm.date_paid}
              onChange={(v) => setEditForm((f) => ({ ...f, date_paid: v }))}
            />
          </div>

          <label className="field-label">
            <span className="field-label-text">Payment Method</span>
            <select
              className="field-input"
              value={editForm.payment_mode}
              onChange={(e) => setEditForm((f) => ({ ...f, payment_mode: e.target.value }))}
              disabled={editSaving}
            >
              <option value="">— None —</option>
              {payModes.map((pm) => <option key={pm.code} value={pm.name}>{pm.name}</option>)}
            </select>
          </label>

          <label className="field-label">
            <span className="field-label-text">Receipt <span className="text-slate-400 font-normal text-xs">(optional — replaces existing)</span></span>
            {editTarget?.receipt_url && !editReceiptFile && (
              <a href={editTarget.receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline mb-1">
                View current receipt
              </a>
            )}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="field-input text-sm py-1.5"
              onChange={(e) => setEditReceiptFile(e.target.files?.[0] ?? null)}
              disabled={editSaving}
            />
            {editReceiptFile && <span className="text-xs text-slate-500">{editReceiptFile.name}</span>}
          </label>

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
