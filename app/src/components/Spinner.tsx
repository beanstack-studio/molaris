"use client";

import React from "react";

/**
 * SVG spinner — color driven by --accent-hue CSS variable (theme-aware).
 * Transparent background, no image file needed.
 */
export function Spinner({ size = "h-12 w-12" }: { size?: string }) {
  return (
    <svg
      viewBox="0 0 50 50"
      className={`animate-spin ${size}`}
      aria-label="Loading"
      role="status"
    >
      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        className="spinner-track"
        strokeWidth="5"
      />
      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        className="spinner-arc"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="75 125"
      />
    </svg>
  );
}

/**
 * Full-screen loading overlay — fixed to viewport center so it's always
 * visually centered regardless of page scroll position or content above it.
 * Usage: <PageLoader /> or <PageLoader text="Loading patients…">…children…</PageLoader>
 */
export function PageLoader({ text = "Loading…", children }: { text?: string; children?: React.ReactNode }) {
  return (
    <div className="loading-screen">
      <div className="loading-container">
        <Spinner />
        <div className="loading-text">{text}</div>
        {children}
      </div>
    </div>
  );
}
