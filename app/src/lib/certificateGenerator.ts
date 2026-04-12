import { buildDocHeaderHTML, buildPatientRowHTML, buildSignatureHTML, buildPageCSS, DOC_ACCENT } from "./documentUtils";

export interface CertificateData {
  patientName: string;
  patientAge?: number;
  patientAddress?: string;
  patientGender?: string;
  visitDate: string;
  dentistName: string;
  findings: string;
  treatmentDone: string;
  purpose?: string;
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

export function generateCertificateHTML(data: CertificateData): string {
  const {
    patientName, patientAge, patientAddress, patientGender,
    visitDate, dentistName, findings, treatmentDone, purpose, remarks,
    docNo, clinicMeta = {},
  } = data;

  const dateObj = new Date(visitDate + "T00:00:00Z");
  const formattedDate = dateObj.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const purposeStatement = purpose
    ? ` for the purpose of <strong>${purpose}</strong>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Dental Certificate - ${docNo}</title>
  <style>${buildPageCSS()}</style>
</head>
<body>
<div class="page">
  ${buildDocHeaderHTML(clinicMeta, docNo)}

  <div style="text-align:center;font-size:22px;font-weight:bold;color:${DOC_ACCENT};text-decoration:underline;margin-bottom:16px;letter-spacing:0.04em;">DENTAL CERTIFICATE</div>

  ${buildPatientRowHTML(patientName, patientAge, patientGender, patientAddress)}

  <!-- Examination row -->
  <div style="display:grid;grid-template-columns:1fr 1fr;border:1px solid #ddd;border-radius:3px;margin-bottom:14px;">
    <div style="padding:6px 9px;border-right:1px solid #ddd;">
      <div style="font-size:9px;font-weight:bold;color:${DOC_ACCENT};">Date of Examination</div>
      <div style="font-size:11px;margin-top:2px;">${formattedDate}</div>
    </div>
    <div style="padding:6px 9px;">
      <div style="font-size:9px;font-weight:bold;color:${DOC_ACCENT};">Examined By</div>
      <div style="font-size:11px;margin-top:2px;">${dentistName || "—"}</div>
    </div>
  </div>

  <hr class="divider">

  <p style="font-size:11px;line-height:1.8;margin-bottom:14px;">
    This is to certify that the above-named patient was examined by the undersigned dentist${purposeStatement}.
  </p>

  ${findings ? `<div class="section-title">Clinical Findings</div><div class="section-body">${findings}</div>` : ""}

  ${treatmentDone ? `<div class="section-title">Treatment Done</div><div class="section-body">${treatmentDone}</div>` : ""}

  ${remarks ? `<div class="section-title">Remarks</div><div class="section-body">${remarks}</div>` : ""}

  <hr class="divider" style="margin-top:30px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:20px;">
    ${buildSignatureHTML(dentistName, clinicMeta.licenseNo, clinicMeta.ptrNo)}
    <div>
      <div style="height:50px;border-bottom:1px solid #333;width:180px;"></div>
      <div style="font-size:11px;font-weight:bold;color:${DOC_ACCENT};margin-top:5px;">Parent / Guardian</div>
      <div style="font-size:9px;color:#666;margin-top:2px;">(if patient is a minor)</div>
    </div>
  </div>
  <div style="text-align:right;font-size:10px;color:#666;margin-top:12px;">Date: ${formattedDate}</div>
</div>
</body>
</html>`;
}
