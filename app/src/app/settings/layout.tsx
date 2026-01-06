import Link from "next/link";
import React from "react";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-50 border-b bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Link href="/patients" className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
              ← Patients
            </Link>
            <div className="text-sm font-semibold text-slate-900">Settings</div>
          </div>

          <div className="flex gap-2">
            <Link
              href="/settings/services"
              className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Services
            </Link>
            <Link
              href="/settings/dentists"
              className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Dentists
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">{children}</div>
    </div>
  );
}
