import React, { useEffect, useRef } from "react";

export function EditModal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop: double-click closes */}
      <div
        className="absolute inset-0 bg-black/40"
        onDoubleClick={onClose}
        aria-hidden="true"
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="w-full max-w-lg rounded-2xl border bg-white shadow-xl"
        >
          <div className="border-b px-4 py-3">
            <div className="text-sm font-semibold">{title}</div>
          </div>

          {/* Body scroll on small screens */}
          <div className="max-h-[75vh] overflow-y-auto p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
