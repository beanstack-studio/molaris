/* =========================
   Helpers
========================= */
import type { GenderDB } from "./types";

export function formatPatientName(
  first: string | null,
  middle: string | null,
  last: string | null
): string {
  return [first, middle, last].filter(Boolean).join(' ').trim() || '—'
}

export function formatPatientNameFormal(
  first: string | null,
  middle: string | null,
  last: string | null
): string {
  const mi = middle?.trim() ? `${middle.trim()[0]}.` : ''
  const full = [first?.trim(), mi].filter(Boolean).join(' ')
  const parts = [last?.trim(), full].filter(Boolean)
  return parts.join(', ') || '—'
}

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

/**
 * Formats a PH phone number as the user types, choosing the right group pattern
 * based on digit count:
 *   11 digits → XXXX XXX XXXX  (4-3-4, PH mobile: 09XX XXX XXXX)
 *   10 digits → XXX XXX XXXX   (3-3-4, landline with area code)
 *    7 digits → XXX XXXX       (3-4, local landline)
 *
 * Also normalises:
 *   +63 / 63 prefix (≥12 raw digits) → 0 prefix
 *   10-digit number starting with 9  → prepend 0 (mobile shorthand)
 */
export function formatPhoneLocal(raw: string): string {
  let d = raw.replace(/\D/g, "");

  // International → local: +63XXXXXXXXXX or 63XXXXXXXXXX
  if (d.startsWith("63") && d.length >= 12) d = "0" + d.slice(2);
  // Mobile shorthand: 9XXXXXXXXX (10 digits) → 09XXXXXXXXX
  if (d.length === 10 && d.startsWith("9")) d = "0" + d;

  d = d.slice(0, 11);
  const n = d.length;

  if (n === 0) return "";
  if (n <= 3) return d;

  if (n <= 7) {
    // 7-digit local landline: XXX XXXX
    return `${d.slice(0, 3)} ${d.slice(3)}`;
  }
  if (n <= 10) {
    // 10-digit landline with area code: XXX XXX XXXX
    return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  }
  // 11-digit mobile: XXXX XXX XXXX
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
}

/**
 * Formats a decimal hour (e.g. 8 = 8:00 AM, 17 = 5:00 PM, 8.5 = 8:30 AM)
 * into "8:00 AM" or "5:30 PM" style.
 */
export function formatScheduleTime(decHour: number): string {
  const h = Math.floor(decHour);
  const m = Math.round((decHour - h) * 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const min = `:${String(m).padStart(2, '0')}`;
  return `${hour}${min} ${period}`;
}

export function formatMoney(amount: number) {
  return '₱ ' + (amount || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatMoneyCompact(amount: number | null | undefined): string {
  if (amount == null) return '—';
  const isWhole = amount % 1 === 0;
  return '₱' + amount.toLocaleString('en-PH', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  });
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
 * Get next sequential receipt number from database: PMT26-0001, PMT26-0002, etc.
 * Queries the receipts table to get count and generates next number
 */
export async function getNextReceiptNumber(supabaseClient: any): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2); // "26" for 2026
  
  const { data, error } = supabaseClient
    .from("receipts")
    .select("id", { count: "exact" });
  
  const count = (data?.length || 0) + 1;
  const sequence = count.toString().padStart(4, "0");
  return `PMT${year}-${sequence}`;
}

export function printTableAsHTML(title: string, headers: string[], rows: string[][]): void {
  const thCells = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const trRows = rows.map((row) =>
    `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`
  ).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body{font-family:sans-serif;font-size:12px;margin:24px}
  h2{margin:0 0 12px;font-size:15px}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #d1d5db;padding:6px 10px;text-align:left}
  th{background:#f1f5f9;font-weight:600}
  tr:nth-child(even){background:#f8fafc}
  @media print{body{margin:0}}
</style></head><body>
<h2>${escapeHtml(title)}</h2>
<table><thead><tr>${thCells}</tr></thead><tbody>${trRows}</tbody></table>
</body></html>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}

export function renderTemplate(template: string, data: Record<string, any>) {
  let html = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\$\\{${key}\\}`, "g");
    html = html.replace(regex, escapeHtml(String(value ?? "")));
  }
  return html;
}