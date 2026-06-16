"use client";

// TODO: REMOVE BEFORE MULTI-TENANT LAUNCH
// Dev-only context for simulating different plan/role states in staging.

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

const SESSION_KEY = "molaris_dev_override";

type DevOverride = {
  plan: "free" | "pro";
  role: "owner" | "staff";
};

type DevOverrideContextValue = {
  override: DevOverride;
  setPlan: (plan: "free" | "pro") => void;
  setRole: (role: "owner" | "staff") => void;
};

const DevOverrideContext = createContext<DevOverrideContextValue | null>(null);

export function DevOverrideProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<DevOverride>({ plan: "pro", role: "owner" });

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) setOverride(JSON.parse(stored) as DevOverride);
    } catch {
      /* ignore */
    }
  }, []);

  function setPlan(plan: "free" | "pro") {
    const next = { ...override, plan };
    setOverride(next);
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  function setRole(role: "owner" | "staff") {
    const next = { ...override, role };
    setOverride(next);
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  return (
    <DevOverrideContext.Provider value={{ override, setPlan, setRole }}>
      {children}
    </DevOverrideContext.Provider>
  );
}

export function useDevOverride(): DevOverrideContextValue | null {
  return useContext(DevOverrideContext);
}
