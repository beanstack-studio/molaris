"use client";

import { type ReactNode, useState } from "react";
import { EditModal } from "@/components/EditModal";

export interface ColumnDef {
  key: string;
  label: string;
  required?: boolean; // cannot be hidden
}

interface TableOptionsProps {
  open: boolean;
  onClose: () => void;
  columns: ColumnDef[];
  visibleColumns: string[];
  onVisibilityChange: (cols: string[]) => void;
  onExportCsv: () => void;
  filterSlot?: ReactNode;
}

export function TableOptions({
  open,
  onClose,
  columns,
  visibleColumns,
  onVisibilityChange,
  onExportCsv,
  filterSlot,
}: TableOptionsProps) {
  function toggle(key: string) {
    const col = columns.find((c) => c.key === key);
    if (!col || col.required) return;
    const already = visibleColumns.includes(key);
    const next = already
      ? visibleColumns.filter((k) => k !== key)
      : [...visibleColumns, key];
    onVisibilityChange(next);
  }

  return (
    <EditModal open={open} title="Table options" onClose={onClose}>
      <div className="spacing-vertical-lg">
        {filterSlot ? (
          <div>
            <p className="field-label-text mb-2">Filter</p>
            {filterSlot}
          </div>
        ) : null}

        {/* COLUMNS */}
        <div>
          <p className="field-label-text mb-2">Columns</p>
          <div className="space-y-2">
            {columns.map((col) => (
              <label
                key={col.key}
                className={`flex items-center gap-2 select-none ${
                  col.required ? "cursor-default" : "cursor-pointer"
                }`}
              >
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(col.key)}
                  onChange={() => toggle(col.key)}
                  disabled={col.required}
                  className="w-4 h-4 rounded"
                />
                <span
                  className={`text-sm ${
                    col.required ? "text-slate-400" : "text-slate-700"
                  }`}
                >
                  {col.label}
                  {col.required ? (
                    <span className="ml-1 text-xs text-slate-400">(required)</span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* EXPORT */}
        <div>
          <p className="field-label-text mb-2">Export</p>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              className="save-btn"
              onClick={() => {
                onExportCsv();
                onClose();
              }}
            >
              Download CSV
            </button>
            <div className="relative group">
              <button
                type="button"
                className="cancel-btn opacity-50 cursor-not-allowed"
                disabled
                aria-disabled="true"
              >
                Download PDF
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
                <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap shadow-lg">
                  Coming soon
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-actions-right">
          <button type="button" className="cancel-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </EditModal>
  );
}

/**
 * Hook for managing which columns are visible, persisted to localStorage.
 * Required columns are always included regardless of stored state.
 */
export function useTableColumns(tableName: string, columns: ColumnDef[]) {
  const storageKey = `molaris_cols_${tableName}`;
  const allKeys = columns.map((c) => c.key);
  const requiredKeys = columns.filter((c) => c.required).map((c) => c.key);

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    if (typeof window === "undefined") return allKeys;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const valid = (parsed as string[]).filter((k) => allKeys.includes(k));
          return [...new Set([...requiredKeys, ...valid])];
        }
      }
    } catch {}
    return allKeys;
  });

  function onVisibilityChange(cols: string[]) {
    const final = [...new Set([...requiredKeys, ...cols])];
    setVisibleColumns(final);
    try {
      localStorage.setItem(storageKey, JSON.stringify(final));
    } catch {}
  }

  function isVisible(key: string): boolean {
    return visibleColumns.includes(key);
  }

  return { visibleColumns, onVisibilityChange, isVisible };
}
