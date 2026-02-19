/* =========================
   Helpers
========================= */
import type { GenderDB } from "./types";

export function splitFullName(full: string | null | undefined) {
  const s = (full ?? "").trim().replace(/\s+/g, " ");
  if (!s) return { first: "", last: "" };

  const parts = s.split(" ");
  if (parts.length === 1) return { first: parts[0], last: "" };

  const first = parts.slice(0, -1).join(" ");
  const last = parts[parts.length - 1];
  return { first, last };
}

export function combineFullName(first: string | null | undefined, last: string | null | undefined) {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  return [f, l].filter(Boolean).join(" ").trim();
}

export function todayLocalISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatGenderShort(g: GenderDB) {
  if (g === "male") return "M";
  if (g === "female") return "F";
  return "—";
}

export function formatGenderLabel(g: GenderDB) {
  if (g === "male") return "Male";
  if (g === "female") return "Female";
  return "Not specified";
}

export function normalizeGenderInput(v: string): GenderDB {
  const s = (v || "").trim().toLowerCase();
  if (s === "male") return "male";
  if (s === "female") return "female";
  return null;
}

export function formatDatePH(isoDate: string | null | undefined) {
  if (!isoDate) return "—";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" });
}

export function formatDateStandard(isoDate: string | null | undefined) {
  if (!isoDate) return "—";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return isoDate;
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const monthStr = months[m - 1] || "";
  return `${String(d).padStart(2, "0")}-${monthStr}-${y}`;
}

export function formatDateTimePH(iso: string | null | undefined) {
  if (!iso) return "—";
  const dt = new Date(iso);
  return dt.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function calcAge(isoDate: string | null | undefined) {
  if (!isoDate) return null;
  const parts = isoDate.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return null;

  const today = new Date();
  let age = today.getFullYear() - y;
  const mm = today.getMonth() + 1;
  const dd = today.getDate();
  if (mm < m || (mm === m && dd < d)) age -= 1;
  return age;
}

export function safeFileName(name: string) {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 120);
}

export function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatMoney(amount: number) {
  return "₱ " + Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Generate formatted invoice number: I26-0001, I26-0002, etc.
 * Note: For proper sequential numbers, call getNextInvoiceNumber() from the page
 * This fallback generates a deterministic number based on timestamp
 */
export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear().toString().slice(-2); // "26" for 2026
  const timestamp = Date.now();
  const sequence = (timestamp % 10000).toString().padStart(4, "0");
  return `I${year}-${sequence}`;
}

/**
 * Generate formatted transaction number: T26-0001, T26-0002, etc.
 * Note: For proper sequential numbers, call getNextTransactionNumber() from the page
 * This fallback generates a deterministic number based on timestamp
 */
export function generateTransactionNumber(): string {
  const year = new Date().getFullYear().toString().slice(-2); // "26" for 2026
  const timestamp = Date.now();
  const sequence = (timestamp % 10000).toString().padStart(4, "0");
  return `T${year}-${sequence}`;
}

/**
 * Generate formatted receipt number: R26-0001, R26-0002, etc.
 * Note: For proper sequential numbers, call getNextReceiptNumber() from the page
 * This fallback generates a deterministic number based on timestamp
 */
export function generateReceiptNumber(): string {
  const year = new Date().getFullYear().toString().slice(-2); // "26" for 2026
  const timestamp = Date.now();
  const sequence = (timestamp % 10000).toString().padStart(4, "0");
  return `R${year}-${sequence}`;
}

/**
 * Get next sequential invoice number from database: I26-0001, I26-0002, etc.
 * Queries the invoices table to get count and generates next number
 */
export async function getNextInvoiceNumber(supabaseClient: any): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2); // "26" for 2026
  
  const { data, error } = await supabaseClient
    .from("invoices")
    .select("id", { count: "exact" });
  
  const count = (data?.length || 0) + 1;
  const sequence = count.toString().padStart(4, "0");
  return `I${year}-${sequence}`;
}

/**
 * Get next sequential transaction number from database: T26-0001, T26-0002, etc.
 * Queries the payments table to get count and generates next number
 */
export async function getNextTransactionNumber(supabaseClient: any): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2); // "26" for 2026
  
  const { data, error } = await supabaseClient
    .from("payments")
    .select("id", { count: "exact" });
  
  const count = (data?.length || 0) + 1;
  const sequence = count.toString().padStart(4, "0");
  return `T${year}-${sequence}`;
}

/**
 * Get next sequential receipt number from database: R26-0001, R26-0002, etc.
 * Queries the receipts table to get count and generates next number
 */
export async function getNextReceiptNumber(supabaseClient: any): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2); // "26" for 2026
  
  const { data, error } = await supabaseClient
    .from("receipts")
    .select("id", { count: "exact" });
  
  const count = (data?.length || 0) + 1;
  const sequence = count.toString().padStart(4, "0");
  return `R${year}-${sequence}`;
}

export function renderTemplate(template: string, data: Record<string, any>) {
  let html = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\$\\{${key}\\}`, "g");
    html = html.replace(regex, escapeHtml(String(value ?? "")));
  }
  return html;
}