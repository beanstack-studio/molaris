"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// Public landing page — visible without login.
// If the user already has a session, silently redirect them to /dashboard.
export default function HomePage() {
  const router = useRouter();
  const [clinicName, setClinicName] = useState("Clinic Portal");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  useEffect(() => {
    fetch("/api/clinic-info")
      .then((r) => r.json())
      .then((d: { clinic_name: string | null; logo_url: string | null }) => {
        if (d.clinic_name) setClinicName(d.clinic_name);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">

      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={clinicName} className="h-9 w-9 rounded-full object-cover" />
          <span className="font-semibold text-slate-800 text-sm">{clinicName}</span>
        </div>
        <Link
          href="/login"
          className="text-sm font-medium px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt={clinicName}
              className="h-20 w-20 rounded-2xl object-cover mx-auto shadow-md"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 leading-tight">
            {clinicName}<br />Clinic Portal
          </h1>
          <p className="text-slate-500 text-base sm:text-lg mb-8 leading-relaxed max-w-lg mx-auto">
            A secure, private management portal for authorized {clinicName} staff.
            Manage appointments, patient records, and billing — all in one place.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10 text-left">
            {[
              { icon: "📅", label: "Appointments", desc: "Schedule and manage patient visits" },
              { icon: "🦷", label: "Patient Records", desc: "Charts, treatment history, and billing" },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="bg-white rounded-2xl border border-slate-200 px-4 py-4">
                <div className="text-2xl mb-2">{icon}</div>
                <div className="text-sm font-semibold text-slate-800">{label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
              </div>
            ))}
          </div>

          <Link
            href="/login"
            className="inline-block px-6 py-3 rounded-xl bg-slate-900 text-white font-medium text-sm hover:bg-slate-700 transition-colors"
          >
            Sign in to portal
          </Link>
          <p className="text-xs text-slate-400 mt-4">
            Access is restricted to authorized clinic staff only.
          </p>
        </div>
      </main>

      {/* Footer with Privacy Policy link — required by Google OAuth verification */}
      <footer className="px-6 py-5 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <span>© {new Date().getFullYear()} {clinicName}</span>
          <Link href="/privacy" className="hover:text-slate-600 underline">
            Privacy Policy
          </Link>
        </div>
      </footer>

    </div>
  );
}
