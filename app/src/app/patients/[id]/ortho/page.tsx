"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { EditModal } from "@/components/EditModal";
import type { OrthoCase, OrthoEntry, DentistRow, Appointment } from "@/lib/types";
import { formatDatePH } from "@/lib/helpers";
import { orthoEntryTags, orthoArchOptions } from "@/lib/types";

export default function OrthoPage() {
  const params = useParams();
  const id = (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Case data
  const [orthoCase, setOrthoCase] = useState<OrthoCase | null>(null);
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [dentists, setDentists] = useState<DentistRow[]>([]);

  // Entries data
  const [entries, setEntries] = useState<OrthoEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<OrthoEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);

  // Case edit modal
  const [caseModalOpen, setCaseModalOpen] = useState(false);
  const [caseModalMode, setCaseModalMode] = useState<"create" | "edit">("create");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "on_hold" | "completed">("active");
  const [editProviderDentistId, setEditProviderDentistId] = useState("");
  const [editProviderName, setEditProviderName] = useState("");
  const [editPackageFee, setEditPackageFee] = useState("");
  const [editCaseNotes, setEditCaseNotes] = useState("");

  // Entry modal
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [entryModalMode, setEntryModalMode] = useState<"create" | "edit">("create");
  const [editEntryId, setEditEntryId] = useState("");
  const [editEntryDate, setEditEntryDate] = useState("");
  const [editEntryTag, setEditEntryTag] = useState<"adjustment" | "wire_change" | "elastics" | "bracket_repair" | "retainer" | "follow_up" | "other">("adjustment");
  const [editEntryNote, setEditEntryNote] = useState("");
  const [editEntryArch, setEditEntryArch] = useState("");
  const [editEntryTeeth, setEditEntryTeeth] = useState("");
  const [editEntryWireDetails, setEditEntryWireDetails] = useState("");

  // Delete confirmation
  const [deleteConfirmEntry, setDeleteConfirmEntry] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErr(null);

    // Load ortho case
    const caseRes = await supabase
      .from("ortho_cases")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!caseRes.error && caseRes.data?.length) {
      const c = caseRes.data[0] as OrthoCase;
      setOrthoCase(c);
    } else {
      setOrthoCase(null);
    }

    // Load dentists
    const dentistsRes = await supabase
      .from("dentists")
      .select("id, full_name")
      .order("full_name", { ascending: true });

    if (!dentistsRes.error && dentistsRes.data) {
      setDentists(dentistsRes.data as DentistRow[]);
    }

    // Load next appointment
    const appointmentsRes = await supabase
      .from("appointments")
      .select("*")
      .eq("patient_id", id)
      .gte("appointment_date", new Date().toISOString().split("T")[0])
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true })
      .limit(1);

    if (!appointmentsRes.error && appointmentsRes.data?.length) {
      setNextAppointment(appointmentsRes.data[0] as Appointment);
    } else {
      setNextAppointment(null);
    }

    setLoading(false);
  }, [id]);

  const loadEntries = useCallback(async () => {
    if (!orthoCase) return;
    setEntriesLoading(true);

    const entriesRes = await supabase
      .from("ortho_entries")
      .select("*")
      .eq("ortho_case_id", orthoCase.id)
      .order("entry_date", { ascending: false });

    if (!entriesRes.error && entriesRes.data) {
      setEntries(entriesRes.data as OrthoEntry[]);
      setFilteredEntries(entriesRes.data as OrthoEntry[]);
    }

    setEntriesLoading(false);
  }, [orthoCase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  async function saveCase() {
    if (!id) return;
    setErr(null);

    const data: Partial<OrthoCase> = {
      patient_id: id,
      status: editStatus,
      start_date: editStartDate || null,
      end_date: editEndDate || null,
      provider_dentist_id: editProviderDentistId || null,
      provider_name: editProviderName.trim() || null,
      package_fee: editPackageFee ? parseFloat(editPackageFee) : null,
      notes: editCaseNotes.trim() || null,
    };

    setBusy(true);

    let res;
    if (caseModalMode === "create" && !orthoCase) {
      res = await supabase.from("ortho_cases").insert([data]);
    } else if (caseModalMode === "edit" && orthoCase) {
      res = await supabase.from("ortho_cases").update(data).eq("id", orthoCase.id);
    } else {
      setBusy(false);
      return;
    }

    setBusy(false);

    if (res.error) {
      setErr(res.error.message);
    } else {
      setCaseModalOpen(false);
      await loadData();
    }
  }

  function openCreateCaseModal() {
    setCaseModalMode("create");
    setEditStartDate("");
    setEditEndDate("");
    setEditStatus("active");
    setEditProviderDentistId("");
    setEditProviderName("");
    setEditPackageFee("");
    setEditCaseNotes("");
    setCaseModalOpen(true);
  }

  function openEditCaseModal() {
    if (!orthoCase) return;
    setCaseModalMode("edit");
    setEditStartDate(orthoCase.start_date || "");
    setEditEndDate(orthoCase.end_date || "");
    setEditStatus(orthoCase.status as "active" | "on_hold" | "completed");
    setEditProviderDentistId(orthoCase.provider_dentist_id || "");
    setEditProviderName(orthoCase.provider_name || "");
    setEditPackageFee(orthoCase.package_fee?.toString() || "");
    setEditCaseNotes(orthoCase.notes || "");
    setCaseModalOpen(true);
  }

  async function saveEntry() {
    if (!orthoCase) return;
    setErr(null);

    if (!editEntryDate.trim()) {
      return setErr("Entry date is required.");
    }

    const data: Partial<OrthoEntry> = {
      ortho_case_id: orthoCase.id,
      entry_date: editEntryDate,
      tag: editEntryTag,
      note: editEntryNote.trim() || undefined,
      arch: editEntryArch || undefined,
      teeth: editEntryTeeth.trim() || undefined,
      wire_details: editEntryWireDetails.trim() || undefined,
    };

    setBusy(true);

    let res;
    if (entryModalMode === "create") {
      res = await supabase.from("ortho_entries").insert([data]);
    } else if (entryModalMode === "edit" && editEntryId) {
      res = await supabase.from("ortho_entries").update(data).eq("id", editEntryId);
    } else {
      setBusy(false);
      return;
    }

    setBusy(false);

    if (res.error) {
      setErr(res.error.message);
    } else {
      setEntryModalOpen(false);
      await loadEntries();
    }
  }

  function openCreateEntryModal() {
    setEntryModalMode("create");
    setEditEntryId("");
    setEditEntryDate(new Date().toISOString().split("T")[0]);
    setEditEntryTag("adjustment");
    setEditEntryNote("");
    setEditEntryArch("");
    setEditEntryTeeth("");
    setEditEntryWireDetails("");
    setEntryModalOpen(true);
  }

  function openEditEntryModal(entry: OrthoEntry) {
    setEntryModalMode("edit");
    setEditEntryId(entry.id);
    setEditEntryDate(entry.entry_date);
    setEditEntryTag(entry.tag as "adjustment" | "wire_change" | "elastics" | "bracket_repair" | "retainer" | "follow_up" | "other");
    setEditEntryNote(entry.note || "");
    setEditEntryArch(entry.arch || "");
    setEditEntryTeeth(entry.teeth || "");
    setEditEntryWireDetails(entry.wire_details || "");
    setEntryModalOpen(true);
  }

  async function deleteEntry(entryId: string) {
    setErr(null);
    setBusy(true);

    const res = await supabase.from("ortho_entries").delete().eq("id", entryId);

    setBusy(false);

    if (res.error) {
      setErr(res.error.message);
      return;
    }

    setDeleteConfirmEntry(null);
    await loadEntries();
  }

  if (loading) {
    return (
      <div className="flex-col-center justify-center min-h-screen">
        <div className="text-muted">Loading…</div>
      </div>
    );
  }

  return (
    <>
      {err ? <div className="error-banner">{err}</div> : null}
      <div className="patient-content">
        <div className="patient-sections">

          {/* Ortho Case Box - Like Patient Information */}
          <div className="info-box">
            <div className="info-box-header">
              <div className="info-box-title">Ortho Case</div>
              {orthoCase ? (
                <button className="btn-primary-dark" disabled={busy} onClick={openEditCaseModal}>
                  Edit
                </button>
              ) : (
                <button className="btn-secondary-dark" disabled={busy} onClick={openCreateCaseModal}>
                  Create Case
                </button>
              )}
            </div>

            {orthoCase ? (
              <div className="space-y-4-base">
                {/* Row 1: Status, Start Date */}
                <div className="grid-gap-4-cols-2">
                  <label className="field-label">
                    <span className="field-label-text">Status</span>
                    <input className="field-input-readonly" value={orthoCase.status?.toUpperCase() || ""} readOnly />
                  </label>
                  <label className="field-label">
                    <span className="field-label-text">Start Date</span>
                    <input className="field-input-readonly" value={orthoCase.start_date ? formatDatePH(orthoCase.start_date) : ""} readOnly />
                  </label>
                </div>

                {/* Row 2: End Date, Provider */}
                <div className="grid-gap-4-cols-2">
                  <label className="field-label">
                    <span className="field-label-text">End Date</span>
                    <input className="field-input-readonly" value={orthoCase.end_date ? formatDatePH(orthoCase.end_date) : "—"} readOnly />
                  </label>
                  <label className="field-label">
                    <span className="field-label-text">Provider</span>
                    <input className="field-input-readonly" value={orthoCase.provider_name || "—"} readOnly />
                  </label>
                </div>

                {/* Row 3: Package Fee, Next Appointment */}
                <div className="grid-gap-4-cols-2">
                  <label className="field-label">
                    <span className="field-label-text">Package Fee</span>
                    <input className="field-input-readonly" value={orthoCase.package_fee ? `₱${orthoCase.package_fee.toFixed(2)}` : "—"} readOnly />
                  </label>
                  <label className="field-label">
                    <span className="field-label-text">Next Appointment</span>
                    <input 
                      className="field-input-readonly" 
                      value={nextAppointment ? `${formatDatePH(nextAppointment.appointment_date)} at ${nextAppointment.appointment_time}` : "No upcoming appointment"} 
                      readOnly 
                    />
                  </label>
                </div>

                {/* Row 4: Notes (full width) */}
                {orthoCase.notes && (
                  <label className="field-label">
                    <span className="field-label-text">Notes</span>
                    <textarea className="field-textarea-readonly" value={orthoCase.notes} readOnly />
                  </label>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-600 py-4">No ortho case created yet. Click "Create Case" to get started.</div>
            )}
          </div>

          {/* Adjustment Log - Like Treatment History Table */}
          {orthoCase && (
            <div className="info-box">
              <div className="info-box-header">
                <div className="info-box-title">Adjustment Log</div>
                <button className="btn-secondary-dark" disabled={busy || entriesLoading} onClick={openCreateEntryModal}>
                  Add Entry
                </button>
              </div>

              {entriesLoading ? (
                <div className="text-center py-8 text-slate-500">Loading entries…</div>
              ) : filteredEntries.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No adjustment entries yet.</div>
              ) : (
                <div className="mt-3-overflow">
                  <table className="data-table">
                    <colgroup>
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "35%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "8%" }} />
                    </colgroup>
                    <thead className="data-table-head">
                      <tr>
                        <th className="data-table-head-cell">Date</th>
                        <th className="data-table-head-cell">Tag</th>
                        <th className="data-table-head-cell">Note</th>
                        <th className="data-table-head-cell">Arch</th>
                        <th className="data-table-head-cell">Details</th>
                        <th className="data-table-head-cell-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((entry, index) => (
                        <tr key={entry.id} className={`data-table-row ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                          <td className="data-table-cell">{formatDatePH(entry.entry_date)}</td>
                          <td className="data-table-cell">
                            <span className="badge badge-secondary">{entry.tag.replace(/_/g, " ")}</span>
                          </td>
                          <td className="data-table-cell">{entry.note || "—"}</td>
                          <td className="data-table-cell">{entry.arch || "—"}</td>
                          <td className="data-table-cell">{entry.teeth || entry.wire_details ? "✓" : "—"}</td>
                          <td className="data-table-cell-right">
                            <button
                              className="data-table-btn"
                              disabled={busy}
                              onClick={() => openEditEntryModal(entry)}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Case Modal */}
      {caseModalOpen && (
        <EditModal 
          open={caseModalOpen} 
          title={`${caseModalMode === "create" ? "Create" : "Edit"} Ortho Case`} 
          onClose={() => { setCaseModalOpen(false); setErr(null); }}
        >
          <div className="space-y-4-base">
            {/* Row 1: Start Date, End Date */}
            <div className="grid-gap-4-cols-2">
              <div className="field-label">
                <span className="field-label-text">Start Date</span>
                <input
                  type="date"
                  className="field-input"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                />
              </div>
              <div className="field-label">
                <span className="field-label-text">End Date</span>
                <input
                  type="date"
                  className="field-input"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Status */}
            <div className="field-label">
              <span className="field-label-text">Status</span>
              <select
                className="field-input"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as "active" | "on_hold" | "completed")}
              >
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* Row 2: Provider ID, Provider Name */}
            <div className="grid-gap-4-cols-2">
              <div className="field-label">
                <span className="field-label-text">Dentist</span>
                <select className="field-input" value={editProviderDentistId} onChange={(e) => setEditProviderDentistId(e.target.value)}>
                  <option value="">— None —</option>
                  {dentists.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-label">
                <span className="field-label-text">Provider Name (if not listed)</span>
                <input
                  className="field-input"
                  value={editProviderName}
                  onChange={(e) => setEditProviderName(e.target.value)}
                  placeholder="e.g., Dr. Smith"
                />
              </div>
            </div>

            {/* Package Fee */}
            <div className="field-label">
              <span className="field-label-text">Package Fee</span>
              <input
                type="number"
                className="field-input"
                step="0.01"
                value={editPackageFee}
                onChange={(e) => setEditPackageFee(e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Notes */}
            <div className="field-label">
              <span className="field-label-text">Notes</span>
              <textarea 
                className="field-textarea" 
                value={editCaseNotes} 
                onChange={(e) => setEditCaseNotes(e.target.value)} 
                placeholder="Any notes about the case…"
                rows={3}
              />
            </div>

            {/* Modal Footer */}
            <div className="modal-footer-spread">
              {caseModalMode === "edit" && orthoCase && (
                <button
                  className="btn-danger-lg"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const res = await supabase.from("ortho_cases").delete().eq("id", orthoCase.id);
                    setBusy(false);
                    if (res.error) return setErr(res.error.message);
                    setCaseModalOpen(false);
                    await loadData();
                  }}
                >
                  {busy ? "Deleting…" : "Delete Case"}
                </button>
              )}
              <div className="modal-footer-buttons">
                <button className="btn-secondary-outlined" onClick={() => setCaseModalOpen(false)}>
                  Cancel
                </button>
                <button
                  className="h-10 save-btn"
                  disabled={busy}
                  onClick={saveCase}
                >
                  {busy ? "Saving…" : caseModalMode === "create" ? "Create" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </EditModal>
      )}

      {/* Add/Edit Entry Modal */}
      {entryModalOpen && (
        <EditModal 
          open={entryModalOpen} 
          title={`${entryModalMode === "create" ? "Add" : "Edit"} Entry`} 
          onClose={() => { setEntryModalOpen(false); setErr(null); }}
        >
          <div className="space-y-4-base">
            {/* Row 1: Date, Tag */}
            <div className="grid-gap-4-cols-2">
              <div className="field-label">
                <span className="field-label-text">Date</span>
                <input
                  type="date"
                  className="field-input"
                  value={editEntryDate}
                  onChange={(e) => setEditEntryDate(e.target.value)}
                />
              </div>
              <div className="field-label">
                <span className="field-label-text">Tag</span>
                <select className="field-input" value={editEntryTag} onChange={(e) => setEditEntryTag(e.target.value as any)}>
                  {orthoEntryTags.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Note - Optional */}
            <div className="field-label">
              <span className="field-label-text">Note <span className="text-slate-400 text-xs">(optional)</span></span>
              <textarea
                className="field-textarea"
                value={editEntryNote}
                onChange={(e) => setEditEntryNote(e.target.value)}
                placeholder="Adjustment details, wire change info, etc."
                rows={3}
              />
            </div>

            {/* Row 2: Arch, Teeth */}
            <div className="grid-gap-4-cols-2">
              <div className="field-label">
                <span className="field-label-text">Arch</span>
                <select className="field-input" value={editEntryArch} onChange={(e) => setEditEntryArch(e.target.value)}>
                  <option value="">— None —</option>
                  {orthoArchOptions.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-label">
                <span className="field-label-text">Teeth</span>
                <input
                  className="field-input"
                  value={editEntryTeeth}
                  onChange={(e) => setEditEntryTeeth(e.target.value)}
                  placeholder="e.g., 1.1, 1.2"
                />
              </div>
            </div>

            {/* Wire Details */}
            <div className="field-label">
              <span className="field-label-text">Wire Details</span>
              <input
                className="field-input"
                value={editEntryWireDetails}
                onChange={(e) => setEditEntryWireDetails(e.target.value)}
                placeholder="e.g., 0.016 NiTi"
              />
            </div>

            {/* Modal Footer */}
            <div className="modal-footer-spread">
              {entryModalMode === "edit" && editEntryId && (
                <button
                  className="btn-danger-lg"
                  disabled={busy}
                  onClick={() => setDeleteConfirmEntry(editEntryId)}
                >
                  Delete
                </button>
              )}
              <div className="modal-footer-buttons">
                <button className="btn-secondary-outlined" onClick={() => setEntryModalOpen(false)}>
                  Cancel
                </button>
                <button
                  className="h-10 save-btn"
                  disabled={busy}
                  onClick={saveEntry}
                >
                  {busy ? "Saving…" : entryModalMode === "create" ? "Add" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </EditModal>
      )}

      {/* Delete Entry Confirmation Modal */}
      {deleteConfirmEntry && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmEntry(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Delete Entry?</div>
            </div>
            <div className="modal-body">
              <div className="delete-warning">
                <div className="delete-warning-title">Are you sure?</div>
                <div className="delete-warning-text">This action cannot be undone.</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary-outlined" onClick={() => setDeleteConfirmEntry(null)}>
                Cancel
              </button>
              <button
                className="btn-danger-lg"
                disabled={busy}
                onClick={() => deleteEntry(deleteConfirmEntry)}
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
