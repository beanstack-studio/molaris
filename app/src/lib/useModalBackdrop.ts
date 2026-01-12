/**
 * Standard hook for modal backdrop event handling
 * Ensures consistent double-click, single-click, and Escape key behavior across all modals
 */

import { useEffect, useRef } from "react";

export function useModalBackdrop(open: boolean, onClose: () => void) {
  const backdropRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !backdropRef.current) return;

    const backdrop = backdropRef.current;

    // Handle Escape key
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    // Handle click on backdrop (not on children)
    function handleBackdropClick(e: MouseEvent) {
      if (e.target === backdrop) {
        onClose();
      }
    }

    // Handle double-click on backdrop
    function handleBackdropDoubleClick(e: MouseEvent) {
      if (e.target === backdrop) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    backdrop.addEventListener("click", handleBackdropClick);
    backdrop.addEventListener("dblclick", handleBackdropDoubleClick);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      backdrop.removeEventListener("click", handleBackdropClick);
      backdrop.removeEventListener("dblclick", handleBackdropDoubleClick);
    };
  }, [open, onClose]);

  return backdropRef;
}
