"use client";

import { useEffect, useState } from "react";

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

export default function AppearancePage() {
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
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Appearance</h2>
      </div>

      <div className="spacing-vertical-lg">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Customize how Molaris looks on your device. This setting is saved per browser.
        </p>

        <div className="card card-light flex items-center justify-between gap-4 py-4 px-4">
          <div className="flex items-center gap-3">
            {isDark ? (
              <span className="text-slate-500 dark:text-slate-400"><IconMoon /></span>
            ) : (
              <span className="text-slate-500"><IconSun /></span>
            )}
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
            <span
              className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out translate-x-0 dark:translate-x-5"
            />
          </button>
        </div>

        <p className="hint-text">
          Your theme preference is stored locally and applied immediately.
        </p>
      </div>
    </div>
  );
}
