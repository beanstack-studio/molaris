"use client";

// TODO: REMOVE BEFORE MULTI-TENANT LAUNCH
// Dev-only context for simulating different plan/role states in staging.

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

const SESSION_KEY = "molaris_dev_override";

export type ViewMode = "desktop" | "tablet" | "mobile";

type DevOverride = {
  plan: "free" | "pro";
  role: "admin" | "dentist" | "staff";
  viewMode: ViewMode;
};

type DevOverrideContextValue = {
  override: DevOverride;
  setPlan: (plan: "free" | "pro") => void;
  setRole: (role: "admin" | "dentist" | "staff") => void;
  setPreset: (preset: "admin" | "dentist" | "staff" | "free") => void;
  setViewMode: (mode: ViewMode) => void;
};

const DevOverrideContext = createContext<DevOverrideContextValue | null>(null);

export function DevOverrideProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<DevOverride>({ plan: "pro", role: "admin", viewMode: "desktop" });

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<DevOverride>;
        setOverride({ plan: "pro", role: "admin", viewMode: "desktop", ...parsed });
      }
    } catch {
      /* ignore */
    }
  }, []);

  function persist(next: DevOverride) {
    setOverride(next);
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  function setPlan(plan: "free" | "pro") { persist({ ...override, plan }); }
  function setRole(role: "admin" | "dentist" | "staff") { persist({ ...override, role }); }
  function setViewMode(mode: ViewMode) { persist({ ...override, viewMode: mode }); }

  function setPreset(preset: "admin" | "dentist" | "staff" | "free") {
    const presets: Record<string, DevOverride> = {
      admin:   { plan: "pro",  role: "admin",   viewMode: override.viewMode },
      dentist: { plan: "pro",  role: "dentist", viewMode: override.viewMode },
      staff:   { plan: "pro",  role: "staff",   viewMode: override.viewMode },
      free:    { plan: "free", role: "admin",   viewMode: override.viewMode },
    };
    persist(presets[preset]);
  }

  return (
    <DevOverrideContext.Provider value={{ override, setPlan, setRole, setPreset, setViewMode }}>
      {children}
    </DevOverrideContext.Provider>
  );
}

export function useDevOverride(): DevOverrideContextValue | null {
  return useContext(DevOverrideContext);
}
