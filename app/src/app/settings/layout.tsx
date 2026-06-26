"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClinic } from "@/contexts/ClinicContext";
import { cn } from "@/lib/cn";
import { SlidingTabBar } from "@/components/shared/SlidingTabBar";

function IconBack() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
    </svg>
  );
}


interface MobileNavItem {
  label: string;
  href: string;
  /** If set, item is hidden when false. */
  show?: boolean;
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAdmin, isPro, isLoading } = useClinic();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
        Loading...
      </div>
    );
  }

  // Mobile tab items — ordered to match spec groupings
  const mobileSettingsItems: MobileNavItem[] = [
    // CLINIC
    { label: "Profile",                      href: "/settings/clinic-profile" },
    { label: "Team",                         href: "/settings/team" },
    { label: isAdmin ? "Services" : "Services 🔒", href: "/settings/services" },
    { label: isAdmin ? "Documents" : "Documents 🔒", href: "/settings/document-templates" },
    // ACCOUNT
    { label: "Account",    href: "/settings/account" },
    { label: "Billing",    href: "/settings/billing",           show: isAdmin },
  ].filter((item) => item.show !== false);

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
          <SlidingTabBar>
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
          </SlidingTabBar>
        </div>

        {/* Content — desktop nav is in main Sidebar flyout */}
        {children}

      </main>
    </div>
  );
}
