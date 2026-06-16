"use client";

import { useEffect, useState } from "react";

export function PWAUpdateBanner() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (cancelled || !reg) return;

      // Already has a waiting worker
      if (reg.waiting) {
        setWaiting(reg.waiting);
        return;
      }

      // Listen for a new service worker installing
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

    return () => {
      cancelled = true;
    };
  }, []);

  function handleReload() {
    if (!waiting) return;
    waiting.postMessage({ type: "SKIP_WAITING" });
    window.location.reload();
  }

  if (!waiting) return null;

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
          onClick={() => setWaiting(null)}
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
