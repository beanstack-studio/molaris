"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useClinic } from "@/contexts/ClinicContext";
import { cn } from "@/lib/cn";

export interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onSignOut: () => void;
}

// ─── Icons (inline SVG, no icon library) ──────────────────────────────────────

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

function IconGear() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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

function IconSun() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" />
      <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
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

// ─── Nav items: Dashboard, Appointments, Patients, Reports only ───────────────
// Settings is accessed via the gear icon — NOT a nav item

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  matchPrefix: string;
}

const navItems: NavItem[] = [
  { href: "/dashboard",       label: "Dashboard",    icon: <IconDashboard />, matchPrefix: "/dashboard" },
  { href: "/appointments",    label: "Appointments", icon: <IconCalendar />,  matchPrefix: "/appointments" },
  { href: "/patients",        label: "Patients",     icon: <IconPatients />,  matchPrefix: "/patients" },
  { href: "/reports/payments",label: "Reports",      icon: <IconReports />,   matchPrefix: "/reports" },
];

// ─── Gear dropdown toggle switch ──────────────────────────────────────────────

interface GearToggleProps {
  isDark: boolean;
  onToggle: () => void;
}

function GearToggle({ isDark, onToggle }: GearToggleProps) {
  const switchClass = cn("switch-btn", isDark ? "switch-btn-on" : "switch-btn-off");
  const thumbClass = cn("switch-thumb", isDark ? "switch-thumb-on" : "switch-thumb-off");
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      onClick={onToggle}
      className={switchClass}
      aria-label="Toggle dark mode"
    >
      <span className={thumbClass} />
    </button>
  );
}

// ─── Sidebar component ─────────────────────────────────────────────────────────

export function Sidebar({ collapsed, onToggle, onSignOut }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { clinicName, plan, isOwner, userFullName, userEmail } = useClinic();
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  const gearRef = useRef<HTMLDivElement>(null);

  // Sync dark mode state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("molaris_theme");
    setIsDark(stored === "dark");
  }, []);

  function toggleDark() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("molaris_theme", next ? "dark" : "light");
  }

  // Close gear dropdown on outside click or Escape key
  useEffect(() => {
    if (!gearOpen) return;

    function handleMouseDown(e: MouseEvent) {
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) {
        setGearOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setGearOpen(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [gearOpen]);

  function handleSettingsClick() {
    setGearOpen(false);
    router.push("/settings/clinic-profile");
  }

  // Load clinic logo from localStorage cache, then refresh from DB
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

  // Re-sync logo when clinic profile is saved elsewhere in the app
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

  // Keep browser favicon in sync with the clinic logo
  useEffect(() => {
    if (!logoSrc) return;
    document.querySelectorAll("link[data-app-favicon]").forEach((el) => el.remove());
    const link = document.createElement("link");
    link.rel = "icon";
    link.setAttribute("data-app-favicon", "true");
    link.href = logoSrc;
    document.head.appendChild(link);
  }, [logoSrc]);

  // Derived display values — computed above JSX
  const userInitials = (userFullName ?? userEmail ?? "U")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const clinicInitials = clinicName
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "C";

  const displayName = userFullName ?? userEmail ?? "User";
  const roleLabel = isOwner ? "Owner" : "Staff";
  const planLabel = plan === "pro" ? "Pro" : "Free";
  const planClass = plan === "pro"
    ? "badge badge-info"
    : "badge badge-secondary";
  const roleBadgeClass = isOwner
    ? "text-xs px-1.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700"
    : "text-xs px-1.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-500";

  const appearanceLabel = isDark ? "Dark" : "Light";
  const dropdownItemClass = "flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-md w-full text-left text-slate-700 dark:text-slate-200";

  // ─── Gear button + dropdown (shared between collapsed and expanded) ──────────
  const gearDropdown = (
    <div ref={gearRef} className="relative">
      <button
        type="button"
        onClick={() => setGearOpen((prev) => !prev)}
        className="sidebar-toggle-btn"
        title="Settings & appearance"
        aria-label="Settings & appearance"
        aria-expanded={gearOpen}
      >
        <IconGear />
      </button>

      {gearOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
          {/* Appearance row */}
          <div
            className={dropdownItemClass}
            role="button"
            tabIndex={0}
            onClick={toggleDark}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleDark(); }}
          >
            {isDark ? <IconSun /> : <IconMoon />}
            <span className="flex-1">{appearanceLabel}</span>
            <GearToggle isDark={isDark} onToggle={toggleDark} />
          </div>

          {/* Settings row */}
          <button
            type="button"
            className={dropdownItemClass}
            onClick={handleSettingsClick}
          >
            <IconGear />
            <span>Settings</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <aside
      className={cn("sidebar-wrapper hidden lg:flex", collapsed ? "w-14" : "w-[220px]")}
      aria-label="Main navigation"
    >
      {/* ── TOP: clinic logo + name + plan badge + gear icon ── */}
      {collapsed ? (
        <div className="flex flex-col items-center gap-2 px-2 py-3 border-b border-slate-100">
          <Link href="/dashboard" aria-label="Dashboard">
            {logoSrc ? (
              <img src={logoSrc} alt="Clinic logo" className="h-8 w-8 rounded-full object-contain" />
            ) : (
              <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white sidebar-user-avatar">
                {clinicInitials}
              </div>
            )}
          </Link>
          {gearDropdown}
        </div>
      ) : (
        <div className="px-3 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="shrink-0" aria-label="Dashboard">
              {logoSrc ? (
                <img src={logoSrc} alt="Clinic logo" className="h-8 w-8 rounded-full object-contain" />
              ) : (
                <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white sidebar-user-avatar">
                  {clinicInitials}
                </div>
              )}
            </Link>
            <div className="flex-1 min-w-0">
              <div className="sidebar-clinic-name">{clinicName}</div>
              <span className={planClass}>{planLabel}</span>
            </div>
            <div className="shrink-0">
              {gearDropdown}
            </div>
          </div>
        </div>
      )}

      {/* ── MIDDLE: nav items — clicking empty space toggles collapse ── */}
      <nav
        className="flex-1 flex flex-col gap-1 px-2 py-3 overflow-y-auto cursor-pointer"
        onClick={(e) => { if (e.target === e.currentTarget) onToggle(); }}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.matchPrefix) ?? false;
          const itemClass = cn(
            "sidebar-nav-item",
            isActive && "sidebar-nav-item-active",
            collapsed && "justify-center"
          );
          return (
            <Link
              key={item.href}
              href={item.href}
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

      {/* ── BOTTOM: user info + sign out + collapse toggle ── */}
      <div className="border-t border-slate-100 px-2 py-3 flex flex-col gap-1">
        {/* User identity */}
        <div className={cn("flex items-center gap-2 px-2 py-1.5 rounded-xl", collapsed && "justify-center px-0")}>
          <div className="sidebar-user-avatar w-8 h-8 text-xs shrink-0">
            {userInitials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-700 truncate">{displayName}</div>
              <span className={roleBadgeClass}>{roleLabel}</span>
            </div>
          )}
        </div>

        {/* Sign out — always visible, label shown when expanded */}
        <button
          type="button"
          onClick={onSignOut}
          className={cn(
            "sidebar-nav-item text-slate-400 hover:text-red-500 mt-1",
            collapsed && "justify-center"
          )}
          title={collapsed ? "Sign out" : undefined}
        >
          <IconSignOut />
          {!collapsed && <span>Sign out</span>}
        </button>

      </div>
    </aside>
  );
}
