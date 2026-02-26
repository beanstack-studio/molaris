/**
 * Document Helpers
 * Unified document system with type mapping, numbering, and creation
 */

import { supabase } from "./supabaseClient";

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
};

/**
 * Get document code from doc type
 * @param docType - The logical document type
 * @returns The short code (INV, PMT, SOA, RX, CER, REF)
 */
export function getDocCode(docType: DocType): string {
  return DOC_CODE_MAP[docType] || "UNKNOWN";
}

/**
 * Reverse: get doc type from code
 * @param code - The short code
 * @returns The logical document type
 */
export function getDocTypeFromCode(code: string): DocType | null {
  return CODE_TO_DOC_TYPE[code] || null;
}

/**
 * Format document number
 * @param code - Short code (INV, PMT, SOA, etc.)
 * @param year - Last 2 digits of year (26 for 2026)
 * @param number - Sequential number (1-based)
 * @returns Formatted doc no: INV26-0001, PMT26-0001, etc.
 */
export function formatDocNo(code: string, year: number, number: number): string {
  const yearStr = String(year).slice(-2).padStart(2, "0");
  const numberStr = String(number).padStart(4, "0");
  return `${code}${yearStr}-${numberStr}`;
}

/**
 * Get next sequential document number (transaction-safe via SQL function)
 * @param docType - The document type
 * @returns Fully formatted doc no
 */
export async function getNextDocNo(docType: DocType): Promise<string> {
  try {
    const docCode = getDocCode(docType);
    const year = new Date().getFullYear();

    // Call SQL function for atomic increment
    // The RPC calls increment_doc_counter which returns next_num
    const { data, error } = await supabase.rpc("increment_doc_counter", {
      p_doc_code: docCode,
      p_year: year,
    });

    if (error) {
      console.warn(
        `[getNextDocNo] RPC increment_doc_counter unavailable for ${docCode}:`,
        error.message
      );
      // Fallback to simple counter-based generation
      return await getNextDocNoFallback(docType);
    }

    if (!data) {
      console.warn(`[getNextDocNo] RPC returned no data for ${docCode}`);
      return await getNextDocNoFallback(docType);
    }

    const nextNumber = data as number;
    return formatDocNo(docCode, year, nextNumber);
  } catch (error) {
    const errorMsg =
      error instanceof Error
        ? error.message
        : JSON.stringify(error);
    console.warn(`[getNextDocNo] Error calling RPC:`, errorMsg);
    return await getNextDocNoFallback(docType);
  }
}

/**
 * Fallback: simple count-based doc number generation (less safe under concurrency)
 * Used if RPC function is unavailable. Checks both documents and legacy tables.
 */
export async function getNextDocNoFallback(docType: DocType): Promise<string> {
  try {
    const year = new Date().getFullYear();
    const docCode = getDocCode(docType);

    // Try to count from new documents table first
    let count = 0;
    const { count: newCount, error: newError } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("doc_code", docCode)
      .gte("created_at", `${year}-01-01T00:00:00Z`)
      .lt("created_at", `${year + 1}-01-01T00:00:00Z`);

    if (!newError) {
      count = newCount || 0;
    }

    // Also count from legacy generated_documents table
    try {
      const { count: legacyCount, error: legacyError } = await supabase
        .from("generated_documents")
        .select("id", { count: "exact", head: true })
        .eq("doc_type", docType)
        .gte("created_at", `${year}-01-01T00:00:00Z`)
        .lt("created_at", `${year + 1}-01-01T00:00:00Z`);

      if (!legacyError && legacyCount) {
        count += legacyCount;
      }
    } catch (legacyErr) {
      console.warn("[getNextDocNoFallback] Could not count legacy table:", legacyErr);
    }

    const nextNumber = Math.max(count + 1, 1);
    return formatDocNo(docCode, year, nextNumber);
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : JSON.stringify(error);
    console.error("[getNextDocNoFallback] Fatal error:", errorMsg);
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
      console.log(
        `[createDocument] Skipping ${input.docType} - already created in invoices/receipts table`
      );
      return { success: true, message: "Document already stored in billing tables" };
    }

    // For other doc types (RX, CER, REF, SOA), save to generated_documents
    const docNo = await getNextDocNo(input.docType);
    const docCode = getDocCode(input.docType);

    const legacyPayload = {
      patient_id: input.patientId || null,
      doc_type: input.docType,
      doc_number: docNo,
      payload: {
        ...input.payload,
        doc_no: docNo,
        doc_code: docCode,
      },
      created_by: input.issuedBy || null,
    };

    const insertResult = await supabase.from("generated_documents").insert(legacyPayload).select();

    if (insertResult.error) {
      const errorMsg =
        insertResult.error.message || JSON.stringify(insertResult.error);
      console.error("[createDocument] Insert error:", errorMsg);
      throw insertResult.error;
    }

    console.log(`[createDocument] Created ${input.docType} document: ${docNo}`);
    return insertResult.data?.[0];
  } catch (error) {
    const errorMsg =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error
        ? JSON.stringify(error)
        : String(error);
    console.error("[createDocument] Fatal error:", errorMsg);
    throw error;
  }
}

/**
 * Get all documents for a patient (from invoices, receipts, generated_documents)
 * Returns unified Document format from existing tables
 */
export async function getPatientDocuments(patientId: string) {
  try {
    console.log("[getPatientDocuments] Loading documents for patient:", patientId);

    let allDocuments: any[] = [];

    // 1. Get invoices
    try {
      const { data: invoices, error: invError } = await supabase
        .from("invoices")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      if (!invError && invoices) {
        console.log("[getPatientDocuments] Invoices found:", invoices.length);
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
      } else if (invError) {
        console.warn("[getPatientDocuments] Error querying invoices:", invError.message);
      }
    } catch (err) {
      console.warn("[getPatientDocuments] Exception querying invoices:", err);
    }

    // 2. Get receipts (PMT)
    try {
      console.log("[getPatientDocuments] Querying receipts for patient:", patientId);
      
      // Raw query WITHOUT any filtering to see what exists
      const { data: allReceiptsRaw, error: rawError } = await supabase
        .from("receipts")
        .select("*")
        .order("created_at", { ascending: false });

      console.log("[getPatientDocuments] ALL receipts in system (raw):", {
        error: rawError,
        count: allReceiptsRaw?.length || 0,
        sample: allReceiptsRaw?.slice(0, 3),
      });

      // Now filter by patient_id
      const { data: patientReceipts, error: rcptError } = await supabase
        .from("receipts")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      console.log("[getPatientDocuments] Receipts for this patient:", {
        error: rcptError,
        count: patientReceipts?.length || 0,
        data: patientReceipts,
      });

      if (!rcptError && patientReceipts) {
        // Filter to exclude voided receipts in application code
        const receipts = patientReceipts.filter((r: any) => !r.voided_at);
        
        if (receipts.length > 0) {
          console.log("[getPatientDocuments] Active receipts (non-voided):", receipts.length);
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
          console.log("[getPatientDocuments] Converted receipts:", converted);
          allDocuments.push(...converted);
        } else {
          console.log("[getPatientDocuments] No active receipts found for this patient (all voided or none exist)");
        }
      } else if (rcptError) {
        console.warn("[getPatientDocuments] Error querying receipts:", rcptError);
      }
    } catch (err) {
      console.error("[getPatientDocuments] Exception in receipts query:", err);
    }

    // 3. Get generated_documents (RX, CER, REF, SOA)
    try {
      const { data: genDocs, error: genError } = await supabase
        .from("generated_documents")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      if (!genError && genDocs) {
        console.log("[getPatientDocuments] Generated documents found:", genDocs.length);
        const converted = genDocs.map((doc: any) => ({
          id: doc.id,
          doc_type: doc.doc_type,
          doc_code: doc.doc_type?.substring(0, 3) || "GEN",
          doc_no: doc.doc_number || "—",
          payload: doc.payload || {},
          created_at: doc.created_at,
          issued_at: doc.created_at,
          patient_id: patientId,
        }));
        allDocuments.push(...converted);
      } else if (genError) {
        console.warn("[getPatientDocuments] Error querying generated_documents:", genError.message);
      }
    } catch (err) {
      console.warn("[getPatientDocuments] Exception querying generated_documents:", err);
    }

    // Sort all documents by created_at descending
    allDocuments.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    console.log("[getPatientDocuments] Final result:", allDocuments.length, "total documents");

    return allDocuments;
  } catch (error) {
    const errorMsg =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error
        ? JSON.stringify(error)
        : String(error);
    console.error("[getPatientDocuments] Fatal error:", errorMsg);
    return [];
  }
}

/**
 * Get a single document by ID
 */
export async function getDocumentById(documentId: string) {
  try {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error fetching document:", error);
    return null;
  }
}

/**
 * Delete a document (soft or hard; currently hard delete)
 */
export async function deleteDocument(documentId: string) {
  try {
    const { error } = await supabase.from("documents").delete().eq("id", documentId);

    if (error) throw error;
    console.log(`[deleteDocument] Deleted document: ${documentId}`);
  } catch (error) {
    console.error("Error deleting document:", error);
    throw error;
  }
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
  };
  return labels[docType] || "Document";
}

/**
 * Get doc types available for generation in Documents tab
 * (excludes INVOICE and PAYMENT_RECEIPT which are created from Billing)
 */
export function getGenerableDocTypes(): DocType[] {
  return [
    DOC_TYPES.PRESCRIPTION,
    DOC_TYPES.DENTAL_CERTIFICATE,
    DOC_TYPES.REFERRAL_LETTER,
  ];
}

/**
 * Check if a doc type is generatable from Documents tab
 */
export function isGenerableDocType(docType: DocType): boolean {
  return getGenerableDocTypes().includes(docType);
}
