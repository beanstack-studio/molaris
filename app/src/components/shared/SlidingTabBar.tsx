"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

interface SlidingTabBarProps {
  children: React.ReactNode;
  className?: string;
}

export function SlidingTabBar({ children, className }: SlidingTabBarProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function move() {
      const container = ref.current;
      if (!container) return;
      const active = container.querySelector<HTMLElement>(".tab-item-active");
      if (!active) return;
      // Use offsetLeft/offsetWidth — unaffected by horizontal scroll of the container,
      // giving correct position relative to the container's content edge.
      container.style.setProperty("--tab-x", `${active.offsetLeft}px`);
      container.style.setProperty("--tab-w", `${active.offsetWidth}px`);
    }

    move();
    const ro = new ResizeObserver(move);
    const el = ref.current;
    if (el) ro.observe(el);
    return () => ro.disconnect();
  }); // intentionally no deps — re-runs on every render to catch route-based tab changes

  return (
    <div ref={ref} className={cn("tabs", className)}>
      {children}
      <span className="tab-slide-indicator" aria-hidden="true" />
    </div>
  );
}
