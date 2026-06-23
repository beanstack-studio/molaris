"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClinic } from "@/contexts/ClinicContext";
import { FeatureGate } from "@/components/shared/FeatureGate";
import { SlidingTabBar } from "@/components/shared/SlidingTabBar";

const tabs = [
  { label: "Payments",            href: "/reports/payments" },
  { label: "Treatment Analytics", href: "/reports/treatment-analytics" },
  { label: "Appointments",        href: "/reports/appointments" },
  { label: "Clinic Performance",  href: "/reports/clinic-performance" },
  { label: "Patient Revenue",     href: "/reports/patient-revenue" },
];

function ReportsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="page-bg">
      <main className="app-section">
        <div className="app-section-header">
          <div className="app-section-title">Reports</div>
        </div>

        <SlidingTabBar>
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
        </SlidingTabBar>

        <div className="app-section-body">{children}</div>
      </main>
    </div>
  );
}

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate feature="reports">
      <ReportsShell>{children}</ReportsShell>
    </FeatureGate>
  );
}
