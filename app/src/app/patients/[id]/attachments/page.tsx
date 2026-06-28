"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PatientTabs from "@/components/PatientTabs";
import { EditModal } from "@/components/EditModal";
import { supabase } from "@/lib/supabaseClient";
import type { Attachment, Patient } from "@/lib/types";
import { formatDateStandard, safeFileName, combineFullName, splitFullName } from "@/lib/helpers";
import { useClinic } from "@/contexts/ClinicContext";
import { PageLoader } from "@/components/Spinner";
import { SortArrow } from "@/components/shared/TableOptions";


const attachmentTypes = ["XRAY", "PHOTO", "FORM", "LAB", "OTHER"] as const;
type AttachmentType = (typeof attachmentTypes)[number];

export default function AttachmentsPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id as string) || "";
  const { clinicId } = useClinic();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadType, setUploadType] = useState<AttachmentType | "">("");
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [fileDisplayName, setFileDisplayName] = useState<string>("");
  const [attachmentNotes, setAttachmentNotes] = useState("");
  const [attachmentSort, setAttachmentSort] = useState<"DATE_DESC" | "DATE_ASC" | "NAME_ASC" | "NAME_DESC" | "TYPE_ASC" | "TYPE_DESC">("DATE_DESC");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAttachment, setEditingAttachment] = useState<Attachment | null>(null);
  const [editFileName, setEditFileName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const displayedAttachments = useMemo(() => {
    const copy = [...attachments];
    if (attachmentSort === "TYPE_ASC" || attachmentSort === "TYPE_DESC") {
      copy.sort((a, b) => {
        const at = (a.type ?? "").toLowerCase();
        const bt = (b.type ?? "").toLowerCase();
        return attachmentSort === "TYPE_ASC" ? at.localeCompare(bt) : bt.localeCompare(at);
      });
      return copy;
    }
    if (attachmentSort === "NAME_ASC" || attachmentSort === "NAME_DESC") {
      copy.sort((a, b) => {
        const an = (a.file_name ?? a.file_path.split("/").slice(-1)[0] ?? "").toLowerCase();
        const bn = (b.file_name ?? b.file_path.split("/").slice(-1)[0] ?? "").toLowerCase();
        return attachmentSort === "NAME_ASC" ? an.localeCompare(bn) : bn.localeCompare(an);
      });
      return copy;
    }
    if (attachmentSort === "DATE_ASC") {
      copy.sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
      return copy;
    }
    copy.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return copy;
  }, [attachments, attachmentSort]);

  const loadData = useCallback(async () => {
    if (!id || !clinicId) return;
    setLoading(true);
    setError(null);

    // Load patient info
    const p = await supabase.from("patients").select("*").eq("id", id).eq("clinic_id", clinicId).single();
    if (!p.error && p.data) {
      const patRaw = p.data as any;
      const fallback = splitFullName(patRaw.full_name ?? "");
      const dbFirst = String(patRaw.first_name ?? "").trim();
      const dbLast = String(patRaw.last_name ?? "").trim();
      const firstNameFinal = dbFirst || fallback.first;
      const lastNameFinal = dbLast || fallback.last;

      setPatient({
        id: patRaw.id,
        clinic_id: patRaw.clinic_id,
        full_name: patRaw.full_name,
        first_name: firstNameFinal,
        middle_name: patRaw.middle_name ?? null,
        last_name: lastNameFinal,
        phone: patRaw.phone,
        birth_date: patRaw.birth_date,
        address: patRaw.address,
        occupation: patRaw.occupation,
        email: patRaw.email,
        gender: patRaw.gender,
        notes: patRaw.notes,
        created_at: patRaw.created_at,
        updated_at: patRaw.updated_at,
      });
    }

    const a = await supabase
      .from("attachments")
      .select("id, type, file_path, file_name, content_type, file_size_bytes, created_at, notes")
      .eq("patient_id", id)
      .order("created_at", { ascending: false });
    setAttachments(!a.error && a.data ? (a.data as Attachment[]) : []);

    setLoading(false);
  }, [id, clinicId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function uploadAttachment() {
    if (!fileToUpload || !uploadType) return;

    // Validate file size (5MB = 5,242,880 bytes)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (fileToUpload.size > MAX_FILE_SIZE) {
      return setError("File size must not exceed 5MB");
    }

    setBusy(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    // Use original file name
    const baseFileName = safeFileName(fileToUpload.name);
    const fileName = baseFileName;
    const filePath = `patient-files/${id}/${crypto.randomUUID()}-${fileName}`;

    const up = await supabase.storage.from("patient-files").upload(filePath, fileToUpload);

    if (up.error) {
      setBusy(false);
      return setError(up.error.message);
    }

    const ins = await supabase.from("attachments").insert({
      patient_id: id,
      type: uploadType,
      file_path: filePath,
      file_name: fileName || null,
      content_type: fileToUpload.type || null,
      file_size_bytes: fileToUpload.size || null,
      uploaded_by: userId,
      notes: attachmentNotes.trim() || null,
    });

    setBusy(false);
    if (ins.error) return setError(ins.error.message);

    setUploadType("");
    setFileToUpload(null);
    closeUploadModal();
    await loadData();
  }

  async function openAttachment(att: Attachment) {
    const { data } = await supabase.storage.from("patient-files").createSignedUrl(att.file_path, 3600);

    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  function openUploadModal() {
    setUploadType("");
    setFileToUpload(null);
    setError(null);
    setShowUploadModal(true);
  }

  function closeUploadModal() {
    setShowUploadModal(false);
    setUploadType("");
    setFileToUpload(null);
    setFileDisplayName("");
    setAttachmentNotes("");
    setError(null);
  }

  function openEditModal(att: Attachment) {
    setEditingAttachment(att);
    setEditFileName(att.file_name || "");
    setEditNotes((att as any).notes || "");
    setDeleteConfirmation("");
    setShowEditModal(true);
  }

  async function updateAttachmentFileName() {
    if (!editingAttachment) return;

    setBusy(true);
    setError(null);

    const { error } = await supabase
      .from("attachments")
      .update({ file_name: editFileName || null, notes: editNotes.trim() || null })
      .eq("id", editingAttachment.id);

    setBusy(false);
    if (error) {
      return setError(error.message);
    }

    setShowEditModal(false);
    setEditingAttachment(null);
    setEditFileName("");
    setEditNotes("");
    await loadData();
  }

  async function deleteAttachment() {
    if (!editingAttachment) return;

    setBusy(true);
    setError(null);

    // Delete from storage first
    const delStorage = await supabase.storage.from("patient-files").remove([editingAttachment.file_path]);
    if (delStorage.error) {
      setBusy(false);
      return setError(delStorage.error.message);
    }

    // Then delete from database
    const delDb = await supabase.from("attachments").delete().eq("id", editingAttachment.id);
    if (delDb.error) {
      setBusy(false);
      return setError(delDb.error.message);
    }

    setBusy(false);
    setShowEditModal(false);
    setEditingAttachment(null);
    setEditFileName("");
    setEditNotes("");
    setDeleteConfirmation("");
    await loadData();
  }

  if (loading) {
    return (
      <PageLoader />
    );
  }

  return (
    <>
      {error ? <div className="error-banner">{error}</div> : null}
      <button onClick={() => router.back()} className="lg:hidden flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3">
        ← Back
      </button>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Attachments</div>
            <button
              className="save-btn"
              onClick={openUploadModal}
              disabled={busy}
            >
              Add attachment
            </button>
          </div>

          {/* Desktop table */}
          <div className="table-wrapper hidden md:block">
            <table className="data-table min-w-[550px]">
              <colgroup>
                <col className="col-15" />
                <col className="col-10" />
                <col className="col-30" />
                <col className="col-30" />
                <col className="col-15" />
              </colgroup>
              <thead className="data-table-head">
                <tr>
                  <th
                    className="data-table-head-cell cursor-pointer select-none"
                    onClick={() => setAttachmentSort(attachmentSort === "DATE_DESC" ? "DATE_ASC" : "DATE_DESC")}
                  >
                    Date
                    <SortArrow dir={attachmentSort === "DATE_DESC" ? "desc" : attachmentSort === "DATE_ASC" ? "asc" : null} />
                  </th>
                  <th
                    className="data-table-head-cell cursor-pointer select-none"
                    onClick={() => setAttachmentSort(attachmentSort === "TYPE_ASC" ? "TYPE_DESC" : "TYPE_ASC")}
                  >
                    Type
                    <SortArrow dir={attachmentSort === "TYPE_ASC" ? "asc" : attachmentSort === "TYPE_DESC" ? "desc" : null} />
                  </th>
                  <th
                    className="data-table-head-cell cursor-pointer select-none"
                    onClick={() => setAttachmentSort(attachmentSort === "NAME_ASC" ? "NAME_DESC" : "NAME_ASC")}
                  >
                    File
                    <SortArrow dir={attachmentSort === "NAME_ASC" ? "asc" : attachmentSort === "NAME_DESC" ? "desc" : null} />
                  </th>
                  <th className="data-table-head-cell">Notes</th>
                  <th className="data-table-head-cell-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedAttachments.map((a, index) => (
                  <tr
                    key={a.id}
                    className={`data-table-row cursor-pointer ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}
                    onClick={() => openEditModal(a)}
                  >
                    <td className="data-table-cell">{formatDateStandard(a.created_at.split('T')[0])}</td>
                    <td className="data-table-cell">{a.type}</td>
                    <td className="data-table-cell">
                      <div className="truncate">
                        {a.file_name ?? a.file_path.split("/").slice(-1)[0]}
                      </div>
                    </td>
                    <td className="data-table-cell text-xs text-slate-600 truncate">
                      {(a as any).notes || "—"}
                    </td>
                    <td className="data-table-cell-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="data-table-btn" onClick={(e) => { e.stopPropagation(); openAttachment(a); }}>Open</button>
                        <button className="data-table-btn hidden lg:inline-flex" onClick={(e) => { e.stopPropagation(); openEditModal(a); }}>Edit</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {displayedAttachments.length === 0 ? (
                  <tr>
                    <td className="data-table-empty" colSpan={5}>No attachments yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mt-3 grid gap-2 md:hidden">
            {displayedAttachments.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">No attachments yet.</div>
            ) : (
              displayedAttachments.map((a) => (
                <div key={a.id} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block rounded-full bg-slate-100 text-slate-700 text-xs font-semibold px-2 py-0.5 mb-1">{a.type}</span>
                      <div className="text-sm font-medium text-slate-800 truncate max-w-[200px]">
                        {a.file_name ?? a.file_path.split("/").slice(-1)[0]}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{formatDateStandard(a.created_at.split('T')[0])}</div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button className="data-table-btn" onClick={() => openAttachment(a)}>Open</button>
                      <button className="data-table-btn" onClick={() => openEditModal(a)}>Edit</button>
                    </div>
                  </div>
                  {(a as any).notes && (
                    <div className="mt-2 text-xs text-slate-500 border-t border-slate-50 pt-2">{(a as any).notes}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      

      {showEditModal && editingAttachment ? (
        <EditModal
          open={showEditModal}
          title="Edit attachment"
          onClose={() => {
            setShowEditModal(false);
            setEditingAttachment(null);
            setEditFileName("");
            setEditNotes("");
            setDeleteConfirmation("");
            setError(null);
          }}
        >
          <div className="spacing-vertical-lg">
            {/* Type and File - Side by Side */}
            <div className="section-columns">
              <div className="grid-gap-1 w-1/4">
                <label className="text-field-label">Type</label>
                <select
                  className="input-full"
                  value={editFileName.split(".")[0] === editingAttachment.type ? editingAttachment.type : ""}
                  onChange={(e) => setEditFileName(e.target.value)}
                >
                  <option value="">Select type</option>
                  {attachmentTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-transparent">—</div>
              </div>

              <div className="grid-gap-1 w-3/4">
                <label className="text-field-label">File</label>
                <div className="relative">
                  <input
                    type="file"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setFileToUpload(file);
                      setEditFileName(file?.name ?? editFileName);
                      setError(null);
                    }}
                  />
                  <div className="input-full flex items-center py-2 px-3 text-sm gap-3">
                    
                    <span className={`flex-1 truncate ${editFileName ? "text-slate-900" : "text-slate-500"}`}>
                      {editFileName || "no file chosen"}
                    </span>
                  </div>
                </div>
                <div className="text-caption">Maximum file size: 5MB</div>
              </div>
            </div>

            {/* Notes - Full Width */}
            <div className="grid-gap-1">
              <label className="text-field-label">Notes (optional)</label>
              <input
                type="text"
                className="input-full"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add notes for this attachment"
              />
            </div>

            {/* Delete Confirmation */}
            <div className="delete-confirmation">
              <div className="delete-confirmation-title">Delete attachment?</div>
              <div className="delete-confirmation-hint">
                Type <span className="delete-confirmation-code">DELETE</span> to confirm deletion
              </div>
              <input
                type="text"
                placeholder="DELETE"
                className="delete-confirmation-input"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
              />
            </div>

            {/* Modal Actions */}
            <div className="modal-actions">
              <button
                className="delete-btn"
                disabled={busy || deleteConfirmation !== "DELETE"}
                onClick={deleteAttachment}
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
              <div className="modal-actions-right">
                <button
                  className="cancel-btn"
                  disabled={busy}
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingAttachment(null);
                    setEditFileName("");
                    setEditNotes("");
                    setDeleteConfirmation("");
                    setError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="save-btn"
                  disabled={busy}
                  onClick={updateAttachmentFileName}
                >
                  {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </EditModal>
      ) : null}

      {/* Upload Attachment Modal */}
      <EditModal
        open={showUploadModal}
        title="Add attachment"
        onClose={closeUploadModal}
      >
        <div className="spacing-vertical-lg">
          {/* Type and File - Side by Side */}
          <div className="section-columns">
            <div className="grid-gap-1 w-1/4">
              <label className="text-field-label">Type</label>
              <select
                className="input-full"
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value as AttachmentType)}
              >
                <option value="">Select type</option>
                {attachmentTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <div className="text-xs text-transparent">—</div>
            </div>

            <div className="grid-gap-1 w-3/4">
              <label className="text-field-label">File</label>
              <div className="relative">
                <input
                  type="file"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setFileToUpload(file);
                    setFileDisplayName(file?.name ?? "");
                    setError(null);
                  }}
                />
                <div className="input-full flex items-center py-2 px-3 text-sm gap-3">
                  
                  <span className={`flex-1 truncate ${fileDisplayName ? "text-slate-900" : "text-slate-500"}`}>
                    {fileDisplayName || "No file chosen."}
                  </span>
                </div>
              </div>
              <div className="text-caption">Maximum file size: 5MB</div>
            </div>
          </div>
        
          {/* Notes - Full Width */}
          <div className="grid-gap-1">
            <label className="text-field-label">Notes (optional)</label>
            <input
              type="text"
              className="input-full"
              value={attachmentNotes}
              onChange={(e) => setAttachmentNotes(e.target.value)}
              placeholder="Add notes for this attachment"
            />
          </div>

          <div className="modal-actions">
            <div className="modal-actions-right">
              <button
                className="cancel-btn"
                onClick={closeUploadModal}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                className="save-btn"
                disabled={busy || !uploadType || !fileToUpload}
                onClick={uploadAttachment}
              >
                {busy ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>
        </div>
      </EditModal>
    </>
  );
}