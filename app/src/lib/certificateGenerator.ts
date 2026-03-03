/**
 * Dental Certificate HTML Generator
 * Professional A4 dental certificate
 */

export interface CertificateData {
  patientName: string;
  patientAge?: number;
  patientAddress?: string;
  patientGender?: string;
  visitDate: string;
  dentistName: string;
  findings: string;
  treatmentDone: string;
  remarks?: string;
  docNo: string;
  clinicMeta?: {
    name?: string;
    address?: string;
    contact?: string;
    licenseNo?: string;
    ptrNo?: string;
  };
}

/**
 * Generate dental certificate HTML (full A4 page)
 */
export function generateCertificateHTML(data: CertificateData): string {
  const {
    patientName,
    patientAge,
    patientAddress,
    patientGender,
    visitDate,
    dentistName,
    findings,
    treatmentDone,
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
  <title>Dental Certificate - ${docNo}</title>
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
    
    .certificate-title {
      text-align: center;
      font-size: 24px;
      font-weight: bold;
      color: #2c5aa0;
      margin: 30px 0 20px 0;
      text-decoration: underline;
    }
    
    .certificate-body {
      font-size: 12px;
      line-height: 1.8;
      margin: 20px 0;
    }
    
    .section-title {
      font-weight: bold;
      color: #2c5aa0;
      margin-top: 15px;
      margin-bottom: 8px;
      font-size: 11px;
    }
    
    .section-content {
      padding-left: 15px;
      font-size: 11px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-wrap: break-word;
      margin-bottom: 12px;
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
    
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px dashed #ccc;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      font-size: 10px;
    }
    
    .signature-section {
      text-align: center;
    }
    
    .signature-line {
      height: 40px;
      border-bottom: 1px solid #000;
      margin-bottom: 5px;
    }
    
    .signature-label {
      font-weight: bold;
      color: #2c5aa0;
      margin-top: 5px;
    }
    
    .date-line {
      text-align: right;
      margin-top: 15px;
      font-size: 10px;
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
        <div style="width: 50px; height: 50px; background: #e0e0e0; border: 2px dashed #999; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #999;">📋</div>
      </div>
      <div class="clinic-info">
        <div class="clinic-name">${clinicMeta.name || "MATIRA DENTAL STUDIO"}</div>
        <div class="clinic-subtitle">GENERAL DENTISTRY & ORTHODONTICS</div>
        <div class="clinic-address">
          ${clinicMeta.address || "Unit 5 Gandionco Building, Toting Reyes Street, Kalibo, Aklan<br>(036) 262 3207"}
        </div>
      </div>
      <div class="right-section">
        <div class="doc-no">${docNo}</div>
        <div>Lic. No. ${clinicMeta.licenseNo || "___________"}</div>
        <div>PTR No. ${clinicMeta.ptrNo || "___________"}</div>
      </div>
    </div>

    <!-- Certificate Title -->
    <div class="certificate-title">DENTAL CERTIFICATE</div>

    <!-- Patient Information -->
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
      <div class="info-field">
        <div class="info-label">Date of Examination</div>
        <div class="info-value">${formattedDate}</div>
      </div>
      <div class="info-field">
        <div class="info-label">Examined By</div>
        <div class="info-value">${dentistName || "_______________"}</div>
      </div>
    </div>

    <!-- Certificate Body -->
    <div class="certificate-body">
      <p>This is to certify that the above-named patient was examined by the undersigned dentist.</p>
    </div>

    <!-- Findings -->
    <div class="section-title">CLINICAL FINDINGS:</div>
    <div class="section-content">${findings || "[Findings]"}</div>

    <!-- Treatment Done -->
    <div class="section-title">TREATMENT DONE:</div>
    <div class="section-content">${treatmentDone || "[Treatment details]"}</div>

    ${
      remarks
        ? `
    <div class="section-title">REMARKS:</div>
    <div class="section-content">${remarks}</div>
    `
        : ""
    }

    <!-- Signature -->
    <div class="footer">
      <div class="signature-section">
        <div class="signature-line"></div>
        <div class="signature-label">${dentistName || "Dentist Signature"}</div>
      </div>
      <div class="signature-section">
        <div class="signature-line"></div>
        <div class="signature-label">Parent / Guardian (if minor)</div>
      </div>
    </div>

    <div class="date-line">Date: ${formattedDate}</div>
  </div>
</body>
</html>
  `;
}
