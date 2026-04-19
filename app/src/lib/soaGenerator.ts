import { supabase } from "./supabaseClient";
import { buildDocHeaderHTML, buildPatientRowHTML, buildPageCSS, buildMolarisFooterHTML, DOC_ACCENT, DOC_TBL, DOC_TH, DOC_TD, DOC_TABLE_WRAP } from "./documentUtils";
import { formatMoney } from "./helpers";

function formatDateDoc(isoDate: string): string {
  if (!isoDate) return "—";
  try {
    const d = new Date(isoDate.includes("T") ? isoDate : isoDate + "T00:00:00");
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch { return isoDate; }
}

async function fetchClinicProfile() {
  const { data: profiles } = await supabase.from("clinic_profile").select("*").limit(1);
  const profile = profiles?.[0] as any;
  if (!profile) return { name: "Dental Clinic", address: "", contact: "", logoUrl: null };
  const addressParts = [profile.street_address, profile.city, profile.province].filter(Boolean);
  const phones: Array<{ number: string }> = profile.phones || [];
  return {
    name: profile.clinic_name || "Dental Clinic",
    address: addressParts.join(", "),
    contact: phones.map((p) => p.number).join(" / "),
    logoUrl: profile.logo_url || null,
  };
}

export async function generateSOADocument(
  patientId: string,
  patientName: string,
  docNo: string,
): Promise<string> {
  const [clinicProfile, patientResult, invoicesResult, paymentsResult, receiptsResult] = await Promise.all([
    fetchClinicProfile(),
    supabase.from("patients").select("birth_date, gender, address").eq("id", patientId).single(),
    supabase.from("invoices").select("id, invoice_number, invoice_date, total, notes").eq("patient_id", patientId).order("invoice_date", { ascending: true }),
    supabase.from("payments").select("id, amount, payment_date, invoice_id, details").eq("patient_id", patientId).order("payment_date", { ascending: true }),
    supabase.from("receipts").select("payment_id, receipt_number").eq("patient_id", patientId),
  ]);

  // Patient metadata for header row
  let patientAge: number | undefined;
  let patientGender: string | undefined;
  let patientAddress: string | undefined;
  const pat = patientResult.data as any;
  if (pat) {
    if (pat.birth_date) {
      const dob = new Date(pat.birth_date);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
      patientAge = age;
    }
    patientGender = pat.gender || undefined;
    patientAddress = pat.address || undefined;
  }

  const invoices = (invoicesResult.data ?? []) as any[];
  const payments = (paymentsResult.data ?? []) as any[];
  const receipts = (receiptsResult.data ?? []) as any[];

  // Build invoice number lookup for payment descriptions
  const invNoMap: Record<string, string> = {};
  for (const inv of invoices) invNoMap[inv.id] = inv.invoice_number;

  // Build payment → receipt number lookup
  const pmtReceiptMap: Record<string, string> = {};
  for (const r of receipts) if (r.payment_id) pmtReceiptMap[r.payment_id] = r.receipt_number;

  type LedgerEntry = { date: string; ref: string; description: string; charges: number; payments: number };
  const ledger: LedgerEntry[] = [];

  for (const inv of invoices) {
    ledger.push({
      date: inv.invoice_date || "",
      ref: inv.invoice_number || "—",
      description: `Invoice${inv.notes ? ` — ${inv.notes}` : ""}`,
      charges: inv.total || 0,
      payments: 0,
    });
  }

  for (const pmt of payments) {
    const details = pmt.details || {};
    const mode = details.payment_mode_name || "Payment";
    const invRef = pmt.invoice_id && invNoMap[pmt.invoice_id] ? ` for ${invNoMap[pmt.invoice_id]}` : "";
    const receiptNo = pmtReceiptMap[pmt.id] || "—";
    ledger.push({
      date: pmt.payment_date || "",
      ref: receiptNo,
      description: `${mode}${invRef}`,
      charges: 0,
      payments: pmt.amount || 0,
    });
  }

  // Sort chronologically
  ledger.sort((a, b) => a.date.localeCompare(b.date));

  let runningBalance = 0;
  const ledgerRows = ledger.map(e => {
    runningBalance += e.charges - e.payments;
    const isCharge = e.charges > 0;
    const balColor = runningBalance > 0 ? "#b45309" : "#15803d";
    return `<tr>
      <td style="${DOC_TD}">${formatDateDoc(e.date)}</td>
      <td style="${DOC_TD}white-space:nowrap;">${e.ref}</td>
      <td style="${DOC_TD}">${e.description}</td>
      <td style="${DOC_TD}text-align:right;">${isCharge ? formatMoney(e.charges) : "—"}</td>
      <td style="${DOC_TD}text-align:right;">${!isCharge ? formatMoney(e.payments) : "—"}</td>
      <td style="${DOC_TD}text-align:right;font-weight:bold;color:${balColor};">${formatMoney(runningBalance)}</td>
    </tr>`;
  }).join("");

  const totalCharges  = ledger.reduce((s, e) => s + e.charges, 0);
  const totalPayments = ledger.reduce((s, e) => s + e.payments, 0);
  const totalBalance  = totalCharges - totalPayments;
  const balColor      = totalBalance > 0 ? "#b45309" : "#15803d";

  const generatedAt = new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Statement of Account — ${docNo}</title>
  <style>${buildPageCSS()}</style>
</head>
<body>
<div class="page">
  ${buildDocHeaderHTML(clinicProfile, docNo)}

  <div style="text-align:center;font-size:22px;font-weight:bold;color:${DOC_ACCENT};text-decoration:underline;margin-bottom:16px;letter-spacing:0.04em;">STATEMENT OF ACCOUNT</div>

  ${buildPatientRowHTML(patientName, patientAge, patientGender, patientAddress)}

  <div class="section-title">TRANSACTION HISTORY</div>
  ${ledger.length > 0 ? `
  <div style="${DOC_TABLE_WRAP}">
  <table style="${DOC_TBL}">
    <colgroup>
      <col style="width:16%"><col style="width:14%"><col style="width:22%"><col style="width:16%"><col style="width:16%"><col style="width:16%">
    </colgroup>
    <thead><tr>
      <th style="${DOC_TH}">Date</th>
      <th style="${DOC_TH}">Ref</th>
      <th style="${DOC_TH}">Description</th>
      <th style="${DOC_TH}text-align:right;">Charges</th>
      <th style="${DOC_TH}text-align:right;">Payments</th>
      <th style="${DOC_TH}text-align:right;">Balance</th>
    </tr></thead>
    <tbody>${ledgerRows}</tbody>
  </table>
  </div>` : `<div style="padding:16px;text-align:center;color:#888;font-size:11px;border:1px solid #ddd;border-radius:3px;margin-bottom:14px;">No transactions found.</div>`}

  <div style="border:1px solid #ddd;border-radius:3px;overflow:hidden;margin-bottom:14px;">
    <div style="padding:6px 9px;border-bottom:1px solid #ddd;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:9px;font-weight:bold;color:${DOC_ACCENT};">TOTAL CHARGES</span>
      <span style="font-size:11px;font-weight:bold;">${formatMoney(totalCharges)}</span>
    </div>
    <div style="padding:6px 9px;border-bottom:1px solid #ddd;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:9px;font-weight:bold;color:#15803d;">TOTAL PAYMENTS</span>
      <span style="font-size:11px;font-weight:bold;color:#15803d;">${formatMoney(totalPayments)}</span>
    </div>
    <div style="padding:8px 9px;background:#f0f4fa;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:10px;font-weight:bold;color:${DOC_ACCENT};">BALANCE DUE</span>
      <span style="font-size:15px;font-weight:bold;color:${balColor};">${formatMoney(totalBalance)}</span>
    </div>
  </div>

  ${buildMolarisFooterHTML(generatedAt)}
</div>
</body>
</html>`;
}
