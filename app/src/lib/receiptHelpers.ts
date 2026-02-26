import { supabase } from "./supabaseClient";
import { getNextReceiptNumber } from "./numberGenerationHelpers";

/**
 * Generate a receipt for a verified payment
 * Creates an immutable snapshot of payment data
 *
 * @param paymentId - ID of the payment
 * @param staffId - ID of staff member issuing receipt
 * @param currentUserId - ID of current user (from auth)
 * @throws Error if payment is not verified
 * @returns Receipt object with receipt_number
 */
export async function generateReceipt(
  paymentId: string,
  staffId: string,
  currentUserId: string
) {
  try {
    console.log("[generateReceipt] Starting with paymentId:", paymentId, "staffId:", staffId, "currentUserId:", currentUserId);

    // Fetch payment
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (paymentError) {
      console.error("[generateReceipt] Error fetching payment:", paymentError);
      throw paymentError;
    }

    console.log("[generateReceipt] Fetched payment:", {
      id: payment.id,
      amount: payment.amount,
      status: payment.status,
      patient_id: payment.patient_id,
      invoice_id: payment.invoice_id,
    });

    // Guard: only verified payments
    if (payment.status !== "verified") {
      throw new Error(`Payment must be verified before issuing receipt (current status: ${payment.status})`);
    }

    // Fetch patient name separately
    const { data: patientData, error: patientError } = await supabase
      .from("patients")
      .select("first_name, last_name")
      .eq("id", payment.patient_id)
      .single();

    const patientName = patientError
      ? "Unknown Patient"
      : `${patientData?.first_name || ""} ${patientData?.last_name || ""}`.trim();

    // Generate sequential receipt number (PMT26-0001, PMT26-0002, etc.)
    const receiptNumber = await getNextReceiptNumber();
    console.log("[generateReceipt] Generated receipt number:", receiptNumber);

    // Create immutable snapshot of payment data
    // Extract payment mode from details JSONB (not from foreign key)
    const snapshot = {
      amount: payment.amount,
      payment_mode_code: payment.details?.payment_mode_code || "UNKNOWN",
      payment_mode_name: payment.details?.payment_mode_name || "Unknown",
      reference_number: payment.details?.reference_number || null,
      paid_by: patientName,
      payment_date: payment.payment_date,
      received_by_staff: payment.details?.received_by || null,
    };

    console.log("[generateReceipt] Snapshot:", snapshot);

    // Insert receipt
    // Note: issued_by can be null if the user is not registered in staff table
    const { data, error } = await supabase
      .from("receipts")
      .insert({
        receipt_number: receiptNumber,
        payment_id: paymentId,
        invoice_id: payment.invoice_id,
        patient_id: payment.patient_id,
        issued_by: null, // Optional staff reference
        snapshot,
        created_by: currentUserId,
      })
      .select();

    if (error) {
      console.error("[generateReceipt] Insert error details:", {
        message: error.message,
        code: error.code,
        hint: error.hint,
        details: error.details,
      });
      throw error;
    }

    console.log("[generateReceipt] Receipt created successfully:", data?.[0]);
    return data?.[0];
  } catch (error) {
    const errorMsg =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error
        ? JSON.stringify(error)
        : String(error);
    console.error("[generateReceipt] Fatal error:", errorMsg, "Stack:", error instanceof Error ? error.stack : "");
    throw error;
  }
}

/**
 * Void a payment and its related receipt
 * Uses soft-delete (sets voided_at) to preserve audit trail
 *
 * @param paymentId - ID of payment to void
 * @param staffId - ID of staff member voiding payment
 * @param reason - Reason for voiding
 */
export async function voidPayment(
  paymentId: string,
  staffId: string,
  reason: string
) {
  // Void payment
  const { error: updateError } = await supabase
    .from("payments")
    .update({
      voided_at: new Date().toISOString(),
      voided_by: staffId,
      void_reason: reason,
    })
    .eq("id", paymentId);

  if (updateError) throw updateError;

  // Also void any related receipt
  await supabase
    .from("receipts")
    .update({
      status: "voided",
      voided_at: new Date().toISOString(),
      voided_by: staffId,
      void_reason: `Payment voided: ${reason}`,
    })
    .eq("payment_id", paymentId)
    .eq("status", "issued");
}

// ============================================================================
// QUERY PATTERNS - Use these in your pages
// ============================================================================

/**
 * Get all active (non-voided) payments for an invoice
 */
export async function getActivePayments(invoiceId: string) {
  const { data } = await supabase
    .from("payments")
    .select(`
      *,
      payment_modes(name, code),
      verified_staff:verified_by(full_name),
      received_staff:received_by(full_name)
    `)
    .eq("invoice_id", invoiceId)
    .is("voided_at", null)
    .order("payment_date", { ascending: false });

  return data || [];
}

/**
 * Get verified payments only (ready for receipt)
 */
export async function getVerifiedPayments(invoiceId: string) {
  const { data } = await supabase
    .from("payments")
    .select("*")
    .eq("invoice_id", invoiceId)
    .eq("status", "verified")
    .is("voided_at", null);

  return data || [];
}

/**
 * Get total paid amount (sum of active non-voided payments)
 */
export async function getTotalPaid(invoiceId: string) {
  const payments = await getActivePayments(invoiceId);
  return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
}