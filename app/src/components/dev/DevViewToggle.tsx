"use client";

// TODO: REMOVE BEFORE MULTI-TENANT LAUNCH
// Dev-only overlay for simulating plan/role states. Only renders when
// NEXT_PUBLIC_DEV_TOOLS=true. Do not ship to production.

import { useEffect, useState } from "react";
import { useDevOverride } from "@/contexts/DevOverrideContext";
import { cn } from "@/lib/cn";

function getBreakpoint(w: number): "Mobile" | "Tablet" | "Desktop" {
  if (w < 768) return "Mobile";
  if (w < 1024) return "Tablet";
  return "Desktop";
}

export function DevViewToggle() {
  const ctx = useDevOverride();
  const [width, setWidth] = useState(0);
  const breakpoint = getBreakpoint(width);

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (!ctx) return null;

  const { override, setPlan, setRole } = ctx;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9998] bg-slate-900/95 text-white text-xs flex items-center gap-4 px-4 py-2 backdrop-blur-sm border-t border-slate-700 select-none">
      <span className="font-bold text-amber-400 shrink-0 tracking-wide">DEV</span>

      {/* Plan */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-slate-400">Plan:</span>
        <button
          onClick={() => setPlan("free")}
          className={cn(
            "px-2 py-0.5 rounded transition-colors",
            override.plan === "free"
              ? "bg-slate-600 font-bold text-white"
              : "text-slate-400 hover:text-white"
          )}
        >
          Free
        </button>
        <button
          onClick={() => setPlan("pro")}
          className={cn(
            "px-2 py-0.5 rounded transition-colors",
            override.plan === "pro"
              ? "bg-slate-600 font-bold text-blue-300"
              : "text-slate-400 hover:text-white"
          )}
        >
          Pro
        </button>
      </div>

      <span className="text-slate-600 shrink-0">·</span>

      {/* Role */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-slate-400">Role:</span>
        <button
          onClick={() => setRole("owner")}
          className={cn(
            "px-2 py-0.5 rounded transition-colors",
            override.role === "owner"
              ? "bg-slate-600 font-bold text-white"
              : "text-slate-400 hover:text-white"
          )}
        >
          Owner
        </button>
        <button
          onClick={() => setRole("staff")}
          className={cn(
            "px-2 py-0.5 rounded transition-colors",
            override.role === "staff"
              ? "bg-slate-600 font-bold text-white"
              : "text-slate-400 hover:text-white"
          )}
        >
          Staff
        </button>
      </div>

      <span className="text-slate-600 shrink-0">·</span>

      {/* Viewport indicator */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-slate-400">Viewport:</span>
        <span
          className={cn(
            "font-semibold",
            breakpoint === "Mobile" && "text-rose-400",
            breakpoint === "Tablet" && "text-amber-400",
            breakpoint === "Desktop" && "text-emerald-400"
          )}
        >
          {breakpoint}
        </span>
        {width > 0 && <span className="text-slate-500">({width}px)</span>}
      </div>
    </div>
  );
}
