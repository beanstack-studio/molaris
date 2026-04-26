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
  const [menuOpen, setMenuOpen] = useState(false);
  // null = show emoji fallback. Populated from Supabase (and cached in localStorage).
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [clinicName, setClinicName] = useState(title);
  const [messengerConnected, setMessengerConnected] = useState(false);

  useEffect(() => {
    // Show cached logo immediately (no flash of emoji on repeat visits)
    const cached = localStorage.getItem("clinic-logo-url");
    if (cached) setLogoSrc(cached);

    // Fetch latest from Supabase and update cache
    supabase
      .from("clinic_profile")
      .select("logo_url, clinic_name")
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          if (data[0].logo_url) {
            setLogoSrc(data[0].logo_url);
            localStorage.setItem("clinic-logo-url", data[0].logo_url);
          }
          if (data[0].clinic_name) setClinicName(data[0].clinic_name);
        }
      });

    // Check if Messenger is connected
    supabase
      .from("facebook_pages")
      .select("page_id")
      .maybeSingle()
      .then(({ data }) => setMessengerConnected(!!data));
  }, []);

  // Listen for clinic profile saves — more reliable than realtime subscriptions
  useEffect(() => {
    function handleProfileUpdate(e: Event) {
      const { logoUrl: newLogo, clinicName: newName } = (e as CustomEvent).detail ?? {};
      if (newLogo) {
        setLogoSrc(newLogo);
        localStorage.setItem("clinic-logo-url", newLogo);
      }
      if (newName) setClinicName(newName);
    }
    window.addEventListener("clinicProfileUpdated", handleProfileUpdate);
    return () => window.removeEventListener("clinicProfileUpdated", handleProfileUpdate);
  }, []);

  // Keep browser favicon in sync — updates whenever logoSrc changes
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
    setBusy(true);
    if (typeof window !== "undefined") window.name = "";
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

    // Auth gate: read session from localStorage (no network round-trip).
    // window.name was previously used as a fast-path guard but Safari clears it
    // after OAuth redirects and cross-origin navigations, causing false logouts.
    // getSession() reads from localStorage and is safe in all browsers.
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;

        if (error && isInvalidRefreshTokenError(error)) {
          window.name = "";
          await supabase.auth.signOut();
          if (!pathname?.startsWith("/login")) {
            router.push("/login");
            router.refresh();
          }
          return;
        }

        if (!data.session && !pathname?.startsWith("/login")) {
          window.name = "";
          router.push("/login");
          router.refresh();
        }
      } catch (e) {
        if (cancelled) return;
        if (!pathname?.startsWith("/login")) {
          window.name = "";
          router.push("/login");
          router.refresh();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  // Inactivity auto-logout after 10 minutes
  useEffect(() => {
    if (pathname?.startsWith("/login")) return;
    const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        window.name = "";
        await supabase.auth.signOut();
        window.location.href = "/login";
      }, TIMEOUT_MS);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset(); // start the timer immediately

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [pathname]);

  const isPatients = pathname?.startsWith("/patients");
  const isReports = pathname?.startsWith("/reports");
  const isSettings = pathname?.startsWith("/settings");
  const isAppointments = pathname?.startsWith("/appointments");
  const isMessages = pathname?.startsWith("/messages");

  const navLinks = [
    { href: "/appointments", label: "Appointments", active: isAppointments },
    { href: "/messages", label: "Messages", active: isMessages },
    { href: "/patients", label: "Patients", active: isPatients },
    { href: "/reports/payments", label: "Reports", active: isReports },
    { href: "/settings/clinic-profile", label: "Settings", active: isSettings },
  ];

  return (
    <div className="topnav-wrapper">
      <div className="topnav-container">
        <div className="topnav-inner">
          {/* Logo/Home */}
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
              <Link key={l.href} href={l.href} className={`topnav-link ${l.active ? "topnav-link-active" : "topnav-link-inactive"}`}>
                {l.label}
              </Link>
            ))}
            <button type="button" className="topnav-button-signout" onClick={signOut} disabled={busy}>
              {busy ? "..." : "Sign out"}
            </button>
          </div>

          {/* Mobile hamburger button */}
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

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-slate-100 pt-2 pb-3 flex flex-col gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${l.active ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
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
