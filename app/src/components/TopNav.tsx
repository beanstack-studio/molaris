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
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [clinicName, setClinicName] = useState(title);

  // Fetch clinic logo and name on mount
  useEffect(() => {
    supabase
      .from("clinic_profile")
      .select("logo_url, clinic_name")
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          if (data[0].logo_url) setLogoUrl(data[0].logo_url);
          if (data[0].clinic_name) setClinicName(data[0].clinic_name);
        }
      });
  }, []);

  // Listen for clinic profile saves — more reliable than realtime subscriptions
  useEffect(() => {
    function handleProfileUpdate(e: Event) {
      const { logoUrl: newLogo, clinicName: newName } = (e as CustomEvent).detail ?? {};
      if (newLogo) setLogoUrl(newLogo);
      if (newName) setClinicName(newName);
    }
    window.addEventListener("clinicProfileUpdated", handleProfileUpdate);
    return () => window.removeEventListener("clinicProfileUpdated", handleProfileUpdate);
  }, []);

  // Update browser favicon — only remove app-managed links to avoid disturbing React's DOM
  useEffect(() => {
    if (!logoUrl) return;
    document.querySelectorAll("link[data-app-favicon]").forEach((el) => el.remove());
    const link = document.createElement("link");
    link.rel = "icon";
    link.setAttribute("data-app-favicon", "true");
    link.href = logoUrl;
    document.head.appendChild(link);
  }, [logoUrl]);

  async function signOut() {
    setBusy(true);
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Sign out timeout")), 2000)
      );
      await Promise.race([supabase.auth.signOut(), timeoutPromise]);
    } catch (err) {
      console.error("Sign out error (continuing anyway):", err);
    }
    window.location.href = "/login";
  }

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (pathname?.startsWith("/login")) return;
      if (!session) {
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
  const isAppointments = pathname?.startsWith("/appointments");

  return (
    <div className="topnav-wrapper">
      <div className="topnav-container">
        <div className="topnav-inner">
          {/* Logo/Home */}
          <Link href="/dashboard" className="topnav-logo">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Clinic logo"
                className="h-8 w-8 rounded-lg object-contain"
              />
            ) : (
              <span>🦷</span>
            )}
            {clinicName}
          </Link>

          {/* Right Navigation & Actions */}
          <div className="topnav-links">
            <Link
              href="/appointments"
              className={`topnav-link ${isAppointments ? "topnav-link-active" : "topnav-link-inactive"}`}
            >
              Appointments
            </Link>
            <Link
              href="/patients"
              className={`topnav-link ${isPatients ? "topnav-link-active" : "topnav-link-inactive"}`}
            >
              Patients
            </Link>
            <Link
              href="/reports/payments"
              className={`topnav-link ${isReports ? "topnav-link-active" : "topnav-link-inactive"}`}
            >
              Reports
            </Link>
            <Link
              href="/settings/clinic-profile"
              className={`topnav-link ${isSettings ? "topnav-link-active" : "topnav-link-inactive"}`}
            >
              Settings
            </Link>
            <button
              type="button"
              className="topnav-button-signout"
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
