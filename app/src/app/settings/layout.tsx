"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import TopNav from "@/components/TopNav";

const tabs = [
  { label: "Clinic Profile", href: "/settings/clinic-profile" },
  { label: "Services", href: "/settings/services" },
  { label: "Dentists", href: "/settings/dentists" },
  { label: "Payment Modes", href: "/settings/payment-modes" },
  { label: "Document Templates", href: "/settings/document-templates" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />

      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Settings</h1>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border bg-white overflow-hidden">
          <div className="flex flex-wrap gap-1 border-b bg-slate-50 px-2 pt-2">
            {tabs.map((t) => {
              const active = pathname === t.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={[
                    "rounded-t-xl border px-3 py-2 text-sm font-semibold",
                    active
                      ? "bg-white border-slate-200 border-b-white"
                      : "bg-slate-100 border-slate-200 hover:bg-white",
                  ].join(" ")}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>

          <div className="p-4">{children}</div>
        </div>
      </main>
    </div>
  );
}
