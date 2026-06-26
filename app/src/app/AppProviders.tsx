"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ClinicProvider } from "@/contexts/ClinicContext";
import AppShell from "@/components/layout/AppShell";
import { DevOverrideProvider } from "@/contexts/DevOverrideContext";
import { DevViewToggle } from "@/components/dev/DevViewToggle";

const AUTH_PATHS = ["/login", "/join", "/reset-password"];
const isDev = process.env.NEXT_PUBLIC_DEV_TOOLS === "true";

export function AppProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PATHS.some((p) => pathname?.startsWith(p));

  if (isAuthPage) return <>{children}</>;

  if (isDev) {
    return (
      <DevOverrideProvider>
        <ClinicProvider>
          <AppShell>{children}</AppShell>
          <DevViewToggle />
        </ClinicProvider>
      </DevOverrideProvider>
    );
  }

  return (
    <ClinicProvider>
      <AppShell>{children}</AppShell>
    </ClinicProvider>
  );
}
