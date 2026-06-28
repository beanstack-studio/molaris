"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

function IconDashboard() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function IconPatients() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconExpenses() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path strokeLinecap="round" d="M2 10h20M6 15h2M10 15h4" />
    </svg>
  );
}

interface BottomNavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
  matchPrefix: string;
}

// 4 items only: Dashboard, Appointments, Patients, Expenses
const bottomNavLinks: BottomNavLink[] = [
  { href: "/dashboard",          label: "Dashboard",    icon: <IconDashboard />, matchPrefix: "/dashboard" },
  { href: "/appointments",       label: "Appointments", icon: <IconCalendar />,  matchPrefix: "/appointments" },
  { href: "/patients",           label: "Patients",     icon: <IconPatients />,  matchPrefix: "/patients" },
  { href: "/expenses/operating", label: "Expenses",     icon: <IconExpenses />,  matchPrefix: "/expenses" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav-wrapper" aria-label="Mobile navigation">
      {bottomNavLinks.map((item) => {
        const isActive = pathname?.startsWith(item.matchPrefix) ?? false;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn("bottom-nav-item", isActive && "bottom-nav-item-active")}
            aria-current={isActive ? "page" : undefined}
          >
            {item.icon}
          </Link>
        );
      })}
    </nav>
  );
}
