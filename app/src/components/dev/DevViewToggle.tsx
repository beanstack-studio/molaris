"use client";

// TODO: REMOVE BEFORE MULTI-TENANT LAUNCH
// Dev-only overlay for simulating plan/role states. Only renders when
// NEXT_PUBLIC_DEV_TOOLS=true. Do not ship to production.

import { useEffect, useState } from "react";
import { useDevOverride } from "@/contexts/DevOverrideContext";
import { useClinic } from "@/contexts/ClinicContext";
import { cn } from "@/lib/cn";

function getBreakpoint(w: number): "Mobile" | "Tablet" | "Desktop" {
  if (w < 768) return "Mobile";
  if (w < 1024) return "Tablet";
  return "Desktop";
}

type Preset = "admin" | "dentist" | "staff" | "free";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "admin",   label: "Admin" },
  { key: "dentist", label: "Dentist" },
  { key: "staff",   label: "Staff" },
  { key: "free",    label: "Free" },
];

export function DevViewToggle() {
  const ctx = useDevOverride();
  const { userEmail } = useClinic();
  const [width, setWidth] = useState(0);
  const breakpoint = getBreakpoint(width);

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (userEmail !== "matiradentalstudio@gmail.com") return null;
  if (!ctx) return null;

  const { override, setPreset } = ctx;

  // Determine which preset is active
  const activePreset: Preset =
    override.plan === "free" ? "free"
    : override.role === "admin"   ? "admin"
    : override.role === "dentist" ? "dentist"
    : "staff";

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-yellow-50 border-b border-yellow-200 h-8 flex items-center gap-3 px-4 select-none text-xs">
      <span className="font-bold text-orange-500 shrink-0 tracking-wide">DEV</span>
      <span className="text-yellow-600 shrink-0">View as:</span>

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

      <span className="ml-auto text-yellow-600 italic shrink-0">
        {breakpoint} {width > 0 && `· ${width}px`} · resets on refresh
      </span>
    </div>
  );
}
