"use client";

import { useEffect, useState } from "react";
import {
  THEMES,
  getStoredThemeId,
  applyTheme,
  type Theme,
} from "@/lib/themeHelpers";

export function ThemePicker() {
  const [activeId, setActiveId] = useState(getStoredThemeId());

  useEffect(() => {
    setActiveId(getStoredThemeId());
  }, []);

  function pick(theme: Theme) {
    setActiveId(theme.id);
    applyTheme(theme);
  }

  return (
    <div>
      <div className="text-sm text-slate-500 mb-4">
        Choose a theme to update the accent color and background throughout the app.
        Your selection is saved automatically.
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {THEMES.map((theme) => {
          const isActive = activeId === theme.id;
          const sat = theme.sat ?? 70;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => pick(theme)}
              className={[
                "rounded-2xl border-2 overflow-hidden text-left transition-all hover:scale-[1.02] focus:outline-none",
                isActive
                  ? "border-violet-500 shadow-lg"
                  : "border-transparent shadow hover:border-slate-200",
              ].join(" ")}
            >
              {/* Background preview */}
              <div
                className="h-28 w-full"
                style={{
                  backgroundImage: theme.previewBg,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />

              {/* Label row */}
              <div className="flex items-center justify-between px-3 py-2 bg-white/90">
                <div className="flex items-center gap-2">
                  <div
                    className="h-4 w-4 rounded-full flex-shrink-0 shadow-sm"
                    style={{ background: `hsl(${theme.hue} ${sat}% 44%)` }}
                  />
                  <span className="text-sm font-medium text-slate-700">{theme.name}</span>
                </div>
                {isActive && (
                  <span className="text-xs font-semibold text-violet-600">Active</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
