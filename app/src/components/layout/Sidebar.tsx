"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useClinic } from "@/contexts/ClinicContext";
import { cn } from "@/lib/cn";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onSignOut: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  matchPrefix: string;
}

function IconDashboard() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function IconPatients() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconReports() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path strokeLinecap="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
    </svg>
  );
}

function IconSignOut() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <IconDashboard />, matchPrefix: "/dashboard" },
  { href: "/appointments", label: "Appointments", icon: <IconCalendar />, matchPrefix: "/appointments" },
  { href: "/patients", label: "Patients", icon: <IconPatients />, matchPrefix: "/patients" },
  { href: "/reports/payments", label: "Reports", icon: <IconReports />, matchPrefix: "/reports" },
  { href: "/settings/clinic-profile", label: "Settings", icon: <IconSettings />, matchPrefix: "/settings" },
];

export function Sidebar({ collapsed, onToggle, onSignOut }: SidebarProps) {
  const pathname = usePathname();
  const { clinicName, isOwner, userFullName, userEmail } = useClinic();
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Load logo from cache, then refresh from DB
  useEffect(() => {
    const cached = localStorage.getItem("clinic-logo-url");
    if (cached) setLogoSrc(cached);

    supabase
      .from("clinic_profile")
      .select("logo_url")
      .limit(1)
      .then(({ data }) => {
        const url = data?.[0]?.logo_url;
        if (url) {
          setLogoSrc(url);
          localStorage.setItem("clinic-logo-url", url);
        }
      });
  }, []);

  // Sync logo when clinic profile is updated
  useEffect(() => {
    function handleProfileUpdate(e: Event) {
      const { logoUrl } = (e as CustomEvent<{ logoUrl?: string }>).detail ?? {};
      if (logoUrl) {
        setLogoSrc(logoUrl);
        localStorage.setItem("clinic-logo-url", logoUrl);
      }
    }
    window.addEventListener("clinicProfileUpdated", handleProfileUpdate);
    return () => window.removeEventListener("clinicProfileUpdated", handleProfileUpdate);
  }, []);

  // Sync favicon with clinic logo
  useEffect(() => {
    if (!logoSrc) return;
    document.querySelectorAll("link[data-app-favicon]").forEach((el) => el.remove());
    const link = document.createElement("link");
    link.rel = "icon";
    link.setAttribute("data-app-favicon", "true");
    link.href = logoSrc;
    document.head.appendChild(link);
  }, [logoSrc]);

  // Close popover on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    }
    if (popoverOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [popoverOpen]);

  const initials = (userFullName ?? userEmail ?? "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const displayName = userFullName ?? userEmail ?? "User";
  const roleLabel = isOwner ? "Owner" : "Staff";

  return (
    <aside
      className={cn("sidebar-wrapper hidden lg:flex", collapsed ? "w-14" : "w-[220px]")}
      aria-label="Main navigation"
    >
      {/* Top: logo + clinic name */}
      <div className={cn("flex items-center gap-2.5 px-3 py-4 border-b border-slate-100", collapsed && "justify-center px-0")}>
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt="Clinic logo"
              className="h-8 w-8 rounded-lg object-contain shrink-0"
            />
          ) : (
            <span className="text-xl shrink-0">🦷</span>
          )}
          {!collapsed && (
            <span className="text-sm font-bold truncate" style={{ color: "var(--accent-text)" }}>
              {clinicName}
            </span>
          )}
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 flex flex-col gap-1 px-2 py-3 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.matchPrefix) ?? false;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "sidebar-nav-item",
                isActive && "sidebar-nav-item-active",
                collapsed && "justify-center px-0 py-2.5 w-10 mx-auto"
              )}
            >
              {item.icon}
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: user info + toggle */}
      <div className="border-t border-slate-100 px-2 py-3 flex flex-col gap-2">
        {/* User section */}
        <div ref={popoverRef} className="relative">
          <button
            type="button"
            onClick={() => setPopoverOpen((o) => !o)}
            className={cn(
              "w-full flex items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-slate-50",
              collapsed && "justify-center px-0"
            )}
          >
            <div
              className="sidebar-user-avatar text-xs w-8 h-8 shrink-0"
              aria-hidden="true"
            >
              {initials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700 truncate">{displayName}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span
                    className={cn(
                      "text-xs px-1.5 py-0.5 rounded-full font-semibold",
                      isOwner
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {roleLabel}
                  </span>
                </div>
              </div>
            )}
          </button>

          {/* Popover */}
          {popoverOpen && (
            <div
              className={cn(
                "absolute bottom-full mb-2 w-48 rounded-xl bg-white shadow-lg border border-slate-100 py-1 z-50",
                collapsed ? "left-0" : "left-0"
              )}
            >
              {!collapsed && (
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="text-xs text-slate-400 truncate">{clinicName}</div>
                  <div className="text-sm font-medium text-slate-700 truncate">{displayName}</div>
                </div>
              )}
              <button
                type="button"
                onClick={() => { setPopoverOpen(false); onSignOut(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
              >
                <IconSignOut />
                Sign out
              </button>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <div className={cn("flex", collapsed ? "justify-center" : "justify-end pr-1")}>
          <button
            type="button"
            onClick={onToggle}
            className="sidebar-toggle-btn"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
        </div>
      </div>
    </aside>
  );
}
