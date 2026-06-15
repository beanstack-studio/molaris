"use client";

import React, { useState } from "react";
import { EditModal } from "@/components/EditModal";
import { cn } from "@/lib/cn";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ColumnConfig = {
  key: string;
  label: string;
  required?: boolean;
  defaultVisible?: boolean;
};

export type SortConfig = {
  key: string;
  label: string;
};

export type FilterConfig = {
  key: string;
  label: string;
  options: Array<{ label: string; value: string }>;
};

export type TableOptionsProps = {
  tableName: string;
  columns: ColumnConfig[];
  sorts?: SortConfig[];
  filters?: FilterConfig[];
  currentSort?: { key: string; direction: "asc" | "desc" };
  onSortChange?: (key: string, direction: "asc" | "desc") => void;
  currentFilters?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  data: unknown[];
  onDownloadCSV: () => void;
};

// ─── Legacy ColumnDef — kept for backward compat ────────────────────────────

export interface ColumnDef {
  key: string;
  label: string;
  required?: boolean;
}

// ─── useTableColumns hook ────────────────────────────────────────────────────

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
    } catch {
      // ignore
    }
    return allKeys;
  });

  function onVisibilityChange(cols: string[]) {
    const final = [...new Set([...requiredKeys, ...cols])];
    setVisibleColumns(final);
    try {
      localStorage.setItem(storageKey, JSON.stringify(final));
    } catch {
      // ignore
    }
  }

  function isVisible(key: string): boolean {
    return visibleColumns.includes(key);
  }

  function toggleColumn(key: string) {
    const col = columns.find((c) => c.key === key);
    if (!col || col.required) return;
    const already = visibleColumns.includes(key);
    const next = already
      ? visibleColumns.filter((k) => k !== key)
      : [...visibleColumns, key];
    onVisibilityChange(next);
  }

  return { visibleColumns, onVisibilityChange, isVisible, toggleColumn };
}

// ─── Section header ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
      {children}
    </p>
  );
}

// ─── SlidersHorizontal SVG icon (no external dep) ───────────────────────────

function IconSliders() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="21" y1="4" x2="14" y2="4" />
      <line x1="10" y1="4" x2="3" y2="4" />
      <line x1="21" y1="12" x2="12" y2="12" />
      <line x1="8" y1="12" x2="3" y2="12" />
      <line x1="21" y1="20" x2="16" y2="20" />
      <line x1="12" y1="20" x2="3" y2="20" />
      <line x1="14" y1="2" x2="14" y2="6" />
      <line x1="8" y1="10" x2="8" y2="14" />
      <line x1="16" y1="18" x2="16" y2="22" />
    </svg>
  );
}

// ─── Build combined sort options ─────────────────────────────────────────────

function sortOptionLabel(sort: SortConfig, direction: "asc" | "desc"): string {
  const key = sort.key.toLowerCase();
  const label = sort.label.toLowerCase();
  const isDate = key.includes("date") || label.includes("date") || label.includes("visit");
  const isMoney = key === "balance" || key.includes("price") || key.includes("total") || key.includes("amount");
  if (isDate) return direction === "asc" ? `${sort.label} — Oldest first` : `${sort.label} — Newest first`;
  if (isMoney) return direction === "asc" ? `${sort.label} — Lowest first` : `${sort.label} — Highest first`;
  return direction === "asc" ? `${sort.label} — A to Z` : `${sort.label} — Z to A`;
}

// ─── TableOptions component ──────────────────────────────────────────────────

export function TableOptions({
  tableName,
  columns,
  sorts,
  filters,
  currentSort,
  onSortChange,
  currentFilters,
  onFilterChange,
  onDownloadCSV,
}: TableOptionsProps) {
  const [open, setOpen] = useState(false);
  const { visibleColumns, onVisibilityChange } = useTableColumns(tableName, columns);

  const storageKey = `molaris_cols_${tableName}`;
  const requiredKeys = columns.filter((c) => c.required).map((c) => c.key);
  const allKeys = columns.map((c) => c.key);

  // Sync column visibility into localStorage via the hook's setter.
  // We track a separate local state for the panel so changes are live.
  const [panelVisible, setPanelVisible] = useState<string[]>(visibleColumns);

  function handleOpen() {
    setPanelVisible(visibleColumns);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  function toggleColInPanel(key: string) {
    const col = columns.find((c) => c.key === key);
    if (!col || col.required) return;
    const already = panelVisible.includes(key);
    const next = already
      ? panelVisible.filter((k) => k !== key)
      : [...panelVisible, key];
    const final = [...new Set([...requiredKeys, ...next])];
    setPanelVisible(final);
    onVisibilityChange(final);
  }

  function selectAllCols() {
    const allNonRequired = allKeys.filter(
      (k) => !requiredKeys.includes(k)
    );
    const allSelected = allNonRequired.every((k) => panelVisible.includes(k));
    if (allSelected) {
      // Deselect all non-required
      const next = [...requiredKeys];
      setPanelVisible(next);
      onVisibilityChange(next);
    } else {
      const next = [...allKeys];
      setPanelVisible(next);
      onVisibilityChange(next);
    }
  }

  const visibleCount = panelVisible.length;
  const totalCount = columns.length;

  const allNonRequired = allKeys.filter((k) => !requiredKeys.includes(k));
  const allNonRequiredSelected = allNonRequired.every((k) =>
    panelVisible.includes(k)
  );

  return (
    <>
      <button
        type="button"
        title="Table options"
        aria-label="Table options"
        onClick={handleOpen}
        className="flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
      >
        <IconSliders />
      </button>

      <EditModal open={open} title="Table options" onClose={handleClose}>
        <div className="space-y-5">
          {/* ── SORT ──────────────────────────────────────────────── */}
          {sorts && sorts.length > 0 && (
            <div>
              <SectionLabel>Sort</SectionLabel>
              <select
                className="field-input w-full"
                value={currentSort?.key ? `${currentSort.key}:${currentSort.direction}` : ""}
                onChange={(e) => {
                  if (!onSortChange) return;
                  const val = e.target.value;
                  if (!val) { onSortChange("", "asc"); return; }
                  const [key, dir] = val.split(":");
                  onSortChange(key, (dir as "asc" | "desc") ?? "asc");
                }}
              >
                <option value="">— No sort —</option>
                {sorts.map((s) => (
                  <React.Fragment key={s.key}>
                    <option value={`${s.key}:asc`}>{sortOptionLabel(s, "asc")}</option>
                    <option value={`${s.key}:desc`}>{sortOptionLabel(s, "desc")}</option>
                  </React.Fragment>
                ))}
              </select>
            </div>
          )}

          {/* ── FILTER ────────────────────────────────────────────── */}
          {filters && filters.length > 0 && (
            <div className="border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>Filter</SectionLabel>
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:underline -mt-3"
                  onClick={() => {
                    if (onFilterChange) {
                      filters.forEach((f) => onFilterChange(f.key, ""));
                    }
                  }}
                >
                  Reset all
                </button>
              </div>
              <div
                className={cn(
                  "grid gap-3",
                  filters.length > 2 ? "grid-cols-2" : "grid-cols-1"
                )}
              >
                {filters.map((f) => (
                  <div key={f.key}>
                    <p className="field-label-text mb-1">{f.label}</p>
                    <select
                      className="field-input w-full"
                      value={currentFilters?.[f.key] ?? ""}
                      onChange={(e) =>
                        onFilterChange && onFilterChange(f.key, e.target.value)
                      }
                    >
                      {f.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── COLUMNS ───────────────────────────────────────────── */}
          <div className="border-t border-slate-200 pt-5">
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>
                Columns ({visibleCount}/{totalCount})
              </SectionLabel>
              <button
                type="button"
                className="text-sm text-blue-600 hover:underline -mt-3"
                onClick={selectAllCols}
              >
                {allNonRequiredSelected ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {columns.map((col) => (
                <label
                  key={col.key}
                  className={cn(
                    "flex items-center gap-2 select-none text-sm",
                    col.required ? "cursor-default" : "cursor-pointer"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={panelVisible.includes(col.key)}
                    onChange={() => toggleColInPanel(col.key)}
                    disabled={col.required}
                    className="w-4 h-4 rounded flex-shrink-0"
                  />
                  <span
                    className={
                      col.required ? "text-slate-400" : "text-slate-700"
                    }
                  >
                    {col.label}
                    {col.required ? (
                      <span className="ml-1 text-xs text-slate-400">
                        (required)
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* ── EXPORT ────────────────────────────────────────────── */}
          <div className="border-t border-slate-200 pt-5">
            <SectionLabel>Export</SectionLabel>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                className="save-btn"
                onClick={() => {
                  onDownloadCSV();
                  handleClose();
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
                  🔒 Download PDF
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
                  <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap shadow-lg">
                    Coming soon
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── DONE ──────────────────────────────────────────────── */}
          <div className="modal-actions-right border-t border-slate-200 pt-4">
            <button type="button" className="cancel-btn" onClick={handleClose}>
              Done
            </button>
          </div>
        </div>
      </EditModal>
    </>
  );
}
