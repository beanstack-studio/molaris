"use client";

// TODO: REMOVE BEFORE MULTI-TENANT LAUNCH
// Dev-only overlay for simulating plan/role/viewport states. Only renders when
// NEXT_PUBLIC_DEV_TOOLS=true. Do not ship to production.

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

const PRESETS: { key: Preset; label: string }[] = [
  { key: "admin",   label: "Admin" },
  { key: "dentist", label: "Dentist" },
  { key: "staff",   label: "Staff" },
  { key: "free",    label: "Free" },
];

const VIEWPORTS: { key: ViewMode; label: string; icon: React.ReactNode; sim: string }[] = [
  { key: "desktop", label: "Desktop", icon: <IconMonitor />, sim: "1280px+" },
  { key: "tablet",  label: "Tablet",  icon: <IconTablet />,  sim: "768px" },
  { key: "mobile",  label: "Mobile",  icon: <IconPhone />,   sim: "390px" },
];

export function DevViewToggle() {
  const ctx = useDevOverride();
  const { userEmail } = useClinic();
  const [width, setWidth] = useState(0);

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
  const simWidth = VIEWPORTS.find((v) => v.key === activeView)?.sim ?? "";

  const breakpointInfo = isSimulated
    ? `${simWidth} simulated`
    : `${getBreakpoint(width)} · ${width > 0 ? `${width}px` : ""} · resets on refresh`;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-yellow-50 border-b border-yellow-200 h-8 flex items-center gap-3 px-4 select-none text-xs">
      <span className="font-bold text-orange-500 shrink-0 tracking-wide">DEV</span>
      <span className="text-yellow-600 shrink-0">View as:</span>

      {/* Role presets */}
      <div className="flex items-center gap-1">
        {PRESETS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setPreset(key)}
            className={cn(
              "px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors",
              activePreset === key
                ? "bg-orange-500 text-white"
                : "border border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Separator */}
      <span className="text-yellow-300 shrink-0">|</span>

      {/* Viewport presets */}
      <div className="flex items-center gap-1">
        {VIEWPORTS.map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            title={label}
            onClick={() => setViewMode(key)}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors",
              activeView === key
                ? "bg-blue-500 text-white"
                : "border border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700"
            )}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <span className={cn("ml-auto italic shrink-0", isSimulated ? "text-blue-500 font-medium" : "text-yellow-600")}>
        {breakpointInfo}
      </span>
    </div>
  );
}
