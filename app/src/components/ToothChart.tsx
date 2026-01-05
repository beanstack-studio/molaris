"use client";

import React, { useMemo } from "react";

export type ChartEntryLite = {
  id: string;
  tooth_number: number;
  finding_code: string;
  surfaces: string | null;
  notes: string | null;
  recorded_at: string;
};

export type ToothStatus =
  | "HEALTHY"
  | "CARIES"
  | "FILLED"
  | "MISSING"
  | "EXTRACTED"
  | "RCT"
  | "CROWN"
  | "IMPLANT"
  | "DENTURE";

const upperRight = [18, 17, 16, 15, 14, 13, 12, 11];
const upperLeft = [21, 22, 23, 24, 25, 26, 27, 28];
const lowerLeft = [38, 37, 36, 35, 34, 33, 32, 31];
const lowerRight = [41, 42, 43, 44, 45, 46, 47, 48];

function statusLabel(s: ToothStatus) {
  switch (s) {
    case "HEALTHY":
      return "Healthy";
    case "CARIES":
      return "Caries";
    case "FILLED":
      return "Filled";
    case "MISSING":
      return "Missing";
    case "EXTRACTED":
      return "Extracted";
    case "RCT":
      return "RCT";
    case "CROWN":
      return "Crown";
    case "IMPLANT":
      return "Implant";
    case "DENTURE":
      return "Denture";
  }
}

function statusTheme(s: ToothStatus) {
  // Soft pastel themes. Identifiable but not loud.
  // wrap: tooth tile background; border: tile border; chip: legend/button
  switch (s) {
    case "HEALTHY":
        return { wrap: "bg-white", border: "border-slate-200", chip: "bg-slate-100 text-slate-800 border-slate-200", halo: "bg-slate-50" };
    case "CARIES":
        return { wrap: "bg-rose-50", border: "border-rose-300", chip: "bg-rose-200 text-rose-950 border-rose-300", halo: "bg-rose-100" };
    case "FILLED":
        return { wrap: "bg-emerald-50", border: "border-emerald-300", chip: "bg-emerald-200 text-emerald-950 border-emerald-300", halo: "bg-emerald-100" };
    case "MISSING":
        return { wrap: "bg-slate-100", border: "border-slate-400", chip: "bg-slate-300 text-slate-900 border-slate-400", halo: "bg-slate-200" };
    case "EXTRACTED":
        return { wrap: "bg-orange-50", border: "border-orange-300", chip: "bg-orange-200 text-orange-950 border-orange-300", halo: "bg-orange-100" };
    case "RCT":
        return { wrap: "bg-indigo-50", border: "border-indigo-300", chip: "bg-indigo-200 text-indigo-950 border-indigo-300", halo: "bg-indigo-100" };
    case "CROWN":
        return { wrap: "bg-amber-50", border: "border-amber-300", chip: "bg-amber-200 text-amber-950 border-amber-300", halo: "bg-amber-100" };
    case "IMPLANT":
        return { wrap: "bg-cyan-50", border: "border-cyan-300", chip: "bg-cyan-200 text-cyan-950 border-cyan-300", halo: "bg-cyan-100" };
    case "DENTURE":
        return { wrap: "bg-purple-50", border: "border-purple-300", chip: "bg-purple-200 text-purple-950 border-purple-300", halo: "bg-purple-100" };
  }
}

function ToothOcclusalIcon({ status }: { status: ToothStatus }) {
  // Original "top view" occlusal style tooth.
  // It’s a rounded crown with cusps and grooves, plus small marks per status.
  const missing = status === "MISSING";
  const extracted = status === "EXTRACTED";

  return (
    <svg viewBox="12 10 40 44" className="h-14 w-14" aria-hidden="true">
      {/* Tooth outline */}
      <path
        d="M20 18c4-4 9-6 12-6s8 2 12 6c4 4 6 9 6 14 0 9-4 16-10 18-3 1-6-1-8-4-2 3-5 5-8 4-6-2-10-9-10-18 0-5 2-10 6-14Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        opacity={missing ? 0.35 : 1}
      />

      {/* Occlusal grooves */}
      <path d="M24 28c4-4 12-4 16 0" fill="none" stroke="currentColor" strokeWidth="2" opacity={missing ? 0.2 : 0.55} />
      <path d="M32 26c0 3-2 4-2 6s2 3 2 6" fill="none" stroke="currentColor" strokeWidth="2" opacity={missing ? 0.2 : 0.55} />

      {/* Cusps */}
      <circle cx="26" cy="34" r="2" fill="currentColor" opacity={missing ? 0.15 : 0.25} />
      <circle cx="38" cy="34" r="2" fill="currentColor" opacity={missing ? 0.15 : 0.25} />
      <circle cx="32" cy="38" r="2" fill="currentColor" opacity={missing ? 0.15 : 0.22} />

      {/* Status marks */}
      {status === "CARIES" ? <circle cx="42" cy="30" r="4" className="fill-rose-500" opacity={0.9} /> : null}
      {status === "FILLED" ? <rect x="28" y="28" width="10" height="10" rx="2" className="fill-emerald-500" opacity={0.9} /> : null}
      {status === "RCT" ? <path d="M32 22v22" className="stroke-indigo-500" strokeWidth="3.2" /> : null}
      {status === "CROWN" ? <path d="M22 20h20" className="stroke-amber-500" strokeWidth="4" /> : null}
      {status === "IMPLANT" ? <path d="M32 24v18m-6 0h12" className="stroke-cyan-600" strokeWidth="3" /> : null}
      {status === "DENTURE" ? <path d="M22 42c5 6 15 6 20 0" className="stroke-purple-600" strokeWidth="3" /> : null}
      {extracted ? <path d="M22 22l20 20M42 22L22 42" className="stroke-orange-500" strokeWidth="3.2" /> : null}
    </svg>
  );
}

function ToothTile({
  tooth,
  status,
  hasNote,
  count,
  selected,
  onClick,
}: {
  tooth: number;
  status: ToothStatus;
  hasNote: boolean;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  const theme = statusTheme(status);

  return (
    <button
        type="button"
        onClick={onClick}
        className={[
            "relative flex w-[46px] flex-col items-center justify-center p-0 m-0 select-none",
            selected ? "ring-2 ring-slate-700" : "hover:bg-slate-100",
        ].join(" ")}
        >
    {/* Status halo behind tooth icon (stronger but still soft) */}
        <span
            className={[
                "absolute top-0.5 left-0.5 right-0.5 h-14 rounded-[18px] border",
                theme.halo,
                theme.border,
                status === "HEALTHY" ? "opacity-0" : "opacity-100",
                status !== "HEALTHY" ? "ring-1 ring-black/5" : "",
            ].join(" ")}
            aria-hidden="true"
        />

      <div className="relative text-slate-800">
        {/* smaller than before */}
        <ToothOcclusalIcon status={status} />
      </div>

      <div className="text-xs font-semibold text-slate-800">{tooth}</div>

      {/* History count badge */}
      {count > 0 ? (
        <span className={["absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-[11px] flex items-center justify-center border", theme.chip].join(" ")}>
          {count}
        </span>
      ) : null}

      {/* Note dot */}
      {hasNote ? <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-slate-700" title="Has note" /> : null}
    </button>
  );
}

export default function ToothChart({
  entries,
  statuses,
  selectedTooth,
  onSelectTooth,
}: {
  entries: ChartEntryLite[];
  statuses: Record<number, { status: ToothStatus; note: string | null; updated_at?: string }>;
  selectedTooth: number | null;
  onSelectTooth: (tooth: number) => void;
}) {
  const counts = useMemo(() => {
    const m = new Map<number, number>();
    for (const e of entries) m.set(e.tooth_number, (m.get(e.tooth_number) ?? 0) + 1);
    return m;
  }, [entries]);

  function renderTooth(t: number) {
    const s = statuses[t]?.status ?? "HEALTHY";
    const note = statuses[t]?.note ?? null;
    return (
      <ToothTile
        key={t}
        tooth={t}
        status={s}
        hasNote={!!note && note.trim().length > 0}
        count={counts.get(t) ?? 0}
        selected={selectedTooth === t}
        onClick={() => onSelectTooth(t)}
      />
    );
  }

  const legendStatuses: ToothStatus[] = ["HEALTHY","CARIES","FILLED","MISSING","EXTRACTED","RCT","CROWN","IMPLANT","DENTURE"];

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-semibold text-center">Legend</div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-700 justify-center">
          {legendStatuses.map((s) => {
            const theme = statusTheme(s);
            return (
              <span key={s} className={["inline-flex items-center rounded-full border px-3 py-1", theme.chip].join(" ")}>
                {statusLabel(s)}
              </span>
            );
          })}
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 bg-white text-slate-800 border-slate-200">
            <span className="inline-block h-2 w-2 rounded-full bg-slate-700" /> Has note
          </span>
        </div>
      </div>

      {/* Upper: single line */}
      <div className="rounded-xl border bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-700">Upper</div>
        <div className="mt-3 flex flex-wrap gap-0 justify-center">
          {upperRight.map(renderTooth)}
          <div className="w-0 shrink-0" />
          {upperLeft.map(renderTooth)}
        </div>
      </div>

      {/* Lower: single line */}
      <div className="rounded-xl border bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-700">Lower</div>
        <div className="mt-3 flex flex-wrap gap-0 justify-center">
          {lowerLeft.map(renderTooth)}
          <div className="w-0 shrink-0" />
          {lowerRight.map(renderTooth)}
        </div>
      </div>

      <div className="text-xs text-slate-600">
        Tap a tooth. Add a note (optional). Tap a status to save.
      </div>
    </div>
  );
}

export function getStatusTheme(status: ToothStatus) {
  return statusTheme(status);
}
