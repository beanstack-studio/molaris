import { buildDocHeaderHTML, buildPageCSS, DOC_ACCENT } from "./documentUtils";
import { formatDateStandard } from "./helpers";

export interface PatientRecordData {
  patientName: string;
  firstName?: string | null;
  lastName?: string | null;
  birthDate?: string | null;
  age?: number | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  occupation?: string | null;
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
    <td style="padding:4px 8px;font-size:9px;font-weight:bold;color:#666;white-space:nowrap;width:110px;">${label}</td>
    <td style="padding:4px 8px;font-size:10px;color:#333;">${value || "—"}</td>
  </tr>`;
}

function sectionTitle(title: string): string {
  return `<div style="font-size:9px;font-weight:bold;color:${DOC_ACCENT};text-transform:uppercase;letter-spacing:0.06em;margin:14px 0 6px;padding-bottom:3px;border-bottom:1px solid ${DOC_ACCENT};">${title}</div>`;
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
    occupation,
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
          <td style="padding:0;" colspan="2">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="width:50%;vertical-align:top;">
                  <table style="width:100%;border-collapse:collapse;">
                    ${infoRow("Full Name", patientName)}
                    ${infoRow("Date of Birth", birthLabel)}
                    ${infoRow("Gender", genderLabel)}
                    ${infoRow("Phone", phone || "—")}
                  </table>
                </td>
                <td style="width:50%;vertical-align:top;border-left:1px solid #eee;">
                  <table style="width:100%;border-collapse:collapse;">
                    ${infoRow("Email", email || "—")}
                    ${infoRow("Occupation", occupation || "—")}
                    ${infoRow("Address", address || "—")}
                    ${notes ? infoRow("Notes", notes) : ""}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
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

  // ── Dental chart ──
  let chartHTML = "";
  const hasChart = chartEntries.length > 0 || toothStatuses.length > 0;
  if (hasChart) {
    const statusRows = toothStatuses
      .sort((a, b) => a.tooth_number - b.tooth_number)
      .map(
        (ts) =>
          `<tr>
            <td style="padding:3px 7px;font-size:10px;border-bottom:1px solid #f0f0f0;">${ts.tooth_number}</td>
            <td style="padding:3px 7px;font-size:10px;border-bottom:1px solid #f0f0f0;font-weight:bold;">${ts.status}</td>
            <td style="padding:3px 7px;font-size:10px;border-bottom:1px solid #f0f0f0;color:#666;">${ts.note || "—"}</td>
          </tr>`
      )
      .join("");

    const chartRows = chartEntries
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
      .map(
        (ce) =>
          `<tr>
            <td style="padding:3px 7px;font-size:10px;border-bottom:1px solid #f0f0f0;">${formatDateStandard(ce.recorded_at.split("T")[0])}</td>
            <td style="padding:3px 7px;font-size:10px;border-bottom:1px solid #f0f0f0;">${ce.tooth_number}${ce.surfaces ? ` (${ce.surfaces})` : ""}</td>
            <td style="padding:3px 7px;font-size:10px;border-bottom:1px solid #f0f0f0;font-weight:bold;">${ce.finding_code}</td>
            <td style="padding:3px 7px;font-size:10px;border-bottom:1px solid #f0f0f0;color:#666;">${ce.finding_detail || ce.notes || "—"}</td>
          </tr>`
      )
      .join("");

    chartHTML = `
      ${sectionTitle("Dental Chart")}
      ${
        toothStatuses.length > 0
          ? `<div style="font-size:9px;font-weight:bold;color:#888;margin-bottom:4px;">Tooth Status</div>
          <table style="width:100%;border-collapse:collapse;background:#fafafa;border:1px solid #eee;border-radius:3px;margin-bottom:10px;">
            <thead>
              <tr style="background:#f0f0f0;">
                <th style="padding:4px 7px;font-size:9px;text-align:left;font-weight:bold;color:#555;">Tooth</th>
                <th style="padding:4px 7px;font-size:9px;text-align:left;font-weight:bold;color:#555;">Status</th>
                <th style="padding:4px 7px;font-size:9px;text-align:left;font-weight:bold;color:#555;">Note</th>
              </tr>
            </thead>
            <tbody>${statusRows}</tbody>
          </table>`
          : ""
      }
      ${
        chartEntries.length > 0
          ? `<div style="font-size:9px;font-weight:bold;color:#888;margin-bottom:4px;">Chart Findings</div>
          <table style="width:100%;border-collapse:collapse;background:#fafafa;border:1px solid #eee;border-radius:3px;">
            <thead>
              <tr style="background:#f0f0f0;">
                <th style="padding:4px 7px;font-size:9px;text-align:left;font-weight:bold;color:#555;">Date</th>
                <th style="padding:4px 7px;font-size:9px;text-align:left;font-weight:bold;color:#555;">Tooth</th>
                <th style="padding:4px 7px;font-size:9px;text-align:left;font-weight:bold;color:#555;">Code</th>
                <th style="padding:4px 7px;font-size:9px;text-align:left;font-weight:bold;color:#555;">Detail</th>
              </tr>
            </thead>
            <tbody>${chartRows}</tbody>
          </table>`
          : ""
      }`;
  }

  // ── Treatment history ──
  let treatmentsHTML = "";
  if (treatments.length > 0) {
    // Group by date
    const byDate: Record<string, typeof treatments> = {};
    for (const t of treatments) {
      if (!byDate[t.treatment_date]) byDate[t.treatment_date] = [];
      byDate[t.treatment_date].push(t);
    }
    const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

    const visitBlocks = dates
      .map((date) => {
        const rows = byDate[date];
        const dentist = rows[0]?.dentist_name || "";
        const concern = rows[0]?.visit_concern || "";
        const procedureRows = rows
          .map(
            (tx) =>
              `<tr>
                <td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #f0f0f0;">${tx.procedure}</td>
                <td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #f0f0f0;color:#888;">${tx.tooth_number ? `Tooth ${tx.tooth_number}` : "—"}</td>
                <td style="padding:3px 8px;font-size:10px;border-bottom:1px solid #f0f0f0;color:#888;font-style:italic;">${tx.notes || ""}</td>
              </tr>`
          )
          .join("");

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
      })
      .join("");

    treatmentsHTML = `
      ${sectionTitle(`Treatment History (${dates.length} visit${dates.length !== 1 ? "s" : ""}, ${treatments.length} procedure${treatments.length !== 1 ? "s" : ""})`)}
      ${visitBlocks}`;
  }

  // ── Footer ──
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
  ${chartHTML}
  ${treatmentsHTML}
  ${footerHTML}
</div></body></html>`;
}
