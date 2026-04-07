import { supabase } from "./supabaseClient";

/**
 * Get payment mode config by code
 * Use in billing form to determine what fields to show
 *
 * @example
 * const mode = await getPaymentModeConfig('GCASH');
 * if (mode.requires_proof) { showFileInput(); }
 */
export async function getPaymentModeConfig(modeCode: string) {
  const { data, error } = await supabase
    .from("payment_modes")
    .select("*")
    .eq("code", modeCode)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all active payment modes (for dropdown)
 * Sorted by sort_order for consistent UI
 *
 * @example
 * const modes = await getActivePaymentModes();
 * // Returns: [ { id, code, name, requires_proof, requires_reference, ... }, ...]
 */
export async function getActivePaymentModes() {
  const { data, error } = await supabase
    .from("payment_modes")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

