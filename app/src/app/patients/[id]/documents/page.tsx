"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useClinic } from "@/contexts/ClinicContext";
import { EditModal } from "@/components/EditModal";
import { DatePickerField } from "@/components/DatePickerField";
import { supabase } from "@/lib/supabaseClient";
import type { Patient, DentistRow, Document } from "@/lib/types";
import {
  todayLocalISO,
  formatDateStandard,
  renderTemplate,
  splitFullName,
  formatPatientName,
  formatPatientNameFormal,
} from "@/lib/helpers";
import {
  DOC_TYPES,
  type DocType,
  getDocTypeLabel,
  getGenerableDocTypes,
  createDocument,
  getPatientDocuments,
  getNextDocNo,
} from "@/lib/documentHelpers";
import {
  generateInvoiceDocument,
  generatePaymentReceiptDocument,
} from "@/lib/invoiceReceiptGenerators";
import { generatePrescriptionHTML } from "@/lib/prescriptionGenerator";
import { generateCertificateHTML } from "@/lib/certificateGenerator";
import { generateReferralHTML } from "@/lib/referralGenerator";
import { generatePatientRecordHTML, type PatientRecordSections } from "@/lib/patientRecordGenerator";
import { generateSOADocument } from "@/lib/soaGenerator";
import { loadClinicMeta } from "@/lib/clinicMetaLoader";
import { openDocumentViewer } from "@/components/DocumentViewer";
import { PageLoader } from "@/components/Spinner";


export default function DocumentsPage() {
  const params = useParams();
  const id = (params?.id as string) || "";
  const { clinicId, isLoading: clinicLoading } = useClinic();

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

  // Patient Record section selections
  const [patRecInclInfo, setPatRecInclInfo]       = useState(true);
  const [patRecInclMed, setPatRecInclMed]         = useState(true);
  const [patRecInclToothChart, setPatRecInclToothChart] = useState(true);
  const [patRecInclChartFindings, setPatRecInclChartFindings] = useState(true);
  const [patRecInclTreatments, setPatRecInclTreatments]       = useState(true);
  const [patRecInclOrtho, setPatRecInclOrtho]                 = useState(true);
  const [patRecInclOrthoCaseOverview, setPatRecInclOrthoCaseOverview] = useState(true);
  const [patRecInclOrthoVisits, setPatRecInclOrthoVisits]     = useState(true);
  const [patRecOrthoExpanded, setPatRecOrthoExpanded]         = useState(false);
  const [patRecChartExpanded, setPatRecChartExpanded]         = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [deleteDocType, setDeleteDocType] = useState<string>("");
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
    if (clinicLoading || !id || !clinicId) return;
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

    // Load documents (from new documents table)
    const docs = await getPatientDocuments(id);
    setDocuments(docs as Document[]);

    // Load dentists
    const d = await supabase
      .from("dentists")
      .select("id, full_name")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("full_name", { ascending: true });
    setDentists(!d.error && d.data ? (d.data as DentistRow[]) : []);

    setLoading(false);
  }, [clinicLoading, id, clinicId]);

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
    if (!docDentistId && selectedDocType !== DOC_TYPES.PATIENT_RECORD && selectedDocType !== DOC_TYPES.ACCOUNT_STATEMENT) return setError("Select a dentist.");

    setBusy(true);

    try {
      const [sessionResult, clinicMeta] = await Promise.all([
        supabase.auth.getSession(),
        loadClinicMeta(docDentistId),
      ]);
      const userEmail = sessionResult.data.session?.user?.email ?? "Unknown";

      let renderedHtml = previewHtml;

      // ── Patient Record: fetch all data and generate HTML ──
      if (selectedDocType === DOC_TYPES.PATIENT_RECORD) {
        const [medRes, chartRes, statusRes, txRes] = await Promise.all([
          supabase
            .from("patient_medical_histories")
            .select("allergies, medications, blood_pressure, conditions, notes")
            .eq("patient_id", id)
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("dental_chart_entries")
            .select("tooth_number, surfaces, finding_code, finding_detail, notes, recorded_at")
            .eq("patient_id", id)
            .order("recorded_at", { ascending: false }),
          supabase
            .from("tooth_statuses")
            .select("tooth_number, status, note, updated_at")
            .eq("patient_id", id)
            .order("tooth_number", { ascending: true }),
          supabase
            .from("treatments")
            .select("treatment_date, procedure, tooth_number, dentist_name, visit_concern, notes")
            .eq("patient_id", id)
            .eq("clinic_id", clinicId)
            .order("treatment_date", { ascending: false })
            .limit(200),
        ]);

        // Calc age for patient record
        let patAge: number | null = null;
        if (patient.birth_date) {
          const dob = new Date(patient.birth_date);
          const today = new Date();
          patAge = today.getFullYear() - dob.getFullYear();
          if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) patAge--;
        }

        // Ortho data (sequential: entries require case id)
        let orthoCase: any = null;
        let orthoEntries: any[] = [];
        if (patRecInclOrtho) {
          const { data: ocRows } = await supabase
            .from("ortho_cases")
            .select("*")
            .eq("patient_id", id)
            .eq("clinic_id", clinicId)
            .order("created_at", { ascending: false })
            .limit(1);
          if (ocRows?.length) {
            const { id: caseId, ...caseFields } = ocRows[0] as any;
            // Resolve provider name from FK if not stored directly
            if (!caseFields.provider_name && caseFields.provider_dentist_id) {
              const { data: dentistRow } = await supabase
                .from("dentists")
                .select("full_name")
                .eq("id", caseFields.provider_dentist_id)
                .single();
              caseFields.provider_name = dentistRow?.full_name || null;
            }
            orthoCase = caseFields;
            const { data: oeData } = await supabase
              .from("ortho_entries")
              .select("entry_date, concern_type, note")
              .eq("ortho_case_id", caseId)
              .order("entry_date", { ascending: false });
            orthoEntries = (oeData ?? []) as any[];
          }
        }

        const docNo = await getNextDocNo(DOC_TYPES.PATIENT_RECORD, clinicId);
        const patRecSections: PatientRecordSections = {
          info: patRecInclInfo,
          medicalHistory: patRecInclMed,
          toothChart: patRecInclToothChart,
          chartFindings: patRecInclChartFindings,
          treatments: patRecInclTreatments,
          orthoTreatments: patRecInclOrtho,
          orthoSubCaseOverview: patRecInclOrthoCaseOverview,
          orthoSubVisits: patRecInclOrthoVisits,
          selectedVisitDates: null,
        };

        renderedHtml = generatePatientRecordHTML({
          patientName: formatPatientNameFormal(patient.first_name, patient.middle_name, patient.last_name),
          birthDate: patient.birth_date || null,
          age: patAge,
          gender: patient.gender || null,
          phone: patient.phone || null,
          email: patient.email || null,
          address: patient.address || null,
          notes: patient.notes || null,
          medHistory: medRes.data?.[0] ?? null,
          chartEntries: (chartRes.data ?? []) as any[],
          toothStatuses: (statusRes.data ?? []) as any[],
          treatments: (txRes.data ?? []) as any[],
          orthoCase,
          orthoEntries,
          docNo,
          generatedAt: new Date().toLocaleString("en-PH", { dateStyle: "long", timeStyle: "short" }),
          clinicMeta,
        }, patRecSections);

        // Insert directly so we can use the same docNo that was embedded in the HTML
        await supabase.from("documents").insert({
          clinic_id: clinicId,
          patient_id: id,
          patient_name: formatPatientName(patient.first_name, patient.middle_name, patient.last_name),
          doc_type: DOC_TYPES.PATIENT_RECORD,
          doc_code: "REC",
          doc_no: docNo,
          payload: { rendered_html: renderedHtml, clinic_meta: clinicMeta, generated_at: new Date().toISOString() },
          clinic_meta: clinicMeta,
          issued_by: userEmail,
        });

        setBusy(false);
        setShowGenerateModal(false);
        resetGenerateForm();
        await loadData();
        return;
      }

      // ── Statement of Account: fetch all billing data and generate HTML ──
      if (selectedDocType === DOC_TYPES.ACCOUNT_STATEMENT) {
        const docNo = await getNextDocNo(DOC_TYPES.ACCOUNT_STATEMENT, clinicId);
        const soaHtml = await generateSOADocument(id, formatPatientNameFormal(patient.first_name, patient.middle_name, patient.last_name), docNo);

        await supabase.from("documents").insert({
          clinic_id: clinicId,
          patient_id: id,
          patient_name: formatPatientName(patient.first_name, patient.middle_name, patient.last_name),
          doc_type: DOC_TYPES.ACCOUNT_STATEMENT,
          doc_code: "SOA",
          doc_no: docNo,
          payload: { rendered_html: soaHtml, generated_at: new Date().toISOString() },
          issued_by: userEmail,
        });

        setBusy(false);
        setShowGenerateModal(false);
        resetGenerateForm();
        await loadData();
        return;
      }

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
          patientName: formatPatientNameFormal(patient.first_name, patient.middle_name, patient.last_name),
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
        clinicId,
        patientId: id,
        patientName: formatPatientName(patient.first_name, patient.middle_name, patient.last_name),
        docType: selectedDocType,
        payload,
        dentistName: dentistNameById[docDentistId],
        issuedBy: userEmail,
      });

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
    setCerPurpose("");
    setCerFindings([]);
    setCerTreatmentDone([]);
    setCerRemarks("");
    setRefReason("");
    setRefClinic("");
    setRefDoctor("");
    setRefRemarks("");
    setPatRecInclInfo(true);
    setPatRecInclMed(true);
    setPatRecInclToothChart(true);
    setPatRecInclChartFindings(true);
    setPatRecInclTreatments(true);
    setPatRecInclOrtho(true);
    setPatRecInclOrthoCaseOverview(true);
    setPatRecInclOrthoVisits(true);
    setPatRecOrthoExpanded(false);
    setPatRecChartExpanded(false);
    setError(null);
  }

  async function handleOpenDocument(d: any) {
    try {
      setBusy(true);
      let html = "";
      if (d.doc_type === DOC_TYPES.INVOICE) {
        html = await generateInvoiceDocument(d.id, formatPatientNameFormal(patient?.first_name ?? null, patient?.middle_name ?? null, patient?.last_name ?? null), d.doc_no || "—", formatDateStandard(d.created_at?.split("T")[0] || ""));
      } else if (d.doc_type === DOC_TYPES.PAYMENT_RECEIPT) {
        html = await generatePaymentReceiptDocument((d as any).payload?.payment_id || d.id, formatPatientNameFormal(patient?.first_name ?? null, patient?.middle_name ?? null, patient?.last_name ?? null), d.doc_no || "—");
      } else if (d.doc_type === DOC_TYPES.DENTAL_CERTIFICATE) {
        let age: number | undefined;
        if (patient?.birth_date) {
          const dob = new Date(patient.birth_date);
          const today = new Date();
          age = today.getFullYear() - dob.getFullYear();
          if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
        }
        html = generateCertificateHTML({ patientName: formatPatientNameFormal(patient?.first_name ?? null, patient?.middle_name ?? null, patient?.last_name ?? null), patientAge: age, patientAddress: patient?.address || "", patientGender: patient?.gender || "", visitDate: d.payload?.visit_date || "", dentistName: d.payload?.dentist_name || "Dentist", purpose: (d.payload?.fields as any)?.purpose || "", findings: (d.payload?.fields as any)?.findings || [], treatmentDone: (d.payload?.fields as any)?.treatment_done || [], remarks: (d.payload?.fields as any)?.remarks || "", docNo: d.doc_no || "—", clinicMeta: d.payload?.clinic_meta || {} });
      } else if (d.doc_type === DOC_TYPES.REFERRAL_LETTER) {
        let age: number | undefined;
        if (patient?.birth_date) {
          const dob = new Date(patient.birth_date);
          const today = new Date();
          age = today.getFullYear() - dob.getFullYear();
          if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
        }
        html = generateReferralHTML({ patientName: formatPatientNameFormal(patient?.first_name ?? null, patient?.middle_name ?? null, patient?.last_name ?? null), patientAge: age, patientAddress: patient?.address || "", patientGender: patient?.gender || "", visitDate: d.payload?.visit_date || "", dentistName: d.payload?.dentist_name || "Dentist", reason: (d.payload?.fields as any)?.reason || "", clinic: (d.payload?.fields as any)?.clinic || "", doctor: (d.payload?.fields as any)?.doctor || "", remarks: (d.payload?.fields as any)?.remarks || "", docNo: d.doc_no || "—", clinicMeta: d.payload?.clinic_meta || {} });
      } else {
        html = d.payload?.rendered_html || (d as any).payload?.renderedHtml || "";
      }
      if (html) { openDocumentViewer({ html, docType: d.doc_type || "INVOICE", docNumber: d.doc_no || "—" }); }
      else if (d.doc_type !== DOC_TYPES.INVOICE && d.doc_type !== DOC_TYPES.PAYMENT_RECEIPT) { alert("No document content available for this document."); }
    } catch (error) {
      console.error("Error opening document:", error);
      alert("Failed to open document");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteDocument() {
    if (!deleteDocId || deleteConfirmation.toUpperCase() !== "DELETE") return;
    setError(null);
    setBusy(true);

    try {
      const res = await fetch("/api/delete-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteDocId, docType: deleteDocType }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete document");
      }
      setShowDeleteModal(false);
      setDeleteDocId(null);
      setDeleteDocType("");
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

          {/* Desktop table */}
          <div className="table-wrapper hidden md:block">
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
                  <tr key={d.id} className={`data-table-row ${index % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                    <td className="data-table-cell">{formatDateStandard(d.created_at?.split("T")[0] || "")}</td>
                    <td className="data-table-cell">{getDocTypeLabel(d.doc_type)}</td>
                    <td className="data-table-cell">{d.doc_no || (d as any).doc_number || "—"}</td>
                    <td className="data-table-cell-right">
                      <div className="table-btn-group">
                        <button className="data-table-btn" onClick={() => handleOpenDocument(d)} disabled={busy}>Open</button>
                        <button className="data-table-btn data-table-btn-danger" onClick={() => { setDeleteDocId(d.id); setDeleteDocType(d.doc_type || ""); setDeleteConfirmation(""); setShowDeleteModal(true); }} disabled={busy}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {displayedDocuments.length === 0 ? (
                  <tr><td className="data-table-empty" colSpan={5}>No documents yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mobile-doc-list">
            {displayedDocuments.length === 0 ? (
              <div className="hint-text text-center py-8">No documents yet.</div>
            ) : (
              displayedDocuments.map((d) => (
                <div key={d.id} className="mobile-doc-card">
                  <div className="mobile-doc-card-inner">
                    <div>
                      <div className="mobile-doc-card-title">{getDocTypeLabel(d.doc_type)}</div>
                      <div className="mobile-doc-card-subtitle">{formatDateStandard(d.created_at?.split("T")[0] || "")}</div>
                      <div className="mobile-doc-card-meta">{d.doc_no || (d as any).doc_number || "—"}</div>
                    </div>
                    <div className="mobile-doc-card-actions">
                      <button className="data-table-btn" onClick={() => handleOpenDocument(d)} disabled={busy}>Open</button>
                      <button className="data-table-btn data-table-btn-danger" onClick={() => { setDeleteDocId(d.id); setDeleteDocType(d.doc_type || ""); setDeleteConfirmation(""); setShowDeleteModal(true); }} disabled={busy}>Delete</button>
                    </div>
                  </div>
                </div>
              ))
            )}
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

          {/* SOA description */}
          {selectedDocType === DOC_TYPES.ACCOUNT_STATEMENT && (
            <div className="hint-text">Generates a complete statement of account including all invoices and payments for this patient.</div>
          )}

          {/* STEP 2: Common fields (visible when type is selected) */}
          {selectedDocType && selectedDocType !== DOC_TYPES.PATIENT_RECORD && selectedDocType !== DOC_TYPES.ACCOUNT_STATEMENT && (
            <>
              <div className="section-columns">
                <div className="section-col-half">
                  <DatePickerField
                    label="Visit date"
                    value={docVisitDate}
                    onChange={setDocVisitDate}
                    inputRef={docVisitDateRef}
                    variant="visit-modal"
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>

                <div className="grid-gap-1 section-col-half">
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
                  <div className="spacing-vertical-sm">
                    <div className="text-field-label">Medications ({rxMedications.length})</div>
                    {rxMedications.map((med) => (
                      <div key={med.id} className="med-form-row">
                        <div className="med-field-name">
                          <label className="field-sublabel">Medication name</label>
                          <input
                            type="text"
                            className="input-standard"
                            value={med.medication}
                            onChange={(e) => setRxMedications(rxMedications.map(m => m.id === med.id ? { ...m, medication: e.target.value } : m))}
                            placeholder="Medication name"
                          />
                        </div>
                        <div className="med-field-dosage">
                          <label className="field-sublabel">Dosage</label>
                          <input
                            type="text"
                            className="input-standard"
                            value={med.dosage}
                            onChange={(e) => setRxMedications(rxMedications.map(m => m.id === med.id ? { ...m, dosage: e.target.value } : m))}
                            placeholder="500mg"
                          />
                        </div>
                        <div className="med-field-duration">
                          <label className="field-sublabel">Duration</label>
                          <input
                            type="text"
                            className="input-standard"
                            value={med.duration}
                            onChange={(e) => setRxMedications(rxMedications.map(m => m.id === med.id ? { ...m, duration: e.target.value } : m))}
                            placeholder="7 days"
                          />
                        </div>
                        <div className="med-field-instructions">
                          <label className="field-sublabel">Instructions</label>
                          <input
                            type="text"
                            className="input-standard"
                            value={med.instructions || ""}
                            onChange={(e) => setRxMedications(rxMedications.map(m => m.id === med.id ? { ...m, instructions: e.target.value } : m))}
                            placeholder="e.g., Take with food, Before sleep"
                          />
                        </div>
                        <div className="med-field-action">
                          <label className="field-sublabel">&nbsp;</label>
                          <button
                            type="button"
                            className="item-delete-btn"
                            onClick={() => setRxMedications(rxMedications.filter(m => m.id !== med.id))}
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
                      className="textarea-input textarea-sm"
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
                      className="textarea-input textarea-sm"
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
                    <div className="grid-gap-1 section-col-half">
                      <label className="text-field-label">Clinic/Specialist</label>
                      <input
                        type="text"
                        className="input-full"
                        value={refClinic}
                        onChange={(e) => setRefClinic(e.target.value)}
                        placeholder="Referring clinic name"
                      />
                    </div>

                    <div className="grid-gap-1 section-col-half">
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
                      className="textarea-input textarea-md"
                      value={refReason}
                      onChange={(e) => setRefReason(e.target.value)}
                      placeholder="Clinical reason for referral"
                    />
                  </div>

                  <div className="grid-gap-1">
                    <label className="text-field-label">Remarks</label>
                    <textarea
                      className="textarea-input textarea-sm"
                      value={refRemarks}
                      onChange={(e) => setRefRemarks(e.target.value)}
                      placeholder="Optional additional notes"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* Patient Record — section checkboxes */}
          {selectedDocType === DOC_TYPES.PATIENT_RECORD && (
            <div className="section-check-container">
              <p className="section-check-label">Sections to include</p>

              {/* Patient Info */}
              <label className="section-check-row">
                <input type="checkbox" checked={patRecInclInfo} onChange={e => setPatRecInclInfo(e.target.checked)} className="accent-violet-600" />
                Patient Information
              </label>

              {/* Medical History */}
              <label className="section-check-row">
                <input type="checkbox" checked={patRecInclMed} onChange={e => setPatRecInclMed(e.target.checked)} className="accent-violet-600" />
                Medical History
              </label>

              {/* Dental Chart — collapsible */}
              <div className="section-check-group">
                <div
                  className="section-check-group-header"
                  onClick={() => setPatRecChartExpanded(v => !v)}
                >
                  <input
                    type="checkbox"
                    checked={patRecInclToothChart || patRecInclChartFindings}
                    onChange={e => {
                      setPatRecInclToothChart(e.target.checked);
                      setPatRecInclChartFindings(e.target.checked);
                      if (!e.target.checked) setPatRecChartExpanded(false);
                    }}
                    className="accent-violet-600"
                    onClick={e => e.stopPropagation()}
                  />
                  <span className="section-check-group-label">
                    Dental Chart
                    <span className="section-check-expand-arrow">{patRecChartExpanded ? "▲" : "▼"}</span>
                  </span>
                </div>
                {patRecChartExpanded && (
                  <div className="section-check-sub-area">
                    <label className="section-check-sub-row">
                      <input type="checkbox" checked={patRecInclToothChart} onChange={e => setPatRecInclToothChart(e.target.checked)} className="accent-violet-600" />
                      Tooth Chart (FDI grid)
                    </label>
                    <label className="section-check-sub-row">
                      <input type="checkbox" checked={patRecInclChartFindings} onChange={e => setPatRecInclChartFindings(e.target.checked)} className="accent-violet-600" />
                      Chart Findings
                    </label>
                  </div>
                )}
              </div>

              {/* Treatment History */}
              <label className="section-check-row">
                <input type="checkbox" checked={patRecInclTreatments} onChange={e => setPatRecInclTreatments(e.target.checked)} className="accent-violet-600" />
                Treatment History
              </label>

              {/* Ortho Treatments & Visits — collapsible */}
              <div className="section-check-group">
                <div
                  className="section-check-group-header"
                  onClick={() => { if (patRecInclOrtho) setPatRecOrthoExpanded(v => !v); }}
                >
                  <input
                    type="checkbox"
                    checked={patRecInclOrtho}
                    onChange={e => {
                      setPatRecInclOrtho(e.target.checked);
                      if (!e.target.checked) setPatRecOrthoExpanded(false);
                    }}
                    className="accent-violet-600"
                    onClick={e => e.stopPropagation()}
                  />
                  <span className="section-check-group-label">
                    Ortho Treatments &amp; Visits
                    <span className="section-check-expand-arrow">{patRecOrthoExpanded ? "▲" : "▼"}</span>
                  </span>
                </div>
                {patRecInclOrtho && patRecOrthoExpanded && (
                  <div className="section-check-sub-area">
                    <label className="section-check-sub-row">
                      <input type="checkbox" checked={patRecInclOrthoCaseOverview} onChange={e => setPatRecInclOrthoCaseOverview(e.target.checked)} className="accent-violet-600" />
                      Case Overview
                    </label>
                    <label className="section-check-sub-row">
                      <input type="checkbox" checked={patRecInclOrthoVisits} onChange={e => setPatRecInclOrthoVisits(e.target.checked)} className="accent-violet-600" />
                      Visit History
                    </label>
                  </div>
                )}
              </div>
            </div>
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
                disabled={busy || !selectedDocType || (!docDentistId && selectedDocType !== DOC_TYPES.PATIENT_RECORD && selectedDocType !== DOC_TYPES.ACCOUNT_STATEMENT)}
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
          setDeleteDocType("");
          setDeleteConfirmation("");
        }}
      >
        <div className="delete-confirmation">
          <div className="delete-confirmation-title">Delete document?</div>
          <div className="delete-confirmation-hint">
            Type <span className="delete-confirmation-code">DELETE</span> to confirm deletion of this document
          </div>
          <input
            type="text"
            className="delete-confirmation-input"
            placeholder="DELETE"
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
          />
        </div>
        <div className="modal-actions">
          <div className="modal-actions-left">
            <button
              className="delete-btn"
              disabled={busy || deleteConfirmation.toUpperCase() !== "DELETE"}
              onClick={handleDeleteDocument}
            >
              {busy ? "Deleting…" : "Delete Document"}
            </button>
          </div>
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
          </div>
        </div>
      </EditModal>
    </>
  );
}