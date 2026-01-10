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

export function num(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

export function todayLocalISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatPHPhoneVisible(input: string) {
  const digits = (input || "").replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";

  const p1 = digits.slice(0, 4);
  const p2 = digits.slice(4, 7);
  const p3 = digits.slice(7, 11);

  if (digits.length <= 4) return p1;
  if (digits.length <= 7) return `${p1} ${p2}`;
  return `${p1} ${p2} ${p3}`;
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

export function generateReceiptNo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RCPT-${y}${m}${d}-${rand}`;
}

export function safeFileName(name: string) {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 120);
}

export function parseToothOrNull(v: string) {
  const n = v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
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
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}

export function renderTemplate(template: string, data: Record<string, any>) {
  let html = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\$\\{${key}\\}`, "g");
    html = html.replace(regex, escapeHtml(String(value ?? "")));
  }
  return html;
}