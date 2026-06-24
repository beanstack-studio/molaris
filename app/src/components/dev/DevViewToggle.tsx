"use client";

// TODO: REMOVE BEFORE MULTI-TENANT LAUNCH
// Dev-only floating panel for simulating plan/role/viewport states.
// Only renders when NEXT_PUBLIC_DEV_TOOLS=true and for the owner email.

import { useEffect, useState } from "react";
import { useDevOverride, type ViewMode } from "@/contexts/DevOverrideContext";
import { useClinic } from "@/contexts/ClinicContext";
import { cn } from "@/lib/cn";

function getBreakpoint(w: number): string {
  if (w < 768) return "Mobile";
  if (w < 1024) return "Tablet";
  return "Desktop";
}

function IconMonitor() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 20 20">
      <rect x="2" y="2" width="16" height="12" rx="1.5" />
      <path strokeLinecap="round" d="M7 17h6M10 14v3" />
    </svg>
  );
}

function IconTablet() {
  return (
    <svg className="w-3 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 16 20">
      <rect x="1.5" y="1" width="13" height="18" rx="1.5" />
      <circle cx="8" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg className="w-2.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 12 20">
      <rect x="1" y="1" width="10" height="18" rx="1.5" />
      <circle cx="6" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

type Preset = "admin" | "dentist" | "staff" | "free";

const PRESETS: { key: Preset; label: string; color: string }[] = [
  { key: "admin",   label: "Admin",   color: "bg-orange-500 text-white" },
  { key: "dentist", label: "Dentist", color: "bg-blue-500 text-white" },
  { key: "staff",   label: "Staff",   color: "bg-slate-500 text-white" },
  { key: "free",    label: "Free",    color: "bg-amber-500 text-white" },
];

const VIEWPORTS: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
  { key: "desktop", label: "Desktop", icon: <IconMonitor /> },
  { key: "tablet",  label: "Tablet",  icon: <IconTablet /> },
  { key: "mobile",  label: "Mobile",  icon: <IconPhone /> },
];

export function DevViewToggle() {
  const ctx = useDevOverride();
  const { userEmail } = useClinic();
  const [width, setWidth] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (userEmail !== "matiradentalstudio@gmail.com") return null;
  if (!ctx) return null;

  const { override, setPreset, setViewMode } = ctx;

  const activePreset: Preset =
    override.plan === "free" ? "free"
    : override.role === "admin"   ? "admin"
    : override.role === "dentist" ? "dentist"
    : "staff";

  const activeView = override.viewMode;
  const isSimulated = activeView !== "desktop";
  const simInfo = isSimulated
    ? `${VIEWPORTS.find((v) => v.key === activeView)?.label} sim`
    : `${getBreakpoint(width)} · ${width > 0 ? `${width}px` : ""}`;

  const activePColor = PRESETS.find((p) => p.key === activePreset)?.color ?? "bg-orange-500 text-white";

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2">
      {/* Expanded panel */}
      {open && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-4 w-64 select-none text-xs">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-orange-500 tracking-wide text-sm">DEV TOOLS</span>
            <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", activePColor)}>
              {activePreset}
            </span>
          </div>

          {/* Role presets */}
          <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] mb-1.5">View as</p>
          <div className="flex gap-1 flex-wrap mb-3">
            {PRESETS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setPreset(key)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                  activePreset === key
                    ? "bg-orange-500 text-white"
                    : "border border-slate-200 text-slate-500 hover:border-slate-400"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Viewport presets */}
          <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] mb-1.5">Viewport</p>
          <div className="flex gap-1 mb-3">
            {VIEWPORTS.map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setViewMode(key)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors",
                  activeView === key
                    ? "bg-blue-500 text-white"
                    : "border border-slate-200 text-slate-500 hover:border-slate-400"
                )}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Info */}
          <p className={cn("text-[10px]", isSimulated ? "text-blue-500 font-medium" : "text-slate-400")}>
            {simInfo} · resets on refresh
          </p>
        </div>
      )}

      {/* FAB trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg text-xs font-bold tracking-wide transition-all",
          open
            ? "bg-orange-500 text-white"
            : "bg-yellow-50 border border-yellow-300 text-orange-500 hover:bg-yellow-100"
        )}
        title="Dev tools"
      >
        <span>DEV</span>
        <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-semibold", activePColor)}>
          {activePreset}
        </span>
      </button>
    </div>
  );
}
