"use client";

import { useState } from "react";

const settingsTabs = ["Services", "Dentists"] as const;
type SettingsTab = (typeof settingsTabs)[number];

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("Services");

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Settings</h1>
            <p className="text-sm text-slate-600">Manage services and dentists.</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border bg-white overflow-hidden">
          <div className="flex flex-wrap gap-1 border-b bg-slate-50 px-2 pt-2">
            {settingsTabs.map((t) => (
              <button
                key={t}
                className={[
                  "rounded-t-xl border px-3 py-2 text-sm font-semibold",
                  tab === t ? "bg-white border-slate-200 border-b-white" : "bg-slate-100 border-slate-200 hover:bg-white",
                ].join(" ")}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="p-4">
            {tab === "Services" ? (
              <div>
                {/* Render your existing Services UI here */}
              </div>
            ) : null}

            {tab === "Dentists" ? (
              <div>
                {/* Render your existing Dentists UI here */}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
