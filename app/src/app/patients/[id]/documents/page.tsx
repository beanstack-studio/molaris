"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { EditModal } from "@/components/EditModal";
import { DatePickerField } from "@/components/DatePickerField";
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
} from "@/lib/invoiceReceiptGenerators";
import { generatePrescriptionHTML } from "@/lib/prescriptionGenerator";
import { generateCertificateHTML } from "@/lib/certificateGenerator";
import { generateReferralHTML } from "@/lib/referralGenerator";
import { loadClinicMeta } from "@/lib/clinicMetaLoader";
import { openDocumentViewer } from "@/components/DocumentViewer";
import { PageLoader } from "@/components/Spinner";


export default function DocumentsPage() {
  const params = useParams();
  const id = (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  // docIssuedBy removed — always auto-filled from user email
  const docVisitDateRef = useRef<HTMLInputElement>(null);

  // Prescription fields
  const [rxMedications, setRxMedications] = useState<Array<{
    id: string;
    medication: string;
    dosage: string;
    duration: string;
    instructions?: string;
  }>>([]);
  const [rxRemarks, setRxRemarks] = useState("");
  const [rxNextCheckup, setRxNextCheckup] = useState(""); // Next check-up date (optional)
  const rxNextCheckupRef = useRef<HTMLInputElement>(null);

  // Certificate fields
  const [cerPurpose, setCerPurpose] = useState("");
  const [cerFindings, setCerFindings] = useState<string[]>([]);
  const [cerTreatmentDone, setCerTreatmentDone] = useState<string[]>([]);
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
    setError(null);

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
    if (!id || !patient) return;
    setError(null);

    if (!selectedDocType) return setError("Select a document type.");
    if (!docDentistId) return setError("Select a dentist.");

    setBusy(true);

    try {
      const [sessionResult, clinicMeta] = await Promise.all([
        supabase.auth.getSession(),
        loadClinicMeta(docDentistId),
      ]);
      const userEmail = sessionResult.data.session?.user?.email ?? "Unknown";

      let renderedHtml = previewHtml;

      // Calculate patient age helper
      function calcAge(): number | undefined {
        if (!patient!.birth_date) return undefined;
        const dob = new Date(patient!.birth_date);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        if (today.getMonth() < dob.getMonth() ||
            (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) {
          age--;
        }
        return age;
      }

      // Generate HTML for prescriptions
      if (selectedDocType === DOC_TYPES.PRESCRIPTION) {
        const cleanMedications = rxMedications.map(({ id, ...med }) => med);
        renderedHtml = generatePrescriptionHTML({
          patientName: patient.full_name || "Unknown Patient",
          patientAge: calcAge(),
          patientAddress: patient.address || "",
          patientGender: patient.gender || "",
          visitDate: docVisitDate,
          dentistName: dentistNameById[docDentistId] ?? "Dentist",
          medications: cleanMedications,
          remarks: rxRemarks || "",
          docNo: "RX26-0000", // Will be replaced by createDocument
          clinicMeta,
        });
      }

      // Build payload based on doc type
      let payload: Record<string, any> = {
        doc_type: selectedDocType,
        visit_date: docVisitDate,
        dentist_id: docDentistId,
        dentist_name: dentistNameById[docDentistId] ?? null,
        issued_by: userEmail,
        rendered_html: renderedHtml,
        clinic_meta: clinicMeta,
      };

      if (selectedDocType === DOC_TYPES.PRESCRIPTION) {
        const cleanMedications = rxMedications.map(({ id, ...med }) => med);
        payload.fields = {
          medications: cleanMedications,
          remarks: rxRemarks || null,
          next_checkup_date: rxNextCheckup || null,
          patient_age: calcAge(),
          patient_address: patient.address || "",
          patient_gender: patient.gender || "",
          visit_date: docVisitDate,
        };
      } else if (selectedDocType === DOC_TYPES.DENTAL_CERTIFICATE) {
        payload.fields = {
          purpose: cerPurpose || null,
          findings: cerFindings.length > 0 ? cerFindings : null,
          treatment_done: cerTreatmentDone.length > 0 ? cerTreatmentDone : null,
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
        issuedBy: userEmail,
      });

      // If prescription has a next checkup date, create an appointment
      if (selectedDocType === DOC_TYPES.PRESCRIPTION && rxNextCheckup) {
        try {
          await supabase.from("appointments").insert({
            patient_id: id,
            appointment_date: rxNextCheckup,
            appointment_time: "09:00", // Default morning time
            appointment_type: "CHECKUP",
            status: "SCHEDULED",
            notes: `Follow-up checkup from prescription dated ${formatDateStandard(docVisitDate)}`,
            created_by: sessionResult.data.session?.user?.id,
          });
        } catch (appointmentError) {
          // Don't fail the entire document generation, just log the appointment error
          console.warn("Failed to create appointment for next checkup:", appointmentError);
        }
      }

      setBusy(false);
      setShowGenerateModal(false);
      resetGenerateForm();
      await loadData();
    } catch (error) {
      setBusy(false);
      setError(error instanceof Error ? error.message : "Failed to generate document");
    }
  }

  function resetGenerateForm() {
    setSelectedDocType("");
    setPreviewHtml("");
    setDocVisitDate(todayLocalISO());
    setDocDentistId("");
    setRxMedications([]);
    setRxRemarks("");
    setRxNextCheckup("");
    setCerPurpose("");
    setCerFindings([]);
    setCerTreatmentDone([]);
    setCerRemarks("");
    setRefReason("");
    setRefClinic("");
    setRefDoctor("");
    setRefRemarks("");
    setError(null);
  }

  async function handleDeleteDocument() {
    if (!deleteDocId) return;
    if (deleteConfirmation !== "DELETE") {
      setError("You must type 'DELETE' to confirm.");
      return;
    }

    setError(null);
    setBusy(true);

    try {
      await deleteDocument(deleteDocId);
      setShowDeleteModal(false);
      setDeleteDocId(null);
      setDeleteConfirmation("");
      await loadData();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to delete document");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <PageLoader />
    );
  }

  return (
    <>
      {error ? <div className="error-banner">{error}</div> : null}

        <div className="card">
          <div className="card-header">
            <div className="card-title">Documents</div>
            <div className="inline-row">
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
                className="save-btn"
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
                <col className="col-30" />
                <col className="col-30" />
                <col className="col-20" />
              </colgroup>
              <thead className="data-table-head">
                <tr>
                  <th className="data-table-head-cell">Date</th>
                  <th className="data-table-head-cell">Type</th>
                  <th className="data-table-head-cell">Doc No.</th>
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
                    <td className="data-table-cell-right">
                      <div className="flex items-center justify-end gap-2">
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
                              // For dental certificates, generate from payload
                              else if (d.doc_type === DOC_TYPES.DENTAL_CERTIFICATE) {
                                let age: number | undefined;
                                if (patient?.birth_date) {
                                  const dob = new Date(patient.birth_date);
                                  const today = new Date();
                                  age = today.getFullYear() - dob.getFullYear();
                                  if (today.getMonth() < dob.getMonth() || 
                                      (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) {
                                    age--;
                                  }
                                }
                                html = generateCertificateHTML({
                                  patientName: patient?.full_name || "Unknown Patient",
                                  patientAge: age,
                                  patientAddress: patient?.address || "",
                                  patientGender: patient?.gender || "",
                                  visitDate: d.payload?.visit_date || "",
                                  dentistName: d.payload?.dentist_name || "Dentist",
                                  purpose: (d.payload?.fields as any)?.purpose || "",
                                  findings: (d.payload?.fields as any)?.findings || [],
                                  treatmentDone: (d.payload?.fields as any)?.treatment_done || [],
                                  remarks: (d.payload?.fields as any)?.remarks || "",
                                  docNo: d.doc_no || "—",
                                  clinicMeta: d.payload?.clinic_meta || {},
                                });
                              }
                              // For referral letters, generate from payload
                              else if (d.doc_type === DOC_TYPES.REFERRAL_LETTER) {
                                let age: number | undefined;
                                if (patient?.birth_date) {
                                  const dob = new Date(patient.birth_date);
                                  const today = new Date();
                                  age = today.getFullYear() - dob.getFullYear();
                                  if (today.getMonth() < dob.getMonth() || 
                                      (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) {
                                    age--;
                                  }
                                }
                                html = generateReferralHTML({
                                  patientName: patient?.full_name || "Unknown Patient",
                                  patientAge: age,
                                  patientAddress: patient?.address || "",
                                  patientGender: patient?.gender || "",
                                  visitDate: d.payload?.visit_date || "",
                                  dentistName: d.payload?.dentist_name || "Dentist",
                                  reason: (d.payload?.fields as any)?.reason || "",
                                  clinic: (d.payload?.fields as any)?.clinic || "",
                                  doctor: (d.payload?.fields as any)?.doctor || "",
                                  remarks: (d.payload?.fields as any)?.remarks || "",
                                  docNo: d.doc_no || "—",
                                  clinicMeta: d.payload?.clinic_meta || {},
                                });
                              }
                              // For other documents, use stored HTML
                              else {
                                html =
                                  d.payload?.rendered_html ||
                                  (d as any).payload?.renderedHtml ||
                                  "";
                              }

                              if (html) {
                                openDocumentViewer({
                                  html,
                                  docType: d.doc_type || "INVOICE",
                                  docNumber: d.doc_no || "—",
                                });
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
            <label className="text-field-label">Document type</label>
            <select
              className="input-full"
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
              <div className="section-columns">
                <div className="w-1/2">
                  <DatePickerField
                    label="Visit date"
                    value={docVisitDate}
                    onChange={setDocVisitDate}
                    inputRef={docVisitDateRef}
                    variant="visit-modal"
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>

                <div className="grid-gap-1 w-1/2">
                  <label className="text-field-label">Dentist</label>
                  <select
                    className="input-full"
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

              {/* STEP 3: Type-specific fields */}

              {/* Prescription */}
              {selectedDocType === DOC_TYPES.PRESCRIPTION && (
                <>
                  {/* Medications List */}
                  <div className="space-y-2">
                    <div className="text-field-label">Medications ({rxMedications.length})</div>
                    {rxMedications.map((med, index) => (
                      <div key={med.id} className="form-section">
                        {/* Row 1: Medication Name (75%) | Dosage (12.5%) | Duration (12.5%) - Grid with equal distribution */}
                        <div className="grid grid-cols-[3fr_1fr_1fr] gap-2 overflow-hidden">
                          <div className="grid gap-1 min-w-0 overflow-hidden">
                            <label className="field-sublabel">Medication name</label>
                            <input
                              type="text"
                              className="input-standard min-w-0 w-full"
                              value={med.medication}
                              onChange={(e) => {
                                const updated = rxMedications.map(m =>
                                  m.id === med.id ? { ...m, medication: e.target.value } : m
                                );
                                setRxMedications(updated);
                              }}
                              placeholder="Medication name"
                            />
                          </div>

                          <div className="grid gap-1 min-w-0 overflow-hidden">
                            <label className="field-sublabel">Dosage</label>
                            <input
                              type="text"
                              className="input-standard min-w-0 w-full"
                              value={med.dosage}
                              onChange={(e) => {
                                const updated = rxMedications.map(m =>
                                  m.id === med.id ? { ...m, dosage: e.target.value } : m
                                );
                                setRxMedications(updated);
                              }}
                              placeholder="500mg"
                            />
                          </div>

                          <div className="grid gap-1 min-w-0 overflow-hidden">
                            <label className="field-sublabel">Duration</label>
                            <input
                              type="text"
                              className="input-standard min-w-0 w-full"
                              value={med.duration}
                              onChange={(e) => {
                                const updated = rxMedications.map(m =>
                                  m.id === med.id ? { ...m, duration: e.target.value } : m
                                );
                                setRxMedications(updated);
                              }}
                              placeholder="7 days"
                            />
                          </div>
                        </div>

                        {/* Row 2: Instructions Input + Delete Button */}
                        <div className="flex gap-2 items-end">
                          <div className="flex-1 grid gap-1 min-w-0">
                            <label className="field-sublabel">Instructions</label>
                            <input
                              type="text"
                              className="input-standard"
                              value={med.instructions || ""}
                              onChange={(e) => {
                                const updated = rxMedications.map(m =>
                                  m.id === med.id ? { ...m, instructions: e.target.value } : m
                                );
                                setRxMedications(updated);
                              }}
                              placeholder="e.g., Take with food, Before sleep"
                            />
                          </div>

                          <button
                            type="button"
                            className="item-delete-btn h-10 flex-shrink-0"
                            onClick={() => {
                              setRxMedications(rxMedications.filter(m => m.id !== med.id));
                            }}
                            title="Remove medication"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                    {rxMedications.length === 0 && (
                      <div className="hint-text">No medications yet. Add one below.</div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="add-row-btn"
                    onClick={() => {
                      setRxMedications([...rxMedications, {
                        id: Math.random().toString(36),
                        medication: "",
                        dosage: "",
                        duration: "",
                        instructions: "",
                      }]);
                    }}
                  >
                    + Add Medication
                  </button>

                  <div className="grid-gap-1">
                    <label className="text-field-label">Patient Instructions</label>
                    <textarea
                      className="textarea-input min-h-[60px]"
                      value={rxRemarks}
                      onChange={(e) => setRxRemarks(e.target.value)}
                      placeholder="Optional notes or warnings"
                    />
                  </div>

                  <div>
                    {(() => {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      const minDate = tomorrow.toISOString().split("T")[0];
                      return (
                        <DatePickerField
                          label="Next check-up date (optional)"
                          value={rxNextCheckup}
                          onChange={setRxNextCheckup}
                          inputRef={rxNextCheckupRef}
                          variant="visit-modal"
                          min={minDate}
                        />
                      );
                    })()}
                    <div className="text-xs-medium-slate-500 mt-1">
                      If provided, an appointment will be automatically created
                    </div>
                  </div>
                </>
              )}

              {/* Dental Certificate */}
              {selectedDocType === DOC_TYPES.DENTAL_CERTIFICATE && (
                <>
                  <div className="grid-gap-1">
                    <label className="text-field-label">Purpose of certificate</label>
                    <input
                      type="text"
                      className="input-full"
                      value={cerPurpose}
                      onChange={(e) => setCerPurpose(e.target.value)}
                      placeholder="e.g. employment, school requirement, travel"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-field-label">Findings ({cerFindings.length})</div>
                    {cerFindings.map((item, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <input
                          type="text"
                          className="input-standard flex-1"
                          value={item}
                          onChange={(e) => {
                            const updated = [...cerFindings];
                            updated[index] = e.target.value;
                            setCerFindings(updated);
                          }}
                          placeholder="Clinical finding"
                        />
                        <button
                          type="button"
                          className="item-delete-btn flex-shrink-0"
                          onClick={() => setCerFindings(cerFindings.filter((_, i) => i !== index))}
                        >Delete</button>
                      </div>
                    ))}
                    {cerFindings.length === 0 && <div className="hint-text">No findings yet. Add one below.</div>}
                  </div>
                  <button
                    type="button"
                    className="add-row-btn"
                    onClick={() => setCerFindings([...cerFindings, ""])}
                  >+ Add Finding</button>

                  <div className="space-y-2">
                    <div className="text-field-label">Treatment done ({cerTreatmentDone.length})</div>
                    {cerTreatmentDone.map((item, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <input
                          type="text"
                          className="input-standard flex-1"
                          value={item}
                          onChange={(e) => {
                            const updated = [...cerTreatmentDone];
                            updated[index] = e.target.value;
                            setCerTreatmentDone(updated);
                          }}
                          placeholder="Treatment performed"
                        />
                        <button
                          type="button"
                          className="item-delete-btn flex-shrink-0"
                          onClick={() => setCerTreatmentDone(cerTreatmentDone.filter((_, i) => i !== index))}
                        >Delete</button>
                      </div>
                    ))}
                    {cerTreatmentDone.length === 0 && <div className="hint-text">No treatments yet. Add one below.</div>}
                  </div>
                  <button
                    type="button"
                    className="add-row-btn"
                    onClick={() => setCerTreatmentDone([...cerTreatmentDone, ""])}
                  >+ Add Treatment Done</button>

                  <div className="grid-gap-1">
                    <label className="text-field-label">Remarks</label>
                    <textarea
                      className="textarea-input min-h-[60px]"
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
                  <div className="section-columns">
                    <div className="grid-gap-1 w-1/2">
                      <label className="text-field-label">Clinic/Specialist</label>
                      <input
                        type="text"
                        className="input-full"
                        value={refClinic}
                        onChange={(e) => setRefClinic(e.target.value)}
                        placeholder="Referring clinic name"
                      />
                    </div>

                    <div className="grid-gap-1 w-1/2">
                      <label className="text-field-label">Doctor/Specialist</label>
                      <input
                        type="text"
                        className="input-full"
                        value={refDoctor}
                        onChange={(e) => setRefDoctor(e.target.value)}
                        placeholder="Referring doctor"
                      />
                    </div>
                  </div>

                  <div className="grid-gap-1">
                    <label className="text-field-label">Reason for referral</label>
                    <textarea
                      className="textarea-input min-h-[80px]"
                      value={refReason}
                      onChange={(e) => setRefReason(e.target.value)}
                      placeholder="Clinical reason for referral"
                    />
                  </div>

                  <div className="grid-gap-1">
                    <label className="text-field-label">Remarks</label>
                    <textarea
                      className="textarea-input min-h-[60px]"
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
          <p className="text-field-label">
            This action cannot be undone. To confirm, type <strong>DELETE</strong> below.
          </p>
          <input
            type="text"
            className="input-full"
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
                className="save-btn bg-red-600"
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