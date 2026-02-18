"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import PatientTabs from "@/components/PatientTabs";
import { EditModal } from "@/components/EditModal";
import { supabase } from "@/lib/supabaseClient";
import type { Attachment, Patient } from "@/lib/types";
import { formatDatePH, safeFileName, combineFullName, splitFullName } from "@/lib/helpers";

const attachmentTypes = ["XRAY", "PHOTO", "FORM", "LAB", "OTHER"] as const;
type AttachmentType = (typeof attachmentTypes)[number];

export default function AttachmentsPage() {
  const params = useParams();
  const id = (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadType, setUploadType] = useState<AttachmentType | "">("");
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [attachmentSort, setAttachmentSort] = useState<"DATE_DESC" | "DATE_ASC" | "NAME_ASC">("DATE_DESC");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAttachment, setEditingAttachment] = useState<Attachment | null>(null);
  const [editFileName, setEditFileName] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const displayedAttachments = useMemo(() => {
    const copy = [...attachments];
    if (attachmentSort === "NAME_ASC") {
      copy.sort((a, b) => {
        const an = (a.file_name ?? a.file_path.split("/").slice(-1)[0] ?? "").toLowerCase();
        const bn = (b.file_name ?? b.file_path.split("/").slice(-1)[0] ?? "").toLowerCase();
        return an.localeCompare(bn);
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
    setLoading(true);
    setErr(null);

    // Load patient info
    const p = await supabase.from("patients").select("*").eq("id", id).single();
    if (!p.error && p.data) {
      const patRaw = p.data as any;
      const fallback = splitFullName(patRaw.full_name ?? "");
      const dbFirst = String(patRaw.first_name ?? "").trim();
      const dbLast = String(patRaw.last_name ?? "").trim();
      const firstNameFinal = dbFirst || fallback.first;
      const lastNameFinal = dbLast || fallback.last;

      setPatient({
        id: patRaw.id,
        full_name: patRaw.full_name,
        first_name: firstNameFinal,
        last_name: lastNameFinal,
        phone: patRaw.phone,
        birth_date: patRaw.birth_date,
        address: patRaw.address,
        occupation: patRaw.occupation,
        email: patRaw.email,
        gender: patRaw.gender,
        notes: patRaw.notes,
      });
    }

    const a = await supabase
      .from("attachments")
      .select("id, type, file_path, file_name, content_type, file_size_bytes, created_at")
      .eq("patient_id", id)
      .order("created_at", { ascending: false });
    setAttachments(!a.error && a.data ? (a.data as Attachment[]) : []);

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function uploadAttachment() {
    if (!fileToUpload || !uploadType) return;

    setBusy(true);
    setErr(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    const fileName = safeFileName(fileToUpload.name);
    const filePath = `patient-files/${id}/${crypto.randomUUID()}-${fileName}`;

    const up = await supabase.storage.from("patient-files").upload(filePath, fileToUpload);

    if (up.error) {
      setBusy(false);
      return setErr(up.error.message);
    }

    const ins = await supabase.from("attachments").insert({
      patient_id: id,
      type: uploadType,
      file_path: filePath,
      file_name: fileName || null,
      content_type: fileToUpload.type || null,
      file_size_bytes: fileToUpload.size || null,
      uploaded_by: userId,
    });

    setBusy(false);
    if (ins.error) return setErr(ins.error.message);

    setUploadType("");
    setFileToUpload(null);
    await loadData();
  }

  async function openAttachment(att: Attachment) {
    const { data } = await supabase.storage.from("patient-files").createSignedUrl(att.file_path, 3600);

    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  function openUploadModal() {
    setUploadType("");
    setFileToUpload(null);
    setErr(null);
    setShowUploadModal(true);
  }

  function closeUploadModal() {
    setShowUploadModal(false);
    setUploadType("");
    setFileToUpload(null);
    setErr(null);
  }

  function openEditModal(att: Attachment) {
    setEditingAttachment(att);
    setEditFileName(att.file_name || "");
    setDeleteConfirmation("");
    setShowEditModal(true);
  }

  async function updateAttachmentFileName() {
    if (!editingAttachment) return;

    setBusy(true);
    setErr(null);

    const { error } = await supabase
      .from("attachments")
      .update({ file_name: editFileName || null })
      .eq("id", editingAttachment.id);

    setBusy(false);
    if (error) {
      return setErr(error.message);
    }

    setShowEditModal(false);
    setEditingAttachment(null);
    setEditFileName("");
    await loadData();
  }

  async function deleteAttachment() {
    if (!editingAttachment) return;

    setBusy(true);
    setErr(null);

    // Delete from storage first
    const delStorage = await supabase.storage.from("patient-files").remove([editingAttachment.file_path]);
    if (delStorage.error) {
      setBusy(false);
      return setErr(delStorage.error.message);
    }

    // Then delete from database
    const delDb = await supabase.from("attachments").delete().eq("id", editingAttachment.id);
    if (delDb.error) {
      setBusy(false);
      return setErr(delDb.error.message);
    }

    setBusy(false);
    setShowEditModal(false);
    setEditingAttachment(null);
    setEditFileName("");
    setDeleteConfirmation("");
    await loadData();
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-container">
          <img src="/loading.gif" alt="Loading" className="loading-icon" />
          <div className="loading-text">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {err ? <div className="error-banner">{err}</div> : null}

      <div className="page-content">
        <div className="page-sections">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Attachments</div>
              <div className="flex items-center gap-2">
                <select
                  className="form-select-standard"
                  value={attachmentSort}
                  onChange={(e) => setAttachmentSort(e.target.value as any)}
                >
                  <option value="DATE_DESC">Newest</option>
                  <option value="DATE_ASC">Oldest</option>
                  <option value="NAME_ASC">Name A–Z</option>
                </select>
                <button
                  className="btn-secondary-dark"
                  onClick={openUploadModal}
                  disabled={busy}
                >
                  Add/Upload attachment
                </button>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <colgroup>
                  <col className="col-10" />
                  <col className="col-50" />
                  <col className="col-20" />
                  <col className="col-20" />
                </colgroup>
                <thead className="data-table-head">
                  <tr>
                    <th className="data-table-head-cell">Type</th>
                    <th className="data-table-head-cell">File</th>
                    <th className="data-table-head-cell">Date</th>
                    <th className="data-table-head-cell-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedAttachments.map((a, index) => (
                    <tr key={a.id} className={`data-table-row ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                      <td className="data-table-cell">{a.type}</td>
                      <td className="data-table-cell">
                        <div className="truncate">
                          {a.file_name ?? a.file_path.split("/").slice(-1)[0]}
                        </div>
                      </td>
                      <td className="data-table-cell">{formatDatePH(a.created_at)}</td>
                      <td className="data-table-cell-right">
                        <div className="flex-items-center-justify-end-gap-2">
                          <button
                            className="data-table-btn"
                            onClick={() => openAttachment(a)}
                          >
                            Open
                          </button>
                          <button
                            className="data-table-btn"
                            onClick={() => openEditModal(a)}
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {displayedAttachments.length === 0 ? (
                    <tr>
                      <td className="data-table-empty" colSpan={4}>
                        No attachments yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showEditModal && editingAttachment ? (
        <div className="modal-container p-4" onClick={(e) => e.target === e.currentTarget && setShowEditModal(false)} onDoubleClick={(e) => e.target === e.currentTarget && setShowEditModal(false)}>
          <div className="modal-scrollable rounded-2xl-border-white modal-box-md">
            <div className="header-sticky">
              <div className="text-lg-semibold">Edit attachment</div>
            </div>

            <div className="p-4">
              {err ? <div className="error-box-sm">{err}</div> : null}

              <div className="grid-gap-4">
                <label className="form-field-wrapper">
                  <span className="form-label-text-slate-700-semibold">Type</span>
                  <div className="container-slate-50">{editingAttachment.type}</div>
                </label>

                <label className="form-field-wrapper">
                  <span className="form-label-text-slate-700-semibold">File name</span>
                  <input
                    type="text"
                    className="form-input-border-white"
                    value={editFileName}
                    onChange={(e) => setEditFileName(e.target.value)}
                    placeholder="File name"
                  />
                </label>

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

                <div className="modal-actions pt-4">
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
                      onClick={() => setShowEditModal(false)}
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
            </div>
          </div>
        </div>
      ) : null}

      {/* Upload Attachment Modal */}
      <EditModal
        open={showUploadModal}
        title="Add/Upload attachment"
        onClose={closeUploadModal}
      >
        <div className="spacing-vertical-lg">
          <div className="grid-gap-1">
            <label className="text-sm-medium-slate-700">Type</label>
            <select
              className="input-h10-border-white w-full"
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
          </div>

          <div className="grid-gap-1">
            <label className="text-sm-medium-slate-700">File</label>
            <input
              type="file"
              className="input-h10-border-white w-full"
              onChange={(e) => setFileToUpload(e.target.files?.[0] ?? null)}
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