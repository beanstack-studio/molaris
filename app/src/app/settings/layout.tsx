"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PageLoader } from "@/components/Spinner";

const tabs = [
  { label: "Clinic Profile", href: "/settings/clinic-profile" },
  { label: "Services", href: "/settings/services" },
  { label: "Team", href: "/settings/team" },
  { label: "Payment Modes", href: "/settings/payment-modes" },
  { label: "Document Templates", href: "/settings/document-templates" },
  { label: "Website Controls", href: "/settings/website-controls" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const r =
        (data.user?.user_metadata?.role as string) ??
        (data.user?.app_metadata?.role as string) ??
        "staff";
      setRole(r);
      setChecking(false);
    });
  }, []);

  if (checking) return <PageLoader />;

  if (role !== "admin") {
    return (
      <div className="page-bg">
        <main className="app-section">
          <div className="app-section-header">
            <div className="app-section-title">Settings</div>
          </div>
          <div className="card text-center py-16">
            <div className="text-slate-500 font-medium mb-1">Access restricted</div>
            <div className="text-sm text-slate-400">This section is only available to admin users.</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-bg">
      <main className="app-section">
        <div className="app-section-header">
          <div>
            <div className="app-section-title">Settings</div>
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
