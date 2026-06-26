"use client";

import { type ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/cn";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";

const SIDEBAR_KEY = "molaris_sidebar_v2";
const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutes

async function doSignOut() {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch (e) {
    console.error("Sign out error:", e);
  } finally {
    window.location.replace("/login");
  }
}

function isInvalidRefreshTokenError(err: unknown): boolean {
  if (!err) return false;
  const msg =
    typeof err === "string"
      ? err
      : (err as { message?: string; error_description?: string })?.message ||
        (err as { message?: string; error_description?: string })
          ?.error_description ||
        "";
  return String(msg).toLowerCase().includes("invalid refresh token");
}

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  const [chartCollapse, setChartCollapse] = useState(false);

  const isLoginPage = pathname === "/login";

  // Restore sidebar state from localStorage after mount (avoids hydration mismatch).
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored === "false") setCollapsed(false);
  }, []);

  // Listen for chart tab activation events to temporarily collapse sidebar
  useEffect(() => {
    function handleChartActive() { setChartCollapse(true); }
    function handleChartInactive() { setChartCollapse(false); }
    window.addEventListener("molaChartActive", handleChartActive);
    window.addEventListener("molaChartInactive", handleChartInactive);
    return () => {
      window.removeEventListener("molaChartActive", handleChartActive);
      window.removeEventListener("molaChartInactive", handleChartInactive);
    };
  }, []);

  // Persist collapse state
  function handleToggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  }

  // Auth: listen for sign-out / token expiry
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (pathname?.startsWith("/login")) return;
      if (event === "SIGNED_OUT" || (event as string) === "TOKEN_EXPIRED") {
        if (!session) {
          await doSignOut();
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [pathname]);

  // Auth gate on every navigation
  useEffect(() => {
    if (isLoginPage) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;
        if (error && isInvalidRefreshTokenError(error)) {
          await doSignOut();
          return;
        }
        if (!data.session) {
          await doSignOut();
        }
      } catch {
        if (cancelled) return;
        await doSignOut();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, isLoginPage]);

  // Inactivity auto-logout after 10 minutes
  useEffect(() => {
    if (isLoginPage) return;
    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { void doSignOut(); }, INACTIVITY_MS);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [isLoginPage]);

  // On the login page: no shell, just children
  if (isLoginPage) {
    return <>{children}</>;
  }

  const effectivelyCollapsed = collapsed || chartCollapse;

  const contentClass = cn(
    "sidebar-content-offset",
    effectivelyCollapsed ? "lg:ml-14" : "lg:ml-[220px]",
    "pb-16 lg:pb-0",
  );

  return (
    <>
      <Sidebar
        collapsed={effectivelyCollapsed}
        onToggle={handleToggle}
        onSignOut={doSignOut}
      />
      <div className={contentClass}>
        {children}
      </div>
      <BottomNav />
    </>
  );
}
