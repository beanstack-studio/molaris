import { buildDocHeaderHTML, buildPatientRowHTML, buildSignatureHTML, buildPageCSS, DOC_ACCENT } from "./documentUtils";

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

export function generatePrescriptionHTML(data: PrescriptionData): string {
  const {
    patientName, patientAge, patientAddress, patientGender,
    visitDate, dentistName, medications, remarks, docNo,
    clinicMeta = {},
  } = data;

  const dateObj = new Date(visitDate + "T00:00:00Z");
  const formattedDate = dateObj.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const medsHtml = Array.isArray(medications) && medications.length > 0
    ? medications.map((med, i) => `
<div style="padding:8px 10px;margin-bottom:6px;border:1px solid #ddd;border-radius:3px;background:#fafafa;">
  <div style="font-size:11px;font-weight:bold;color:${DOC_ACCENT};margin-bottom:4px;">${i + 1}. ${med.medication || "Medication"}</div>
  <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:9px;color:#555;">
    ${med.dosage ? `<span><strong>Dosage:</strong> ${med.dosage}</span>` : ""}
    ${med.duration ? `<span><strong>Duration:</strong> ${med.duration}</span>` : ""}
  </div>
  ${med.instructions ? `<div style="font-size:9px;margin-top:4px;padding:3px 6px;background:#f0f4fa;border-left:2px solid ${DOC_ACCENT};color:#444;">${med.instructions}</div>` : ""}
</div>`).join("")
    : `<div style="padding:8px 10px;border:1px solid #ddd;border-radius:3px;background:#fafafa;font-size:11px;color:#aaa;">No medications entered.</div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Prescription - ${docNo}</title>
  <style>${buildPageCSS()}</style>
</head>
<body>
<div class="page">
  ${buildDocHeaderHTML(clinicMeta, docNo)}

  <div style="text-align:center;font-size:22px;font-weight:bold;color:${DOC_ACCENT};margin-bottom:14px;letter-spacing:0.04em;">PRESCRIPTION</div>

  ${buildPatientRowHTML(patientName, patientAge, patientGender, patientAddress)}

  <div style="font-size:9px;color:#666;margin-bottom:10px;">Date: ${formattedDate}</div>

  <hr class="divider">

  <div style="font-size:28px;font-weight:bold;color:${DOC_ACCENT};margin-bottom:8px;font-style:italic;">℞</div>
  ${medsHtml}

  ${remarks ? `
  <div class="section-title">Patient Instructions</div>
  <div class="section-body">${remarks}</div>` : ""}

  <hr class="divider" style="margin-top:30px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:20px;">
    ${buildSignatureHTML(dentistName, clinicMeta.licenseNo, clinicMeta.ptrNo)}
    <div style="text-align:right;font-size:10px;color:#666;">
      <div>Date: ${formattedDate}</div>
    </div>
  </div>
</div>
</body>
</html>`;
}
