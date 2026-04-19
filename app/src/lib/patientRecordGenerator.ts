import { buildDocHeaderHTML, buildPageCSS, DOC_ACCENT } from "./documentUtils";
import { formatDateStandard } from "./helpers";

export interface PatientRecordData {
  patientName: string;
  birthDate?: string | null;
  age?: number | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  medHistory?: {
    allergies?: string | null;
    medications?: string | null;
    blood_pressure?: string | null;
    conditions?: Record<string, boolean> | null;
    notes?: string | null;
  } | null;
  chartEntries?: Array<{
    tooth_number: number;
    surfaces?: string | null;
    finding_code: string;
    finding_detail?: string | null;
    notes?: string | null;
    recorded_at: string;
  }>;
  toothStatuses?: Array<{
    tooth_number: number;
    status: string;
    note?: string | null;
  }>;
  treatments?: Array<{
    treatment_date: string;
    procedure: string;
    tooth_number?: number | null;
    dentist_name?: string | null;
    visit_concern?: string | null;
    notes?: string | null;
  }>;
  docNo: string;
  generatedAt?: string;
  clinicMeta?: {
    name?: string;
    address?: string;
    contact?: string;
    logoUrl?: string | null;
  };
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:4px 8px;font-size:9px;font-weight:bold;color:#666;white-space:nowrap;width:100px;">${label}</td>
    <td style="padding:4px 8px;font-size:10px;color:#333;word-break:break-word;">${value || "—"}</td>
  </tr>`;
}

function sectionTitle(title: string): string {
  return `<div style="font-size:9px;font-weight:bold;color:${DOC_ACCENT};text-transform:uppercase;letter-spacing:0.06em;margin:14px 0 6px;padding-bottom:3px;border-bottom:1px solid ${DOC_ACCENT};">${title}</div>`;
}

// ── FDI/PH Dentition Chart ─────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  DECAYED: "#fde68a",
  CARIES: "#fde68a",
  FILLED: "#bfdbfe",
  EXTRACTED: "#fca5a5",
  MISSING: "#fca5a5",
  CROWNED: "#ddd6fe",
  CROWN: "#ddd6fe",
  IMPLANT: "#a7f3d0",
  RCT: "#fef08a",
  "ROOT CANAL": "#fef08a",
  PRESENT: "#f0fdf4",
  SOUND: "#f0fdf4",
  RETAINED: "#fed7aa",
  IMPACTED: "#e9d5ff",
};

function toothColor(statusMap: Record<number, string>, codeMap: Record<number, string>, tooth: number): string {
  const status = statusMap[tooth]?.toUpperCase();
  const code = codeMap[tooth]?.toUpperCase();
  if (status && STATUS_COLORS[status]) return STATUS_COLORS[status];
  if (code && STATUS_COLORS[code]) return STATUS_COLORS[code];
  return "#f9fafb";
}

function toothLabel(statusMap: Record<number, string>, codeMap: Record<number, string>, tooth: number): string {
  return statusMap[tooth] || codeMap[tooth] || "";
}

function toothCell(statusMap: Record<number, string>, codeMap: Record<number, string>, tooth: number, small = false): string {
  const bg = toothColor(statusMap, codeMap, tooth);
  const label = toothLabel(statusMap, codeMap, tooth);
  const size = small ? "14px" : "17px";
  const fontSize = small ? "7px" : "8px";
  const labelSize = small ? "6px" : "7px";
  return `<td style="text-align:center;padding:1px;border:1px solid #e5e7eb;">
    <div style="width:${size};height:${size};background:${bg};border-radius:2px;margin:0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:${labelSize};color:#374151;overflow:hidden;" title="${tooth}${label ? ": " + label : ""}">
      <div style="font-size:${fontSize};font-weight:bold;color:#1e3a5f;">${tooth}</div>
      ${label ? `<div style="font-size:5px;color:#555;line-height:1;overflow:hidden;max-width:${size};">${label.slice(0, 3)}</div>` : ""}
    </div>
  </td>`;
}

function buildDentitionChartHTML(
  toothStatuses: PatientRecordData["toothStatuses"],
  chartEntries: PatientRecordData["chartEntries"]
): string {
  const statusMap: Record<number, string> = {};
  const codeMap: Record<number, string> = {};

  for (const ts of toothStatuses ?? []) statusMap[ts.tooth_number] = ts.status;
  for (const ce of chartEntries ?? []) codeMap[ce.tooth_number] = codeMap[ce.tooth_number] || ce.finding_code;

  // PH FDI layout
  const upperRight = [18, 17, 16, 15, 14, 13, 12, 11];
  const upperLeft  = [21, 22, 23, 24, 25, 26, 27, 28];
  const lowerLeft  = [31, 32, 33, 34, 35, 36, 37, 38];
  const lowerRight = [48, 47, 46, 45, 44, 43, 42, 41];

  const upperPrimaryRight = [55, 54, 53, 52, 51];
  const upperPrimaryLeft  = [61, 62, 63, 64, 65];
  const lowerPrimaryLeft  = [71, 72, 73, 74, 75];
  const lowerPrimaryRight = [85, 84, 83, 82, 81];

  const divider = `<td style="width:2px;background:${DOC_ACCENT};padding:0;"></td>`;
  const spacer3 = `<td style="width:3px;"></td>`;

  const legendItems = [
    ["#fde68a", "Decayed"],
    ["#bfdbfe", "Filled"],
    ["#fca5a5", "Extracted"],
    ["#ddd6fe", "Crowned"],
    ["#a7f3d0", "Implant"],
    ["#fef08a", "RCT"],
  ];

  const legend = legendItems.map(([color, label]) =>
    `<span style="display:inline-flex;align-items:center;gap:3px;margin-right:8px;font-size:8px;color:#555;">
      <span style="display:inline-block;width:10px;height:10px;background:${color};border:1px solid #ddd;border-radius:1px;"></span>${label}
    </span>`
  ).join("");

  return `
    ${sectionTitle("Dentition Chart (FDI Notation — PH Standard)")}
    <div style="overflow-x:auto;">
      <table style="border-collapse:collapse;margin:0 auto 4px;font-size:8px;">
        <tr>
          <td style="font-size:7px;color:#888;padding-right:4px;text-align:right;vertical-align:middle;">UR</td>
          ${upperRight.map(t => toothCell(statusMap, codeMap, t)).join("")}
          ${divider}
          ${upperLeft.map(t => toothCell(statusMap, codeMap, t)).join("")}
          <td style="font-size:7px;color:#888;padding-left:4px;vertical-align:middle;">UL</td>
        </tr>
        <tr>
          <td style="font-size:7px;color:#888;padding-right:4px;text-align:right;vertical-align:middle;"></td>
          ${spacer3}${spacer3}${spacer3}
          ${upperPrimaryRight.map(t => toothCell(statusMap, codeMap, t, true)).join("")}
          ${divider}
          ${upperPrimaryLeft.map(t => toothCell(statusMap, codeMap, t, true)).join("")}
          ${spacer3}${spacer3}${spacer3}
        </tr>
        <tr><td colspan="20" style="height:3px;"></td></tr>
        <tr>
          <td style="font-size:7px;color:#888;padding-right:4px;text-align:right;vertical-align:middle;"></td>
          ${spacer3}${spacer3}${spacer3}
          ${lowerPrimaryRight.map(t => toothCell(statusMap, codeMap, t, true)).join("")}
          ${divider}
          ${lowerPrimaryLeft.map(t => toothCell(statusMap, codeMap, t, true)).join("")}
          ${spacer3}${spacer3}${spacer3}
        </tr>
        <tr>
          <td style="font-size:7px;color:#888;padding-right:4px;text-align:right;vertical-align:middle;">LR</td>
          ${lowerRight.map(t => toothCell(statusMap, codeMap, t)).join("")}
          ${divider}
          ${lowerLeft.map(t => toothCell(statusMap, codeMap, t)).join("")}
          <td style="font-size:7px;color:#888;padding-left:4px;vertical-align:middle;">LL</td>
        </tr>
      </table>
    </div>
    <div style="margin-top:4px;margin-bottom:2px;">${legend}</div>`;
}

export function generatePatientRecordHTML(data: PatientRecordData): string {
  const {
    patientName,
    birthDate,
    age,
    gender,
    phone,
    email,
    address,
    notes,
    medHistory,
    chartEntries = [],
    toothStatuses = [],
    treatments = [],
    docNo,
    generatedAt,
    clinicMeta = {},
  } = data;

  const genderLabel = gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : "—";
  const birthLabel = birthDate
    ? `${formatDateStandard(birthDate.split("T")[0])}${age != null ? ` (${age} yrs)` : ""}`
    : "—";

  // ── Patient information table ──
  const patientInfoHTML = `
    ${sectionTitle("Patient Information")}
    <table style="width:100%;border-collapse:collapse;background:#fafafa;border:1px solid #eee;border-radius:3px;">
      <tbody>
        <tr>
          <td style="padding:0;width:50%;vertical-align:top;">
            <table style="width:100%;border-collapse:collapse;">
              ${infoRow("Full Name", patientName)}
              ${infoRow("Date of Birth", birthLabel)}
              ${infoRow("Gender", genderLabel)}
            </table>
          </td>
          <td style="padding:0;width:50%;vertical-align:top;border-left:1px solid #eee;">
            <table style="width:100%;border-collapse:collapse;">
              ${infoRow("Email", email || "—")}
              ${infoRow("Phone", phone || "—")}
              ${infoRow("Address", address || "—")}
            </table>
          </td>
        </tr>
        ${notes ? `<tr><td colspan="2" style="border-top:1px solid #eee;"><table style="width:100%;border-collapse:collapse;">${infoRow("Notes", notes)}</table></td></tr>` : ""}
      </tbody>
    </table>`;

  // ── Medical history ──
  let medHistHTML = "";
  if (medHistory) {
    const conditions: string[] = medHistory.conditions
      ? Object.entries(medHistory.conditions)
          .filter(([, v]) => v === true)
          .map(([k]) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
      : [];

    medHistHTML = `
      ${sectionTitle("Medical History")}
      <table style="width:100%;border-collapse:collapse;background:#fafafa;border:1px solid #eee;border-radius:3px;">
        <tbody>
          <tr>
            <td style="width:50%;vertical-align:top;">
              <table style="width:100%;border-collapse:collapse;">
                ${infoRow("Allergies", medHistory.allergies || "None reported")}
                ${infoRow("Blood Pressure", medHistory.blood_pressure || "—")}
              </table>
            </td>
            <td style="width:50%;vertical-align:top;border-left:1px solid #eee;">
              <table style="width:100%;border-collapse:collapse;">
                ${medHistory.medications ? infoRow("Medications", medHistory.medications) : ""}
                ${conditions.length > 0 ? infoRow("Conditions", conditions.join(", ")) : ""}
                ${medHistory.notes ? infoRow("Med. Notes", medHistory.notes) : ""}
              </table>
            </td>
          </tr>
        </tbody>
      </table>`;
  }

  // ── Dentition chart ──
  const dentitionHTML = buildDentitionChartHTML(toothStatuses, chartEntries);

  // ── Treatment history ──
  let treatmentsHTML = "";
  if (treatments.length > 0) {
    const byDate: Record<string, typeof treatments> = {};
    for (const t of treatments) {
      if (!byDate[t.treatment_date]) byDate[t.treatment_date] = [];
      byDate[t.treatment_date].push(t);
    }
    const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

    const visitBlocks = dates.map((date) => {
      const rows = byDate[date];
      const dentist = rows[0]?.dentist_name || "";
      const concern = rows[0]?.visit_concern || "";
      const procedureRows = rows.map((tx) =>
        `<tr>
          <td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #f0f0f0;">${tx.procedure}</td>
          <td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #f0f0f0;color:#888;">${tx.tooth_number ? `Tooth ${tx.tooth_number}` : "—"}</td>
          <td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #f0f0f0;color:#888;font-style:italic;">${tx.notes || ""}</td>
        </tr>`
      ).join("");

      return `<div style="margin-bottom:8px;border:1px solid #e8e8e8;border-radius:3px;overflow:hidden;">
        <div style="background:#f0f0f0;padding:5px 8px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10px;font-weight:bold;color:#333;">${formatDateStandard(date)}</span>
          ${dentist ? `<span style="font-size:9px;color:#666;">${dentist}</span>` : ""}
        </div>
        ${concern ? `<div style="background:#ede9fe;padding:3px 8px;font-size:9px;color:#5b21b6;font-style:italic;">Concern: ${concern}</div>` : ""}
        <table style="width:100%;border-collapse:collapse;background:white;">
          <thead>
            <tr style="background:#fafafa;">
              <th style="padding:3px 8px;font-size:9px;text-align:left;font-weight:bold;color:#555;">Procedure</th>
              <th style="padding:3px 8px;font-size:9px;text-align:left;font-weight:bold;color:#555;width:80px;">Tooth</th>
              <th style="padding:3px 8px;font-size:9px;text-align:left;font-weight:bold;color:#555;">Notes</th>
            </tr>
          </thead>
          <tbody>${procedureRows}</tbody>
        </table>
      </div>`;
    }).join("");

    treatmentsHTML = `
      ${sectionTitle(`Treatment History (${dates.length} visit${dates.length !== 1 ? "s" : ""}, ${treatments.length} procedure${treatments.length !== 1 ? "s" : ""})`)}
      ${visitBlocks}`;
  }

  const footerHTML = `
    <div style="margin-top:24px;padding-top:10px;border-top:1px solid #e0e0e0;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:8px;color:#bbb;">Powered by <strong>MOLARIS</strong> · BeanStack Studio</span>
      <span style="font-size:8px;color:#bbb;">Confidential — for clinical use only</span>
    </div>`;

  const printedLabel = generatedAt
    ? `<div style="font-size:9px;color:#888;margin-top:2px;">Generated ${generatedAt}</div>`
    : "";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Patient Record — ${patientName}</title><style>${buildPageCSS()}</style></head><body><div class="page">
  ${buildDocHeaderHTML(clinicMeta, docNo)}
  <div style="text-align:center;margin-bottom:10px;">
    <div style="font-size:13px;font-weight:bold;color:${DOC_ACCENT};">PATIENT RECORD</div>
    ${printedLabel}
  </div>
  ${patientInfoHTML}
  ${medHistHTML}
  ${dentitionHTML}
  ${treatmentsHTML}
  ${footerHTML}
</div></body></html>`;
}
