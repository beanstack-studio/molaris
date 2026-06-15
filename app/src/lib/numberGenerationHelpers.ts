/**
 * Number Generation Helpers
 * Generates sequential numbers by counting existing records per clinic
 */

import { supabase } from "./supabaseClient";

/**
 * Get next sequential invoice number (INV26-0001, INV26-0002, etc.)
 */
export async function getNextInvoiceNumber(clinicId: string): Promise<string> {
  try {
    const year = new Date().getFullYear().toString().slice(-2); // "26" for 2026

    // Count existing invoices for this clinic
    const { count, error } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId);

    if (error) throw error;

    const nextNumber = (count || 0) + 1;
    return `INV${year}-${String(nextNumber).padStart(4, "0")}`;
  } catch (error) {
    console.error("Error generating invoice number:", error);
    return "INV26-0001";
  }
}

/**
 * Get next sequential payment number (PAY26-0001, PAY26-0002, etc.)
 */
export async function getNextTransactionNumber(clinicId: string): Promise<string> {
  try {
    const year = new Date().getFullYear().toString().slice(-2); // "26" for 2026

    // Count existing payments for this clinic
    const { count, error } = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId);

    if (error) throw error;

    const nextNumber = (count || 0) + 1;
    return `PAY${year}-${String(nextNumber).padStart(4, "0")}`;
  } catch (error) {
    console.error("Error generating payment number:", error);
    return "PAY26-0001";
  }
}

/**
 * Get next sequential receipt number (PMT26-0001, PMT26-0002, etc.)
 */
export async function getNextReceiptNumber(clinicId: string): Promise<string> {
  try {
    const year = new Date().getFullYear().toString().slice(-2); // "26" for 2026

    // Count existing receipts for this clinic
    const { count, error } = await supabase
      .from("receipts")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId);

    if (error) throw error;

    const nextNumber = (count || 0) + 1;
    return `PMT${year}-${String(nextNumber).padStart(4, "0")}`;
  } catch (error) {
    console.error("Error generating receipt number:", error);
    return "PMT26-0001";
  }
}
