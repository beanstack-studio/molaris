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
  // Fetch payment with related data
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select(`
      *,
      patient_id,
      invoice_id,
      payment_modes(name, code),
      patients(first_name, last_name),
      staff(full_name)
    `)
    .eq("id", paymentId)
    .single();

  if (paymentError) throw paymentError;

  // Guard: only verified payments
  if (payment.status !== "verified") {
    throw new Error("Payment must be verified before issuing receipt");
  }

  // Generate sequential receipt number (R26-0001, R26-0002, etc.)
  const receiptNumber = await getNextReceiptNumber();

  // Create immutable snapshot of payment data
  const snapshot = {
    amount: payment.amount,
    payment_mode_code: payment.payment_modes.code,
    payment_mode_name: payment.payment_modes.name,
    reference_number: payment.reference_number || null,
    paid_by: `${payment.patients.first_name} ${payment.patients.last_name}`,
    payment_date: payment.payment_date,
    received_by_staff: payment.staff?.full_name || null,
  };

  // Insert receipt
  const { data, error } = await supabase
    .from("receipts")
    .insert({
      receipt_number: receiptNumber,
      payment_id: paymentId,
      invoice_id: payment.invoice_id,
      patient_id: payment.patient_id,
      issued_by: staffId,
      snapshot,
      created_by: currentUserId,
    })
    .select();

  if (error) throw error;

  return data[0];
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