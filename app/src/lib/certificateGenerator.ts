import { buildDocHeaderHTML, buildPatientRowHTML, buildSignatureHTML, buildPageCSS, buildMolarisFooterHTML, DOC_ACCENT } from "./documentUtils";

export interface CertificateData {
  patientName: string;
  patientAge?: number;
  patientAddress?: string;
  patientGender?: string;
  visitDate: string;
  dentistName: string;
  findings: string | string[];
  treatmentDone: string | string[];
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

function renderLines(val: string | string[] | null | undefined): string {
  if (!val) return "";
  const items = Array.isArray(val) ? val.filter(Boolean) : [val].filter(Boolean);
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return items.map((item) => `• ${item}`).join("\n");
}

export function generateCertificateHTML(data: CertificateData): string {
  const {
    patientName, patientAge, patientAddress, patientGender,
    visitDate, dentistName, purpose, remarks,
    docNo, clinicMeta = {},
  } = data;
  const findings = renderLines(data.findings);
  const treatmentDone = renderLines(data.treatmentDone);

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
  <div style="margin-top:20px;">
    ${buildSignatureHTML(dentistName, clinicMeta.licenseNo, clinicMeta.ptrNo)}
  </div>
  ${buildMolarisFooterHTML(new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }))}
</div>
</body>
</html>`;
}
