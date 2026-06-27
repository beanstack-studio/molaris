"use client";

import { useEffect, useRef } from "react";

interface UndoToastProps {
  message: string;
  onUndo: () => void | Promise<void>;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
  duration?: number;
}

export function UndoToast({ message, onUndo, onConfirm, onDismiss, duration = 3000 }: UndoToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        void onConfirm().then(onDismiss);
      }
    }, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleUndo() {
    if (doneRef.current) return;
    doneRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    void Promise.resolve(onUndo()).then(onDismiss);
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-slate-800 px-4 py-3 shadow-xl">
      <span className="text-sm text-white">{message}</span>
      <button
        type="button"
        onClick={handleUndo}
        className="text-sm font-semibold text-violet-400 hover:text-violet-300 transition-colors"
      >
        Undo
      </button>
    </div>
  );
}
