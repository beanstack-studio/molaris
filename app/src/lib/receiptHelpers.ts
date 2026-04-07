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
    // Fetch payment
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (paymentError) {
      throw paymentError;
    }

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
      throw error;
    }

    return data?.[0];
  } catch (error) {
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

