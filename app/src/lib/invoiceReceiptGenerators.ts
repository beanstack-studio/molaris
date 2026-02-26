/**
 * Invoice and Receipt Document Generators
 * Creates HTML representations of invoices and payment receipts for printing/viewing
 */

import { supabase } from "./supabaseClient";

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
    // Fetch invoice and its items
    const { data: invoiceData, error: invError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (invError) throw invError;

    const { data: items, error: itemsError } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId);

    if (itemsError) throw itemsError;

    const itemsList = items || [];

    // Build HTML document
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoiceNumber}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: white;
      padding: 20px;
      margin: 0;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #000;
      padding-bottom: 20px;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 24px;
    }
    .header .subtitle {
      font-size: 12px;
      color: #666;
      margin-bottom: 10px;
    }
    .disclaimer {
      background-color: #fff3cd;
      border: 1px solid #ffc107;
      padding: 10px;
      margin: 20px 0;
      border-radius: 4px;
      font-size: 12px;
      color: #856404;
    }
    .invoice-details {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      gap: 20px;
    }
    .invoice-details div {
      flex: 1;
    }
    .invoice-details label {
      font-weight: bold;
      font-size: 12px;
      color: #666;
    }
    .invoice-details p {
      margin: 0;
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    th {
      background-color: #f3f4f6;
      border: 1px solid #d1d5db;
      padding: 10px;
      text-align: left;
      font-weight: bold;
      font-size: 13px;
    }
    td {
      border: 1px solid #d1d5db;
      padding: 10px;
      font-size: 13px;
    }
    tr:nth-child(even) {
      background-color: #f9fafb;
    }
    .amount-cell {
      text-align: right;
    }
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 30px;
    }
    .totals-section table {
      width: 300px;
      margin: 0;
    }
    .totals-section td {
      padding: 8px 10px;
    }
    .total-row {
      font-weight: bold;
      background-color: #e5e7eb;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #d1d5db;
      padding-top: 20px;
      margin-top: 40px;
    }
    @media print {
      body {
        padding: 0;
      }
      .print-btn {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>INVOICE</h1>
    <div class="subtitle">Internal Document (Non-BIR)</div>
  </div>

  <div class="disclaimer">
    <strong>⚠ Disclaimer:</strong> This is an internal clinic invoice and is not a BIR-registered official receipt/invoice. 
    For tax purposes, please request an official BIR receipt if required.
  </div>

  <div class="invoice-details">
    <div>
      <label>Invoice Number:</label>
      <p><strong>${invoiceNumber}</strong></p>
    </div>
    <div>
      <label>Invoice Date:</label>
      <p>${invoiceDate}</p>
    </div>
    <div>
      <label>Patient:</label>
      <p>${patientName || "—"}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align: right;">Quantity</th>
        <th style="text-align: right;">Unit Price</th>
        <th style="text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemsList
        .map((item: any) => {
          const qty = item.qty || 1;
          const unitPrice = item.unit_price || 0;
          const total = item.line_total || qty * unitPrice;
          return `
        <tr>
          <td>${item.description || item.service_name || "Service"}</td>
          <td style="text-align: right;">${qty}</td>
          <td style="text-align: right;">₱${unitPrice.toFixed(2)}</td>
          <td style="text-align: right;">₱${total.toFixed(2)}</td>
        </tr>
      `;
        })
        .join("")}
    </tbody>
  </table>

  <div class="totals-section">
    <table>
      <tr>
        <td>Total:</td>
        <td class="amount-cell"><strong>₱${(invoiceData?.total || 0).toFixed(2)}</strong></td>
      </tr>
    </table>
  </div>

  <div class="footer">
    <p>Generated on ${new Date().toLocaleString("en-PH")}</p>
    <p>This is a system-generated document. Please keep for your records.</p>
  </div>

  <button class="print-btn" onclick="window.print()" style="padding: 10px 20px; margin: 20px; cursor: pointer;">
    🖨 Print
  </button>
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
    // Fetch payment data (without joining payment_modes - data is in details JSONB)
    const { data: payment, error: payError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (payError) throw payError;

    // Extract payment mode from details JSONB field
    const paymentDetails = (payment as any)?.details || {};
    const paymentModeName = paymentDetails.payment_mode_name || "—";
    const referenceNumber = paymentDetails.reference_number || "—";

    // Build HTML document
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt ${receiptNumber}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: white;
      padding: 20px;
      margin: 0;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #000;
      padding-bottom: 20px;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 24px;
    }
    .header .subtitle {
      font-size: 12px;
      color: #666;
      margin-bottom: 10px;
    }
    .disclaimer {
      background-color: #d1fae5;
      border: 1px solid #10b981;
      padding: 10px;
      margin: 20px 0;
      border-radius: 4px;
      font-size: 12px;
      color: #047857;
    }
    .receipt-details {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      gap: 20px;
    }
    .receipt-details div {
      flex: 1;
    }
    .receipt-details label {
      font-weight: bold;
      font-size: 12px;
      color: #666;
    }
    .receipt-details p {
      margin: 0;
      font-size: 14px;
    }
    .amount-box {
      border: 2px solid #000;
      padding: 20px;
      text-align: center;
      margin: 30px 0;
      background-color: #f3f4f6;
    }
    .amount-box label {
      display: block;
      font-size: 12px;
      color: #666;
      margin-bottom: 5px;
    }
    .amount-box .amount {
      font-size: 28px;
      font-weight: bold;
      color: #10b981;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #d1d5db;
      padding-top: 20px;
      margin-top: 40px;
    }
    @media print {
      body {
        padding: 0;
      }
      .print-btn {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>PAYMENT RECEIPT</h1>
    <div class="subtitle">Official Payment Record</div>
  </div>

  <div class="disclaimer">
    <strong>✓ Payment Confirmed:</strong> This receipt acknowledges that payment has been received and verified by the clinic.
  </div>

  <div class="receipt-details">
    <div>
      <label>Receipt Number:</label>
      <p><strong>${receiptNumber}</strong></p>
    </div>
    <div>
      <label>Payment Date:</label>
      <p>${new Date(payment.payment_date).toLocaleDateString("en-PH")}</p>
    </div>
    <div>
      <label>Patient:</label>
      <p>${patientName || "—"}</p>
    </div>
  </div>

  <div className="receipt-details">
    <div>
      <label>Payment Mode:</label>
      <p>${paymentModeName}</p>
    </div>
    <div>
      <label>Reference Number:</label>
      <p>${referenceNumber}</p>
    </div>
    <div>
      <label>Status:</label>
      <p><strong style="color: #10b981;">✓ VERIFIED</strong></p>
    </div>
  </div>

  <div class="amount-box">
    <label>Amount Paid:</label>
    <div class="amount">₱${(payment.amount || 0).toFixed(2)}</div>
  </div>

  <div class="footer">
    <p>Generated on ${new Date().toLocaleString("en-PH")}</p>
    <p>Please keep this receipt for your records.</p>
  </div>

  <button class="print-btn" onclick="window.print()" style="padding: 10px 20px; margin: 20px; cursor: pointer;">
    🖨 Print
  </button>
</body>
</html>`;

    return html;
  } catch (error) {
    console.error("[generatePaymentReceiptDocument] Error:", error);
    throw error;
  }
}

/**
 * Open HTML document in new tab
 */
export function openDocumentInNewTab(html: string, title: string = "Document") {
  const w = window.open("", "", "width=900,height=700");
  if (w) {
    w.document.write(html);
    w.document.title = title;
    w.document.close();
  }
}
