"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { EditModal } from "@/components/EditModal";
import { supabase } from "@/lib/supabaseClient";
import type { Patient, DentistRow, Document } from "@/lib/types";
import {
  todayLocalISO,
  formatDateStandard,
  renderTemplate,
  splitFullName,
  formatMoney,
} from "@/lib/helpers";
import {
  DOC_TYPES,
  type DocType,
  getDocTypeLabel,
  getGenerableDocTypes,
  createDocument,
  getPatientDocuments,
  deleteDocument,
} from "@/lib/documentHelpers";
import {
  generateInvoiceDocument,
  generatePaymentReceiptDocument,
  openDocumentInNewTab,
} from "@/lib/invoiceReceiptGenerators";

function printHtml(html: string) {
  const w = window.open("", "", "width=800,height=600");
  if (w) {
    w.document.write(html);
    w.document.close();
    w.print();
  }
}

function openHtml(html: string) {
  const w = window.open("", "", "width=900,height=700");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

export default function DocumentsPage() {
  const params = useParams();
  const id = (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [docSort, setDocSort] = useState<"DATE_DESC" | "DATE_ASC" | "TYPE_ASC">("DATE_DESC");
  const [dentists, setDentists] = useState<DentistRow[]>([]);

  // Generation modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<DocType | "">(""); // Type-first selector
  const [previewHtml, setPreviewHtml] = useState<string>("");

  // Form fields (dynamic per doc type)
  const [docVisitDate, setDocVisitDate] = useState(() => todayLocalISO());
  const [docDentistId, setDocDentistId] = useState<string>("");
  const [docIssuedBy, setDocIssuedBy] = useState("");

  // Prescription fields
  const [rxMedications, setRxMedications] = useState("");
  const [rxDosage, setRxDosage] = useState("");
  const [rxDuration, setRxDuration] = useState("");
  const [rxRemarks, setRxRemarks] = useState("");

  // Certificate fields
  const [cerFindings, setCerFindings] = useState("");
  const [cerTreatmentDone, setCerTreatmentDone] = useState("");
  const [cerRemarks, setCerRemarks] = useState("");

  // Referral fields
  const [refReason, setRefReason] = useState("");
  const [refClinic, setRefClinic] = useState("");
  const [refDoctor, setRefDoctor] = useState("");
  const [refRemarks, setRefRemarks] = useState("");

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const dentistNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const d of dentists) m[d.id] = d.full_name;
    return m;
  }, [dentists]);

  const displayedDocuments = useMemo(() => {
    const copy = [...documents];
    if (docSort === "TYPE_ASC") {
      copy.sort(
        (a, b) =>
          (a.doc_type ?? "").localeCompare(b.doc_type ?? "") ||
          (a.created_at < b.created_at ? 1 : -1)
      );
      return copy;
    }
    if (docSort === "DATE_ASC") {
      copy.sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
      return copy;
    }
    copy.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return copy;
  }, [documents, docSort]);

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

    // Load documents (from new documents table)
    const docs = await getPatientDocuments(id);
    setDocuments(docs as Document[]);

    // Load dentists
    const d = await supabase
      .from("dentists")
      .select("id, full_name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("full_name", { ascending: true });
    setDentists(!d.error && d.data ? (d.data as DentistRow[]) : []);

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Generate document with type-first UX
   */
  async function generateDocument() {
    if (!id) return;
    setErr(null);

    if (!selectedDocType) return setErr("Select a document type.");
    if (!docDentistId) return setErr("Select a dentist.");

    setBusy(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userEmail = sessionData.session?.user?.email ?? "Unknown";

      // Build payload based on doc type
      let payload: Record<string, any> = {
        doc_type: selectedDocType,
        visit_date: docVisitDate,
        dentist_id: docDentistId,
        dentist_name: dentistNameById[docDentistId] ?? null,
        issued_by: docIssuedBy || userEmail,
        rendered_html: previewHtml,
      };

      if (selectedDocType === DOC_TYPES.PRESCRIPTION) {
        payload.fields = {
          medications: rxMedications || null,
          dosage: rxDosage || null,
          duration: rxDuration || null,
          remarks: rxRemarks || null,
        };
      } else if (selectedDocType === DOC_TYPES.DENTAL_CERTIFICATE) {
        payload.fields = {
          findings: cerFindings || null,
          treatment_done: cerTreatmentDone || null,
          remarks: cerRemarks || null,
        };
      } else if (selectedDocType === DOC_TYPES.REFERRAL_LETTER) {
        payload.fields = {
          reason: refReason || null,
          clinic: refClinic || null,
          doctor: refDoctor || null,
          remarks: refRemarks || null,
        };
      }

      // Create document (saves to documents table with auto-generated doc_no)
      await createDocument({
        patientId: id,
        patientName: patient?.full_name,
        docType: selectedDocType,
        payload,
        dentistName: dentistNameById[docDentistId],
        issuedBy: docIssuedBy || userEmail,
      });

      setBusy(false);
      setShowGenerateModal(false);
      resetGenerateForm();
      await loadData();
    } catch (error) {
      setBusy(false);
      setErr(error instanceof Error ? error.message : "Failed to generate document");
    }
  }

  function resetGenerateForm() {
    setSelectedDocType("");
    setPreviewHtml("");
    setDocVisitDate(todayLocalISO());
    setDocDentistId("");
    setDocIssuedBy("");
    setRxMedications("");
    setRxDosage("");
    setRxDuration("");
    setRxRemarks("");
    setCerFindings("");
    setCerTreatmentDone("");
    setCerRemarks("");
    setRefReason("");
    setRefClinic("");
    setRefDoctor("");
    setRefRemarks("");
    setErr(null);
  }

  async function handleDeleteDocument() {
    if (!deleteDocId) return;
    if (deleteConfirmation !== "DELETE") {
      setErr("You must type 'DELETE' to confirm.");
      return;
    }

    setErr(null);
    setBusy(true);

    try {
      await deleteDocument(deleteDocId);
      setShowDeleteModal(false);
      setDeleteDocId(null);
      setDeleteConfirmation("");
      await loadData();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to delete document");
    } finally {
      setBusy(false);
    }
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
              <div className="card-title">Documents</div>
              <div className="flex items-center gap-2">
                <select
                  className="form-select-standard"
                  value={docSort}
                  onChange={(e) => setDocSort(e.target.value as any)}
                >
                  <option value="DATE_DESC">Newest</option>
                  <option value="DATE_ASC">Oldest</option>
                  <option value="TYPE_ASC">Type A–Z</option>
                </select>
                <button
                  className="btn-secondary-dark"
                  onClick={() => setShowGenerateModal(true)}
                >
                  Generate document
                </button>
              </div>
            </div>

            {/* Generated Documents List */}
            <div className="table-wrapper">
              <table className="data-table">
                <colgroup>
                  <col className="col-20" />
                  <col className="col-20" />
                  <col className="col-20" />
                  <col className="col-25" />
                  <col className="col-15" />
                </colgroup>
                <thead className="data-table-head">
                  <tr>
                    <th className="data-table-head-cell">Date</th>
                    <th className="data-table-head-cell">Type</th>
                    <th className="data-table-head-cell">Doc No.</th>
                    <th className="data-table-head-cell">Issued By</th>
                    <th className="data-table-head-cell-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedDocuments.map((d, index) => (
                    <tr
                      key={d.id}
                      className={`data-table-row ${
                        index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"
                      }`}
                    >
                      <td className="data-table-cell">
                        {formatDateStandard(d.created_at?.split("T")[0] || "")}
                      </td>
                      <td className="data-table-cell">
                        {getDocTypeLabel(d.doc_type)}
                      </td>
                      <td className="data-table-cell">
                        {d.doc_no || (d as any).doc_number || "—"}
                      </td>
                      <td className="data-table-cell">
                        {d.issued_by ?? (d as any).issued_by ?? "—"}
                      </td>
                      <td className="data-table-cell-right">
                        <div className="flex-items-center-justify-end-gap-2">
                          <button
                            className="data-table-btn"
                            onClick={async () => {
                              try {
                                setBusy(true);
                                let html = "";

                                // For invoices, generate HTML from invoice table
                                if (d.doc_type === DOC_TYPES.INVOICE) {
                                  html = await generateInvoiceDocument(
                                    d.id,
                                    patient?.full_name || "Patient",
                                    d.doc_no || "—",
                                    formatDateStandard(d.created_at?.split("T")[0] || "")
                                  );
                                }
                                // For payment receipts, generate HTML from receipts table
                                else if (d.doc_type === DOC_TYPES.PAYMENT_RECEIPT) {
                                  html = await generatePaymentReceiptDocument(
                                    (d as any).payload?.payment_id || d.id,
                                    patient?.full_name || "Patient",
                                    d.doc_no || "—"
                                  );
                                }
                                // For other documents, use stored HTML
                                else {
                                  html =
                                    d.payload?.rendered_html ||
                                    (d as any).payload?.renderedHtml ||
                                    "";
                                }

                                if (html) {
                                  openDocumentInNewTab(
                                    html,
                                    `${getDocTypeLabel(d.doc_type)}-${d.doc_no}`
                                  );
                                } else if (d.doc_type !== DOC_TYPES.INVOICE && d.doc_type !== DOC_TYPES.PAYMENT_RECEIPT) {
                                  alert("No document content available for this document.");
                                }
                              } catch (error) {
                                console.error("Error opening document:", error);
                                alert("Failed to open document");
                              } finally {
                                setBusy(false);
                              }
                            }}
                            disabled={busy}
                          >
                            Open
                          </button>
                          <button
                            className="data-table-btn"
                            onClick={async () => {
                              try {
                                setBusy(true);
                                let html = "";

                                // For invoices, generate HTML from invoice table
                                if (d.doc_type === DOC_TYPES.INVOICE) {
                                  html = await generateInvoiceDocument(
                                    d.id,
                                    patient?.full_name || "Patient",
                                    d.doc_no || "—",
                                    formatDateStandard(d.created_at?.split("T")[0] || "")
                                  );
                                }
                                // For payment receipts, generate HTML from receipts table
                                else if (d.doc_type === DOC_TYPES.PAYMENT_RECEIPT) {
                                  html = await generatePaymentReceiptDocument(
                                    (d as any).payload?.payment_id || d.id,
                                    patient?.full_name || "Patient",
                                    d.doc_no || "—"
                                  );
                                }
                                // For other documents, use stored HTML
                                else {
                                  html =
                                    d.payload?.rendered_html ||
                                    (d as any).payload?.renderedHtml ||
                                    "";
                                }

                                if (html) {
                                  printHtml(html);
                                } else if (d.doc_type !== DOC_TYPES.INVOICE && d.doc_type !== DOC_TYPES.PAYMENT_RECEIPT) {
                                  alert("No document content available for this document.");
                                }
                              } catch (error) {
                                console.error("Error printing document:", error);
                                alert("Failed to print document");
                              } finally {
                                setBusy(false);
                              }
                            }}
                            disabled={busy}
                          >
                            Print
                          </button>
                          <button
                            className="data-table-btn data-table-btn-danger"
                            onClick={() => {
                              setDeleteDocId(d.id);
                              setDeleteConfirmation("");
                              setShowDeleteModal(true);
                            }}
                            disabled={busy}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {displayedDocuments.length === 0 ? (
                    <tr>
                      <td className="data-table-empty" colSpan={5}>
                        No documents yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Generate Document Modal - Type-First UX */}
      <EditModal
        open={showGenerateModal}
        title="Generate document"
        onClose={() => {
          setShowGenerateModal(false);
          resetGenerateForm();
        }}
      >
        <div className="spacing-vertical-lg">
          {/* STEP 1: Select Document Type (always visible first) */}
          <div className="grid-gap-1">
            <label className="text-sm-medium-slate-700">Document type</label>
            <select
              className="input-h10-border-white w-full"
              value={selectedDocType}
              onChange={(e) => {
                const newType = e.target.value as DocType | "";
                setSelectedDocType(newType);
                setPreviewHtml(""); // Clear preview when type changes
              }}
            >
              <option value="">Select document type</option>
              {getGenerableDocTypes().map((dt) => (
                <option key={dt} value={dt}>
                  {getDocTypeLabel(dt)}
                </option>
              ))}
            </select>
          </div>

          {/* STEP 2: Common fields (visible when type is selected) */}
          {selectedDocType && (
            <>
              <div className="flex gap-4">
                <div className="grid-gap-1" style={{ width: "50%" }}>
                  <label className="text-sm-medium-slate-700">Visit date</label>
                  <input
                    type="date"
                    className="input-h10-border-white w-full"
                    value={docVisitDate}
                    onChange={(e) => setDocVisitDate(e.target.value)}
                  />
                </div>

                <div className="grid-gap-1" style={{ width: "50%" }}>
                  <label className="text-sm-medium-slate-700">Dentist</label>
                  <select
                    className="input-h10-border-white w-full"
                    value={docDentistId}
                    onChange={(e) => setDocDentistId(e.target.value)}
                  >
                    <option value="">Select dentist</option>
                    {dentists.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid-gap-1">
                <label className="text-sm-medium-slate-700">Issued by</label>
                <input
                  type="text"
                  className="input-h10-border-white w-full"
                  value={docIssuedBy}
                  onChange={(e) => setDocIssuedBy(e.target.value)}
                  placeholder="Optional"
                />
              </div>

              {/* STEP 3: Type-specific fields */}

              {/* Prescription */}
              {selectedDocType === DOC_TYPES.PRESCRIPTION && (
                <>
                  <div className="flex gap-4">
                    <div className="grid-gap-1" style={{ width: "50%" }}>
                      <label className="text-sm-medium-slate-700">Medications</label>
                      <textarea
                        className="input-h10-border-white w-full resize-none"
                        style={{ minHeight: "80px" }}
                        value={rxMedications}
                        onChange={(e) => setRxMedications(e.target.value)}
                        placeholder="List medications and instructions"
                      />
                    </div>

                    <div className="grid-gap-1" style={{ width: "25%" }}>
                      <label className="text-sm-medium-slate-700">Dosage</label>
                      <input
                        type="text"
                        className="input-h10-border-white w-full"
                        value={rxDosage}
                        onChange={(e) => setRxDosage(e.target.value)}
                        placeholder="e.g., 500mg"
                      />
                    </div>

                    <div className="grid-gap-1" style={{ width: "25%" }}>
                      <label className="text-sm-medium-slate-700">Duration</label>
                      <input
                        type="text"
                        className="input-h10-border-white w-full"
                        value={rxDuration}
                        onChange={(e) => setRxDuration(e.target.value)}
                        placeholder="e.g., 7 days"
                      />
                    </div>
                  </div>

                  <div className="grid-gap-1">
                    <label className="text-sm-medium-slate-700">Remarks</label>
                    <textarea
                      className="input-h10-border-white w-full resize-none"
                      style={{ minHeight: "60px" }}
                      value={rxRemarks}
                      onChange={(e) => setRxRemarks(e.target.value)}
                      placeholder="Optional notes or warnings"
                    />
                  </div>
                </>
              )}

              {/* Dental Certificate */}
              {selectedDocType === DOC_TYPES.DENTAL_CERTIFICATE && (
                <>
                  <div className="flex gap-4">
                    <div className="grid-gap-1" style={{ width: "50%" }}>
                      <label className="text-sm-medium-slate-700">Findings</label>
                      <textarea
                        className="input-h10-border-white w-full resize-none"
                        style={{ minHeight: "80px" }}
                        value={cerFindings}
                        onChange={(e) => setCerFindings(e.target.value)}
                        placeholder="Clinical findings"
                      />
                    </div>

                    <div className="grid-gap-1" style={{ width: "50%" }}>
                      <label className="text-sm-medium-slate-700">Treatment done</label>
                      <textarea
                        className="input-h10-border-white w-full resize-none"
                        style={{ minHeight: "80px" }}
                        value={cerTreatmentDone}
                        onChange={(e) => setCerTreatmentDone(e.target.value)}
                        placeholder="Treatments performed"
                      />
                    </div>
                  </div>

                  <div className="grid-gap-1">
                    <label className="text-sm-medium-slate-700">Remarks</label>
                    <textarea
                      className="input-h10-border-white w-full resize-none"
                      style={{ minHeight: "60px" }}
                      value={cerRemarks}
                      onChange={(e) => setCerRemarks(e.target.value)}
                      placeholder="Optional remarks"
                    />
                  </div>
                </>
              )}

              {/* Referral Letter */}
              {selectedDocType === DOC_TYPES.REFERRAL_LETTER && (
                <>
                  <div className="flex gap-4">
                    <div className="grid-gap-1" style={{ width: "50%" }}>
                      <label className="text-sm-medium-slate-700">Clinic/Specialist</label>
                      <input
                        type="text"
                        className="input-h10-border-white w-full"
                        value={refClinic}
                        onChange={(e) => setRefClinic(e.target.value)}
                        placeholder="Referring clinic name"
                      />
                    </div>

                    <div className="grid-gap-1" style={{ width: "50%" }}>
                      <label className="text-sm-medium-slate-700">Doctor/Specialist</label>
                      <input
                        type="text"
                        className="input-h10-border-white w-full"
                        value={refDoctor}
                        onChange={(e) => setRefDoctor(e.target.value)}
                        placeholder="Referring doctor"
                      />
                    </div>
                  </div>

                  <div className="grid-gap-1">
                    <label className="text-sm-medium-slate-700">Reason for referral</label>
                    <textarea
                      className="input-h10-border-white w-full resize-none"
                      style={{ minHeight: "80px" }}
                      value={refReason}
                      onChange={(e) => setRefReason(e.target.value)}
                      placeholder="Clinical reason for referral"
                    />
                  </div>

                  <div className="grid-gap-1">
                    <label className="text-sm-medium-slate-700">Remarks</label>
                    <textarea
                      className="input-h10-border-white w-full resize-none"
                      style={{ minHeight: "60px" }}
                      value={refRemarks}
                      onChange={(e) => setRefRemarks(e.target.value)}
                      placeholder="Optional additional notes"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* Modal Actions */}
          <div className="modal-actions">
            <div className="modal-actions-right">
              <button
                className="cancel-btn"
                disabled={busy}
                onClick={() => {
                  setShowGenerateModal(false);
                  resetGenerateForm();
                }}
              >
                Cancel
              </button>
              <button
                className="save-btn"
                disabled={busy || !selectedDocType || !docDentistId}
                onClick={generateDocument}
              >
                {busy ? "Generating…" : "Generate"}
              </button>
            </div>
          </div>
        </div>
      </EditModal>

      {/* Delete Document Modal */}
      <EditModal
        open={showDeleteModal}
        title="Delete document"
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteDocId(null);
          setDeleteConfirmation("");
        }}
      >
        <div className="spacing-vertical-lg">
          <p className="text-sm-medium-slate-700">
            This action cannot be undone. To confirm, type <strong>DELETE</strong> below.
          </p>
          <input
            type="text"
            className="input-h10-border-white w-full"
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
            placeholder="Type DELETE to confirm"
          />
          <div className="modal-actions">
            <div className="modal-actions-right">
              <button
                className="cancel-btn"
                disabled={busy}
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteDocId(null);
                  setDeleteConfirmation("");
                }}
              >
                Cancel
              </button>
              <button
                className="save-btn"
                style={{ backgroundColor: "#dc2626" }}
                disabled={busy || deleteConfirmation !== "DELETE"}
                onClick={handleDeleteDocument}
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      </EditModal>
    </>
  );
}