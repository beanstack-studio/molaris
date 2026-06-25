"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { SlidingTabBar } from "@/components/shared/SlidingTabBar";
import { useClinic } from "@/contexts/ClinicContext";

export default function ExpensesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAdmin } = useClinic();

  const tabs = [
    { label: "General", href: "/expenses/operating" },
    { label: "Bills",     href: "/expenses/bills" },
    ...(isAdmin ? [{ label: "Payroll", href: "/expenses/payroll" }] : []),
  ];

  return (
    <div className="page-bg">
      <main className="app-section">
        <div className="mb-4">
          <SlidingTabBar>
            {tabs.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn("tab-item", active && "tab-item-active")}
                >
                  {tab.label}
                </Link>
              );
            })}
          </SlidingTabBar>
        </div>
        {children}
      </main>
    </div>
  );
}
