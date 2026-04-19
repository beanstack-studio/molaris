/**
 * Shared document building utilities — ensures all 5 document types
 * (Prescription, Certificate, Referral, Invoice, Receipt) are visually consistent.
 */

export const DOC_ACCENT = "#2c5aa0";

export interface DocClinicMeta {
  name?: string;
  address?: string;
  contact?: string;
  logoUrl?: string | null;
}

// ─── Header ────────────────────────────────────────────────────────────────
// Layout: (left) LOGO  |  (center) CLINIC INFO  |  (right) DOC NUMBER
export function buildDocHeaderHTML(clinicMeta: DocClinicMeta, docNo: string): string {
  const logo = clinicMeta.logoUrl
    ? `<img src="${clinicMeta.logoUrl}" style="width:64px;height:64px;object-fit:contain;" alt="Clinic Logo">`
    : `<div style="width:64px;height:64px;background:#f0f0f0;border:1px dashed #ccc;border-radius:4px;"></div>`;

  return `<div style="display:flex;align-items:flex-start;gap:14px;padding-bottom:12px;border-bottom:3px solid ${DOC_ACCENT};margin-bottom:16px;">
  <div style="flex:0 0 auto;">${logo}</div>
  <div style="flex:1;text-align:center;padding:0 6px;">
    <div style="font-size:17px;font-weight:bold;color:${DOC_ACCENT};line-height:1.2;">${clinicMeta.name || "Dental Clinic"}</div>
    <div style="font-size:10px;color:#555;margin-top:3px;font-style:italic;">GENERAL DENTISTRY &amp; ORTHODONTICS</div>
    ${clinicMeta.address ? `<div style="font-size:9px;color:#777;margin-top:3px;">${clinicMeta.address}</div>` : ""}
    ${clinicMeta.contact ? `<div style="font-size:9px;color:#777;margin-top:1px;">${clinicMeta.contact}</div>` : ""}
  </div>
  <div style="flex:0 0 auto;text-align:right;min-width:90px;">
    <div style="font-size:11px;font-weight:bold;color:${DOC_ACCENT};">${docNo}</div>
  </div>
</div>`;
}

// ─── Patient row ───────────────────────────────────────────────────────────
// One row: Patient Name (50%) | Age / Sex (10%) | Address (40%)
export function buildPatientRowHTML(
  name: string,
  age: number | undefined,
  gender: string | undefined,
  address: string | undefined
): string {
  const ageSex = `${age ?? "—"} / ${gender ? gender.charAt(0).toUpperCase() : "—"}`;
  return `<div style="display:grid;grid-template-columns:5fr 1fr 4fr;border:1px solid #ddd;border-radius:3px;margin-bottom:14px;">
  <div style="padding:6px 9px;border-right:1px solid #ddd;">
    <div style="font-size:9px;font-weight:bold;color:${DOC_ACCENT};">Patient Name</div>
    <div style="font-size:11px;margin-top:2px;word-wrap:break-word;">${name || "—"}</div>
  </div>
  <div style="padding:6px 8px;border-right:1px solid #ddd;">
    <div style="font-size:9px;font-weight:bold;color:${DOC_ACCENT};">Age / Sex</div>
    <div style="font-size:11px;margin-top:2px;">${ageSex}</div>
  </div>
  <div style="padding:6px 9px;">
    <div style="font-size:9px;font-weight:bold;color:${DOC_ACCENT};">Address</div>
    <div style="font-size:11px;margin-top:2px;word-wrap:break-word;">${address || "—"}</div>
  </div>
</div>`;
}

// ─── Signature block ───────────────────────────────────────────────────────
// Dentist name + Lic./PTR below the signature line
export function buildSignatureHTML(
  dentistName: string,
  licenseNo?: string,
  ptrNo?: string
): string {
  const licLine = `Lic. No. ${licenseNo || "_______________"}`;
  const ptrLine = `PTR No. ${ptrNo || "_______________"}`;

  return `<div>
  <div style="height:50px;border-bottom:1px solid #333;width:220px;"></div>
  <div style="font-size:11px;font-weight:bold;color:${DOC_ACCENT};margin-top:5px;">${dentistName || "Dentist"}</div>
  <div style="font-size:9px;color:#666;margin-top:2px;">${licLine}</div>
  <div style="font-size:9px;color:#666;margin-top:1px;">${ptrLine}</div>
</div>`;
}

// ─── Molaris footer ────────────────────────────────────────────────────────
export function buildMolarisFooterHTML(generatedAt?: string): string {
  return `<div style="margin-top:24px;padding-top:8px;border-top:3px solid ${DOC_ACCENT};display:flex;justify-content:space-between;align-items:center;">
  <span style="font-size:8px;color:#bbb;">Powered by <strong>MOLARIS</strong> · BeanStack Studio</span>
  ${generatedAt ? `<span style="font-size:8px;color:#bbb;">Generated ${generatedAt}</span>` : ""}
</div>`;
}

// ─── Shared document table styles ──────────────────────────────────────────
// Use these in ALL document generators for visual consistency
export const DOC_TBL  = `width:100%;border-collapse:collapse;font-size:11px;`;
export const DOC_TH   = `padding:5px 8px;font-size:9px;font-weight:bold;color:${DOC_ACCENT};background:#f0f4fa;text-align:left;border-bottom:2px solid ${DOC_ACCENT};white-space:nowrap;`;
export const DOC_TD   = `padding:5px 8px;border-bottom:1px solid #eee;vertical-align:top;`;
export const DOC_TDG  = `padding:5px 8px;border-bottom:1px solid #eee;vertical-align:top;color:#666;`;
export const DOC_TABLE_WRAP = `border:1px solid #ddd;border-radius:3px;overflow:hidden;margin-bottom:14px;`;

// ─── Base page CSS ─────────────────────────────────────────────────────────
export function buildPageCSS(): string {
  return `* { margin:0; padding:0; box-sizing:border-box; print-color-adjust:exact; -webkit-print-color-adjust:exact; }
body { font-family: Arial, sans-serif; color:#333; background:#f5f5f5; }
.page { width:8.5in; min-height:11in; background:white; margin:20px auto; padding:0.65in 0.8in; box-shadow:0 2px 8px rgba(0,0,0,0.1); border-top:3px solid ${DOC_ACCENT}; border-bottom:3px solid ${DOC_ACCENT}; }
.section-title { font-size:10px; font-weight:bold; color:${DOC_ACCENT}; margin-top:14px; margin-bottom:5px; letter-spacing:0.04em; text-transform:uppercase; }
.section-body { font-size:11px; line-height:1.7; white-space:pre-wrap; word-wrap:break-word; padding:7px 9px; background:#fafafa; border:1px solid #eee; border-radius:3px; margin-bottom:4px; }
.divider { border:none; border-top:1px solid #e0e0e0; margin:14px 0; }
@media print {
  body { background:white; }
  .page { margin:0; box-shadow:none; padding:0.5in 0.8in; }
  @page { size:letter; margin:0; }
  .section-title { page-break-inside:avoid; }
  tr { page-break-inside:avoid; }
}`;
}
