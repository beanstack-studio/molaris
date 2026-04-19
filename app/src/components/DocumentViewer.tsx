/**
 * Document Viewer Helper
 * Opens the document HTML directly in a new window.
 * All generators already produce complete <!DOCTYPE html> documents
 * with their own CSS, paper sizing, and @media print rules.
 */

interface ViewerOptions {
  html: string;
  docType: string;
  docNumber: string;
}

export function openDocumentViewer(options: ViewerOptions): void {
  const win = window.open("", "_blank", "width=1100,height=900,menubar=no,toolbar=no");
  if (!win) return;

  win.document.write(options.html);
  win.document.close();
}
