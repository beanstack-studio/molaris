import Link from "next/link";
import React from "react";

export default function PatientsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Global header for all /patients routes */}
      <div className="sticky top-0 z-50 border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <Link href="/patients" className="text-sm font-semibold text-slate-900 hover:underline">
            Matira Dental Studio
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Settings
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">{children}</div>
    </div>
  );
}
