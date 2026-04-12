"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Payments", href: "/reports/payments" },
  { label: "Treatment Analytics", href: "/reports/treatment-analytics" },
  { label: "Appointments", href: "/reports/appointments" },
  { label: "Clinic Performance", href: "/reports/clinic-performance" },
];

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="page-bg">
      <main className="app-section">
        <div className="app-section-header">
          <div>
            <div className="app-section-title">Reports</div>
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
