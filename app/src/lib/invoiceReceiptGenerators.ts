/**
 * Invoice and Receipt Document Generators
 * Creates HTML representations of invoices and payment receipts for printing/viewing
 */

import { supabase } from "./supabaseClient";
import { formatMoney } from "./helpers";

/**
 * Format date consistently across documents
 * Example: "February 24, 2026" (matches prescription/certificate/referral format)
 */
function formatDateDocument(isoDate: string): string {
  if (!isoDate) return "—";
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
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

  const addressParts = [
    profile.street_address,
    profile.city,
    profile.province,
  ].filter(Boolean);
  const address = addressParts.join(", ");

  const phones: Array<{ type: string; number: string }> = profile.phones || [];
  const contact = phones.map((p) => p.number).join(" / ");

  return {
    name: profile.clinic_name || "Dental Clinic",
    address,
    contact,
    logoUrl: profile.logo_url || null,
  };
}

function buildDocHeader(opts: {
  name: string;
  address: string;
  contact: string;
  logoUrl: string | null;
  docTitle: string;
  accentColor: string;
}): string {
  const logoHtml = opts.logoUrl
    ? `<img src="${opts.logoUrl}" style="width:60px;height:60px;object-fit:contain;" alt="Clinic Logo">`
    : `<div style="width:60px;height:60px;background:#f0f0f0;border:1px dashed #ccc;"></div>`;

  return `
    <div style="display:flex;align-items:flex-start;gap:16px;padding-bottom:14px;border-bottom:3px solid ${opts.accentColor};margin-bottom:18px;">
      <div style="flex:0 0 auto;">${logoHtml}</div>
      <div style="flex:1;text-align:center;">
        <div style="font-size:18px;font-weight:bold;color:${opts.accentColor};">${opts.name}</div>
        <div style="font-size:11px;color:#666;margin-top:3px;">${opts.address}</div>
        ${opts.contact ? `<div style="font-size:11px;color:#666;margin-top:2px;">${opts.contact}</div>` : ""}
      </div>
      <div style="flex:0 0 auto;text-align:right;">
        <div style="font-size:18px;font-weight:bold;color:${opts.accentColor};">${opts.docTitle}</div>
      </div>
    </div>
  `;
}

/**
 * Generate invoice HTML document
 */
export async function generateInvoiceDocument(
  invoiceId: string,
  patientName: string,
  invoiceNumber: string,
  invoiceDate: string
): Promise<string> {
  try {
    const [clinicProfile, invoiceResult, itemsResult] = await Promise.all([
      fetchClinicProfile(),
      supabase.from("invoices").select("*").eq("id", invoiceId).single(),
      supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId),
    ]);

    if (invoiceResult.error) throw invoiceResult.error;
    if (itemsResult.error) throw itemsResult.error;

    const invoiceData = invoiceResult.data;
    const itemsList = itemsResult.data || [];
    const accentColor = "#2c5aa0";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #333; background: #f5f5f5; }
    .page {
      width: 8.5in;
      min-height: 11in;
      background: white;
      margin: 20px auto;
      padding: 0.6in 0.75in;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }
    .meta-box {
      padding: 8px 10px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
    }
    .meta-label { font-size: 9px; font-weight: bold; color: ${accentColor}; margin-bottom: 2px; }
    .meta-value { font-size: 11px; color: #333; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10px; }
    th {
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      padding: 8px;
      text-align: left;
      font-weight: bold;
      color: ${accentColor};
    }
    td { border: 1px solid #d1d5db; padding: 6px 8px; }
    tr:nth-child(even) { background: #f9fafb; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .total-row { font-weight: bold; background: #e5e7eb !important; }
    .footer {
      text-align: center;
      font-size: 9px;
      color: #666;
      border-top: 1px solid #d1d5db;
      padding-top: 12px;
      margin-top: 20px;
    }
    @media print {
      body { background: white; }
      .page { margin: 0; box-shadow: none; padding: 0.5in; }
      @page { size: letter; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    ${buildDocHeader({ ...clinicProfile, docTitle: "INVOICE", accentColor })}

    <div class="meta-grid">
      <div class="meta-box">
        <div class="meta-label">Invoice No.</div>
        <div class="meta-value"><strong>${invoiceNumber}</strong></div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Invoice Date</div>
        <div class="meta-value">${invoiceDate}</div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Patient</div>
        <div class="meta-value">${patientName || "—"}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-center">Qty</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsList
          .map(
            (item: any) => `
        <tr>
          <td>${item.service_name || "—"}</td>
          <td class="text-center">${item.qty || 1}</td>
          <td class="text-right">${formatMoney(item.unit_price || 0)}</td>
          <td class="text-right">${formatMoney(item.line_total || 0)}</td>
        </tr>`
          )
          .join("")}
        <tr class="total-row">
          <td colspan="3">Total Amount</td>
          <td class="text-right">${formatMoney(invoiceData.total || 0)}</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <p>Thank you for your trust in our services.</p>
      <p style="margin-top:6px;font-size:8px;">This is a computer-generated document. Please retain for your records.</p>
    </div>
  </div>
</body>
</html>`;

    return html;
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
  receiptNumber: string
): Promise<string> {
  try {
    const [clinicProfile, paymentResult] = await Promise.all([
      fetchClinicProfile(),
      supabase.from("payments").select("*").eq("id", paymentId).single(),
    ]);

    if (paymentResult.error) throw paymentResult.error;

    const payment = paymentResult.data as any;
    const paymentDetails = payment?.details || {};
    const paymentModeName = paymentDetails.payment_mode_name || "—";
    const referenceNumber = paymentDetails.reference_number || "—";
    const accentColor = "#059669";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Receipt ${receiptNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #333; background: #f5f5f5; }
    .page {
      width: 8.5in;
      min-height: 11in;
      background: white;
      margin: 20px auto;
      padding: 0.6in 0.75in;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }
    .meta-grid-full { grid-column: 1 / -1; }
    .meta-box {
      padding: 8px 10px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 4px;
    }
    .meta-label { font-size: 9px; font-weight: bold; color: ${accentColor}; margin-bottom: 2px; }
    .meta-value { font-size: 11px; color: #333; word-break: break-word; }
    .amount-box {
      border: 2px solid ${accentColor};
      border-radius: 6px;
      padding: 18px;
      text-align: center;
      background: #f0fdf4;
      margin: 20px 0;
    }
    .amount-label { font-size: 10px; font-weight: bold; color: ${accentColor}; margin-bottom: 6px; }
    .amount-value { font-size: 28px; font-weight: bold; color: ${accentColor}; }
    .verified-badge {
      display: inline-block;
      background: ${accentColor};
      color: white;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 9px;
      font-weight: bold;
      margin-top: 8px;
    }
    .footer {
      text-align: center;
      font-size: 9px;
      color: #666;
      border-top: 1px solid #d1d5db;
      padding-top: 12px;
      margin-top: 20px;
    }
    @media print {
      body { background: white; }
      .page { margin: 0; box-shadow: none; padding: 0.5in; }
      @page { size: letter; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    ${buildDocHeader({ ...clinicProfile, docTitle: "PAYMENT RECEIPT", accentColor })}

    <div class="meta-grid">
      <div class="meta-box">
        <div class="meta-label">Receipt No.</div>
        <div class="meta-value"><strong>${receiptNumber}</strong></div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Date</div>
        <div class="meta-value">${formatDateDocument(payment.payment_date)}</div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Patient</div>
        <div class="meta-value">${patientName || "—"}</div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Payment Mode</div>
        <div class="meta-value">${paymentModeName}</div>
      </div>
      <div class="meta-box meta-grid-full">
        <div class="meta-label">Reference Number</div>
        <div class="meta-value">${referenceNumber}</div>
      </div>
    </div>

    <div class="amount-box">
      <div class="amount-label">AMOUNT PAID</div>
      <div class="amount-value">${formatMoney(payment.amount || 0)}</div>
      <div><span class="verified-badge">✓ VERIFIED</span></div>
    </div>

    <div class="footer">
      <p>Generated: ${new Date().toLocaleString("en-PH")}</p>
      <p style="margin-top:5px;">Please keep this receipt for your records.</p>
    </div>
  </div>
</body>
</html>`;

    return html;
  } catch (error) {
    console.error("[generatePaymentReceiptDocument] Error:", error);
    throw error;
  }
}
