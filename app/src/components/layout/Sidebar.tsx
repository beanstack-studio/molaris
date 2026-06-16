"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useClinic } from "@/contexts/ClinicContext";
import { cn } from "@/lib/cn";

export interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onSignOut: () => void;
}

// ─── Icons (inline SVG, no icon library, no emoji) ────────────────────────────

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

function IconSignOut() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1" />
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

// ─── Nav items ────────────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  matchPrefix: string;
  isSettings?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard",        label: "Dashboard",    icon: <IconDashboard />, matchPrefix: "/dashboard" },
  { href: "/appointments",     label: "Appointments", icon: <IconCalendar />,  matchPrefix: "/appointments" },
  { href: "/patients",         label: "Patients",     icon: <IconPatients />,  matchPrefix: "/patients" },
  { href: "/reports/payments", label: "Reports",      icon: <IconReports />,   matchPrefix: "/reports" },
  { href: "/settings/clinic-profile", label: "Settings", icon: <IconSettings />, matchPrefix: "/settings", isSettings: true },
];

// ─── Settings flyout nav data ─────────────────────────────────────────────────

interface SettingsNavItem {
  label: string;
  href: string;
  /** If true, item is hidden for non-admins (not just locked). */
  adminOnly?: boolean;
  /** If true, show 🔒 for non-admins but keep item visible. */
  adminLock?: boolean;
  /** If true, show 🔒 for free-plan users but keep item visible. */
  proLock?: boolean;
}

const settingsFlyoutSections: { title: string; items: SettingsNavItem[] }[] = [
  {
    title: "Clinic",
    items: [
      { label: "Clinic Profile",  href: "/settings/clinic-profile" },
      { label: "Services",        href: "/settings/services",           adminLock: true },
      { label: "Payment Modes",   href: "/settings/payment-modes",      adminLock: true },
      { label: "Documents",       href: "/settings/document-templates", adminLock: true },
    ],
  },
  {
    title: "Team",
    items: [
      { label: "Team",            href: "/settings/team" },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "My Account",      href: "/settings/account" },
      { label: "Plan & Billing",  href: "/settings/billing",            adminOnly: true },
      { label: "Calendar Sync",   href: "/settings/calendar-sync",      proLock: true },
    ],
  },
];

// ─── Sidebar component ────────────────────────────────────────────────────────

export function Sidebar({ collapsed, onToggle, onSignOut }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { clinicName, plan, isAdmin, isPro, userFullName, userEmail } = useClinic();
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Auto-open settings accordion when on a settings route
  useEffect(() => {
    if (pathname?.startsWith("/settings")) setSettingsOpen(true);
    else setSettingsOpen(false);
  }, [pathname]);

  // Load clinic logo
  useEffect(() => {
    const cached = localStorage.getItem("clinic-logo-url");
    if (cached) setLogoSrc(cached);
    supabase.from("clinic_profile").select("logo_url").limit(1).then(({ data }) => {
      const url = data?.[0]?.logo_url;
      if (url) { setLogoSrc(url); localStorage.setItem("clinic-logo-url", url); }
    });
  }, []);

  useEffect(() => {
    function handle(e: Event) {
      const { logoUrl } = (e as CustomEvent<{ logoUrl?: string }>).detail ?? {};
      if (logoUrl) { setLogoSrc(logoUrl); localStorage.setItem("clinic-logo-url", logoUrl); }
    }
    window.addEventListener("clinicProfileUpdated", handle);
    return () => window.removeEventListener("clinicProfileUpdated", handle);
  }, []);

  useEffect(() => {
    if (!logoSrc) return;
    document.querySelectorAll("link[data-app-favicon]").forEach((el) => el.remove());
    const link = document.createElement("link");
    link.rel = "icon"; link.setAttribute("data-app-favicon", "true"); link.href = logoSrc;
    document.head.appendChild(link);
  }, [logoSrc]);

  // ─── Derived values ──────────────────────────────────────────────────────────
  const userInitials = (userFullName ?? userEmail ?? "U")
    .split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const clinicInitials = clinicName
    .split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "C";

  const displayName = userFullName ?? userEmail ?? "User";
  const { role } = useClinic();
  const roleLabel = role === "admin" ? "Admin" : role === "dentist" ? "Dentist" : "Staff";
  const planLabel = plan === "pro" ? "Pro" : "Free";
  const planClass = plan === "pro" ? "badge badge-info" : "badge badge-secondary";
  const roleBadgeClass = isAdmin
    ? "text-xs px-1.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700"
    : role === "dentist"
    ? "text-xs px-1.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700"
    : "text-xs px-1.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-500";

  return (
    <>
      <aside
        className={cn("sidebar-wrapper hidden lg:flex", collapsed ? "w-14" : "w-[220px]")}
        aria-label="Main navigation"
        onClick={() => { if (collapsed) onToggle(); }}
      >
        {/* ── TOP: clinic logo + name + plan badge ── */}
        {collapsed ? (
          <div className="flex flex-col items-center px-2 py-3 border-b border-slate-100 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <Link href="/dashboard" aria-label="Dashboard">
              {logoSrc ? (
                <img src={logoSrc} alt="Clinic logo" className="h-8 w-8 rounded-full object-contain" />
              ) : (
                <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white sidebar-user-avatar">
                  {clinicInitials}
                </div>
              )}
            </Link>
          </div>
        ) : (
          <div className="px-3 py-3 border-b border-slate-100 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-2">
              <Link href="/dashboard" className="shrink-0 mt-0.5" aria-label="Dashboard">
                {logoSrc ? (
                  <img src={logoSrc} alt="Clinic logo" className="h-8 w-8 rounded-full object-contain" />
                ) : (
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white sidebar-user-avatar">
                    {clinicInitials}
                  </div>
                )}
              </Link>
              <div className="min-w-0">
                <div className="sidebar-clinic-name break-words">{clinicName}</div>
                <span className={planClass}>{planLabel}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── MIDDLE: nav items — clicking empty space collapses ── */}
        <nav
          className="flex-1 flex flex-col gap-1 px-2 py-3 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget && !collapsed) onToggle(); }}
        >
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.matchPrefix) ?? false;
            const itemClass = cn(
              "sidebar-nav-item",
              isActive && "sidebar-nav-item-active",
              collapsed && "justify-center"
            );

            if (item.isSettings) {
              return (
                <div key="settings-group">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (collapsed) {
                        onToggle();
                        router.push(item.href);
                      } else if (isActive) {
                        onToggle(); // collapse when re-clicking the active settings group
                      } else {
                        setSettingsOpen(true);
                        router.push(item.href);
                      }
                    }}
                    className={cn(itemClass, "w-full text-left")}
                    title={collapsed ? item.label : undefined}
                    aria-expanded={settingsOpen}
                  >
                    {item.icon}
                    {!collapsed && <span className="flex-1">{item.label}</span>}
                    {!collapsed && (
                      <svg
                        className={cn("w-3 h-3 shrink-0 transition-transform duration-200", settingsOpen && "rotate-90")}
                        fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                      </svg>
                    )}
                  </button>

                  {/* Inline accordion sub-items — grouped by section */}
                  {settingsOpen && !collapsed && (
                    <div className="ml-3 mt-0.5 border-l border-slate-200 dark:border-slate-700 pl-2 flex flex-col gap-0">
                      {settingsFlyoutSections.map((section, si) => {
                        const visibleItems = section.items.filter(
                          (sub) => !(sub.adminOnly && !isAdmin)
                        );
                        if (visibleItems.length === 0) return null;
                        return (
                          <div key={section.title} className={si > 0 ? "mt-2" : ""}>
                            <div className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                              {section.title}
                            </div>
                            {visibleItems.map((sub) => {
                              const subActive = pathname === sub.href;
                              const isLocked = (sub.adminLock && !isAdmin) || (sub.proLock && !isPro);
                              return (
                                <Link
                                  key={sub.href}
                                  href={sub.href}
                                  onClick={(e) => e.stopPropagation()}
                                  className={cn(
                                    "flex items-center gap-1 px-2 py-1.5 text-sm rounded-md transition-colors",
                                    subActive
                                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium"
                                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
                                  )}
                                  aria-current={subActive ? "page" : undefined}
                                >
                                  <span className="flex-1">{sub.label}</span>
                                  {isLocked && (
                                    <svg className="w-3 h-3 shrink-0 opacity-40" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                      <rect x="3" y="11" width="18" height="11" rx="2" />
                                      <path strokeLinecap="round" d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                  )}
                                </Link>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => { e.stopPropagation(); if (collapsed || isActive) onToggle(); }}
                className={itemClass}
                title={collapsed ? item.label : undefined}
                aria-current={isActive ? "page" : undefined}
              >
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* ── BOTTOM: user info + sign out ── */}
        <div className="border-t border-slate-100 dark:border-slate-700 px-2 py-3 flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
          <div className={cn("flex items-center gap-2 px-2 py-1.5 rounded-xl", collapsed && "justify-center px-0")}>
            <div className="sidebar-user-avatar w-8 h-8 text-xs shrink-0">
              {userInitials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{displayName}</div>
                <span className={roleBadgeClass}>{roleLabel}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className={cn("sidebar-nav-item text-slate-400 hover:text-red-500 mt-1", collapsed && "justify-center")}
            title={collapsed ? "Sign out" : undefined}
          >
            <IconSignOut />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
