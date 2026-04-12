import { buildDocHeaderHTML, buildPatientRowHTML, buildSignatureHTML, buildPageCSS, DOC_ACCENT } from "./documentUtils";

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

export function generateReferralHTML(data: ReferralData): string {
  const {
    patientName, patientAge, patientAddress, patientGender,
    visitDate, dentistName, reason, clinic, doctor, remarks,
    docNo, clinicMeta = {},
  } = data;

  const dateObj = new Date(visitDate + "T00:00:00Z");
  const formattedDate = dateObj.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const doctorLastName = doctor?.trim().split(" ").pop() || "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Referral Letter - ${docNo}</title>
  <style>${buildPageCSS()}</style>
</head>
<body>
<div class="page">
  ${buildDocHeaderHTML(clinicMeta, docNo)}

  <div style="text-align:center;font-size:22px;font-weight:bold;color:${DOC_ACCENT};text-decoration:underline;margin-bottom:16px;letter-spacing:0.04em;">REFERRAL LETTER</div>

  <div style="text-align:right;font-size:11px;color:#555;margin-bottom:16px;">${formattedDate}</div>

  <div style="font-size:11px;line-height:1.8;margin-bottom:16px;">
    <div><strong style="color:${DOC_ACCENT};">To:</strong></div>
    <div style="padding-left:12px;">
      <div>${doctor ? `Dr. ${doctor}` : "_______________"}</div>
      <div style="color:#555;">${clinic || "_______________"}</div>
    </div>
  </div>

  <div style="font-size:11px;margin-bottom:14px;">Dear Dr. ${doctorLastName || "_______________"},</div>

  <p style="font-size:11px;line-height:1.8;margin-bottom:14px;">
    I am hereby referring the above-named patient to your clinic for further evaluation and specialized treatment.
  </p>

  ${buildPatientRowHTML(patientName, patientAge, patientGender, patientAddress)}

  ${reason ? `<div class="section-title">Reason for Referral</div><div class="section-body">${reason}</div>` : ""}

  ${remarks ? `
  <div class="section-title">Clinical Notes</div>
  <div class="section-body">${remarks}</div>` : ""}

  <p style="font-size:11px;line-height:1.8;margin-top:14px;">
    I would greatly appreciate your assessment and recommendations regarding this patient.<br>
    Thank you for your attention to this referral.
  </p>

  <hr class="divider" style="margin-top:30px;">
  <div style="margin-top:20px;">
    ${buildSignatureHTML(dentistName, clinicMeta.licenseNo, clinicMeta.ptrNo)}
  </div>
</div>
</body>
</html>`;
}
