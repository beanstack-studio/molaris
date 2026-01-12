/**
 * Number Generation Helpers
 * Generates sequential numbers by counting existing records
 */

import { supabase } from "./supabaseClient";

/**
 * Get next sequential invoice number (I26-0001, I26-0002, etc.)
 */
export async function getNextInvoiceNumber(): Promise<string> {
  try {
    const year = new Date().getFullYear().toString().slice(-2); // "26" for 2026
    
    // Count existing invoices
    const { count, error } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true });
    
    if (error) throw error;
    
    const nextNumber = (count || 0) + 1;
    return `I${year}-${String(nextNumber).padStart(4, "0")}`;
  } catch (error) {
    console.error("Error generating invoice number:", error);
    return "I26-0001";
  }
}

/**
 * Get next sequential transaction number (T26-0001, T26-0002, etc.)
 */
export async function getNextTransactionNumber(): Promise<string> {
  try {
    const year = new Date().getFullYear().toString().slice(-2); // "26" for 2026
    
    // Count existing payments
    const { count, error } = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true });
    
    if (error) throw error;
    
    const nextNumber = (count || 0) + 1;
    return `T${year}-${String(nextNumber).padStart(4, "0")}`;
  } catch (error) {
    console.error("Error generating transaction number:", error);
    return "T26-0001";
  }
}

/**
 * Get next sequential receipt number (R26-0001, R26-0002, etc.)
 */
export async function getNextReceiptNumber(): Promise<string> {
  try {
    const year = new Date().getFullYear().toString().slice(-2); // "26" for 2026
    
    // Count existing receipts
    const { count, error } = await supabase
      .from("receipts")
      .select("id", { count: "exact", head: true });
    
    if (error) throw error;
    
    const nextNumber = (count || 0) + 1;
    return `R${year}-${String(nextNumber).padStart(4, "0")}`;
  } catch (error) {
    console.error("Error generating receipt number:", error);
    return "R26-0001";
  }
}
