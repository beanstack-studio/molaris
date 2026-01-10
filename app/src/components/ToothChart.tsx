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
  | "ROOT_CANAL"
  | "CROWN"
  | "BRIDGE"
  | "IMPLANT";

const upperRight = [18, 17, 16, 15, 14, 13, 12, 11];
const upperLeft = [21, 22, 23, 24, 25, 26, 27, 28];

// Lower should mirror the upper layout:
// left side of the screen is patient's RIGHT (quadrant 4), then patient's LEFT (quadrant 3)
const lowerRight = [48, 47, 46, 45, 44, 43, 42, 41];
const lowerLeft = [31, 32, 33, 34, 35, 36, 37, 38];

function statusTheme(s: ToothStatus) {
  // More prominent tile themes.
  // wrap: status tint layer; border: tile border; chip: legend/button
  switch (s) {
    case "HEALTHY":
      return {
        wrap: "bg-transparent",
        border: "border-slate-200",
        chip: "bg-slate-100 text-slate-800 border-slate-200",
        halo: "bg-transparent",
      };

    case "CARIES":
      return {
        wrap: "bg-rose-200/80",
        border: "border-rose-400",
        chip: "bg-rose-200 text-rose-950 border-rose-300",
        halo: "bg-rose-200/70",
      };

    case "FILLED":
      return {
        wrap: "bg-emerald-200/80",
        border: "border-emerald-400",
        chip: "bg-emerald-200 text-emerald-950 border-emerald-300",
        halo: "bg-emerald-200/70",
      };

    case "MISSING":
      return {
        wrap: "bg-slate-300/70",
        border: "border-slate-500",
        chip: "bg-slate-300 text-slate-900 border-slate-400",
        halo: "bg-slate-300/60",
      };

    case "EXTRACTED":
      return {
        wrap: "bg-orange-200/80",
        border: "border-orange-400",
        chip: "bg-orange-200 text-orange-950 border-orange-300",
        halo: "bg-orange-200/70",
      };

    case "ROOT_CANAL":
      return {
        wrap: "bg-indigo-200/80",
        border: "border-indigo-400",
        chip: "bg-indigo-200 text-indigo-950 border-indigo-300",
        halo: "bg-indigo-200/70",
      };

    case "CROWN":
      return {
        wrap: "bg-amber-200/80",
        border: "border-amber-400",
        chip: "bg-amber-200 text-amber-950 border-amber-300",
        halo: "bg-amber-200/70",
      };

    case "BRIDGE":
      return {
        wrap: "bg-purple-200/80",
        border: "border-purple-400",
        chip: "bg-purple-200 text-purple-950 border-purple-300",
        halo: "bg-purple-200/70",
      };

    case "IMPLANT":
      return {
        wrap: "bg-cyan-200/80",
        border: "border-cyan-400",
        chip: "bg-cyan-200 text-cyan-950 border-cyan-300",
        halo: "bg-cyan-200/70",
      };

    default:
      return {
        wrap: "bg-slate-100/80",
        border: "border-slate-300",
        chip: "bg-slate-100 text-slate-800 border-slate-200",
        halo: "bg-slate-100/70",
      };
  }
}

function iconTintClass(status: ToothStatus) {
  // Applies only to the SVG (icon), not the button background.
  // Feel free to tweak shades later.
  switch (status) {
    case "HEALTHY":
      return "text-slate-700";
    case "CARIES":
      return "text-rose-600";
    case "FILLED":
      return "text-emerald-600";
    case "MISSING":
      return "text-slate-500";
    case "EXTRACTED":
      return "text-orange-600";
    case "ROOT_CANAL":
      return "text-indigo-600";
    case "CROWN":
      return "text-amber-600";
    case "BRIDGE":
      return "text-purple-600";
    case "IMPLANT":
      return "text-cyan-600";
    default:
      return "text-slate-600";
  }
}

function ToothOcclusalIcon({
  status,
  jaw,
  className,
}: {
  status: ToothStatus;
  jaw: "upper" | "lower";
  className?: string;
}) {
  // Flip upper teeth so the icon orientation matches a real chart
  const missing = status === "MISSING";
  const extracted = status === "EXTRACTED";

  return (
    <svg
      viewBox="12 10 40 44"
      className={["h-12 w-12", jaw === "upper" ? "rotate-180" : ""].join(" ")}
      aria-hidden="true"
    >
      {/* Tooth outline */}
      <path
        d="M20 18c4-4 9-6 12-6s8 2 12 6c4 4 6 9 6 14 0 9-4 16-10 18-3 1-6-1-8-4-2 3-5 5-8 4-6-2-10-9-10-18 0-5 2-10 6-14Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
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
      {status === "ROOT_CANAL" ? <path d="M32 22v22" className="stroke-indigo-500" strokeWidth="3.2" /> : null}
      {status === "CROWN" ? <path d="M22 20h20" className="stroke-amber-500" strokeWidth="4" /> : null}
      {status === "BRIDGE" ? <path d="M22 32c5-6 15-6 20 0" className="stroke-purple-500" strokeWidth="3.2" /> : null}
      {status === "IMPLANT" ? <path d="M32 24v18m-6 0h12" className="stroke-cyan-600" strokeWidth="3" /> : null}
      {extracted ? <path d="M22 22l20 20M42 22L22 42" className="stroke-orange-500" strokeWidth="3.2" /> : null}
    </svg>
  );
}

function ToothTile({
  tooth,
  status,
  jaw,
  hasNote,
  count,
  selected,
  onClick,
}: {
  tooth: number;
  status: ToothStatus;
  jaw: "upper" | "lower";
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
        // No square tile background at all
        "relative flex w-[52px] flex-col items-center justify-center select-none",
        "transition-transform",
        selected ? "scale-[1.30]" : "hover:scale-[1.05]",
      ].join(" ")}
    >
      {/* ICON WRAP */}
      <div className="relative flex h-[44px] w-[44px] items-center justify-center">
        {/* Selected highlight (behind icon only) */}
        {selected ? (
          <span className="absolute inset-0 rounded-[14px] bg-white/60 shadow-md" />
        ) : null}

        {/* Status highlight (behind icon only, and only when status is not HEALTHY)
            - for selected: it sits BEHIND the icon but still within the icon wrap
            - does NOT create a big rounded square tile
        */}
        {status !== "HEALTHY" ? (
          <span
            className={[
              "absolute inset-1 rounded-[12px] opacity-90",
              // stronger + more prominent color chip behind the icon
              // reuse your statusTheme().wrap if you like, but it must be a bg-* class
              statusTheme(status).wrap,
            ].join(" ")}
          />
        ) : null}

        {/* The icon itself (tinted by status) */}
        <div className={["relative", iconTintClass(status)].join(" ")}>
          <ToothOcclusalIcon status={status} jaw={jaw} className="h-8 w-8" />
        </div>
      </div>

      {/* Label */}
      <div className="mt-1 text-xs font-semibold text-slate-800">{tooth}</div>

      {/* Count badge */}
      {count > 0 ? (
        <span
          className={[
            "absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-[11px] flex items-center justify-center border",
            statusTheme(status).chip,
          ].join(" ")}
        >
          {count}
        </span>
      ) : null}

      {/* Note dot */}
      {hasNote ? (
        <span
          className={[
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full",
            selected ? "bg-slate-900" : "bg-slate-700",
          ].join(" ")}
          title="Has note"
        />
      ) : null}
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
  const jaw: "upper" | "lower" = t >= 11 && t <= 28 ? "upper" : "lower";
  return (
    <ToothTile
      key={t}
      tooth={t}
      status={s}
      jaw={jaw}
      hasNote={!!note && note.trim().length > 0}
      count={counts.get(t) ?? 0}
      selected={selectedTooth === t}
      onClick={() => onSelectTooth(t)}
    />
  );
}

  return (
    <div className="grid gap-4">
      {/* Upper: single line */}
      <div className="rounded-xl border bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-700">Upper</div>
        <div className="mt-3 flex flex-nowrap gap-0.5 justify-center overflow-x-auto min-h-[100px] items-center py-3">
          {upperRight.map(renderTooth)}
          <div className="w-6 shrink-0" />
          {upperLeft.map(renderTooth)}
        </div>
      </div>

      {/* Lower: single line */}
      <div className="rounded-xl border bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-700">Lower</div>
        <div className="mt-3 flex flex-nowrap gap-0.5 justify-center overflow-x-auto min-h-[100px] items-center py-3">
          {lowerRight.map(renderTooth)}
          <div className="w-6 shrink-0" />
          {lowerLeft.map(renderTooth)}
        </div>
      </div>

    </div>
  );
}

export function getStatusTheme(status: ToothStatus) {
  return statusTheme(status);
}
