import Link from "next/link";
import React from "react";
import TopNav from "@/components/TopNav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />

      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
        <div className="rounded-xl border bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">Settings</div>
              <div className="text-xs text-slate-600">Manage services and dentists.</div>
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

        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}