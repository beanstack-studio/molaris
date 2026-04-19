import { buildDocHeaderHTML, buildPatientRowHTML, buildPageCSS, DOC_ACCENT } from "./documentUtils";
import { formatDateStandard } from "./helpers";

export interface PatientRecordSections {
  info?: boolean;
  medicalHistory?: boolean;
  toothChart?: boolean;
  chartFindings?: boolean;
  treatments?: boolean;
  selectedVisitDates?: string[] | null; // null = all
}

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
    updated_at?: string | null;
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

// ── Status colours — matches ToothChart.tsx web app colors ────────────────
const STATUS_COLORS: Record<string, string> = {
  DECAYED: "#fca5a5", CARIES: "#fca5a5",       // rose-300
  FILLED: "#86efac",                             // emerald-300
  EXTRACTED: "#fed7aa",                          // orange-300
  MISSING: "#e2e8f0",                            // slate-200
  CROWNED: "#fcd34d", CROWN: "#fcd34d",          // amber-300
  IMPLANT: "#a5f3fc",                            // cyan-300
  RCT: "#c4b5fd", "ROOT CANAL": "#c4b5fd",      // violet-300
  DENTURE: "#e2e8f0",                            // slate-200
  PRESENT: "#f1f5f9", SOUND: "#f1f5f9", HEALTHY: "#f1f5f9",  // slate-100
  RETAINED: "#fed7aa", IMPACTED: "#e9d5ff",
};

function toothBg(statusMap: Record<number, string>, codeMap: Record<number, string>, n: number) {
  const s = statusMap[n]?.toUpperCase();
  const c = codeMap[n]?.toUpperCase();
  return (s && STATUS_COLORS[s]) || (c && STATUS_COLORS[c]) || "#f9fafb";
}

function toothShort(statusMap: Record<number, string>, codeMap: Record<number, string>, n: number) {
  return (statusMap[n] || codeMap[n] || "").slice(0, 4);
}

function cell(statusMap: Record<number, string>, codeMap: Record<number, string>, n: number, sm = false) {
  const bg = toothBg(statusMap, codeMap, n);
  const lbl = toothShort(statusMap, codeMap, n);
  const sz = sm ? "26px" : "36px";
  const fsNum = sm ? "7" : "9";
  const fsLbl = sm ? "6" : "7";
  return `<td style="padding:2px;border:none;">
    <div style="width:${sz};height:${sz};background:${bg};border:1px solid #d1d5db;border-radius:3px;display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto;" title="${n}${lbl ? ": " + lbl : ""}">
      <div style="font-size:${fsNum}px;font-weight:bold;color:#1e3a5f;line-height:1;">${n}</div>
      ${lbl ? `<div style="font-size:${fsLbl}px;color:#555;line-height:1;">${lbl}</div>` : ""}
    </div>
  </td>`;
}

function buildDentitionChartHTML(
  statuses: PatientRecordData["toothStatuses"],
  entries: PatientRecordData["chartEntries"]
): string {
  const sm: Record<number, string> = {};
  const cm: Record<number, string> = {};
  for (const t of statuses ?? []) sm[t.tooth_number] = t.status;
  for (const e of entries ?? []) cm[e.tooth_number] = cm[e.tooth_number] || e.finding_code;

  const ur = [18,17,16,15,14,13,12,11];
  const ul = [21,22,23,24,25,26,27,28];
  const lr = [48,47,46,45,44,43,42,41];
  const ll = [31,32,33,34,35,36,37,38];
  const pur = [55,54,53,52,51];
  const pul = [61,62,63,64,65];
  const plr = [85,84,83,82,81];
  const pll = [71,72,73,74,75];

  // Vertical midline (3px) — present in EVERY row so the line is unbroken
  const mid = `<td style="width:3px;padding:0;background:#b8cce8;"></td>`;
  const sp3 = `<td></td>`;  // spacer cells — takes remaining space in fixed layout

  // subLabel: 3-cell structure keeps mid column continuous
  const subLabel = (text: string) =>
    `<tr>
      <td colspan="8" style="text-align:center;font-size:9px;color:#888;padding:3px 0;">${text}</td>
      ${mid}
      <td colspan="8"></td>
    </tr>`;

  // Horizontal separator: full-width 3px fill — same thickness as mid column width
  const hSep = `<tr>
    <td colspan="8" style="height:3px;padding:0;background:#b8cce8;border:none;"></td>
    <td style="width:3px;height:3px;padding:0;background:#b8cce8;"></td>
    <td colspan="8" style="height:3px;padding:0;background:#b8cce8;border:none;"></td>
  </tr>`;

  // Section labels live OUTSIDE the table so they don't interrupt the vertical line
  const secLabelStyle = `text-align:center;font-size:9px;font-weight:bold;color:${DOC_ACCENT};letter-spacing:0.06em;text-transform:uppercase;padding:4px 0 2px;`;

  const legend = [
    ["#fca5a5","Caries"],["#86efac","Filled"],["#e2e8f0","Missing"],["#fed7aa","Extracted"],
    ["#fcd34d","Crown"],["#c4b5fd","RCT"],["#a5f3fc","Implant"],["#e9d5ff","Impacted"],
  ].map(([c, l]) =>
    `<span style="display:inline-flex;align-items:center;gap:3px;margin-right:8px;font-size:8px;color:#555;white-space:nowrap;">
      <span style="display:inline-block;width:9px;height:9px;background:${c};border:1px solid #ddd;border-radius:1px;flex-shrink:0;"></span>${l}
    </span>`
  ).join("");

  return `<div style="margin-bottom:4px;">
  <div style="${secLabelStyle}">UPPER DENTITION</div>
  <table style="border-collapse:collapse;width:100%;table-layout:fixed;">
    ${subLabel("Primary")}
    <tr>
      ${sp3}${sp3}${sp3}
      ${pur.map(n => cell(sm, cm, n, true)).join("")}
      ${mid}
      ${pul.map(n => cell(sm, cm, n, true)).join("")}
      ${sp3}${sp3}${sp3}
    </tr>
    ${subLabel("Permanent")}
    <tr>
      ${ur.map(n => cell(sm, cm, n)).join("")}
      ${mid}
      ${ul.map(n => cell(sm, cm, n)).join("")}
    </tr>
    ${hSep}
    <tr>
      ${lr.map(n => cell(sm, cm, n)).join("")}
      ${mid}
      ${ll.map(n => cell(sm, cm, n)).join("")}
    </tr>
    ${subLabel("Permanent")}
    <tr>
      ${sp3}${sp3}${sp3}
      ${plr.map(n => cell(sm, cm, n, true)).join("")}
      ${mid}
      ${pll.map(n => cell(sm, cm, n, true)).join("")}
      ${sp3}${sp3}${sp3}
    </tr>
    ${subLabel("Primary")}
  </table>
  <div style="${secLabelStyle}">LOWER DENTITION</div>
</div>
<div style="margin-bottom:10px;line-height:2;">${legend}</div>`;
}

// ── Shared table styles ────────────────────────────────────────────────────
const TBL = `width:100%;border-collapse:collapse;font-size:11px;`;
const TH  = `padding:5px 8px;font-size:9px;font-weight:bold;color:${DOC_ACCENT};background:#f0f4fa;text-align:left;border-bottom:2px solid ${DOC_ACCENT};white-space:nowrap;`;
const TD  = `padding:5px 8px;border-bottom:1px solid #eee;vertical-align:top;`;
const TDG = `padding:5px 8px;border-bottom:1px solid #eee;vertical-align:top;color:#666;`;

export function generatePatientRecordHTML(
  data: PatientRecordData,
  sections: PatientRecordSections = {}
): string {
  const {
    patientName, birthDate, age, gender, phone, email, address, notes,
    medHistory, chartEntries = [], toothStatuses = [], treatments = [],
    docNo, generatedAt, clinicMeta = {},
  } = data;

  const inclInfo      = sections.info          !== false;
  const inclMed       = sections.medicalHistory !== false;
  const inclToothChart= sections.toothChart     !== false;
  const inclChartFind = sections.chartFindings  !== false;
  const inclTreat     = sections.treatments     !== false;
  const selVisits     = sections.selectedVisitDates ?? null;

  const genderLabel = gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : "—";
  const birthLabel  = birthDate ? formatDateStandard(birthDate.split("T")[0]) : "—";

  // ── Patient Information — matches dental certificate style ───────────────
  const patientInfoHTML = !inclInfo ? "" : `
<div class="section-title">PATIENT INFORMATION</div>
${buildPatientRowHTML(patientName, age ?? undefined, gender ?? undefined, address ?? undefined)}
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid #ddd;border-radius:3px;margin-bottom:14px;">
  <div style="padding:6px 9px;border-right:1px solid #ddd;">
    <div style="font-size:9px;font-weight:bold;color:${DOC_ACCENT};">Date of Birth</div>
    <div style="font-size:11px;margin-top:2px;">${birthLabel}</div>
  </div>
  <div style="padding:6px 9px;border-right:1px solid #ddd;">
    <div style="font-size:9px;font-weight:bold;color:${DOC_ACCENT};">Phone</div>
    <div style="font-size:11px;margin-top:2px;">${phone || "—"}</div>
  </div>
  <div style="padding:6px 9px;">
    <div style="font-size:9px;font-weight:bold;color:${DOC_ACCENT};">Email</div>
    <div style="font-size:11px;margin-top:2px;">${email || "—"}</div>
  </div>
</div>
${notes ? `<div style="border:1px solid #ddd;border-radius:3px;margin-bottom:14px;padding:6px 9px;"><div style="font-size:9px;font-weight:bold;color:${DOC_ACCENT};">Notes</div><div style="font-size:11px;margin-top:2px;">${notes}</div></div>` : ""}`;

  // ── Medical History ──────────────────────────────────────────────────────
  let medHistHTML = "";
  if (inclMed && medHistory) {
    const conditions: string[] = medHistory.conditions
      ? Object.entries(medHistory.conditions)
          .filter(([, v]) => v === true)
          .map(([k]) => k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()))
      : [];

    const CELL = `padding:6px 9px;border-right:1px solid #ddd;`;
    const CELL_LAST = `padding:6px 9px;`;
    const LABEL = `font-size:9px;font-weight:bold;color:${DOC_ACCENT};`;
    const VALUE = `font-size:11px;margin-top:2px;`;

    medHistHTML = `
<div class="section-title">MEDICAL HISTORY</div>
<div style="border:1px solid #ddd;border-radius:3px;margin-bottom:14px;">
  <div style="display:grid;grid-template-columns:1fr 1fr;">
    <div style="${CELL}"><div style="${LABEL}">Allergies</div><div style="${VALUE}">${medHistory.allergies || "None reported"}</div></div>
    <div style="${CELL_LAST}"><div style="${LABEL}">Blood Pressure</div><div style="${VALUE}">${medHistory.blood_pressure || "—"}</div></div>
  </div>
  ${medHistory.medications ? `<div style="border-top:1px solid #ddd;${CELL}"><div style="${LABEL}">Medications</div><div style="${VALUE}">${medHistory.medications}</div></div>` : ""}
  ${conditions.length > 0 ? `<div style="border-top:1px solid #ddd;${CELL}"><div style="${LABEL}">Conditions</div><div style="${VALUE}">${conditions.join(", ")}</div></div>` : ""}
  ${medHistory.notes ? `<div style="border-top:1px solid #ddd;${CELL}"><div style="${LABEL}">Notes</div><div style="${VALUE}">${medHistory.notes}</div></div>` : ""}
</div>`;
  }

  // ── Tooth Chart (FDI grid) ───────────────────────────────────────────────
  const toothChartHTML = inclToothChart ? buildDentitionChartHTML(toothStatuses, chartEntries) : "";

  // ── Chart Findings table ─────────────────────────────────────────────────
  let chartFindingsHTML = "";
  if (inclChartFind && chartEntries.length > 0) {
    const rows = [...chartEntries]
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
      .map(ce => `<tr>
        <td style="${TD}">${formatDateStandard(ce.recorded_at.split("T")[0])}</td>
        <td style="${TD}">${ce.tooth_number}</td>
        <td style="${TDG}">${ce.surfaces || "—"}</td>
        <td style="${TD}font-weight:bold;">${ce.finding_code}</td>
        <td style="${TDG}">${ce.finding_detail || ce.notes || "—"}</td>
      </tr>`).join("");

    chartFindingsHTML = `
<div class="section-title">CHART FINDINGS</div>
<div style="border:1px solid #ddd;border-radius:3px;overflow:hidden;margin-bottom:14px;">
<table style="${TBL}">
  <colgroup>
    <col style="width:22%"><col style="width:13%"><col style="width:13%"><col style="width:22%"><col style="width:30%">
  </colgroup>
  <thead><tr>
    <th style="${TH}">Date</th>
    <th style="${TH}">Tooth</th>
    <th style="${TH}">Surfaces</th>
    <th style="${TH}">Code</th>
    <th style="${TH}">Detail</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
</div>`;
  }

  // ── Treatment History ────────────────────────────────────────────────────
  let treatmentsHTML = "";
  if (inclTreat && treatments.length > 0) {
    const byDate: Record<string, typeof treatments> = {};
    for (const t of treatments) {
      if (!byDate[t.treatment_date]) byDate[t.treatment_date] = [];
      byDate[t.treatment_date].push(t);
    }
    const dates = Object.keys(byDate)
      .sort((a, b) => b.localeCompare(a))
      .filter(d => !selVisits || selVisits.includes(d));

    const visitBlocks = dates.map(date => {
      const rows = byDate[date];
      const dentist = rows[0]?.dentist_name || "";
      const concern = rows[0]?.visit_concern || "";

      const procedureRows = rows.map(tx => `<tr>
        <td style="${TD}">${tx.procedure}</td>
        <td style="${TD}text-align:center;">${tx.tooth_number ? `Tooth ${tx.tooth_number}` : "—"}</td>
        <td style="${TDG}font-style:italic;">${tx.notes || "—"}</td>
      </tr>`).join("");

      return `<div style="margin-bottom:10px;border:1px solid #ddd;border-radius:3px;overflow:hidden;">
        <div style="padding:5px 9px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #ddd;">
          <div style="font-size:9px;font-weight:bold;color:${DOC_ACCENT};">${formatDateStandard(date)}</div>
          ${dentist ? `<div style="font-size:9px;color:#555;">${dentist}</div>` : ""}
        </div>
        <table style="${TBL}">
          <colgroup>
            <col style="width:45%"><col style="width:20%"><col style="width:35%">
          </colgroup>
          <thead><tr>
            <th style="${TH}">Procedure</th>
            <th style="${TH}text-align:center;">Tooth</th>
            <th style="${TH}">Notes</th>
          </tr></thead>
          <tbody>${procedureRows}</tbody>
        </table>
      </div>`;
    }).join("");

    treatmentsHTML = `
<div class="section-title">TREATMENT HISTORY</div>
${visitBlocks}`;
  }

  const hasChart = inclToothChart || inclChartFind;
  const chartWrap = !hasChart ? "" : `
<div class="section-title">DENTAL CHART</div>
${toothChartHTML}
${chartFindingsHTML}`;

  const printedLabel = "";

  const generatedAtLabel = generatedAt
    ? `Generated ${generatedAt}`
    : `Generated ${new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}`;
  const footer = `<div style="margin-top:24px;padding-top:8px;border-top:1px solid #e0e0e0;display:flex;justify-content:space-between;align-items:center;">
  <span style="font-size:8px;color:#bbb;">Powered by <strong>MOLARIS</strong> · BeanStack Studio</span>
  <span style="font-size:8px;color:#bbb;">${generatedAtLabel}</span>
</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Patient Record — ${patientName}</title>
<style>${buildPageCSS()}</style>
</head>
<body>
<div class="page">
  ${buildDocHeaderHTML(clinicMeta, docNo)}
  <div style="text-align:center;font-size:22px;font-weight:bold;color:${DOC_ACCENT};text-decoration:underline;margin-bottom:4px;letter-spacing:0.04em;">PATIENT RECORD</div>
  <div style="margin-bottom:16px;"></div>
  ${patientInfoHTML}
  ${medHistHTML}
  ${chartWrap}
  ${treatmentsHTML}
  ${footer}
</div>
</body>
</html>`;
}
