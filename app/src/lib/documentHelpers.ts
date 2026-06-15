/**
 * Document Helpers
 * Unified document system with type mapping, numbering, and creation
 */

import { supabase } from "./supabaseClient";
import { generatePrescriptionHTML } from "./prescriptionGenerator";

/**
 * Document Type Constants
 */
export const DOC_TYPES = {
  INVOICE: "INVOICE",
  PAYMENT_RECEIPT: "PAYMENT_RECEIPT",
  ACCOUNT_STATEMENT: "ACCOUNT_STATEMENT",
  PRESCRIPTION: "PRESCRIPTION",
  DENTAL_CERTIFICATE: "DENTAL_CERTIFICATE",
  REFERRAL_LETTER: "REFERRAL_LETTER",
  PATIENT_RECORD: "PATIENT_RECORD",
} as const;

export type DocType = typeof DOC_TYPES[keyof typeof DOC_TYPES];

/**
 * Document Code Mapping (unified across app)
 * Maps logical doc type to short codes used in numbering
 */
export const DOC_CODE_MAP: Record<DocType, string> = {
  [DOC_TYPES.INVOICE]: "INV",
  [DOC_TYPES.PAYMENT_RECEIPT]: "PMT",
  [DOC_TYPES.ACCOUNT_STATEMENT]: "SOA",
  [DOC_TYPES.PRESCRIPTION]: "RX",
  [DOC_TYPES.DENTAL_CERTIFICATE]: "CER",
  [DOC_TYPES.REFERRAL_LETTER]: "REF",
  [DOC_TYPES.PATIENT_RECORD]: "REC",
};

/**
 * Reverse lookup: code to DocType
 */
export const CODE_TO_DOC_TYPE: Record<string, DocType> = {
  INV: DOC_TYPES.INVOICE,
  PMT: DOC_TYPES.PAYMENT_RECEIPT,
  SOA: DOC_TYPES.ACCOUNT_STATEMENT,
  RX: DOC_TYPES.PRESCRIPTION,
  CER: DOC_TYPES.DENTAL_CERTIFICATE,
  REF: DOC_TYPES.REFERRAL_LETTER,
  REC: DOC_TYPES.PATIENT_RECORD,
};

/**
 * Get document code from doc type
 * @param docType - The logical document type
 * @returns The short code (INV, PMT, SOA, RX, CER, REF)
 */
function getDocCode(docType: DocType): string {
  return DOC_CODE_MAP[docType] || "UNKNOWN";
}

/**
 * Format document number
 * @param code - Short code (INV, PMT, SOA, etc.)
 * @param year - Last 2 digits of year (26 for 2026)
 * @param number - Sequential number (1-based)
 * @returns Formatted doc no: INV26-0001, PMT26-0001, etc.
 */
function formatDocNo(code: string, year: number, number: number): string {
  const yearStr = String(year).slice(-2).padStart(2, "0");
  const numberStr = String(number).padStart(4, "0");
  return `${code}${yearStr}-${numberStr}`;
}

/**
 * Get next sequential document number
 * Uses fallback count-based approach (safe for this use case)
 * @param docType - The document type
 * @returns Fully formatted doc no
 */
export async function getNextDocNo(docType: DocType, clinicId: string): Promise<string> {
  try {
    return await getNextDocNoFallback(docType, clinicId);
  } catch (error) {
    // Last resort fallback - start at 1
    return formatDocNo(
      getDocCode(docType),
      new Date().getFullYear(),
      1
    );
  }
}

/**
 * Fallback: simple count-based doc number generation (less safe under concurrency)
 * Used if RPC function is unavailable. Counts from documents table.
 */
async function getNextDocNoFallback(docType: DocType, clinicId: string): Promise<string> {
  try {
    const year = new Date().getFullYear();
    const docCode = getDocCode(docType);

    // Count documents from documents table for this clinic
    const { count, error } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("doc_code", docCode)
      .gte("created_at", `${year}-01-01T00:00:00Z`)
      .lt("created_at", `${year + 1}-01-01T00:00:00Z`);

    const nextNumber = Math.max((count || 0) + 1, 1);
    return formatDocNo(docCode, year, nextNumber);
  } catch (error) {
    // Last resort fallback - start at 1 (will need manual conflict resolution)
    return formatDocNo(
      getDocCode(docType),
      new Date().getFullYear(),
      1
    );
  }
}

/**
 * Create and save a document to the documents table
 * @param input - Document creation input
 * @returns Created document record
 */
export interface CreateDocumentInput {
  clinicId: string;
  patientId?: string;
  patientName?: string;
  docType: DocType;
  payload: Record<string, any>;
  clinicMeta?: Record<string, any>;
  dentistName?: string;
  dentistPrc?: string;
  dentistPtr?: string;
  issuedBy?: string;
  invoiceId?: string;
  paymentId?: string;
  visitId?: string;
}

export async function createDocument(input: CreateDocumentInput) {
  try {
    // Skip INVOICE and PAYMENT_RECEIPT - those are already created in their own tables
    if (input.docType === DOC_TYPES.INVOICE || input.docType === DOC_TYPES.PAYMENT_RECEIPT) {
      return { success: true, message: "Document already stored in billing tables" };
    }

    // For other doc types (RX, CER, REF, SOA), save to documents table
    const docNo = await getNextDocNo(input.docType, input.clinicId);
    const docCode = getDocCode(input.docType);

    let payload: any = { ...input.payload, doc_no: docNo, doc_code: docCode };

    // For PRESCRIPTION documents, regenerate HTML with the correct doc_no
    if (input.docType === DOC_TYPES.PRESCRIPTION && input.payload?.fields?.medications) {
      const prescriptionData = {
        patientName: input.patientName || "",
        patientAge: input.payload?.fields?.patient_age,
        patientAddress: input.payload?.fields?.patient_address,
        patientGender: input.payload?.fields?.patient_gender,
        visitDate: input.payload?.fields?.visit_date || new Date().toISOString().split("T")[0],
        dentistName: input.dentistName || "",
        medications: input.payload?.fields?.medications || [],
        remarks: input.payload?.fields?.remarks || "",
        docNo: docNo,
        clinicMeta: input.payload?.clinic_meta,
      };
      const regeneratedHtml = generatePrescriptionHTML(prescriptionData);
      payload.rendered_html = regeneratedHtml;
    }

    const documentRecord = {
      clinic_id: input.clinicId,
      patient_id: input.patientId || null,
      patient_name: input.patientName || null,
      doc_type: input.docType,
      doc_code: docCode,
      doc_no: docNo,
      payload,
      clinic_meta: input.payload?.clinic_meta || {},
      dentist_name: input.dentistName || null,
      dentist_prc: input.payload?.dentist_prc || null,
      dentist_ptr: input.payload?.dentist_ptr || null,
      issued_by: input.issuedBy || null,
    };

    const insertResult = await supabase.from("documents").insert(documentRecord).select();

    if (insertResult.error) {
      throw insertResult.error;
    }

    return insertResult.data?.[0];
  } catch (error) {
    throw error;
  }
}

/**
 * Get all documents for a patient (from invoices, receipts, generated_documents)
 * Returns unified Document format from existing tables
 */
export async function getPatientDocuments(patientId: string) {
  try {
    let allDocuments: any[] = [];

    // 1. Get invoices
    try {
      const { data: invoices, error: invError } = await supabase
        .from("invoices")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      if (!invError && invoices) {
        const converted = invoices.map((inv: any) => ({
          id: inv.id,
          doc_type: DOC_TYPES.INVOICE,
          doc_code: "INV",
          doc_no: inv.invoice_number,
          payload: {
            invoice_number: inv.invoice_number,
            invoice_date: inv.invoice_date,
            total: inv.total,
            rendered_html: "",
          },
          created_at: inv.created_at,
          issued_at: inv.created_at,
          patient_id: patientId,
        }));
        allDocuments.push(...converted);
      }
    } catch (err) {
      // Silent catchall for invoices query
    }

    // 2. Get receipts (PMT)
    try {
      const { data: patientReceipts, error: rcptError } = await supabase
        .from("receipts")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      if (!rcptError && patientReceipts) {
        // Filter to exclude voided receipts in application code
        const receipts = patientReceipts.filter((r: any) => !r.voided_at);
        
        if (receipts.length > 0) {
          const converted = receipts.map((receipt: any) => ({
            id: receipt.id,
            doc_type: DOC_TYPES.PAYMENT_RECEIPT,
            doc_code: "PMT",
            doc_no: receipt.receipt_number,
            payload: {
              receipt_number: receipt.receipt_number,
              payment_id: receipt.payment_id,
            },
            created_at: receipt.created_at,
            issued_at: receipt.issued_at || receipt.created_at,
            issued_by: receipt.issued_by,
            patient_id: patientId,
          }));
          allDocuments.push(...converted);
        } else {
        }
      }
    } catch (err) {
      // Silent catchall for receipts query
    }

    // 3. Get documents (RX, CER, REF, SOA, etc. - from documents table)
    try {
      const { data: docs, error: docError } = await supabase
        .from("documents")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      if (!docError && docs) {
        const converted = docs.map((doc: any) => ({
          id: doc.id,
          doc_type: doc.doc_type,
          doc_code: doc.doc_code || "GEN",
          doc_no: doc.doc_no || "—",
          payload: doc.payload || {},
          created_at: doc.created_at,
          issued_at: doc.issued_at || doc.created_at,
          issued_by: doc.issued_by,
          patient_id: patientId,
        }));
        allDocuments.push(...converted);
      }
    } catch (err) {
      // Silent catchall for documents query
    }

    // Sort all documents by created_at descending
    allDocuments.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    return allDocuments;
  } catch (error) {
    return [];
  }
}

/**
 * Delete a document (soft or hard; currently hard delete)
 */
export async function deleteDocument(documentId: string, docType?: string) {
  let table = "documents";
  if (docType === DOC_TYPES.INVOICE) table = "invoices";
  else if (docType === DOC_TYPES.PAYMENT_RECEIPT) table = "receipts";

  const { error, count } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .eq("id", documentId);

  if (error) throw error;
  if ((count ?? 0) === 0) throw new Error("Document not found or already deleted.");
}

/**
 * Get document label for UI display
 */
export function getDocTypeLabel(docType: DocType | string): string {
  const labels: Record<string, string> = {
    [DOC_TYPES.INVOICE]: "Invoice",
    [DOC_TYPES.PAYMENT_RECEIPT]: "Payment Receipt",
    [DOC_TYPES.ACCOUNT_STATEMENT]: "Statement of Account",
    [DOC_TYPES.PRESCRIPTION]: "Prescription",
    [DOC_TYPES.DENTAL_CERTIFICATE]: "Dental Certificate",
    [DOC_TYPES.REFERRAL_LETTER]: "Referral Letter",
    [DOC_TYPES.PATIENT_RECORD]: "Patient Record",
  };
  return labels[docType] || "Document";
}

/**
 * Get doc types available for generation in Documents tab
 * (excludes INVOICE and PAYMENT_RECEIPT which are created from Billing)
 */
export function getGenerableDocTypes(): DocType[] {
  return [
    DOC_TYPES.PATIENT_RECORD,
    DOC_TYPES.PRESCRIPTION,
    DOC_TYPES.DENTAL_CERTIFICATE,
    DOC_TYPES.REFERRAL_LETTER,
    DOC_TYPES.ACCOUNT_STATEMENT,
  ];
}

/**
 * Check if a doc type is generatable from Documents tab
 */
export function isGenerableDocType(docType: DocType): boolean {
  return getGenerableDocTypes().includes(docType);
}
