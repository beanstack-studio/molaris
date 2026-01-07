"use client";

import { useState } from "react";

type EditModalProps = {
  title: string;
  open: boolean;
  busy?: boolean;
  onSave: () => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void; // internal only (ESC / overlay)
  children: React.ReactNode;
};

export default function EditModal({
  title,
  open,
  busy,
  onSave,
  onDelete,
  onClose,
  children,
}: EditModalProps) {
  const [confirm, setConfirm] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="border-b px-4 py-3 text-sm font-semibold">
          {title}
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-4">{children}</div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              className="h-9 w-28 rounded-lg border px-2 text-xs"
              placeholder="Type DELETE"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <button
              className="h-9 rounded-lg border border-red-500 px-3 text-xs font-semibold text-red-600 disabled:opacity-50"
              disabled={confirm !== "DELETE" || busy}
              onClick={onDelete}
            >
              Delete
            </button>
          </div>

          <button
            className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white disabled:opacity-50"
            disabled={busy}
            onClick={onSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
