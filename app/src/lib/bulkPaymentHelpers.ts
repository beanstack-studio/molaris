import { supabase } from "./supabaseClient";
import { generateReceipt } from "./receiptHelpers";

export interface BulkPaymentRecord {
  invoice_number: string;
  amount: number;
  payment_date: string;
  mode: string;
  reference_number?: string;
  received_by?: string;
  notes?: string;
}

export interface BulkPaymentResult {
  success: boolean;
  invoice_number: string;
  message: string;
  payment_id?: string;
  error?: string;
}

/**
 * Record a single payment (used by bulk import and manual entry)
 * Validates invoice and creates payment record
 */
export async function recordPayment(
  invoiceNumber: string,
  amount: number,
  paymentDate: string,
  modeCode: string,
  referenceNumber?: string,
  receivedBy?: string,
  notes?: string,
  userId?: string
) {
  // Find invoice by invoice_number
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, total, invoice_number, patient_id")
    .eq("invoice_number", invoiceNumber)
    .single();

  if (invoiceError || !invoice) {
    throw new Error(`Invoice ${invoiceNumber} not found`);
  }

  // Get payment mode
  const { data: mode, error: modeError } = await supabase
    .from("payment_modes")
    .select("id, code")
    .eq("code", modeCode)
    .single();

  if (modeError || !mode) {
    throw new Error(`Payment mode ${modeCode} not found`);
  }

  // Create payment record
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      invoice_id: invoice.id,
      patient_id: invoice.patient_id,
      amount: amount,
      payment_date: paymentDate,
      status: "pending", // Requires verification
      reference_number: referenceNumber || null,
      received_by: receivedBy || null,
      notes: notes || null,
      created_by: userId || null,
    })
    .select()
    .single();

  if (paymentError) {
    throw new Error(`Failed to create payment: ${paymentError.message}`);
  }

  return payment;
}

/**
 * Import multiple payments from CSV or array
 * Returns array of results for each record
 */
export async function importBulkPayments(
  records: BulkPaymentRecord[],
  userId?: string
): Promise<BulkPaymentResult[]> {
  const results: BulkPaymentResult[] = [];

  for (const record of records) {
    try {
      const payment = await recordPayment(
        record.invoice_number,
        record.amount,
        record.payment_date,
        record.mode,
        record.reference_number,
        record.received_by,
        record.notes,
        userId
      );

      results.push({
        success: true,
        invoice_number: record.invoice_number,
        message: `Payment recorded successfully`,
        payment_id: payment.id,
      });
    } catch (error) {
      results.push({
        success: false,
        invoice_number: record.invoice_number,
        message: "Failed to record payment",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

/**
 * Batch verify multiple payments
 * Marks payments as verified after review
 */
export async function batchVerifyPayments(
  paymentIds: string[],
  staffId: string,
  verifiedBy: string
): Promise<{ success: number; failed: number; errors: string[] }> {
  const errors: string[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const paymentId of paymentIds) {
    try {
      const { error } = await supabase
        .from("payments")
        .update({
          status: "verified",
          verified_by: staffId,
          verified_at: new Date().toISOString(),
        })
        .eq("id", paymentId);

      if (error) {
        errors.push(`Payment ${paymentId}: ${error.message}`);
        failCount += 1;
      } else {
        successCount += 1;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Payment ${paymentId}: ${msg}`);
      failCount += 1;
    }
  }

  return { success: successCount, failed: failCount, errors };
}

/**
 * Batch generate receipts for verified payments
 * Creates immutable receipt snapshots
 */
export async function batchGenerateReceipts(
  paymentIds: string[],
  staffId: string,
  userId: string,
  clinicId: string        // ← ADD THIS
): Promise<{ success: number; failed: number; receipts: string[]; errors: string[] }> {
  const errors: string[] = [];
  const receipts: string[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const paymentId of paymentIds) {
    try {
      const receipt = await generateReceipt(paymentId, staffId, userId, clinicId);  // ← NOW WORKS
      receipts.push(receipt.id);
      successCount += 1;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Payment ${paymentId}: ${msg}`);
      failCount += 1;
    }
  }

  return { success: successCount, failed: failCount, receipts, errors };
}

/**
 * Parse CSV data into payment records
 * Expects columns: invoice_number,amount,payment_date,mode,reference_number,received_by,notes
 */
export function parsePaymentCSV(csvText: string): { records: BulkPaymentRecord[]; errors: string[] } {
  const lines = csvText.trim().split("\n");
  const records: BulkPaymentRecord[] = [];
  const errors: string[] = [];

  // Skip header line
  const dataLines = lines.slice(1);

  dataLines.forEach((line, index) => {
    const row = index + 2; // Account for header + 1-based indexing
    if (!line.trim()) return;

    try {
      const [
        invoice_number,
        amount_str,
        payment_date,
        mode,
        reference_number,
        received_by,
        notes,
      ] = line.split(",").map((s) => s.trim());

      if (!invoice_number) {
        errors.push(`Row ${row}: Missing invoice number`);
        return;
      }

      if (!amount_str || isNaN(parseFloat(amount_str))) {
        errors.push(`Row ${row}: Invalid amount "${amount_str}"`);
        return;
      }

      if (!payment_date) {
        errors.push(`Row ${row}: Missing payment date`);
        return;
      }

      if (!mode) {
        errors.push(`Row ${row}: Missing payment mode`);
        return;
      }

      records.push({
        invoice_number,
        amount: parseFloat(amount_str),
        payment_date,
        mode: mode.toUpperCase(),
        reference_number: reference_number || undefined,
        received_by: received_by || undefined,
        notes: notes || undefined,
      });
    } catch (error) {
      errors.push(`Row ${row}: ${error instanceof Error ? error.message : "Parse error"}`);
    }
  });

  return { records, errors };
}

/**
 * Export CSV template for bulk payment import
 * Returns CSV content with headers and sample row
 */
export function getPaymentCSVTemplate(): string {
  const headers = "invoice_number,amount,payment_date,mode,reference_number,received_by,notes";
  const sample = "INV-001,5000.00,2026-01-12,CASH,,,Payment received";
  return `${headers}\n${sample}`;
}

/**
 * Validate bulk payment records before import
 */
export async function validatePaymentRecords(
  records: BulkPaymentRecord[]
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Check for required fields
  records.forEach((record, index) => {
    if (!record.invoice_number) errors.push(`Row ${index + 2}: Missing invoice number`);
    if (!record.amount || record.amount <= 0) errors.push(`Row ${index + 2}: Invalid amount`);
    if (!record.payment_date) errors.push(`Row ${index + 2}: Missing payment date`);
    if (!record.mode) errors.push(`Row ${index + 2}: Missing payment mode`);

    // Validate date format (YYYY-MM-DD)
    if (record.payment_date && !/^\d{4}-\d{2}-\d{2}$/.test(record.payment_date)) {
      errors.push(`Row ${index + 2}: Invalid date format (expected YYYY-MM-DD)`);
    }
  });

  // Check if invoices and modes exist (database queries)
  const invoiceNumbers = [...new Set(records.map((r) => r.invoice_number))];
  const modes = [...new Set(records.map((r) => r.mode))];

  try {
    const { data: invoices } = await supabase
      .from("invoices")
      .select("invoice_number")
      .in("invoice_number", invoiceNumbers);

    const foundInvoices = new Set((invoices || []).map((i: any) => i.invoice_number));
    invoiceNumbers.forEach((num) => {
      if (!foundInvoices.has(num)) {
        errors.push(`Invoice ${num}: Not found in database`);
      }
    });

    const { data: paymentModes } = await supabase
      .from("payment_modes")
      .select("code")
      .in("code", modes);

    const foundModes = new Set((paymentModes || []).map((m: any) => m.code));
    modes.forEach((mode) => {
      if (!foundModes.has(mode)) {
        errors.push(`Payment mode ${mode}: Not found in database`);
      }
    });
  } catch (error) {
    errors.push(`Database validation error: ${error instanceof Error ? error.message : "Unknown"}`);
  }

  return { valid: errors.length === 0, errors };
}
