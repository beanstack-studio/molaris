"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ClinicProvider } from "@/contexts/ClinicContext";
import AppShell from "@/components/layout/AppShell";

const AUTH_PATHS = ["/login", "/join", "/reset-password"];

export function AppProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PATHS.some((p) => pathname?.startsWith(p));

  if (isAuthPage) return <>{children}</>;

  return (
    <ClinicProvider>
      <AppShell>{children}</AppShell>
    </ClinicProvider>
  );
}
