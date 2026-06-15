"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClinic } from "@/contexts/ClinicContext";
import { cn } from "@/lib/cn";

// Mobile-only tab strip items (no emoji)
const mobileSettingsItems = [
  { label: "Clinic Profile", href: "/settings/clinic-profile" },
  { label: "Services",       href: "/settings/services" },
  { label: "Payment Modes",  href: "/settings/payment-modes" },
  { label: "Documents",      href: "/settings/document-templates" },
  { label: "Team",           href: "/settings/team" },
  { label: "Account",        href: "/settings/account" },
];

function IconBack() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isOwner, isLoading } = useClinic();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
        Loading...
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="page-bg">
        <main className="app-section">
          <div className="app-section-header">
            <div className="app-section-title">Settings</div>
          </div>
          <div className="card text-center py-16">
            <div className="text-slate-500 font-medium mb-1">Access restricted</div>
            <div className="text-sm text-slate-400">This section is only available to owners.</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-bg">
      <main className="app-section">

        {/* Mobile only: horizontal scrollable tab strip */}
        <div className="lg:hidden mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Link href="/dashboard" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors">
              <IconBack />
              Back
            </Link>
            <span className="text-slate-300">·</span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Settings</span>
          </div>
          <div className="tabs bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1">
            {mobileSettingsItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("tab-item", active && "tab-item-active")}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Content — no sub-sidebar on desktop (handled by main Sidebar flyout) */}
        <div className="app-section-body">
          {children}
        </div>

      </main>
    </div>
  );
}
