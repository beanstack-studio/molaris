"use client";

import { useEffect, useState } from "react";
import { useClinic } from "@/contexts/ClinicContext";

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconCheck() {
  return (
    <svg className="w-4 h-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg className="w-4 h-4 shrink-0 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path strokeLinecap="round" d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" />
      <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

// ─── Plan feature lists ───────────────────────────────────────────────────────

const FREE_FEATURES = [
  "Patient records (unlimited)",
  "Appointments calendar",
  "Treatment records",
  "Billing & invoicing",
  "Document generation",
  "Up to 2 staff accounts",
];

const PRO_FEATURES = [
  "Everything in Free",
  "Unlimited staff accounts",
  "Advanced reports & analytics",
  "Google Calendar sync",
  "Priority support",
];

// ─── AccountPage ──────────────────────────────────────────────────────────────

export default function AccountPage() {
  const { plan, clinicName, isOwner } = useClinic();
  const isPro = plan === "pro";

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("molaris_theme");
    setIsDark(stored === "dark");
  }, []);

  function toggleDark() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("molaris_theme", next ? "dark" : "light");
  }

  return (
    <div className="spacing-vertical-lg">

      {/* ── Plan ─────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Plan</h2>
        </div>

        <div className="spacing-vertical-lg">
          {/* Current plan badge */}
          <div className="flex items-center gap-3">
            <span className={isPro ? "badge badge-info text-sm px-3 py-1" : "badge badge-secondary text-sm px-3 py-1"}>
              {isPro ? "Pro" : "Free"}
            </span>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {clinicName} is on the <strong>{isPro ? "Pro" : "Free"}</strong> plan.
            </span>
          </div>

          {/* Feature comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Free column */}
            <div className={`card card-light p-4 ${!isPro ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Free</span>
                {!isPro && <span className="badge badge-secondary text-xs">Current plan</span>}
              </div>
              <ul className="space-y-2">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <IconCheck />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro column */}
            <div className={`card card-light p-4 ${isPro ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Pro</span>
                {isPro
                  ? <span className="badge badge-info text-xs">Current plan</span>
                  : (
                    <div className="relative group">
                      <button
                        type="button"
                        className="save-btn h-7 px-3 text-xs opacity-60 cursor-not-allowed"
                        disabled
                        aria-disabled="true"
                      >
                        Upgrade
                      </button>
                      <div className="absolute bottom-full right-0 mb-1 hidden group-hover:block z-10 pointer-events-none">
                        <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap">
                          Contact support to upgrade
                        </div>
                      </div>
                    </div>
                  )
                }
              </div>
              <ul className="space-y-2">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    {isPro ? <IconCheck /> : <IconLock />}
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {!isOwner && (
            <p className="hint-text">Plan changes can only be made by the clinic owner.</p>
          )}
        </div>
      </div>

      {/* ── Appearance ───────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Appearance</h2>
        </div>

        <div className="spacing-vertical-lg">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Customize how Molaris looks on your device. This setting is saved per browser.
          </p>

          <div className="card card-light flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <span className="text-slate-500 dark:text-slate-400">
                {isDark ? <IconMoon /> : <IconSun />}
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {isDark ? "Dark mode" : "Light mode"}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {isDark ? "Using dark theme" : "Using light theme"}
                </div>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isDark}
              onClick={toggleDark}
              className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 bg-slate-200 dark:bg-blue-600"
              aria-label="Toggle dark mode"
            >
              <span className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out translate-x-0 dark:translate-x-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Integrations ─────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Integrations</h2>
        </div>

        <div className="spacing-vertical-lg">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Connect external services to extend Molaris.
          </p>

          <div className="card card-light flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-0.5">
                Google Calendar
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Sync confirmed appointments to Google Calendar automatically.
              </div>
            </div>
            <div className="relative group shrink-0">
              <button
                type="button"
                className="save-btn opacity-50 cursor-not-allowed"
                disabled
                aria-disabled="true"
              >
                Connect
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
                <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap">
                  Coming soon
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
