/**
 * Document Viewer Helper
 * Creates a viewer window with fixed paper sizes (no toolbar)
 * User can print with Ctrl+P
 */

import { PAPER_SIZE_DIMENSIONS, getDefaultPaperSizeForDocType } from "@/lib/documentConstants";

interface ViewerOptions {
  html: string;
  docType: string;
  docNumber: string;
}

/**
 * Generate viewer HTML with default paper size
 */
function generateViewerHTML(html: string, docType: string, docNumber: string): string {
  const defaultSize = getDefaultPaperSizeForDocType(docType);
  const dims = PAPER_SIZE_DIMENSIONS[defaultSize];

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docNumber || "Document"}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html, body {
      height: 100%;
      background: #f5f5f5;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 20px;
    }
    
    .document-page {
      width: ${dims.width}mm;
      height: ${dims.height}mm;
      background: white;
      margin: 0 auto;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      overflow: hidden;
      page-break-after: always;
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .document-page {
        width: 100%;
        height: 100%;
        margin: 0;
        box-shadow: none;
        page-break-after: always;
      }
      
      @page {
        margin: 0;
        size: auto;
      }
    }
  </style>
</head>
<body>
  <div class="document-page">
    ${html}
  </div>
</body>
</html>
  `;
}

/**
 * Open document in new tab/window with default paper size
 * User prints with Ctrl+P
 */
export function openDocumentViewer(options: ViewerOptions): void {
  const viewerHTML = generateViewerHTML(options.html, options.docType, options.docNumber);
  const window_ref = window.open("", "_blank", "width=1000,height=800");
  if (window_ref) {
    window_ref.document.write(viewerHTML);
    window_ref.document.close();
  }
}
