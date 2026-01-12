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
    <div className="sticky top-0 z-50 border-b bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <Link href="/dashboard" className="text-sm font-semibold text-slate-900 hover:underline">
          {title}
        </Link>

        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="btn btn-secondary">
            Dashboard
          </Link>

          <Link href="/patients" className="btn btn-secondary">
            Patients
          </Link>

          <Link href="/settings/clinic-profile" className="btn btn-secondary">
            Settings
          </Link>

          <button
            type="button"
            className="btn btn-secondary disabled:opacity-60"
            onClick={signOut}
            disabled={busy}
            title="Sign out"
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}
