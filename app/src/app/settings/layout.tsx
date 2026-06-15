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
}

interface SettingsSection {
  title: string;
  items: SettingsNavItem[];
}

const settingsSections: SettingsSection[] = [
  {
    title: "Clinic",
    items: [
      { label: "Clinic Profile", href: "/settings/clinic-profile" },
      { label: "Services", href: "/settings/services" },
      { label: "Payment Modes", href: "/settings/payment-modes" },
      { label: "Document Templates", href: "/settings/document-templates" },
    ],
  },
  {
    title: "Team",
    items: [
      { label: "Team Members", href: "/settings/team" },
    ],
  },
];

// Flat list for mobile tabs
const allSettingsItems: SettingsNavItem[] = settingsSections.flatMap((s) => s.items);

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
        <div className="app-section-header">
          <div className="app-section-title">Settings</div>
        </div>

        {/* Mobile: horizontal scroll tabs */}
        <div className="lg:hidden tabs">
          {allSettingsItems.map((item) => {
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

        {/* Desktop: sub-sidebar + content */}
        <div className="hidden lg:flex gap-6 pt-2">
          {/* Sub-sidebar */}
          <aside className="w-[200px] shrink-0 flex flex-col">
            {settingsSections.map((section) => (
              <div key={section.title}>
                <div className="settings-sub-section-label">{section.title}</div>
                {section.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "settings-sub-item",
                        active && "settings-sub-item-active"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </aside>

          {/* Settings content */}
          <div className="flex-1 min-w-0">
            <div className="app-section-body pt-0">{children}</div>
          </div>
        </div>

        {/* Mobile content (below tabs) */}
        <div className="lg:hidden">
          <div className="app-section-body">{children}</div>
        </div>
      </main>
    </div>
  );
}
