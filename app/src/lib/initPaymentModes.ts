import { supabase } from "./supabaseClient";

const DEFAULT_PAYMENT_MODES = [
  { name: "Cash", sort_order: 1 },
  { name: "GCash", sort_order: 2 },
  { name: "Maya", sort_order: 3 },
  { name: "Bank Transfer", sort_order: 4 },
  { name: "Check", sort_order: 5 },
  { name: "Credit Card", sort_order: 6 },
];

/**
 * Initialize payment_modes table with default modes if it doesn't have any
 * Call this once when the app loads
 */
export async function initializePaymentModes() {
  try {
    // Try to check if table exists and has data
    const { data: existing, error: checkError } = await supabase
      .from("payment_modes")
      .select("id")
      .limit(1);

    // If we got an error, likely table doesn't exist - that's a schema issue
    if (checkError) {
      // Suppress error if payment_modes table doesn't exist yet - it's expected during initial setup
      // console.error("Payment modes table does not exist. Please create it in Supabase with: id (uuid), name (text), is_active (boolean), sort_order (integer)");
      return;
    }

    // If table exists but is empty, seed it with defaults
    if (!existing || existing.length === 0) {
      const { error: insertError } = await supabase
        .from("payment_modes")
        .insert(DEFAULT_PAYMENT_MODES.map(mode => ({
          name: mode.name,
          is_active: true,
          sort_order: mode.sort_order,
        })));

      if (insertError) {
        console.error("Failed to seed payment modes:", insertError);
      } else {
        console.log("Payment modes initialized with defaults");
      }
    }
  } catch (err) {
    console.error("Error initializing payment modes:", err);
  }
}
