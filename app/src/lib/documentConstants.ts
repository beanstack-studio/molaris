/**
 * Document Constants
 * Centralized document types, paper sizes, and configuration
 */

export type PaperSize = "A4" | "A5" | "Letter";

/**
 * Default paper sizes for each document type
 */
export const DEFAULT_PAPER_SIZES: Record<string, PaperSize> = {
  PRESCRIPTION: "A5",
  PAYMENT_RECEIPT: "A5",
  DENTAL_CERTIFICATE: "A4",
  INVOICE: "A4",
  REFERRAL_LETTER: "A4",
  ACCOUNT_STATEMENT: "A4",
} as const;

/**
 * Paper size dimensions in millimeters
 */
export const PAPER_SIZE_DIMENSIONS: Record<PaperSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  Letter: { width: 215.9, height: 279.4 }, // 8.5" x 11"
} as const;

/**
 * Get default paper size for a document type
 */
export function getDefaultPaperSizeForDocType(docType: string): PaperSize {
  return DEFAULT_PAPER_SIZES[docType] || "A4";
}

/**
 * Get dimensions as CSS string (in mm)
 */
export function getPaperSizeCSS(size: PaperSize): string {
  const dims = PAPER_SIZE_DIMENSIONS[size];
  return `${dims.width}mm ${dims.height}mm`;
}

/**
 * Get dimensions for @page rule
 */
export function getPaperSizePageRule(size: PaperSize): string {
  const dims = PAPER_SIZE_DIMENSIONS[size];
  return `${dims.width}mm x ${dims.height}mm`;
}
