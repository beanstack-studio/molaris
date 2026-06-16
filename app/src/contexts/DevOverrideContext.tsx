"use client";

// TODO: REMOVE BEFORE MULTI-TENANT LAUNCH
// Dev-only context for simulating different plan/role states in staging.

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

const SESSION_KEY = "molaris_dev_override";

type DevOverride = {
  plan: "free" | "pro";
  role: "admin" | "dentist" | "staff";
};

type DevOverrideContextValue = {
  override: DevOverride;
  setPlan: (plan: "free" | "pro") => void;
  setRole: (role: "admin" | "dentist" | "staff") => void;
  setPreset: (preset: "admin" | "dentist" | "staff" | "free") => void;
};

const DevOverrideContext = createContext<DevOverrideContextValue | null>(null);

export function DevOverrideProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<DevOverride>({ plan: "pro", role: "admin" });

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) setOverride(JSON.parse(stored) as DevOverride);
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

  function setPreset(preset: "admin" | "dentist" | "staff" | "free") {
    const presets: Record<string, DevOverride> = {
      admin:   { plan: "pro",  role: "admin" },
      dentist: { plan: "pro",  role: "dentist" },
      staff:   { plan: "pro",  role: "staff" },
      free:    { plan: "free", role: "admin" },
    };
    persist(presets[preset]);
  }

  return (
    <DevOverrideContext.Provider value={{ override, setPlan, setRole, setPreset }}>
      {children}
    </DevOverrideContext.Provider>
  );
}

export function useDevOverride(): DevOverrideContextValue | null {
  return useContext(DevOverrideContext);
}
