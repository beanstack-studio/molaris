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
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Arial', sans-serif;
      color: #333;
      background: #f5f5f5;
    }
    
    .page {
      width: 8.27in;
      height: 11.69in;
      background: white;
      margin: 20px auto;
      padding: 25px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      page-break-after: always;
    }
    
    .header {
      text-align: center;
      margin-bottom: 25px;
      padding-bottom: 15px;
      border-bottom: 2px solid #2c5aa0;
    }
    
    .header h1 {
      margin: 0 0 8px 0;
      font-size: 20px;
      color: #2c5aa0;
      font-weight: bold;
    }
    
    .header .subtitle {
      font-size: 11px;
      color: #666;
      margin-bottom: 5px;
    }
    
    .disclaimer {
      background-color: #fff3cd;
      border: 1px solid #ffc107;
      padding: 8px;
      margin: 15px 0;
      border-radius: 3px;
      font-size: 10px;
      color: #856404;
    }
    
    .invoice-details {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 15px;
      margin-bottom: 20px;
      font-size: 10px;
    }
    
    .invoice-details-item {
      padding: 8px;
      background: #f9fafb;
      border: 1px solid #d1d5db;
    }
    
    .invoice-details-label {
      font-weight: bold;
      color: #2c5aa0;
      font-size: 9px;
      margin-bottom: 2px;
    }
    
    .invoice-details-value {
      color: #333;
      font-size: 11px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 10px;
    }
    
    th {
      background-color: #f3f4f6;
      border: 1px solid #d1d5db;
      padding: 8px;
      text-align: left;
      font-weight: bold;
      font-size: 10px;
      color: #2c5aa0;
    }
    
    td {
      border: 1px solid #d1d5db;
      padding: 6px 8px;
      font-size: 10px;
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
      margin: 15px 0;
    }
    
    .totals-table {
      width: 250px;
      margin: 0;
    }
    
    .totals-table td {
      padding: 6px 8px;
      font-size: 10px;
    }
    
    .totals-table td:first-child {
      border: 1px solid #d1d5db;
    }
    
    .totals-table td:last-child {
      border: 1px solid #d1d5db;
      text-align: right;
    }
    
    .total-row {
      font-weight: bold;
      background-color: #e5e7eb;
    }
    
    .total-row td {
      border: 1px solid #999 !important;
    }
    
    .footer {
      text-align: center;
      font-size: 9px;
      color: #666;
      border-top: 1px solid #d1d5db;
      padding-top: 15px;
      margin-top: 20px;
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .page {
        margin: 0;
        box-shadow: none;
        padding: 20px;
      }
      
      @page {
        margin: 0;
        size: A4;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>INVOICE</h1>
      <div class="subtitle">MATIRA DENTAL STUDIO</div>
    </div>
    
    <div class="disclaimer">
      <strong>Invoice #${invoiceNumber}</strong> | Date: ${new Date(invoiceData.created_at || new Date()).toLocaleDateString("en-PH")}
    </div>
    
    <div class="invoice-details">
      <div class="invoice-details-item">
        <div class="invoice-details-label">Patient Name</div>
        <div class="invoice-details-value">${patientName || "—"}</div>
      </div>
      <div class="invoice-details-item">
        <div class="invoice-details-label">Invoice Date</div>
        <div class="invoice-details-value">${invoiceDate}</div>
      </div>
      <div class="invoice-details-item">
        <div class="invoice-details-label">Invoice No</div>
        <div class="invoice-details-value">${invoiceNumber}</div>
      </div>
    </div>
    
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th class="amount-cell">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsList
          .map(
            (item: { service_name?: string; quantity?: number; unit_price?: number; amount?: number }) => `
        <tr>
          <td>${item.service_name || "—"}</td>
          <td style="text-align: center;">${item.quantity || 1}</td>
          <td class="amount-cell">₱${(item.unit_price || 0).toFixed(2)}</td>
          <td class="amount-cell">₱${(item.amount || 0).toFixed(2)}</td>
        </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
    
    <div class="totals-section">
      <table class="totals-table">
        <tr>
          <td>Subtotal:</td>
          <td>₱${(invoiceData.subtotal || 0).toFixed(2)}</td>
        </tr>
        <tr>
          <td>Tax/Discount:</td>
          <td>₱${(invoiceData.tax || 0).toFixed(2)}</td>
        </tr>
        <tr class="total-row">
          <td>Total Amount:</td>
          <td>₱${(invoiceData.total_amount || 0).toFixed(2)}</td>
        </tr>
      </table>
    </div>
    
    <div class="footer">
      <p>Thank you for your business!</p>
      <p style="margin-top: 10px; font-size: 8px;">This is a computer-generated document. Please retain for your records.</p>
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
    // Fetch payment data (without joining payment_modes - data is in details JSONB)
    const { data: payment, error: payError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (payError) throw payError;

    // Extract payment mode from details JSONB field
    const paymentDetails = (payment as { details?: { payment_mode_name?: string; reference_number?: string } })?.details || {};
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
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Arial', sans-serif;
      color: #333;
      background: #f5f5f5;
    }
    
    .page {
      width: 5.83in;
      height: 8.27in;
      background: white;
      margin: 20px auto;
      padding: 15px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      page-break-after: always;
    }
    
    .header {
      text-align: center;
      margin-bottom: 15px;
      padding-bottom: 12px;
      border-bottom: 2px solid #10b981;
    }
    
    .header h1 {
      margin: 0 0 5px 0;
      font-size: 16px;
      color: #10b981;
      font-weight: bold;
    }
    
    .header .subtitle {
      font-size: 10px;
      color: #666;
    }
    
    .disclaimer {
      background-color: #d1fae5;
      border: 1px solid #10b981;
      padding: 8px;
      margin: 12px 0;
      border-radius: 3px;
      font-size: 9px;
      color: #047857;
    }
    
    .receipt-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 12px;
      font-size: 9px;
    }
    
    .receipt-details-item {
      padding: 6px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
    }
    
    .receipt-details-label {
      font-weight: bold;
      color: #10b981;
      font-size: 8px;
      margin-bottom: 2px;
    }
    
    .receipt-details-value {
      color: #333;
      font-size: 10px;
      word-break: break-word;
    }
    
    .amount-box {
      border: 2px solid #10b981;
      padding: 12px;
      text-align: center;
      margin: 12px 0;
      background-color: #f0fdf4;
    }
    
    .amount-box-label {
      display: block;
      font-size: 9px;
      color: #047857;
      margin-bottom: 4px;
      font-weight: bold;
    }
    
    .amount-box-value {
      font-size: 22px;
      font-weight: bold;
      color: #10b981;
    }
    
    .footer {
      text-align: center;
      font-size: 8px;
      color: #666;
      border-top: 1px solid #d1d5db;
      padding-top: 10px;
      margin-top: 12px;
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .page {
        margin: 0;
        box-shadow: none;
        padding: 12px;
      }
      
      @page {
        margin: 0;
        size: A5;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>PAYMENT RECEIPT</h1>
      <div class="subtitle">Official Payment Record</div>
    </div>
    
    <div class="disclaimer">
      <strong>✓ Payment Confirmed</strong> — Payment verified by clinic
    </div>
    
    <div class="receipt-details">
      <div class="receipt-details-item">
        <div class="receipt-details-label">Receipt No</div>
        <div class="receipt-details-value"><strong>${receiptNumber}</strong></div>
      </div>
      <div class="receipt-details-item">
        <div class="receipt-details-label">Date</div>
        <div class="receipt-details-value">${new Date(payment.payment_date).toLocaleDateString("en-PH")}</div>
      </div>
      <div class="receipt-details-item">
        <div class="receipt-details-label">Patient</div>
        <div class="receipt-details-value">${patientName || "—"}</div>
      </div>
      <div class="receipt-details-item">
        <div class="receipt-details-label">Status</div>
        <div class="receipt-details-value"><strong style="color: #10b981;">✓ VERIFIED</strong></div>
      </div>
    </div>
    
    <div class="receipt-details" style="margin-top: 10px;">
      <div class="receipt-details-item" style="grid-column: 1 / -1;">
        <div class="receipt-details-label">Payment Mode</div>
        <div class="receipt-details-value">${paymentModeName}</div>
      </div>
      <div class="receipt-details-item" style="grid-column: 1 / -1;">
        <div class="receipt-details-label">Reference Number</div>
        <div class="receipt-details-value">${referenceNumber}</div>
      </div>
    </div>
    
    <div class="amount-box">
      <span class="amount-box-label">Amount Paid</span>
      <div class="amount-box-value">₱${(payment.amount || 0).toFixed(2)}</div>
    </div>
    
    <div class="footer">
      <p>Generated: ${new Date().toLocaleString("en-PH")}</p>
      <p style="margin-top: 5px;">Please keep for your records</p>
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

