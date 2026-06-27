"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useClinic } from "@/contexts/ClinicContext";
import { cn } from "@/lib/cn";

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconClose() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg className="w-4 h-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
    </svg>
  );
}

function IconSignOut() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1" />
    </svg>
  );
}

function IconClinicProfile() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16M3 21h18M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />
    </svg>
  );
}

function IconTeam() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconServices() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path strokeLinecap="round" d="M2 10h20M6 15h2M10 15h4" />
    </svg>
  );
}

function IconMaintenance() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function IconDocuments() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function IconAccount() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="4" />
      <path strokeLinecap="round" d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function IconBilling() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
    </svg>
  );
}

// ─── Nav item types ───────────────────────────────────────────────────────────

interface MenuNavItem {
  href: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  isTeam?: boolean;
}

const clinicItems: MenuNavItem[] = [
  { href: "/settings/clinic-profile",     label: "Clinic Profile",      sublabel: "Name, address, hours, contacts", icon: <IconClinicProfile /> },
  { href: "/settings/team",              label: "Team",                sublabel: "Schedule and leave requests",    icon: <IconTeam />, isTeam: true },
  { href: "/settings/services",          label: "Services & Payments", sublabel: "Fees, payment modes",            icon: <IconServices /> },
  { href: "/settings/maintenance",       label: "Maintenance Log",     sublabel: "Equipment upkeep",               icon: <IconMaintenance /> },
  { href: "/settings/document-templates", label: "Documents",           sublabel: "Templates and files",            icon: <IconDocuments /> },
];

const accountItems: MenuNavItem[] = [
  { href: "/settings/account",  label: "My Account",   sublabel: "Email, password, display name",  icon: <IconAccount /> },
  { href: "/settings/billing",  label: "Plan & Billing", sublabel: "Your subscription and limits", icon: <IconBilling />, adminOnly: true },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface ClinicMenuProps {
  onSignOut: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClinicMenu({ onSignOut }: ClinicMenuProps) {
  const pathname = usePathname();
  const { clinicName, clinicId, profileId, plan, role, isAdmin, userFullName, userEmail } = useClinic();

  const [open, setOpen] = useState(false);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  const [unseenDecisionCount, setUnseenDecisionCount] = useState(0);

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Load clinic logo from localStorage cache then Supabase
  useEffect(() => {
    if (!clinicId) return;
    const cached = localStorage.getItem("clinic-logo-url");
    if (cached) setLogoSrc(cached);
    supabase
      .from("clinic_profile")
      .select("logo_url")
      .eq("clinic_id", clinicId)
      .limit(1)
      .then(({ data }) => {
        const url = data?.[0]?.logo_url ?? null;
        if (url) { setLogoSrc(url); localStorage.setItem("clinic-logo-url", url); }
      });
  }, [clinicId]);

  // Sync logo when clinic profile is updated elsewhere
  useEffect(() => {
    function handle(e: Event) {
      const { logoUrl } = (e as CustomEvent<{ logoUrl?: string }>).detail ?? {};
      if (logoUrl) { setLogoSrc(logoUrl); localStorage.setItem("clinic-logo-url", logoUrl); }
    }
    window.addEventListener("clinicProfileUpdated", handle);
    return () => window.removeEventListener("clinicProfileUpdated", handle);
  }, []);

  // Leave badge logic — identical to Sidebar.tsx
  useEffect(() => {
    if (!clinicId) return;
    async function fetchCount() {
      try {
        if (isAdmin) {
          const [{ count: pendingCount }, { count: withdrawnCount }] = await Promise.all([
            supabase.from("schedule_requests").select("id", { count: "exact", head: true })
              .eq("clinic_id", clinicId).eq("status", "pending"),
            supabase.from("schedule_requests").select("id", { count: "exact", head: true })
              .eq("clinic_id", clinicId).eq("status", "cancelled").eq("cancelled_by", "user"),
          ]);
          setPendingLeaveCount((pendingCount ?? 0) + (withdrawnCount ?? 0));
        } else if (profileId) {
          const { count } = await supabase
            .from("schedule_requests")
            .select("id", { count: "exact", head: true })
            .eq("clinic_id", clinicId)
            .eq("profile_id", profileId)
            .eq("is_seen_by_requester", false)
            .or("status.eq.approved,and(status.eq.cancelled,cancelled_by.eq.admin)");
          setUnseenDecisionCount(count ?? 0);
        }
      } catch { /* schedule_requests table not yet created */ }
    }
    void fetchCount();
    function handle() { void fetchCount(); }
    window.addEventListener("teamLeaveCountChanged", handle);
    return () => window.removeEventListener("teamLeaveCountChanged", handle);
  }, [isAdmin, clinicId, profileId]);

  // Derived values
  const leaveNavBadge = isAdmin ? pendingLeaveCount : unseenDecisionCount;
  const emailHandle = userEmail?.split("@")[0] ?? "User";
  const displayName = userFullName ?? emailHandle;
  const roleLabel = role === "admin" ? "Admin" : role === "dentist" ? "Dentist" : "Staff";
  const planLabel = plan === "pro" ? "Pro" : "Free";
  const clinicInitials = clinicName.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "C";
  const userInitials = (userFullName ?? emailHandle).split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="lg:hidden">
      {/* ── Floating trigger button ── */}
      <button
        type="button"
        className="fixed z-40 right-4 top-4 h-10 w-10 rounded-full overflow-hidden border-2 border-white/30 shadow-lg sidebar-user-avatar"
        onClick={() => setOpen(true)}
        aria-label="Open clinic menu"
      >
        {logoSrc ? (
          <img src={logoSrc} alt="Clinic logo" className="h-full w-full object-contain" />
        ) : (
          <span className="text-sm font-bold text-white">{clinicInitials}</span>
        )}
      </button>

      {/* ── Full-screen overlay ── */}
      {open && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">

          {/* Header */}
          <div className="clinic-menu-safe-top flex items-center gap-3 px-4 pb-4 border-b border-slate-100 shrink-0">
            <div className="h-10 w-10 rounded-full overflow-hidden flex-shrink-0 sidebar-user-avatar">
              {logoSrc ? (
                <img src={logoSrc} alt="Clinic logo" className="h-full w-full object-contain" />
              ) : (
                <span className="text-sm font-bold text-white">{clinicInitials}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base font-bold text-slate-900 truncate">{clinicName}</div>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full font-semibold",
                plan === "pro" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"
              )}>
                {planLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center h-9 w-9 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors shrink-0"
              aria-label="Close menu"
            >
              <IconClose />
            </button>
          </div>

          {/* Scrollable nav sections */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">

            {/* Clinic section */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 px-1">Clinic</div>
              <div className="rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
                {clinicItems.map((item) => {
                  const badge = item.isTeam && leaveNavBadge > 0 ? leaveNavBadge : 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 px-4 py-3.5 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-50 text-violet-600 shrink-0">
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-800">{item.label}</div>
                        <div className="text-xs text-slate-400 truncate">{item.sublabel}</div>
                      </div>
                      {badge > 0 && (
                        <span className={cn(
                          "inline-flex items-center justify-center rounded-full text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 shrink-0",
                          isAdmin ? "bg-red-500" : "bg-blue-500"
                        )}>
                          {badge}
                        </span>
                      )}
                      <IconChevron />
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Account section */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 px-1">Account</div>
              <div className="rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
                {accountItems
                  .filter((item) => !(item.adminOnly && !isAdmin))
                  .map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 px-4 py-3.5 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-50 text-violet-600 shrink-0">
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-800">{item.label}</div>
                        <div className="text-xs text-slate-400 truncate">{item.sublabel}</div>
                      </div>
                      <IconChevron />
                    </Link>
                  ))}
              </div>
            </div>
          </div>

          {/* Footer — user info + sign out */}
          <div className="clinic-menu-safe-bottom shrink-0 px-4 pt-3 border-t border-slate-100 space-y-3">
            <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-slate-50">
              <div className="sidebar-user-avatar w-9 h-9 text-sm shrink-0">
                <span>{userInitials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">{displayName}</div>
                <div className="text-xs text-slate-500">{roleLabel}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl border border-red-100 bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 active:bg-red-200 transition-colors"
            >
              <IconSignOut />
              Sign Out
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
