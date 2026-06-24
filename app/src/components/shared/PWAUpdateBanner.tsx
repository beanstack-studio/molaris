"use client";

import { useEffect, useState } from "react";

// Baked in at build time by Vercel; undefined in local dev
const BUILD_SHA = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;

// Poll /api/version every 5 minutes to detect a new Vercel deployment
const POLL_INTERVAL_MS = 5 * 60 * 1000;

export function PWAUpdateBanner() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [vercelUpdate, setVercelUpdate] = useState(false);

  // ── Service worker update detection (PWA installs) ────────────────────────
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (cancelled || !reg) return;
      if (reg.waiting) { setWaiting(reg.waiting); return; }

      const onUpdateFound = () => {
        const installing = reg.installing;
        if (!installing) return;
        const onStateChange = () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            if (!cancelled) setWaiting(installing);
          }
        };
        installing.addEventListener("statechange", onStateChange);
      };
      reg.addEventListener("updatefound", onUpdateFound);
    });

    return () => { cancelled = true; };
  }, []);

  // ── Vercel deployment polling (regular browser, non-PWA) ─────────────────
  useEffect(() => {
    // Only poll when running on Vercel (BUILD_SHA is set) and not already a PWA update
    if (!BUILD_SHA || BUILD_SHA === "dev") return;

    async function checkVersion() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json() as { sha?: string };
        if (json.sha && json.sha !== BUILD_SHA && json.sha !== "dev") {
          setVercelUpdate(true);
        }
      } catch {
        // network error — ignore silently
      }
    }

    const id = setInterval(() => { void checkVersion(); }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  function handleReload() {
    if (waiting) {
      waiting.postMessage({ type: "SKIP_WAITING" });
    }
    window.location.reload();
  }

  if (!waiting && !vercelUpdate) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-blue-600 text-white text-sm py-2.5 px-4 flex items-center justify-between gap-4 shadow-lg">
      <span className="font-medium">A new version of Molaris is available.</span>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleReload}
          className="bg-white text-blue-600 font-semibold text-xs px-3 py-1 rounded-md hover:bg-blue-50 transition-colors"
        >
          Reload
        </button>
        <button
          onClick={() => { setWaiting(null); setVercelUpdate(false); }}
          className="text-blue-200 hover:text-white transition-colors p-1"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
