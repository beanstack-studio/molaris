"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import PatientTabs from "@/components/PatientTabs";
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
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        <div className="flex flex-col items-center gap-3">
          <img src="/loading.gif" alt="Loading" className="h-12 w-12" />
          <div className="text-sm">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <>
    <main className="min-h-screen bg-slate-50">
      <div className="app-section">
        <div className="app-section-header">
          <div className="app-section-title">
            {patient ? combineFullName(patient.first_name, patient.last_name) || patient.full_name || "" : "Patient Attachments"}
          </div>
          <button className="btn btn-secondary" onClick={() => window.history.back()}>
            Back
          </button>
        </div>

        {err ? <div className="mb-4 rounded-lg border bg-white p-3 text-sm text-red-600">{err}</div> : null}

        <div className="app-section-body">
          <PatientTabs activeTab="Attachments" />

          <div>
            <div className="grid gap-4">
              <div className="rounded-2xl border bg-white p-4">
                <div className="text-sm font-semibold">Upload attachment</div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Type</span>
                    <select
                      className="h-10 rounded-lg border bg-white px-3"
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
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">File</span>
                    <input
                      type="file"
                      className="h-10 rounded-lg border bg-white px-3 py-2 text-sm"
                      onChange={(e) => setFileToUpload(e.target.files?.[0] ?? null)}
                    />
                  </label>

                  <div className="flex items-end">
                    <button
                      className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={busy || !uploadType || !fileToUpload}
                      onClick={uploadAttachment}
                    >
                      {busy ? "Uploading…" : "Upload"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold">Attachments</div>

                  <select
                    className="h-9 w-40 rounded-lg border bg-white px-2 text-sm"
                    value={attachmentSort}
                    onChange={(e) => setAttachmentSort(e.target.value as any)}
                  >
                    <option value="DATE_DESC">Newest</option>
                    <option value="DATE_ASC">Oldest</option>
                    <option value="NAME_ASC">Name A–Z</option>
                  </select>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="data-table">
                    <colgroup>
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "50%" }} />
                      <col style={{ width: "20%" }} />
                      <col style={{ width: "20%" }} />
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
                            <div className="flex items-center justify-end gap-2">
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
        </div>
      </div>
    </main>

      {showEditModal && editingAttachment ? (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 z-50">
          <div className="max-h-screen overflow-y-auto rounded-2xl border bg-white w-full max-w-md">
            <div className="sticky top-0 border-b bg-white p-4 flex items-center justify-between">
              <div className="text-lg font-semibold">Edit attachment</div>
              <button
                className="rounded-lg border bg-white px-2 py-1 text-sm"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingAttachment(null);
                  setEditFileName("");
                  setDeleteConfirmation("");
                }}
              >
                Close
              </button>
            </div>

            <div className="p-4">
              {err ? <div className="mb-4 rounded-lg border bg-white p-3 text-sm text-red-600">{err}</div> : null}

              <div className="grid gap-4">
                <div className="grid gap-1 text-sm">
                  <span className="text-slate-700 font-semibold">Type</span>
                  <div className="p-3 bg-slate-50 rounded-lg text-slate-600">{editingAttachment.type}</div>
                </div>

                <label className="grid gap-1 text-sm">
                  <span className="text-slate-700 font-semibold">File name</span>
                  <input
                    type="text"
                    className="h-10 rounded-lg border bg-white px-3 py-2 text-sm"
                    value={editFileName}
                    onChange={(e) => setEditFileName(e.target.value)}
                    placeholder="File name"
                  />
                </label>

                <div className="pt-4 border-t">
                  <div className="text-sm font-semibold mb-3 text-slate-700">Delete attachment</div>
                  <p className="text-xs text-slate-600 mb-3">Type <span className="font-mono bg-slate-100 px-1 rounded">DELETE</span> to confirm deletion:</p>
                  <input
                    type="text"
                    placeholder="Type DELETE to confirm"
                    className="w-full h-10 rounded-lg border bg-white px-3 py-2 text-sm mb-3"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-4">
                  <button
                    className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={busy || deleteConfirmation !== "DELETE"}
                    onClick={deleteAttachment}
                  >
                    {busy ? "Deleting…" : "Delete"}
                  </button>
                  <button
                    className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
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
      ) : null}
    </>
  );
}