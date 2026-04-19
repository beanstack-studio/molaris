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

  // Inject a print/save button that hides itself during printing
  const btn = win.document.createElement("button");
  btn.textContent = "Print / Save as PDF";
  btn.setAttribute("data-no-print", "1");
  btn.style.cssText = [
    "position:fixed", "top:12px", "right:12px", "z-index:9999",
    "background:#2c5aa0", "color:white", "border:none",
    "padding:8px 18px", "border-radius:4px", "cursor:pointer",
    "font-size:13px", "font-family:Arial,sans-serif",
    "box-shadow:0 2px 6px rgba(0,0,0,0.2)",
  ].join(";");
  btn.onclick = () => win.print();
  win.document.body.appendChild(btn);

  // Inject hide-on-print rule
  const style = win.document.createElement("style");
  style.textContent = "@media print { [data-no-print] { display:none !important; } }";
  win.document.head.appendChild(style);
}
