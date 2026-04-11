"use client";

import { useEffect } from "react";
import { getStoredThemeId, getThemeById, applyTheme } from "@/lib/themeHelpers";

export function ThemeLoader() {
  useEffect(() => {
    applyTheme(getThemeById(getStoredThemeId()));
  }, []);

  return null;
}
