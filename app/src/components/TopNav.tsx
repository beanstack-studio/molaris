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
    setBusy(true);
    console.log("Sign out started");
    try {
      console.log("Calling supabase.auth.signOut()");
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Sign out timeout")), 2000)
      );
      
      // Race: whichever completes first
      await Promise.race([supabase.auth.signOut(), timeoutPromise]);
      
      console.log("Supabase signOut successful");
    } catch (err) {
      console.error("Sign out error (continuing anyway):", err);
    }
    console.log("About to redirect to /login");
    // Use hard redirect to ensure navigation happens
    window.location.href = "/login";
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

  const isPatients = pathname?.startsWith("/patients");
  const isReports = pathname?.startsWith("/reports");
  const isSettings = pathname?.startsWith("/settings");
  const isMessages = pathname?.startsWith("/messages");

  return (
    <div className="sticky top-0 z-50 border-b bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          {/* Logo/Home */}
          <Link href="/dashboard" className="text-sm font-bold text-slate-900 hover:text-slate-700 transition-colors">
            🦷 {title}
          </Link>

          {/* Right Navigation & Actions */}
          <div className="flex items-center gap-2">
            {/* Messages tab temporarily hidden - will reopen after holidays */}
            {/* 
            <Link
              href="/messages"
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isMessages
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              💬 Messages
            </Link>
            */}
            <Link
              href="/patients"
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isPatients
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Patients
            </Link>
            <Link
              href="/reports/payments"
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isReports
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Reports
            </Link>
            <Link
              href="/settings/clinic-profile"
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isSettings
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Settings
            </Link>
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 active:bg-red-300 transition-colors disabled:opacity-60"
              onClick={signOut}
              disabled={busy}
              title="Sign out"
            >
              {busy ? "..." : "Sign out"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
