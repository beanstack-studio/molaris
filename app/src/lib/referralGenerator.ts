/**
 * Referral Letter HTML Generator
 * Professional A4 referral letter
 */

export interface ReferralData {
  patientName: string;
  patientAge?: number;
  patientAddress?: string;
  patientGender?: string;
  visitDate: string;
  dentistName: string;
  reason: string;
  clinic: string;
  doctor: string;
  remarks?: string;
  docNo: string;
  clinicMeta?: {
    name?: string;
    address?: string;
    contact?: string;
    logoUrl?: string | null;
    licenseNo?: string;
    ptrNo?: string;
  };
}

/**
 * Generate referral letter HTML (full A4 page)
 */
export function generateReferralHTML(data: ReferralData): string {
  const {
    patientName,
    patientAge,
    patientAddress,
    patientGender,
    visitDate,
    dentistName,
    reason,
    clinic,
    doctor,
    remarks,
    docNo,
    clinicMeta = {},
  } = data;

  // Format date
  const dateObj = new Date(visitDate + "T00:00:00Z");
  const formattedDate = dateObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Referral Letter - ${docNo}</title>
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
      width: 8.5in;
      min-height: 11in;
      background: white;
      margin: 20px auto;
      padding: 0.6in 0.75in;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      page-break-after: always;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 3px solid #2c5aa0;
    }
    
    .clinic-info {
      flex: 1;
      text-align: center;
      margin: 0 15px;
    }
    
    .clinic-name {
      font-size: 18px;
      font-weight: bold;
      color: #2c5aa0;
      margin-bottom: 3px;
    }
    
    .clinic-subtitle {
      font-size: 12px;
      color: #666;
      margin-bottom: 5px;
    }
    
    .clinic-address {
      font-size: 10px;
      color: #666;
      line-height: 1.4;
    }
    
    .right-section {
      flex: 0 0 auto;
      text-align: right;
      font-size: 9px;
    }
    
    .doc-no {
      font-weight: bold;
      color: #2c5aa0;
      font-size: 11px;
      margin-bottom: 8px;
    }
    
    .letter-date {
      text-align: right;
      font-size: 11px;
      margin-bottom: 20px;
      margin-top: 10px;
    }
    
    .referral-to {
      font-size: 11px;
      line-height: 1.8;
      margin-bottom: 20px;
    }
    
    .referral-to-label {
      font-weight: bold;
      color: #2c5aa0;
    }
    
    .salutation {
      font-size: 12px;
      margin-bottom: 15px;
    }
    
    .letter-body {
      font-size: 11px;
      line-height: 1.8;
      margin: 15px 0;
    }
    
    .section-title {
      font-weight: bold;
      color: #2c5aa0;
      margin-top: 12px;
      margin-bottom: 6px;
      font-size: 11px;
    }
    
    .section-content {
      padding-left: 15px;
      font-size: 11px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-wrap: break-word;
      margin-bottom: 10px;
    }
    
    .patient-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin: 15px 0;
      font-size: 11px;
    }
    
    .info-field {
      padding: 6px;
      border: 1px solid #ddd;
      background: #fafafa;
    }
    
    .info-label {
      font-weight: bold;
      color: #2c5aa0;
      font-size: 10px;
    }
    
    .info-value {
      color: #333;
      margin-top: 3px;
      word-wrap: break-word;
    }
    
    .closing {
      margin-top: 20px;
      font-size: 11px;
    }
    
    .signature-section {
      margin-top: 30px;
      text-align: left;
    }
    
    .signature-line {
      height: 40px;
      border-bottom: 1px solid #000;
      width: 200px;
      margin-bottom: 5px;
    }
    
    .signature-label {
      font-weight: bold;
      color: #2c5aa0;
      margin-top: 5px;
      font-size: 11px;
    }
    
    @media print {
      body {
        background: white;
      }
      .page {
        margin: 0;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div style="flex: 0 0 auto;">
        ${clinicMeta.logoUrl
          ? `<img src="${clinicMeta.logoUrl}" style="width:60px;height:60px;object-fit:contain;" alt="Clinic Logo">`
          : `<div style="width:60px;height:60px;background:#f0f0f0;border:1px dashed #ccc;"></div>`}
      </div>
      <div class="clinic-info">
        <div class="clinic-name">${clinicMeta.name || "Dental Clinic"}</div>
        <div class="clinic-subtitle">GENERAL DENTISTRY &amp; ORTHODONTICS</div>
        <div class="clinic-address">
          ${clinicMeta.address || ""}${clinicMeta.contact ? `<br>${clinicMeta.contact}` : ""}
        </div>
      </div>
      <div class="right-section">
        <div class="doc-no">${docNo}</div>
        ${clinicMeta.licenseNo ? `<div>Lic. No. ${clinicMeta.licenseNo}</div>` : ""}
        ${clinicMeta.ptrNo ? `<div>PTR No. ${clinicMeta.ptrNo}</div>` : ""}
      </div>
    </div>

    <!-- Date -->
    <div class="letter-date">${formattedDate}</div>

    <!-- Referral To -->
    <div class="referral-to">
      <div class="referral-to-label">To:</div>
      <div style="margin-top: 4px;">Dr. ${doctor || "_______________"}</div>
      <div>${clinic || "_______________"}</div>
    </div>

    <!-- Salutation -->
    <div class="salutation">Dear Dr. ${doctor?.split(" ").pop() || "_______________"},</div>

    <!-- Letter Body -->
    <div class="letter-body">
      <p>I am hereby referring the above-named patient to your clinic for further evaluation and specialized treatment.</p>
    </div>

    <!-- Patient Information -->
    <div class="section-title">PATIENT INFORMATION:</div>
    <div class="patient-info">
      <div class="info-field">
        <div class="info-label">Patient Name</div>
        <div class="info-value">${patientName || "_______________"}</div>
      </div>
      <div class="info-field">
        <div class="info-label">Age / Sex</div>
        <div class="info-value">${patientAge ? patientAge : "___"} / ${patientGender?.charAt(0) || "_"}</div>
      </div>
      <div class="info-field" style="grid-column: 1 / -1;">
        <div class="info-label">Address</div>
        <div class="info-value">${patientAddress || "_______________"}</div>
      </div>
    </div>

    <!-- Reason for Referral -->
    <div class="section-title">REASON FOR REFERRAL:</div>
    <div class="section-content">${reason || "[Reason for referral]"}</div>

    ${
      remarks
        ? `
    <div class="section-title">CLINICAL NOTES:</div>
    <div class="section-content">${remarks}</div>
    `
        : ""
    }

    <!-- Closing -->
    <div class="closing">
      <p>I would greatly appreciate your assessment and recommendations regarding this patient.</p>
      <p>Thank you for your attention to this referral.</p>
    </div>

    <!-- Signature -->
    <div class="signature-section">
      <div class="signature-line"></div>
      <div class="signature-label">${dentistName || "Dentist Signature"}</div>
      <div style="margin-top: 3px; font-size: 10px; color: #666;">${dentistName || "Dentist Name"}</div>
    </div>
  </div>
</body>
</html>
  `;
}
