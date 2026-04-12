export interface PrescriptionData {
  patientName: string;
  patientAge?: number;
  patientAddress?: string;
  patientGender?: string;
  visitDate: string;
  dentistName: string;
  medications: Array<{
    medication: string;
    dosage?: string;
    duration?: string;
    instructions?: string;
  }>;
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
 * Generate prescription HTML (full A4 page)
 */
export function generatePrescriptionHTML(data: PrescriptionData): string {
  const {
    patientName,
    patientAge,
    patientAddress,
    patientGender,
    visitDate,
    dentistName,
    medications,
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
  <title>Prescription - ${docNo}</title>
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
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 2px solid #2c5aa0;
    }
    
    .logo-section {
      flex: 0 0 auto;
    }
    
    .logo-placeholder {
      width: 60px;
      height: 60px;
      background: #f0f0f0;
      border: 1px dashed #ccc;
    }
    
    .clinic-info {
      flex: 1;
      text-align: center;
      margin-left: 15px;
    }
    
    .clinic-name {
      font-size: 16px;
      font-weight: bold;
      color: #2c5aa0;
      margin-bottom: 2px;
    }
    
    .clinic-subtitle {
      font-size: 11px;
      color: #666;
      margin-bottom: 3px;
    }
    
    .clinic-address {
      font-size: 9px;
      color: #666;
      line-height: 1.3;
    }
    
    .right-section {
      flex: 0 0 auto;
      text-align: right;
      font-size: 9px;
    }
    
    .lic-ptr {
      margin-bottom: 5px;
    }
    
    .doc-no {
      font-weight: bold;
      color: #2c5aa0;
      font-size: 10px;
    }
    
    .divider {
      border-top: 1px solid #2c5aa0;
      margin: 12px 0;
    }
    
    .patient-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 12px;
      font-size: 10px;
    }
    
    .patient-field {
      padding: 4px;
      border: 1px solid #ddd;
      background: #fafafa;
    }
    
    .patient-field-label {
      font-weight: bold;
      color: #2c5aa0;
      font-size: 9px;
    }
    
    .patient-field-value {
      color: #333;
      margin-top: 2px;
      word-wrap: break-word;
    }
    
    .rx-section {
      margin: 12px 0;
    }
    
    .rx-header {
      font-size: 18px;
      font-weight: bold;
      color: #000;
      margin-bottom: 8px;
      text-align: center;
    }
    
    .medication-item {
      padding: 8px;
      margin-bottom: 6px;
      background: #f9f9f9;
      border: 1px solid #ddd;
      border-radius: 3px;
      font-size: 10px;
    }
    
    .medication-text {
      line-height: 1.4;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    .dosage-duration {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      font-size: 9px;
      margin-bottom: 6px;
    }
    
    .dosage-duration-item {
      padding: 4px;
      border: 1px solid #ddd;
      background: #fafafa;
    }
    
    .dosage-duration-label {
      font-weight: bold;
      color: #2c5aa0;
    }
    
    .dosage-duration-value {
      color: #333;
      margin-top: 2px;
    }
    
    .remarks-section {
      margin: 10px 0;
    }
    
    .remarks-label {
      font-size: 10px;
      font-weight: bold;
      color: #2c5aa0;
      margin-bottom: 4px;
    }
    
    .remarks-text {
      font-size: 9px;
      padding: 6px;
      background: #fffacd;
      border: 1px solid #f0f0a0;
      border-radius: 3px;
      line-height: 1.3;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    .footer {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px dashed #ccc;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      font-size: 9px;
    }
    
    .signature-line {
      text-align: center;
    }
    
    .blank-line {
      height: 40px;
      border-bottom: 1px solid #000;
      margin-top: 8px;
    }
    
    .signature-label {
      margin-top: 4px;
      font-weight: bold;
      color: #2c5aa0;
    }
    
    .date-issued {
      text-align: right;
      font-size: 9px;
      margin-top: 10px;
      color: #666;
    }
    
    @media print {
      body {
        background: white;
      }
      .page {
        margin: 0;
        box-shadow: none;
        page-break-after: always;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div class="logo-section">
        ${clinicMeta.logoUrl
          ? `<img src="${clinicMeta.logoUrl}" style="width:60px;height:60px;object-fit:contain;" alt="Clinic Logo">`
          : `<div class="logo-placeholder"></div>`}
      </div>
      <div class="clinic-info">
        <div class="clinic-name">${clinicMeta.name || "Dental Clinic"}</div>
        <div class="clinic-subtitle">GENERAL DENTISTRY &amp; ORTHODONTICS</div>
        <div class="clinic-address">
          ${clinicMeta.address || ""}${clinicMeta.contact ? `<br>${clinicMeta.contact}` : ""}
        </div>
      </div>
      <div class="right-section">
        <div class="lic-ptr">
          <div>Lic. No. ${clinicMeta.licenseNo || "___________"}</div>
          <div>PTR No. ${clinicMeta.ptrNo || "___________"}</div>
        </div>
        <div class="doc-no">${docNo}</div>
      </div>
    </div>

    <div class="divider"></div>

    <!-- Patient Information -->
    <div class="patient-info">
      <div class="patient-field">
        <div class="patient-field-label">Pt. Name</div>
        <div class="patient-field-value">${patientName || "_______________"}</div>
      </div>
      <div class="patient-field">
        <div class="patient-field-label">Age / Sex</div>
        <div class="patient-field-value">${
          patientAge ? patientAge : "___"
        } / ${patientGender?.charAt(0) || "_"}</div>
      </div>
      <div class="patient-field" style="grid-column: 1 / -1;">
        <div class="patient-field-label">Address</div>
        <div class="patient-field-value">${padRight(patientAddress || "_______________", 50)}</div>
      </div>
    </div>

    <div class="divider"></div>

    <!-- Prescription Section -->
    <div class="rx-section">
      <div class="rx-header">℞</div>
      
      ${
        Array.isArray(medications) && medications.length > 0
          ? medications
              .map(
                (med, index) => `
      <div class="medication-item">
        <div style="display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: start;">
          <div style="overflow: hidden;">
            <strong style="color: #2c5aa0;">${index + 1}. ${med.medication || "Medication"}</strong>
          </div>
          ${med.dosage ? `<div style="font-size: 9px; padding: 2px 4px; background: #f0f0f0; border-radius: 2px;"><strong>Dosage:</strong> ${med.dosage}</div>` : ""}
          ${med.duration ? `<div style="font-size: 9px; padding: 2px 4px; background: #f0f0f0; border-radius: 2px;"><strong>Duration:</strong> ${med.duration}</div>` : ""}
        </div>
        ${med.instructions ? `<div style="font-size: 9px; margin-top: 4px; padding: 4px; background: #f5f5f5; border-left: 2px solid #2c5aa0;"><em>${med.instructions}</em></div>` : ""}
      </div>
      `
              )
              .join("")
          : `
      <div class="medication-item">
        <div class="medication-text">1. [Medication]\n2. [Medication]\n3. [Medication]</div>
      </div>
      `
      }
    </div>

    ${
      remarks
        ? `
    <div class="remarks-section">
      <div class="remarks-label">Patient Instructions</div>
      <div class="remarks-text">${remarks}</div>
    </div>
    `
        : ""
    }

    <!-- Footer -->
    <div class="footer">
      <div class="signature-line">
        <div class="blank-line"></div>
        <div class="signature-label">${dentistName || "Dentist Signature"}</div>
      </div>
      <div class="signature-line">
        <div class="blank-line"></div>
        <div class="signature-label">Date: ${formattedDate}</div>
      </div>
    </div>

    <div class="date-issued">Issued: ${formattedDate}</div>
  </div>
</body>
</html>
  `;
}

function padRight(str: string, length: number): string {
  return str + " ".repeat(Math.max(0, length - str.length));
}
