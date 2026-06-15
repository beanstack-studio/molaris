"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageLoader } from "@/components/Spinner";
import { useClinic } from "@/contexts/ClinicContext";
import { cn } from "@/lib/cn";

interface SettingsNavItem {
  label: string;
  href: string;
  emoji: string;
}

interface SettingsSection {
  title: string;
  items: SettingsNavItem[];
}

const settingsSections: SettingsSection[] = [
  {
    title: "Clinic",
    items: [
      { label: "Clinic Profile",      href: "/settings/clinic-profile",      emoji: "🏥" },
      { label: "Services",            href: "/settings/services",            emoji: "🦷" },
      { label: "Payment Modes",       href: "/settings/payment-modes",       emoji: "💳" },
      { label: "Document Templates",  href: "/settings/document-templates",  emoji: "📄" },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Team Members",  href: "/settings/team",           emoji: "👥" },
      { label: "Calendar Sync", href: "/settings/calendar-sync",  emoji: "📅" },
    ],
  },
];

// Flat list used for mobile tab strip
const allSettingsItems: SettingsNavItem[] = settingsSections.flatMap((s) => s.items);

function IconBack() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isOwner, isLoading } = useClinic();

  if (isLoading) return <PageLoader />;

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

        {/* Mobile: horizontal scrollable tab strip */}
        <div className="lg:hidden mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Link href="/dashboard" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors">
              <IconBack />
              Back
            </Link>
            <span className="text-slate-300">·</span>
            <span className="text-sm font-semibold text-slate-700">⚙ Settings</span>
          </div>
          <div className="tabs bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1">
            {allSettingsItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("tab-item", active && "tab-item-active")}
                >
                  {item.emoji} {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Desktop: settings sub-sidebar + content */}
        <div className="hidden lg:flex gap-6">
          {/* Settings sub-sidebar */}
          <aside className="w-[200px] shrink-0 flex flex-col bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 rounded-xl py-3">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 px-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">⚙ SETTINGS</span>
              <Link
                href="/dashboard"
                className="sidebar-toggle-btn"
                title="Back to dashboard"
                aria-label="Close settings"
              >
                <IconClose />
              </Link>
            </div>

            {/* Grouped nav items */}
            {settingsSections.map((section) => (
              <div key={section.title}>
                <div className="settings-sub-section-label">{section.title}</div>
                {section.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn("settings-sub-item", active && "settings-sub-item-active")}
                      aria-current={active ? "page" : undefined}
                    >
                      <span aria-hidden="true">{item.emoji}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </aside>

          {/* Page content */}
          <div className="flex-1 min-w-0">
            <div className="app-section-body pt-0">{children}</div>
          </div>
        </div>

        {/* Mobile: content below tab strip */}
        <div className="lg:hidden">
          <div className="app-section-body">{children}</div>
        </div>
      </main>
    </div>
  );
}
