import React, { useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";

export function EditModal({
  open,
  title,
  children,
  onClose,
  wide = false,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  // Exact same handler pattern as attachments modal - proven to work
  const handleBackdropEvent = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return ReactDOM.createPortal(
    <div className="modal-container p-4" onClick={handleBackdropEvent} onDoubleClick={handleBackdropEvent}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`${wide ? "modal-panel-wide" : "modal-panel-lg"} overflow-hidden`}
      >
        <div className="modal-header">
          <div className="modal-title">{title}</div>
        </div>

        {/* Body scroll on small screens */}
        <div className="max-h-[90dvh] lg:max-h-[80vh] overflow-y-auto p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}
