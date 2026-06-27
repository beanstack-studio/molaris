"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useClinic } from "@/contexts/ClinicContext";

let isSigningOut = false;

function isInvalidRefreshTokenError(err: unknown): boolean {
  if (!err) return false;
  const msg =
    typeof err === "string"
      ? err
      : (err as { message?: string; error_description?: string })?.message ||
        (err as { message?: string; error_description?: string })?.error_description ||
        "";
  return String(msg).toLowerCase().includes("invalid refresh token");
}

export default function TopNav() {
  const pathname = usePathname();
  const { clinicName } = useClinic();

  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  // Load logo from cache immediately, then refresh from Supabase
  useEffect(() => {
    const cached = localStorage.getItem("clinic-logo-url");
    if (cached) setLogoSrc(cached);

    supabase
      .from("clinic_profile")
      .select("logo_url")
      .limit(1)
      .then(({ data }) => {
        const url = data?.[0]?.logo_url;
        if (url) {
          setLogoSrc(url);
          localStorage.setItem("clinic-logo-url", url);
        }
      });
  }, []);

  // Sync logo when clinic profile is saved elsewhere in the app
  useEffect(() => {
    function handleProfileUpdate(e: Event) {
      const { logoUrl } = (e as CustomEvent<{ logoUrl?: string; clinicName?: string }>).detail ?? {};
      if (logoUrl) {
        setLogoSrc(logoUrl);
        localStorage.setItem("clinic-logo-url", logoUrl);
      }
    }
    window.addEventListener("clinicProfileUpdated", handleProfileUpdate);
    return () => window.removeEventListener("clinicProfileUpdated", handleProfileUpdate);
  }, []);

  // Keep browser favicon in sync with clinic logo
  useEffect(() => {
    if (!logoSrc) return;
    document.querySelectorAll("link[data-app-favicon]").forEach((el) => el.remove());
    const link = document.createElement("link");
    link.rel = "icon";
    link.setAttribute("data-app-favicon", "true");
    link.href = logoSrc;
    document.head.appendChild(link);
  }, [logoSrc]);

  async function signOut() {
    if (isSigningOut) return;
    isSigningOut = true;
    setBusy(true);
    try {
      localStorage.removeItem("clinic-logo-url");
      sessionStorage.clear();
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // ignore
    } finally {
      window.location.replace("/login");
    }
  }

  // Redirect on auth state change (sign-out / token expiry)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (isSigningOut) return;
      if (pathname?.startsWith("/login")) return;
      if (event === "SIGNED_OUT" || (event as string) === "TOKEN_EXPIRED") {
        if (!session) {
          try { await supabase.auth.signOut({ scope: "local" }); } catch { /* ignore */ }
          window.location.replace("/login");
        }
      }
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auth gate on every navigation
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;
        if (error && isInvalidRefreshTokenError(error)) {
          window.name = "";
          await supabase.auth.signOut({ scope: "local" });
          window.location.replace("/login");
          return;
        }
        if (!data.session && !pathname?.startsWith("/login")) {
          window.location.replace("/login");
        }
      } catch {
        if (cancelled) return;
        if (!pathname?.startsWith("/login")) {
          window.location.replace("/login");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [pathname]);

  // Inactivity auto-logout after 10 minutes
  useEffect(() => {
    if (pathname?.startsWith("/login")) return;
    const TIMEOUT_MS = 10 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try { await supabase.auth.signOut({ scope: "local" }); } catch { /* ignore */ }
        window.location.replace("/login");
      }, TIMEOUT_MS);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [pathname]);

  const isAppointments = pathname?.startsWith("/appointments");
  const isPatients = pathname?.startsWith("/patients");
  const isReports = pathname?.startsWith("/reports");
  const isSettings = pathname?.startsWith("/settings");

  const navLinks = [
    { href: "/appointments", label: "Appointments", active: isAppointments },
    { href: "/patients", label: "Patients", active: isPatients },
    { href: "/reports/payments", label: "Reports", active: isReports },
    { href: "/settings/clinic-profile", label: "Settings", active: isSettings },
  ];

  return (
    <div className="topnav-wrapper">
      <div className="topnav-container">
        <div className="topnav-inner">
          {/* Logo / clinic name */}
          <Link href="/dashboard" className="topnav-logo" onClick={() => setMenuOpen(false)}>
            {logoSrc ? (
              <img src={logoSrc} alt="Clinic logo" className="h-8 w-8 rounded-lg object-contain" />
            ) : (
              <span>🦷</span>
            )}
            <span className="hidden sm:inline">{clinicName}</span>
          </Link>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`topnav-link ${l.active ? "topnav-link-active" : "topnav-link-inactive"}`}
              >
                {l.label}
              </Link>
            ))}
            <button
              type="button"
              className="topnav-button-signout"
              onClick={signOut}
              disabled={busy}
            >
              {busy ? "..." : "Sign out"}
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="md:hidden border-t border-slate-100 pt-2 pb-3 flex flex-col gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  l.active ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {l.label}
              </Link>
            ))}
            <button
              type="button"
              className="px-3 py-2.5 rounded-xl text-sm font-medium text-left text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              onClick={() => { setMenuOpen(false); signOut(); }}
              disabled={busy}
            >
              {busy ? "Signing out…" : "Sign out"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
