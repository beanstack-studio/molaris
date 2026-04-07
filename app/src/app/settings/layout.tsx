"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Clinic Profile", href: "/settings/clinic-profile" },
  { label: "Services", href: "/settings/services" },
  { label: "Team", href: "/settings/team" },
  { label: "Payment Modes", href: "/settings/payment-modes" },
  { label: "Document Templates", href: "/settings/document-templates" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="page-bg">
      <main className="app-section">
        <div className="app-section-header">
          <div>
            <div className="app-section-title">Settings</div>
            <div className="app-section-subtitle">Clinic configuration</div>
          </div>
        </div>

        <div className="tabs">
          {tabs.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`tab-item ${active ? "tab-item-active" : ""}`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        <div className="app-section-body">{children}</div>
      </main>
    </div>
  );
}
