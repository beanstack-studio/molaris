"use client";

import React, { useMemo, useRef, useEffect } from "react";

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

// Permanent dentition (PDA/ISO 3950)
const permUpperRight = [18, 17, 16, 15, 14, 13, 12, 11];
const permUpperLeft = [21, 22, 23, 24, 25, 26, 27, 28];
const permLowerRight = [48, 47, 46, 45, 44, 43, 42, 41];
const permLowerLeft = [31, 32, 33, 34, 35, 36, 37, 38];

// Primary dentition (PDA/ISO 3950: 5x = upper right, 6x = upper left, 7x = lower left, 8x = lower right)
const primaryUpperRight = [55, 54, 53, 52, 51];
const primaryUpperLeft = [61, 62, 63, 64, 65];
const primaryLowerRight = [85, 84, 83, 82, 81];
const primaryLowerLeft = [71, 72, 73, 74, 75];

function statusBackgroundColor(s: ToothStatus): string {
  switch (s) {
    case "CARIES":
      return "#fca5a5"; // rose-300
    case "FILLED":
      return "#86efac"; // emerald-300
    case "EXTRACTED":
      return "#fed7aa"; // orange-300
    case "RCT":
      return "#c4b5fd"; // indigo-300
    case "CROWN":
      return "#fcd34d"; // amber-300
    case "DENTURE":
      return "#d8b4fe"; // purple-300
    case "IMPLANT":
      return "#a5f3fc"; // cyan-300
    default:
      return "#e2e8f0"; // slate-200
  }
}

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

    case "RCT":
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

    case "DENTURE":
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
  switch (status) {
    case "HEALTHY":
      return "text-slate-500 dark:text-slate-400";
    case "CARIES":
      return "text-rose-600 dark:text-rose-400";
    case "FILLED":
      return "text-emerald-600 dark:text-emerald-400";
    case "MISSING":
      return "text-slate-400 dark:text-slate-500";
    case "EXTRACTED":
      return "text-orange-600 dark:text-orange-400";
    case "RCT":
      return "text-indigo-600 dark:text-indigo-400";
    case "CROWN":
      return "text-amber-600 dark:text-amber-400";
    case "DENTURE":
      return "text-purple-600 dark:text-purple-400";
    case "IMPLANT":
      return "text-cyan-600 dark:text-cyan-400";
    default:
      return "text-slate-500 dark:text-slate-400";
  }
}

function ToothOcclusalIcon({
  status,
  jaw,
  className,
  showBackground = true,
}: {
  status: ToothStatus;
  jaw: "upper" | "lower";
  className?: string;
  showBackground?: boolean;
}) {
  const missing = status === "MISSING";

  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {/* Status background - visible for non-healthy teeth */}
      {showBackground && status !== "HEALTHY" && status !== "MISSING" ? (
        <rect x="10" y="10" width="44" height="44" rx="4" fill={statusBackgroundColor(status)} opacity="0.65" />
      ) : null}
      {/* Surface outline square */}
      <rect
        x="12"
        y="12"
        width="40"
        height="40"
        rx="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity={missing ? 0.35 : 1}
      />
      {/* Cross pattern - dividing lines */}
      <path d="M32 12 L32 52" fill="none" stroke="currentColor" strokeWidth="2" opacity={missing ? 0.2 : 0.5} />
      <path d="M12 32 L52 32" fill="none" stroke="currentColor" strokeWidth="2" opacity={missing ? 0.2 : 0.5} />
      {/* Center circle */}
      <circle cx="32" cy="32" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={missing ? 0.2 : 0.5} />
      {/* Corner pits */}
      <circle cx="18" cy="18" r="2" fill="currentColor" opacity={missing ? 0.15 : 0.3} />\n      <circle cx="46" cy="18" r="2" fill="currentColor" opacity={missing ? 0.15 : 0.3} />\n      <circle cx="18" cy="46" r="2" fill="currentColor" opacity={missing ? 0.15 : 0.3} />\n      <circle cx="46" cy="46" r="2" fill="currentColor" opacity={missing ? 0.15 : 0.3} />\n      {/* Status marks */}
      {status === "CARIES" ? <circle cx="32" cy="32" r="6" className="fill-rose-500" opacity={0.9} /> : null}
      {status === "FILLED" ? <rect x="18" y="18" width="28" height="28" rx="3" className="fill-emerald-500" opacity={0.9} /> : null}
      {status === "RCT" ? <path d="M32 12v40" className="stroke-indigo-500" strokeWidth="3" /> : null}
      {status === "CROWN" ? <path d="M12 16h40" className="stroke-amber-500" strokeWidth="3" /> : null}
      {status === "DENTURE" ? <path d="M12 32h40" className="stroke-purple-500" strokeWidth="3" /> : null}
      {status === "IMPLANT" ? <path d="M32 12v40m-8-20h16" className="stroke-cyan-600" strokeWidth="2.5" /> : null}
    </svg>
  );
}

function ToothOcclusalIconPrimary({
  status,
  jaw,
  className,
  showBackground = true,
}: {
  status: ToothStatus;
  jaw: "upper" | "lower";
  className?: string;
  showBackground?: boolean;
}) {
  const missing = status === "MISSING";

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {/* Status background - visible for non-healthy teeth */}
      {showBackground && status !== "HEALTHY" && status !== "MISSING" ? (
        <g transform="rotate(45 50 50)">
          <path
            d="
              M50 10
              C60 10, 70 20, 70 30
              C80 30, 90 40, 90 50
              C90 60, 80 70, 70 70
              C70 80, 60 90, 50 90
              C40 90, 30 80, 30 70
              C20 70, 10 60, 10 50
              C10 40, 20 30, 30 30
              C30 20, 40 10, 50 10
              Z
            "
            fill={statusBackgroundColor(status)}
            opacity="0.65"
          />
        </g>
      ) : null}
      {/* Rotated, softened four-lobe outline */}
      <g transform="rotate(45 50 50)" opacity={missing ? 0.35 : 1}>
        <path
          d="
            M50 10
            C60 10, 70 20, 70 30
            C80 30, 90 40, 90 50
            C90 60, 80 70, 70 70
            C70 80, 60 90, 50 90
            C40 90, 30 80, 30 70
            C20 70, 10 60, 10 50
            C10 40, 20 30, 30 30
            C30 20, 40 10, 50 10
            Z
          "
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </g>

      {/* Center (Occlusal / Incisal) */}
      <circle
        cx="50"
        cy="50"
        r="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        opacity={missing ? 0.2 : 1}
      />

      {/* Diagonal separators (do not cross center) */}
      <line x1="26" y1="26" x2="39" y2="39" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity={missing ? 0.2 : 0.6} />
      <line x1="74" y1="26" x2="61" y2="39" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity={missing ? 0.2 : 0.6} />
      <line x1="74" y1="74" x2="61" y2="61" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity={missing ? 0.2 : 0.6} />
      <line x1="26" y1="74" x2="39" y2="61" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity={missing ? 0.2 : 0.6} />

      {/* Status marks */}
      {status === "CARIES" ? <circle cx="50" cy="50" r="10" className="fill-rose-500" opacity={0.9} /> : null}
      {status === "FILLED" ? <rect x="30" y="30" width="40" height="40" rx="4" className="fill-emerald-500" opacity={0.9} /> : null}
      {status === "RCT" ? <path d="M50 15v70" className="stroke-indigo-500" strokeWidth="5" /> : null}
      {status === "CROWN" ? <path d="M15 25h70" className="stroke-amber-500" strokeWidth="5" /> : null}
      {status === "DENTURE" ? <path d="M15 50h70" className="stroke-purple-500" strokeWidth="5" /> : null}
      {status === "IMPLANT" ? <path d="M50 15v70m-12-35h24" className="stroke-cyan-600" strokeWidth="4" /> : null}
    </svg>
  );
}

function ToothOcclusalIconSecondary({
  status,
  jaw,
  className,
  showBackground = true,
}: {
  status: ToothStatus;
  jaw: "upper" | "lower";
  className?: string;
  showBackground?: boolean;
}) {
  const missing = status === "MISSING";

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {/* Status background - visible for non-healthy teeth */}
      {showBackground && status !== "HEALTHY" && status !== "MISSING" ? (
        <g transform="rotate(45 50 50)">
          <path
            d="
              M50 10
              C60 10, 70 20, 70 30
              C80 30, 90 40, 90 50
              C90 60, 80 70, 70 70
              C70 80, 60 90, 50 90
              C40 90, 30 80, 30 70
              C20 70, 10 60, 10 50
              C10 40, 20 30, 30 30
              C30 20, 40 10, 50 10
              Z
            "
            fill={statusBackgroundColor(status)}
            opacity="0.65"
          />
        </g>
      ) : null}
      {/* Rotated, softened four-lobe outline */}
      <g transform="rotate(45 50 50)" opacity={missing ? 0.35 : 1}>
        <path
          d="
            M50 10
            C60 10, 70 20, 70 30
            C80 30, 90 40, 90 50
            C90 60, 80 70, 70 70
            C70 80, 60 90, 50 90
            C40 90, 30 80, 30 70
            C20 70, 10 60, 10 50
            C10 40, 20 30, 30 30
            C30 20, 40 10, 50 10
            Z
          "
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </g>

      {/* Center square (Occlusal / Incisal) */}
      <rect
        x="38"
        y="38"
        width="26"
        height="26"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        opacity={missing ? 0.2 : 1}
      />

      {/* Diagonal separators (stop before center square) */}
      <line x1="26" y1="26" x2="37" y2="37" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity={missing ? 0.2 : 0.6} />
      <line x1="74" y1="26" x2="63" y2="37" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity={missing ? 0.2 : 0.6} />
      <line x1="74" y1="74" x2="63" y2="63" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity={missing ? 0.2 : 0.6} />
      <line x1="26" y1="74" x2="37" y2="63" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity={missing ? 0.2 : 0.6} />

      {/* Status marks */}
      {status === "CARIES" ? <circle cx="50" cy="50" r="10" className="fill-rose-500" opacity={0.9} /> : null}
      {status === "FILLED" ? <rect x="30" y="30" width="40" height="40" rx="4" className="fill-emerald-500" opacity={0.9} /> : null}
      {status === "RCT" ? <path d="M50 15v70" className="stroke-indigo-500" strokeWidth="5" /> : null}
      {status === "CROWN" ? <path d="M15 25h70" className="stroke-amber-500" strokeWidth="5" /> : null}
      {status === "DENTURE" ? <path d="M15 50h70" className="stroke-purple-500" strokeWidth="5" /> : null}
      {status === "IMPLANT" ? <path d="M50 15v70m-12-35h24" className="stroke-cyan-600" strokeWidth="4" /> : null}
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
  tooth: number | string;
  status: ToothStatus;
  jaw: "upper" | "lower";
  hasNote: boolean;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  const theme = statusTheme(status);
  
  // Primary icon (lobed with circle center) for primary molars and posterior permanent teeth
  const primaryIconTeeth = [55, 54, 64, 65, 85, 84, 74, 75];
  const permanentPrimaryIconTeeth = [18, 17, 16, 15, 14, 24, 25, 26, 27, 28, 38, 37, 36, 35, 34, 48, 47, 46, 45, 44];
  
  // Secondary icon (lobed with square center) for anterior and canine teeth (permanent + primary anteriors)
  const permanentSecondaryIconTeeth = [13, 12, 11, 21, 22, 23, 33, 32, 31, 41, 42, 43];
  const primarySecondaryIconTeeth = [53, 52, 51, 61, 62, 63, 83, 82, 81, 71, 72, 73];
  
  const usePrimaryIcon = primaryIconTeeth.includes(tooth as number) || permanentPrimaryIconTeeth.includes(tooth as number);
  const useSecondaryIcon = permanentSecondaryIconTeeth.includes(tooth as number) || primarySecondaryIconTeeth.includes(tooth as number);
  
  // Label position: above for upper teeth, below for lower teeth
  const labelAbove = jaw === "upper";
  
  // Show background colors for non-healthy teeth
  const showBg = status !== "HEALTHY" && status !== "MISSING";

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative flex flex-col items-center justify-center select-none -mx-3",
        "transition-transform",
        selected ? "scale-[1.25]" : "hover:scale-[1.10]",
      ].join(" ")}
    >
      {/* Label - tooth number above for upper, below for lower */}
      {labelAbove && <div className="text-xs font-semibold text-slate-800 dark:text-slate-300 leading-none">{tooth}</div>}

      {/* ICON WRAP - single surface/occlusal icon, 3x larger */}
      <div className={["relative flex h-14 w-20 justify-center", jaw === "lower" ? "items-start" : "items-center"].join(" ")}>
        <div className={["relative h-12 w-16", iconTintClass(status)].join(" ")}>
          {usePrimaryIcon ? (
            <ToothOcclusalIconPrimary status={status} jaw={jaw} showBackground={showBg} />
          ) : useSecondaryIcon ? (
            <ToothOcclusalIconSecondary status={status} jaw={jaw} showBackground={showBg} />
          ) : (
            <ToothOcclusalIcon status={status} jaw={jaw} showBackground={showBg} />
          )}
        </div>
      </div>

      {/* Label - tooth number below for lower teeth */}
      {!labelAbove && <div className="text-xs font-semibold text-slate-800 dark:text-slate-300 leading-none mt-1.5">{tooth}</div>}
    </button>
  );
}

export default function ToothChart({
  entries,
  statuses,
  selectedTooth,
  previewStatus,
  onSelectTooth,
}: {
  entries: ChartEntryLite[];
  statuses: Record<number | string, { status: ToothStatus; note: string | null; updated_at?: string }>;
  selectedTooth: number | string | null;
  previewStatus?: ToothStatus | null;
  onSelectTooth: (tooth: number | string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // On mobile, scroll to center of the chart so the midline is visible by default
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);

  const counts = useMemo(() => {
    const m = new Map<number | string, number>();
    for (const e of entries) m.set(e.tooth_number, (m.get(e.tooth_number) ?? 0) + 1);
    return m;
  }, [entries]);

  function renderTooth(t: number | string) {
    // Check if this tooth has any entries in history
    const hasEntries = counts.get(t) ?? 0 > 0;
    // If no entries, force HEALTHY status; otherwise use stored status
    let s = hasEntries ? (statuses[t]?.status ?? "HEALTHY") : "HEALTHY";
    // Override with preview status if this tooth is selected
    if (selectedTooth === t && previewStatus) {
      s = previewStatus;
    }
    const note = statuses[t]?.note ?? null;
    const jaw: "upper" | "lower" = 
      typeof t === "number" 
        ? ((t >= 11 && t <= 28) || (t >= 51 && t <= 65) ? "upper" : "lower")
        : (["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].includes(t as string) ? "upper" : "lower");
    
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
    /* Mobile/tablet: single horizontal scroll container for the whole chart.
       Desktop (md+): overflow-x-visible lets the per-row scroll containers take over. */
    <div ref={scrollRef} className="overflow-x-auto md:overflow-x-visible -mx-3 px-3 md:mx-0 md:px-0">
      <div className="grid gap-3 min-w-max md:min-w-0 w-full">
      {/* UPPER DENTITION - Combined Primary & Permanent */}
      <div className="card-light">
        <div className="text-s font-semibold text-slate-600 dark:text-slate-300 uppercase text-center mb-2 py-2">Upper Dentition</div>

        {/* Primary Upper */}
        <div>
          <div className="tooth-section-label">Primary</div>
          {/* Desktop: per-row scroll + edge-to-edge via -mx-3. Mobile: outer wrapper scrolls. */}
          <div className="min-h-[90px] md:overflow-x-auto md:overflow-y-hidden md:scrollbar-hide md:-mx-3">
            <div className="flex gap-0 w-max mx-auto items-center py-1">
              {primaryUpperRight.map(renderTooth)}
              <div className="tooth-divider" />
              {primaryUpperLeft.map(renderTooth)}
            </div>
          </div>
        </div>

        {/* Permanent Upper */}
        <div className="mt-0.5">
          <div className="tooth-section-label">Permanent</div>
          <div className="min-h-[90px] md:overflow-x-auto md:overflow-y-hidden md:scrollbar-hide md:-mx-3">
            <div className="flex gap-0 w-max mx-auto items-center py-1">
              {permUpperRight.map(renderTooth)}
              <div className="tooth-divider" />
              {permUpperLeft.map(renderTooth)}
            </div>
          </div>
        </div>
      </div>

      {/* LOWER DENTITION - Permanent first, then Primary */}
      <div className="card-light">

        {/* Permanent Lower - FIRST */}
        <div>
          <div className="min-h-[90px] md:overflow-x-auto md:overflow-y-hidden md:scrollbar-hide md:-mx-3">
            <div className="flex gap-0 w-max mx-auto items-center py-1">
              {permLowerRight.map(renderTooth)}
              <div className="tooth-divider" />
              {permLowerLeft.map(renderTooth)}
            </div>
          </div>
          <div className="tooth-section-label">Permanent</div>
        </div>

        {/* Primary Lower - SECOND */}
        <div className="mt-0.5">
          <div className="min-h-[90px] md:overflow-x-auto md:overflow-y-hidden md:scrollbar-hide md:-mx-3">
            <div className="flex gap-0 w-max mx-auto items-center py-1">
              {primaryLowerRight.map(renderTooth)}
              <div className="tooth-divider" />
              {primaryLowerLeft.map(renderTooth)}
            </div>
          </div>
          <div className="tooth-section-label">Primary</div>
        </div>

        {/* Lower Dentition Title - Below Primary */}
        <div className="text-s font-semibold text-slate-600 dark:text-slate-300 uppercase text-center mt-1 py-2">Lower Dentition</div>
      </div>
      </div>
    </div>
  );
}

export function getStatusTheme(status: ToothStatus) {
  return statusTheme(status);
}
