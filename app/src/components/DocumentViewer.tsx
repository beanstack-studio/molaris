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

  // Inject fixed top/bottom bars that repeat on every printed page
  const topBar = win.document.createElement("div");
  topBar.setAttribute("data-print-border", "1");
  topBar.style.cssText = "display:none;position:fixed;top:0;left:0;right:0;height:3px;background:#2c5aa0;z-index:9999;";
  win.document.body.appendChild(topBar);

  const bottomBar = win.document.createElement("div");
  bottomBar.setAttribute("data-print-border", "1");
  bottomBar.style.cssText = "display:none;position:fixed;bottom:0;left:0;right:0;height:3px;background:#2c5aa0;z-index:9999;";
  win.document.body.appendChild(bottomBar);

  const style = win.document.createElement("style");
  style.textContent = "@media print { [data-print-border] { display:block !important; } }";
  win.document.head.appendChild(style);
}
