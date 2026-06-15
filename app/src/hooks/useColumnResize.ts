"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MIN_WIDTH = 60;
const DEFAULT_WIDTH = 120;

export interface UseColumnResizeReturn {
  getWidth: (colKey: string) => number | undefined;
  startResize: (colKey: string, e: React.MouseEvent) => void;
}

export function useColumnResize(tableName: string): UseColumnResizeReturn {
  const storageKey = `molaris_widths_${tableName}`;

  // Start with empty state to avoid SSR hydration mismatches;
  // hydrate from localStorage in useEffect.
  const [widths, setWidths] = useState<Record<string, number>>({});
  const widthsRef = useRef<Record<string, number>>({});

  // Keep ref in sync with state so mouse handlers always see the latest value.
  useEffect(() => {
    widthsRef.current = widths;
  }, [widths]);

  // Hydrate from localStorage after mount (client only).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const validated: Record<string, number> = {};
          for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === "number" && v >= MIN_WIDTH) {
              validated[k] = v;
            }
          }
          setWidths(validated);
          widthsRef.current = validated;
        }
      }
    } catch {
      // Ignore corrupt localStorage data
    }
  }, [storageKey]);

  const getWidth = useCallback(
    (colKey: string): number | undefined => widths[colKey],
    [widths],
  );

  const startResize = useCallback(
    (colKey: string, e: React.MouseEvent): void => {
      e.preventDefault();

      const startX = e.clientX;
      const startWidth = widthsRef.current[colKey] ?? DEFAULT_WIDTH;

      // Prevent text selection while dragging.
      document.body.classList.add("select-none");

      const onMouseMove = (moveEvent: MouseEvent): void => {
        const newWidth = Math.max(
          MIN_WIDTH,
          startWidth + (moveEvent.clientX - startX),
        );
        const updated = { ...widthsRef.current, [colKey]: newWidth };
        widthsRef.current = updated;
        setWidths(updated);
      };

      const onMouseUp = (): void => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.classList.remove("select-none");

        // Persist final widths to localStorage.
        try {
          localStorage.setItem(storageKey, JSON.stringify(widthsRef.current));
        } catch {
          // localStorage may be unavailable in private browsing, etc.
        }
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [storageKey],
  );

  // Clean up any lingering listeners on unmount.
  useEffect(() => {
    return () => {
      document.body.classList.remove("select-none");
    };
  }, []);

  return { getWidth, startResize };
}
