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

type MaintenanceLog = {
  id: string;
  clinic_id: string;
  equipment: string;
  issue_work_done: string;
  service_date: string;
  cost: number | null;
  technician: string | null;
  photo_url: string | null;
  photo_urls: string[];
  expense_id: string | null;
  created_at: string;
};

type FormState = {
  equipment: string;
  issue_work_done: string;
  service_date: string;
  cost: string;
  technician: string;
};

function blankForm(): FormState {
  return {
    equipment:       "",
    issue_work_done: "",
    service_date:    new Date().toISOString().slice(0, 10),
    cost:            "",
    technician:      "",
  };
}

const MAX_PHOTOS = 5;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MaintenancePage() {
  const { clinicId, isAdmin } = useClinic();

  const [logs, setLogs]             = useState<MaintenanceLog[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add modal
  const [showAdd, setShowAdd]       = useState(false);
  const [form, setForm]             = useState<FormState>(blankForm());
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);

  // Edit modal (admin only)
  const [editTarget, setEditTarget]               = useState<MaintenanceLog | null>(null);
  const [editForm, setEditForm]                   = useState<FormState>(blankForm());
  const [editPhotoUrls, setEditPhotoUrls]         = useState<string[]>([]);
  const [editNewPhotoFiles, setEditNewPhotoFiles] = useState<File[]>([]);
  const [editSaving, setEditSaving]               = useState(false);
  const [editError, setEditError]                 = useState<string | null>(null);
  const [editDeleteText, setEditDeleteText]       = useState("");

  // ─── Load data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!clinicId) return;
    setIsLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("maintenance_logs")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("service_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setLogs((data ?? []).map((row) => ({
        ...row,
        photo_urls: row.photo_urls ?? [],
      })) as MaintenanceLog[]);
    }

    setIsLoading(false);
  }, [clinicId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 3000);
    return () => clearTimeout(t);
  }, [successMsg]);

  // ─── Upload photo helper ────────────────────────────────────────────────────

  async function uploadPhoto(file: File): Promise<string | null> {
    const path = `maintenance/${clinicId}/${crypto.randomUUID()}-${file.name}`;
    const up = await supabase.storage.from("clinic-files").upload(path, file);
    if (up.error) return null;
    const { data: pub } = supabase.storage.from("clinic-files").getPublicUrl(path);
    return pub.publicUrl;
  }

  async function uploadAll(files: File[]): Promise<string[]> {
    const results = await Promise.all(files.map(uploadPhoto));
    return results.filter((u): u is string => u !== null);
  }

  // ─── Auto-create operating expense when cost > 0 ──────────────────────────

  async function createMaintenanceExpense(
    serviceDate: string,
    cost: number,
    equipmentNote: string,
    technician: string | null,
  ): Promise<string | null> {
    const { data, error: err } = await supabase
      .from("clinic_operating_expenses")
      .insert({
        clinic_id:    clinicId,
        expense_date: serviceDate,
        category:     "Maintenance",
        description:  equipmentNote,
        vendor:       technician || null,
        amount:       cost,
        payment_mode: null,
        status:       "unpaid",
        date_paid:    null,
        remarks:      "Auto-created from Maintenance Log",
      })
      .select("id")
      .single();

    if (err || !data) return null;
    return (data as { id: string }).id;
  }

  // ─── Add log ──────────────────────────────────────────────────────────────

  function openAdd() {
    setForm(blankForm());
    setPhotoFiles([]);
    setFormError(null);
    setShowAdd(true);
  }

  function addPhotoFile(file: File) {
    setPhotoFiles((prev) => (prev.length < MAX_PHOTOS ? [...prev, file] : prev));
  }

  function removePhotoFile(idx: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleAdd() {
    if (!form.equipment.trim()) { setFormError("Equipment is required."); return; }
    if (!form.issue_work_done.trim()) { setFormError("Issue / Work Done is required."); return; }
    if (!form.service_date) { setFormError("Service date is required."); return; }
    setSaving(true);
    setFormError(null);

    const uploadedUrls = photoFiles.length > 0 ? await uploadAll(photoFiles) : [];
    if (photoFiles.length > 0 && uploadedUrls.length === 0) {
      setSaving(false);
      setFormError("Photo upload failed. Please try again.");
      return;
    }

    const cost = form.cost ? Number(form.cost) : null;
    let expenseId: string | null = null;
    if (cost && cost > 0) {
      expenseId = await createMaintenanceExpense(
        form.service_date,
        cost,
        form.equipment.trim(),
        form.technician.trim() || null,
      );
    }

    const { error: err } = await supabase.from("maintenance_logs").insert({
      clinic_id:       clinicId,
      equipment:       form.equipment.trim(),
      issue_work_done: form.issue_work_done.trim(),
      service_date:    form.service_date,
      cost:            cost,
      technician:      form.technician.trim() || null,
      photo_url:       uploadedUrls[0] ?? null,
      // Only include photo_urls when non-empty; column requires migration:
      // ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT '{}';
      ...(uploadedUrls.length > 0 && { photo_urls: uploadedUrls }),
      expense_id:      expenseId,
    });

    setSaving(false);
    if (err) { setFormError(err.message); return; }
    setShowAdd(false);
    setSuccessMsg(cost && cost > 0 ? "Log added. An unpaid expense was created under General → Maintenance." : "Log added.");
    await loadData();
  }

  // ─── Edit (admin only) ─────────────────────────────────────────────────────

  function openEdit(log: MaintenanceLog) {
    setEditTarget(log);
    setEditForm({
      equipment:       log.equipment,
      issue_work_done: log.issue_work_done,
      service_date:    log.service_date,
      cost:            log.cost != null ? String(log.cost) : "",
      technician:      log.technician ?? "",
    });
    // Combine photo_url (legacy) + photo_urls, dedupe
    const urls = log.photo_urls.length > 0
      ? log.photo_urls
      : log.photo_url
        ? [log.photo_url]
        : [];
    setEditPhotoUrls(urls);
    setEditNewPhotoFiles([]);
    setEditError(null);
    setEditDeleteText("");
  }

  function addEditPhotoFile(file: File) {
    setEditNewPhotoFiles((prev) => {
      const total = editPhotoUrls.length + prev.length;
      return total < MAX_PHOTOS ? [...prev, file] : prev;
    });
  }

  function removeEditNewPhoto(idx: number) {
    setEditNewPhotoFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function removeEditExistingPhoto(url: string) {
    setEditPhotoUrls((prev) => prev.filter((u) => u !== url));
  }

  async function handleEdit() {
    if (!editTarget) return;
    if (!editForm.equipment.trim()) { setEditError("Equipment is required."); return; }
    setEditSaving(true);
    setEditError(null);

    const newUrls = editNewPhotoFiles.length > 0 ? await uploadAll(editNewPhotoFiles) : [];
    const allUrls = [...editPhotoUrls, ...newUrls];

    const cost = editForm.cost ? Number(editForm.cost) : null;
    const { error: err } = await supabase
      .from("maintenance_logs")
      .update({
        equipment:       editForm.equipment.trim(),
        issue_work_done: editForm.issue_work_done.trim(),
        service_date:    editForm.service_date,
        cost:            cost,
        technician:      editForm.technician.trim() || null,
        photo_url:       allUrls[0] ?? null,
        // Only include photo_urls when non-empty; column requires migration:
        // ALTER TABLE maintenance_logs ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT '{}';
        ...(allUrls.length > 0 && { photo_urls: allUrls }),
      })
      .eq("id", editTarget.id)
      .eq("clinic_id", clinicId);

    setEditSaving(false);
    if (err) { setEditError(err.message); return; }
    setEditTarget(null);
    setSuccessMsg("Log updated.");
    await loadData();
  }

  async function handleDelete() {
    if (!editTarget || editDeleteText !== "DELETE") return;
    const id = editTarget.id;
    setEditSaving(true);
    const { error: err } = await supabase
      .from("maintenance_logs")
      .delete()
      .eq("id", id)
      .eq("clinic_id", clinicId);
    setEditSaving(false);
    if (err) { setEditError(err.message); return; }
    setEditTarget(null);
    setSuccessMsg("Log deleted.");
    await loadData();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function getPhotoCount(log: MaintenanceLog): number {
    if (log.photo_urls.length > 0) return log.photo_urls.length;
    return log.photo_url ? 1 : 0;
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="page-bg">
      <main className="app-section spacing-vertical-lg">
        {successMsg && <div className="success-banner">{successMsg}</div>}
        {error && <div className="error-banner">{error}</div>}

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Maintenance Log</h2>
            <button type="button" className="save-btn" onClick={openAdd}>
              + Add Log
            </button>
          </div>
          <p className="hint-text mt-0 pb-2">
            Track equipment servicing and repairs. Adding a cost auto-creates an unpaid expense under General → Maintenance.
          </p>

          {isLoading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : logs.length === 0 ? (
            <div className="data-table-empty">
              No maintenance logs yet. Click &quot;Add Log&quot; to get started.
            </div>
          ) : (
            <div className="table-wrapper overflow-x-auto">
              <table className="data-table min-w-[640px]">
                <thead className="data-table-head">
                  <tr>
                    <th className="data-table-head-cell">Equipment</th>
                    <th className="data-table-head-cell">Issue / Work Done</th>
                    <th className="data-table-head-cell w-28">Date</th>
                    <th className="data-table-head-cell-right w-24">Cost</th>
                    <th className="data-table-head-cell w-40">Technician</th>
                    <th className="data-table-head-cell w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, idx) => {
                    const photoCount = getPhotoCount(log);
                    const allUrls = log.photo_urls.length > 0
                      ? log.photo_urls
                      : log.photo_url ? [log.photo_url] : [];
                    return (
                      <tr
                        key={log.id}
                        className={cn("data-table-row", idx % 2 === 0 ? "data-table-row-even" : "data-table-row-odd", isAdmin && "cursor-pointer")}
                        onClick={() => isAdmin && openEdit(log)}
                      >
                        <td className="data-table-cell font-medium text-sm">{log.equipment}</td>
                        <td className="data-table-cell text-sm text-slate-600 max-w-xs">
                          <span className="line-clamp-2">{log.issue_work_done}</span>
                        </td>
                        <td className="data-table-cell text-sm whitespace-nowrap">{formatDateStandard(log.service_date)}</td>
                        <td className="data-table-cell-right text-sm tabular-nums">
                          {log.cost != null ? formatMoney(log.cost) : "—"}
                        </td>
                        <td className="data-table-cell text-sm text-slate-600 truncate max-w-0">{log.technician ?? "—"}</td>
                        <td className="data-table-cell" onClick={(e) => e.stopPropagation()}>
                          {photoCount > 0 && (
                            <div className="flex items-center justify-end gap-1">
                              {allUrls.slice(0, 3).map((url, i) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="data-table-btn"
                                  title={`View photo ${i + 1}`}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </a>
                              ))}
                              {photoCount > 3 && (
                                <span className="text-xs text-slate-500">+{photoCount - 3}</span>
                              )}
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

        {/* ── Add Log Modal ── */}
        <EditModal open={showAdd} title="Add Maintenance Log" onClose={() => setShowAdd(false)}>
          <div className="flex flex-col gap-4">
            {formError && <div className="error-banner">{formError}</div>}

            <label className="field-label">
              <span className="field-label-text">Equipment <span className="text-rose-500">*</span></span>
              <input
                type="text"
                className="field-input"
                placeholder="e.g. Purifier, Compressor, Dental Chair"
                value={form.equipment}
                onChange={(e) => setForm((f) => ({ ...f, equipment: e.target.value }))}
                disabled={saving}
              />
            </label>

            <label className="field-label">
              <span className="field-label-text">Issue / Work Done <span className="text-rose-500">*</span></span>
              <textarea
                className="field-textarea"
                rows={3}
                placeholder="Describe the problem or work done…"
                value={form.issue_work_done}
                onChange={(e) => setForm((f) => ({ ...f, issue_work_done: e.target.value }))}
                disabled={saving}
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DatePickerField
                label="Service Date *"
                value={form.service_date}
                onChange={(v) => setForm((f) => ({ ...f, service_date: v }))}
              />

              <label className="field-label">
                <span className="field-label-text">Cost <span className="text-slate-400 font-normal text-xs">(if any)</span></span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="field-input"
                  placeholder="0.00"
                  value={form.cost}
                  onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                  disabled={saving}
                />
              </label>
            </div>

            <label className="field-label">
              <span className="field-label-text">Supplier / Technician</span>
              <input
                type="text"
                className="field-input"
                placeholder="Name or company"
                value={form.technician}
                onChange={(e) => setForm((f) => ({ ...f, technician: e.target.value }))}
                disabled={saving}
              />
            </label>

            {/* Multi-photo upload */}
            <div>
              <span className="field-label-text block mb-2">
                Photos <span className="text-slate-400 font-normal text-xs">(up to {MAX_PHOTOS})</span>
              </span>
              <div className="flex flex-col gap-2">
                {photoFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    <svg className="w-4 h-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="flex-1 truncate">{file.name}</span>
                    <button
                      type="button"
                      className="shrink-0 text-slate-400 hover:text-rose-500 transition-colors"
                      onClick={() => removePhotoFile(idx)}
                      disabled={saving}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {photoFiles.length < MAX_PHOTOS && (
                  <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-600 transition-colors">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) addPhotoFile(f); e.target.value = ""; }}
                      disabled={saving}
                    />
                  </label>
                )}
              </div>
            </div>

            {form.cost && Number(form.cost) > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <span className="shrink-0 mt-0.5">ℹ</span>
                <span>An unpaid expense of {formatMoney(Number(form.cost))} will be auto-created under General → Maintenance.</span>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button type="button" className="cancel-btn" onClick={() => setShowAdd(false)} disabled={saving}>Cancel</button>
              <button type="button" className="save-btn" onClick={handleAdd} disabled={saving}>
                {saving ? "Saving…" : "Add Log"}
              </button>
            </div>
          </div>
        </EditModal>

        {/* ── Edit Log Modal (admin only) ── */}
        <EditModal open={Boolean(editTarget) && isAdmin} title="Edit Maintenance Log" onClose={() => setEditTarget(null)}>
          <div className="flex flex-col gap-4">
            {editError && <div className="error-banner">{editError}</div>}

            <label className="field-label">
              <span className="field-label-text">Equipment</span>
              <input
                type="text"
                className="field-input"
                value={editForm.equipment}
                onChange={(e) => setEditForm((f) => ({ ...f, equipment: e.target.value }))}
                disabled={editSaving}
              />
            </label>

            <label className="field-label">
              <span className="field-label-text">Issue / Work Done</span>
              <textarea
                className="field-textarea"
                rows={3}
                value={editForm.issue_work_done}
                onChange={(e) => setEditForm((f) => ({ ...f, issue_work_done: e.target.value }))}
                disabled={editSaving}
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DatePickerField
                label="Service Date"
                value={editForm.service_date}
                onChange={(v) => setEditForm((f) => ({ ...f, service_date: v }))}
              />

              <label className="field-label">
                <span className="field-label-text">Cost</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="field-input"
                  value={editForm.cost}
                  onChange={(e) => setEditForm((f) => ({ ...f, cost: e.target.value }))}
                  disabled={editSaving}
                />
              </label>
            </div>

            <label className="field-label">
              <span className="field-label-text">Supplier / Technician</span>
              <input
                type="text"
                className="field-input"
                value={editForm.technician}
                onChange={(e) => setEditForm((f) => ({ ...f, technician: e.target.value }))}
                disabled={editSaving}
              />
            </label>

            {/* Multi-photo edit */}
            <div>
              <span className="field-label-text block mb-2">
                Photos <span className="text-slate-400 font-normal text-xs">(up to {MAX_PHOTOS})</span>
              </span>
              <div className="flex flex-col gap-2">
                {editPhotoUrls.map((url, idx) => (
                  <div key={url} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-blue-600 underline truncate text-xs"
                    >
                      Photo {idx + 1}
                    </a>
                    <button
                      type="button"
                      className="shrink-0 text-slate-400 hover:text-rose-500 transition-colors"
                      onClick={() => removeEditExistingPhoto(url)}
                      disabled={editSaving}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {editNewPhotoFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-slate-600">
                    <svg className="w-4 h-4 shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="flex-1 truncate">{file.name}</span>
                    <button
                      type="button"
                      className="shrink-0 text-slate-400 hover:text-rose-500 transition-colors"
                      onClick={() => removeEditNewPhoto(idx)}
                      disabled={editSaving}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {(editPhotoUrls.length + editNewPhotoFiles.length) < MAX_PHOTOS && (
                  <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-600 transition-colors">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) addEditPhotoFile(f); e.target.value = ""; }}
                      disabled={editSaving}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="delete-confirmation">
              <div className="delete-confirmation-title">Delete log?</div>
              <div className="delete-confirmation-hint">Type <span className="delete-confirmation-code">DELETE</span> to confirm</div>
              <input
                className="delete-confirmation-input"
                value={editDeleteText}
                onChange={(e) => setEditDeleteText(e.target.value)}
                placeholder="DELETE"
                disabled={editSaving}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="delete-btn"
                onClick={handleDelete}
                disabled={editSaving || editDeleteText !== "DELETE"}
              >
                Delete
              </button>
              <div className="modal-actions-right">
                <button type="button" className="cancel-btn" onClick={() => setEditTarget(null)} disabled={editSaving}>Cancel</button>
                <button type="button" className="save-btn" onClick={handleEdit} disabled={editSaving}>
                  {editSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </EditModal>
      </main>
    </div>
  );
}
