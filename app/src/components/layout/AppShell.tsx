"use client";

import { type ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/cn";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { useDevOverride } from "@/contexts/DevOverrideContext";

const SIDEBAR_KEY = "molaris_sidebar_v2";
const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutes

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
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(true);
  const [chartCollapse, setChartCollapse] = useState(false);
  const [busy, setBusy] = useState(false);
  const devCtx = useDevOverride();
  const devViewMode = devCtx?.override.viewMode ?? "desktop";
  const isDevMode = devCtx !== null;

  const isLoginPage = pathname === "/login";

  // Restore sidebar state from localStorage after mount (avoids hydration mismatch).
  // Default is collapsed; only override if user explicitly expanded it.
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
          try {
            await supabase.auth.signOut();
          } catch {
            /* ignore */
          }
          router.push("/login");
          router.refresh();
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [router, pathname]);

  // Auth gate on every navigation
  useEffect(() => {
    if (isLoginPage) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;
        if (error && isInvalidRefreshTokenError(error)) {
          window.name = "";
          await supabase.auth.signOut();
          router.push("/login");
          router.refresh();
          return;
        }
        if (!data.session) {
          window.name = "";
          router.push("/login");
          router.refresh();
        }
      } catch {
        if (cancelled) return;
        window.name = "";
        router.push("/login");
        router.refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, pathname, isLoginPage]);

  // Inactivity auto-logout after 10 minutes
  useEffect(() => {
    if (isLoginPage) return;
    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        window.name = "";
        await supabase.auth.signOut();
        window.location.href = "/login";
      }, INACTIVITY_MS);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [isLoginPage]);

  async function signOut() {
    setBusy(true);
    if (typeof window !== "undefined") window.name = "";
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Sign out timeout")), 2000)
      );
      await Promise.race([supabase.auth.signOut(), timeout]);
    } catch (err) {
      console.error("Sign out error (continuing anyway):", err);
    }
    window.location.href = "/login";
  }

  // On the login page: no shell, just children
  if (isLoginPage) {
    return <>{children}</>;
  }

  const effectivelyCollapsed = collapsed || chartCollapse;

  // Dev viewport simulation: in dev mode, control sidebar/bottomnav via React instead of CSS breakpoints
  const showSidebar = !isDevMode || devViewMode === "desktop";
  const showBottomNav = !isDevMode || devViewMode !== "desktop";

  const contentClass = cn(
    "sidebar-content-offset",
    !isDevMode || devViewMode === "desktop"
      ? cn(effectivelyCollapsed ? "lg:ml-14" : "lg:ml-[220px]", "pb-16 lg:pb-0")
      : cn(
          devViewMode === "tablet" ? "max-w-[768px]" : "max-w-[390px]",
          "mx-auto pb-16"
        )
  );

  return (
    <>
      {/* Sidebar — desktop only (hidden on mobile via CSS; or hidden by dev viewport mode) */}
      {showSidebar && (
        <Sidebar
          collapsed={effectivelyCollapsed}
          onToggle={handleToggle}
          onSignOut={signOut}
        />
      )}

      {/* Main content — offset by sidebar width on lg+ */}
      <div className={contentClass}>
        {children}
      </div>

      {/* Bottom nav — mobile only (CSS) or forced by dev viewport mode */}
      {showBottomNav && <BottomNav />}

      {/* Invisible overlay during sign-out */}
      {busy && (
        <div className="fixed inset-0 z-50 bg-white/60 backdrop-blur-sm flex items-center justify-center">
          <div className="loading-text text-sm">Signing out…</div>
        </div>
      )}
    </>
  );
}
