"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

function isInvalidRefreshTokenError(err: unknown): boolean {
  if (!err) return false;
  const msg =
    typeof err === "string"
      ? err
      : (err as any)?.message || (err as any)?.error_description || "";
  return String(msg).toLowerCase().includes("invalid refresh token");
}

export default function TopNav({
  title = "Matira Dental Studio",
}: {
  title?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    try {
      setBusy(true);
      await supabase.auth.signOut();
    } finally {
      setBusy(false);
      router.push("/login");
      router.refresh();
    }
  }

  useEffect(() => {
    // If the browser has a stale/invalid refresh token stored,
    // Supabase may throw "Invalid Refresh Token: Refresh Token Not Found".
    // We recover by clearing auth and pushing to /login.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // If user is already on /login, don't bounce again.
      if (pathname?.startsWith("/login")) return;

      // No session means signed out/expired. Route to login.
      // This handles cases where refresh token is missing/invalid.
      if (!session) {
        // Clear any lingering local session data, just in case.
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
        router.push("/login");
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, pathname]);

  // Optional: proactive check on mount for an invalid session.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;

        if (error && isInvalidRefreshTokenError(error)) {
          await supabase.auth.signOut();
          if (!pathname?.startsWith("/login")) {
            router.push("/login");
            router.refresh();
          }
          return;
        }

        if (!data.session && !pathname?.startsWith("/login")) {
          router.push("/login");
          router.refresh();
        }
      } catch (e) {
        if (cancelled) return;
        // If anything auth-related fails unexpectedly, fail safe to login.
        if (!pathname?.startsWith("/login")) {
          router.push("/login");
          router.refresh();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  return (
    <div className="sticky top-0 z-50 border-b bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          {/* Logo/Home */}
          <Link href="/dashboard" className="text-sm font-bold text-slate-900 hover:text-slate-700 transition-colors">
            🦷 {title}
          </Link>

          {/* Main Navigation */}
          <div className="hidden sm:flex items-center gap-1">
            <Link href="/patients" className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
              Patients
            </Link>
            <Link href="/reports/payments" className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
              Reports
            </Link>
            <Link href="/settings/clinic-profile" className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
              Settings
            </Link>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-2 text-sm font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-60"
              onClick={signOut}
              disabled={busy}
              title="Sign out"
            >
              {busy ? "..." : "Sign out"}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="sm:hidden flex items-center gap-1 mt-2 pt-2 border-t">
          <Link href="/patients" className="flex-1 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded text-center">
            Patients
          </Link>
          <Link href="/reports/payments" className="flex-1 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded text-center">
            Reports
          </Link>
          <Link href="/settings/clinic-profile" className="flex-1 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded text-center">
            Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
