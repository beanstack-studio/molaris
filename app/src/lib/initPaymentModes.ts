import { supabase } from "./supabaseClient";

const DEFAULT_PAYMENT_MODES = [
  { code: "CASH", name: "Cash", requires_proof: false, requires_reference: false, requires_received_by: true, auto_verifies: true, sort_order: 1 },
  { code: "GCASH", name: "GCash", requires_proof: true, requires_reference: true, requires_received_by: false, auto_verifies: false, sort_order: 2 },
  { code: "MAYA", name: "Maya", requires_proof: true, requires_reference: true, requires_received_by: false, auto_verifies: false, sort_order: 3 },
  { code: "BANK_TRANSFER", name: "Bank Transfer", requires_proof: true, requires_reference: true, requires_received_by: false, auto_verifies: false, sort_order: 4 },
  { code: "CHEQUE", name: "Check", requires_proof: false, requires_reference: true, requires_received_by: false, auto_verifies: false, sort_order: 5 },
  { code: "CREDIT_CARD", name: "Credit Card", requires_proof: false, requires_reference: false, requires_received_by: false, auto_verifies: false, sort_order: 6 },
];

/**
 * Initialize payment_modes table with default modes if it doesn't have any
 * Call this once when the app loads
 */
export async function initializePaymentModes() {
  try {
    const { data: existing, error: checkError } = await supabase
      .from("payment_modes")
      .select("id")
      .limit(1);

    if (checkError) {
      return;
    }

    if (!existing || existing.length === 0) {
      const { error: insertError } = await supabase
        .from("payment_modes")
        .insert(DEFAULT_PAYMENT_MODES.map(mode => ({
          code: mode.code,
          name: mode.name,
          requires_proof: mode.requires_proof,
          requires_reference: mode.requires_reference,
          requires_received_by: mode.requires_received_by,
          auto_verifies: mode.auto_verifies,
          is_active: true,
          sort_order: mode.sort_order,
        })));

      if (insertError) {
        console.error("Failed to seed payment modes:", insertError?.message || JSON.stringify(insertError));
      } else {
        console.log("Payment modes initialized with defaults");
      }
    }
  } catch (err) {
    console.error("Error initializing payment modes:", err);
  }
}