/**
 * Invoice and Receipt Document Generators
 * Consistent design with all other document types (Prescription, Certificate, Referral)
 */

import { supabase } from "./supabaseClient";
import { formatMoney } from "./helpers";
import { buildDocHeaderHTML, buildPatientRowHTML, buildPageCSS, buildMolarisFooterHTML, DOC_ACCENT, DOC_TH, DOC_TD, DOC_TABLE_WRAP } from "./documentUtils";

function formatDateDocument(isoDate: string): string {
  if (!isoDate) return "—";
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

async function fetchClinicProfile() {
  const { data: profiles } = await supabase
    .from("clinic_profile")
    .select("*")
    .limit(1);
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

/**
 * Generate invoice HTML document
 */
export async function generateInvoiceDocument(
  invoiceId: string,
  patientName: string,
  invoiceNumber: string,
  invoiceDate: string,
): Promise<string> {
  try {
    const [clinicProfile, invoiceResult, itemsResult] = await Promise.all([
      fetchClinicProfile(),
      supabase.from("invoices").select("*").eq("id", invoiceId).single(),
      supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId),
    ]);

    if (invoiceResult.error) throw invoiceResult.error;
    if (itemsResult.error) throw itemsResult.error;

    const invoiceData = invoiceResult.data as any;
    const itemsList = (itemsResult.data || []) as any[];

    // Fetch patient metadata directly
    let patientAge: number | undefined;
    let patientGender: string | undefined;
    let patientAddress: string | undefined;
    if (invoiceData.patient_id) {
      const { data: pat } = await supabase
        .from("patients")
        .select("birth_date, gender, address")
        .eq("id", invoiceData.patient_id)
        .single();
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
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoiceNumber}</title>
  <style>${buildPageCSS()}</style>
</head>
<body>
<div class="page">
  ${buildDocHeaderHTML(clinicProfile, invoiceNumber)}

  <div style="text-align:center;font-size:22px;font-weight:bold;color:${DOC_ACCENT};margin-bottom:14px;letter-spacing:0.04em;">INVOICE</div>

  ${buildPatientRowHTML(patientName, patientAge, patientGender, patientAddress)}

  <div style="font-size:9px;color:#666;margin-bottom:10px;">Invoice Date: ${invoiceDate}</div>

  <div style="${DOC_TABLE_WRAP}">
  <table style="width:100%;border-collapse:collapse;font-size:11px;">
    <colgroup>
      <col style="width:50%"><col style="width:10%"><col style="width:20%"><col style="width:20%">
    </colgroup>
    <thead>
      <tr>
        <th style="${DOC_TH}">Description</th>
        <th style="${DOC_TH}text-align:center;">Qty</th>
        <th style="${DOC_TH}text-align:right;">Unit Price</th>
        <th style="${DOC_TH}text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemsList.map((item) => `
      <tr>
        <td style="${DOC_TD}">${item.service_name || "—"}</td>
        <td style="${DOC_TD}text-align:center;">${item.qty || 1}</td>
        <td style="${DOC_TD}text-align:right;">${formatMoney(item.unit_price || 0)}</td>
        <td style="${DOC_TD}text-align:right;">${formatMoney(item.line_total || 0)}</td>
      </tr>`).join("")}
      <tr>
        <td colspan="3" style="${DOC_TD}font-weight:bold;background:#e8edf7;color:${DOC_ACCENT};">Total Amount</td>
        <td style="${DOC_TD}text-align:right;font-weight:bold;background:#e8edf7;color:${DOC_ACCENT};">${formatMoney(invoiceData.total || 0)}</td>
      </tr>
    </tbody>
  </table>
  </div>

  ${buildMolarisFooterHTML(new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }))}
</div>
</body>
</html>`;
  } catch (error) {
    console.error("[generateInvoiceDocument] Error:", error);
    throw error;
  }
}

/**
 * Generate payment receipt HTML document
 */
export async function generatePaymentReceiptDocument(
  paymentId: string,
  patientName: string,
  receiptNumber: string,
): Promise<string> {
  try {
    const [clinicProfile, paymentResult] = await Promise.all([
      fetchClinicProfile(),
      supabase.from("payments").select("*").eq("id", paymentId).single(),
    ]);

    if (paymentResult.error) throw paymentResult.error;

    const payment = paymentResult.data as any;

    // Fetch patient metadata directly
    let patientAge: number | undefined;
    let patientGender: string | undefined;
    let patientAddress: string | undefined;
    if (payment.patient_id) {
      const { data: pat } = await supabase
        .from("patients")
        .select("birth_date, gender, address")
        .eq("id", payment.patient_id)
        .single();
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
    }
    const paymentDetails = payment?.details || {};
    const paymentModeName = paymentDetails.payment_mode_name || "—";
    const referenceNumber = paymentDetails.reference_number || "—";

    // Fetch linked invoice number(s) via invoice_id FK
    let invoiceRef = "—";
    if (payment.invoice_id) {
      const { data: invData } = await supabase
        .from("invoices")
        .select("invoice_number")
        .eq("id", payment.invoice_id)
        .single();
      if (invData?.invoice_number) invoiceRef = invData.invoice_number;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Receipt ${receiptNumber}</title>
  <style>
    ${buildPageCSS()}
    .detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
    .detail-full { grid-column:1/-1; }
    .detail-box { padding:6px 9px; background:#f9fafb; border:1px solid #ddd; border-radius:3px; }
    .detail-label { font-size:9px; font-weight:bold; color:${DOC_ACCENT}; margin-bottom:2px; }
    .detail-value { font-size:11px; color:#333; word-break:break-word; }
    .amount-box { border:2px solid ${DOC_ACCENT}; border-radius:6px; padding:20px; text-align:center; background:#f0f4fa; margin:18px 0; }
    .amount-label { font-size:10px; font-weight:bold; color:${DOC_ACCENT}; margin-bottom:6px; }
    .amount-value { font-size:30px; font-weight:bold; color:${DOC_ACCENT}; }
    .verified-badge { display:inline-block; background:${DOC_ACCENT}; color:white; padding:3px 12px; border-radius:12px; font-size:9px; font-weight:bold; margin-top:8px; }
  </style>
</head>
<body>
<div class="page">
  ${buildDocHeaderHTML(clinicProfile, receiptNumber)}

  <div style="text-align:center;font-size:22px;font-weight:bold;color:${DOC_ACCENT};margin-bottom:14px;letter-spacing:0.04em;">PAYMENT RECEIPT</div>

  ${buildPatientRowHTML(patientName, patientAge, patientGender, patientAddress)}

  <div class="detail-grid">
    <div class="detail-box">
      <div class="detail-label">Receipt No.</div>
      <div class="detail-value"><strong>${receiptNumber}</strong></div>
    </div>
    <div class="detail-box">
      <div class="detail-label">Date</div>
      <div class="detail-value">${formatDateDocument(payment.payment_date)}</div>
    </div>
    <div class="detail-box">
      <div class="detail-label">Payment Mode</div>
      <div class="detail-value">${paymentModeName}</div>
    </div>
    <div class="detail-box">
      <div class="detail-label">Invoice No.</div>
      <div class="detail-value">${invoiceRef}</div>
    </div>
  </div>
  ${referenceNumber !== "—" ? `<div class="detail-grid" style="margin-top:-4px;"><div class="detail-box detail-full" style="grid-column:1/-1;"><div class="detail-label">Reference Number</div><div class="detail-value">${referenceNumber}</div></div></div>` : ""}

  <div class="amount-box">
    <div class="amount-label">AMOUNT PAID</div>
    <div class="amount-value">${formatMoney(payment.amount || 0)}</div>
    <div><span class="verified-badge">✓ VERIFIED</span></div>
  </div>

  ${buildMolarisFooterHTML(new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }))}
</div>
</body>
</html>`;
  } catch (error) {
    console.error("[generatePaymentReceiptDocument] Error:", error);
    throw error;
  }
}

/**
 * Sample invoice HTML for document templates preview
 */
export async function generateInvoicePreviewHTML(): Promise<string> {
  const clinicProfile = await fetchClinicProfile();
  const sampleItems = [
    { service_name: "Oral Prophylaxis (Teeth Cleaning)", qty: 1, unit_price: 800, line_total: 800 },
    { service_name: "Tooth Extraction (Simple)", qty: 1, unit_price: 1200, line_total: 1200 },
    { service_name: "Composite Filling (Anterior)", qty: 2, unit_price: 1500, line_total: 3000 },
  ];
  const total = sampleItems.reduce((s, i) => s + i.line_total, 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice Preview</title>
  <style>${buildPageCSS()}</style>
</head>
<body>
<div class="page">
  ${buildDocHeaderHTML(clinicProfile, "INV26-0001")}
  <div style="text-align:center;font-size:22px;font-weight:bold;color:${DOC_ACCENT};margin-bottom:14px;letter-spacing:0.04em;">INVOICE</div>
  ${buildPatientRowHTML("Sample Patient", 32, "Female", "Sample Address, Kalibo, Aklan")}
  <div style="font-size:9px;color:#666;margin-bottom:10px;">Invoice Date: April 11, 2026</div>
  <div style="${DOC_TABLE_WRAP}">
  <table style="width:100%;border-collapse:collapse;font-size:11px;">
    <colgroup>
      <col style="width:50%"><col style="width:10%"><col style="width:20%"><col style="width:20%">
    </colgroup>
    <thead>
      <tr>
        <th style="${DOC_TH}">Description</th>
        <th style="${DOC_TH}text-align:center;">Qty</th>
        <th style="${DOC_TH}text-align:right;">Unit Price</th>
        <th style="${DOC_TH}text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${sampleItems.map((i) => `<tr>
        <td style="${DOC_TD}">${i.service_name}</td>
        <td style="${DOC_TD}text-align:center;">${i.qty}</td>
        <td style="${DOC_TD}text-align:right;">${formatMoney(i.unit_price)}</td>
        <td style="${DOC_TD}text-align:right;">${formatMoney(i.line_total)}</td>
      </tr>`).join("")}
      <tr>
        <td colspan="3" style="${DOC_TD}font-weight:bold;background:#e8edf7;color:${DOC_ACCENT};">Total Amount</td>
        <td style="${DOC_TD}text-align:right;font-weight:bold;background:#e8edf7;color:${DOC_ACCENT};">${formatMoney(total)}</td>
      </tr>
    </tbody>
  </table>
  </div>
  ${buildMolarisFooterHTML(new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }))}
</div>
</body>
</html>`;
}

/**
 * Sample receipt HTML for document templates preview
 */
export async function generateReceiptPreviewHTML(): Promise<string> {
  const clinicProfile = await fetchClinicProfile();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Receipt Preview</title>
  <style>
    ${buildPageCSS()}
    .detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
    .detail-box { padding:6px 9px; background:#f9fafb; border:1px solid #ddd; border-radius:3px; }
    .detail-label { font-size:9px; font-weight:bold; color:${DOC_ACCENT}; margin-bottom:2px; }
    .detail-value { font-size:11px; color:#333; word-break:break-word; }
    .amount-box { border:2px solid ${DOC_ACCENT}; border-radius:6px; padding:20px; text-align:center; background:#f0f4fa; margin:18px 0; }
    .amount-label { font-size:10px; font-weight:bold; color:${DOC_ACCENT}; margin-bottom:6px; }
    .amount-value { font-size:30px; font-weight:bold; color:${DOC_ACCENT}; }
    .verified-badge { display:inline-block; background:${DOC_ACCENT}; color:white; padding:3px 12px; border-radius:12px; font-size:9px; font-weight:bold; margin-top:8px; }
  </style>
</head>
<body>
<div class="page">
  ${buildDocHeaderHTML(clinicProfile, "OR26-0001")}
  <div style="text-align:center;font-size:22px;font-weight:bold;color:${DOC_ACCENT};margin-bottom:14px;letter-spacing:0.04em;">PAYMENT RECEIPT</div>
  ${buildPatientRowHTML("Sample Patient", 32, "Female", "Sample Address, Kalibo, Aklan")}
  <div class="detail-grid">
    <div class="detail-box"><div class="detail-label">Receipt No.</div><div class="detail-value"><strong>OR26-0001</strong></div></div>
    <div class="detail-box"><div class="detail-label">Date</div><div class="detail-value">April 11, 2026</div></div>
    <div class="detail-box"><div class="detail-label">Payment Mode</div><div class="detail-value">GCash</div></div>
    <div class="detail-box"><div class="detail-label">Reference Number</div><div class="detail-value">GC-2026-0000-1234</div></div>
  </div>
  <div class="amount-box">
    <div class="amount-label">AMOUNT PAID</div>
    <div class="amount-value">${formatMoney(5000)}</div>
    <div><span class="verified-badge">✓ VERIFIED</span></div>
  </div>
  ${buildMolarisFooterHTML(new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }))}
</div>
</body>
</html>`;
}
