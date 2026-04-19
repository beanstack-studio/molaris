"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [clinicName, setClinicName] = useState("Clinic Portal");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    const cached = localStorage.getItem("clinic-logo-url");
    if (cached) setLogoSrc(cached);
    supabase.from("clinic_profile").select("logo_url, clinic_name").limit(1).then(({ data }) => {
      if (data?.[0]) {
        if (data[0].logo_url) setLogoSrc(data[0].logo_url);
        if (data[0].clinic_name) setClinicName(data[0].clinic_name);
      }
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    window.location.href = "/dashboard";
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setResetSent(true);
  }

  return (
    <main className="page-bg min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-md">

        {/* Logo + clinic name */}
        <div className="flex flex-col items-center mb-6">
          {logoSrc ? (
            <img src={logoSrc} alt="Clinic logo" className="h-16 w-16 rounded-2xl object-contain shadow mb-3" />
          ) : (
            <div className="h-16 w-16 rounded-2xl bg-violet-100 flex items-center justify-center text-3xl shadow mb-3">🦷</div>
          )}
          <h1 className="text-xl font-bold text-slate-800">{clinicName}</h1>
          <p className="text-xs text-slate-400 mt-0.5">Clinic Portal</p>
        </div>

        {/* ── Forgot password view ── */}
        {showForgot ? (
          <form onSubmit={sendReset} className="flex flex-col gap-4">
            {resetSent ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700 text-center">
                Reset link sent! Check your email to set a new password.
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-500">Enter your email and we'll send you a password reset link.</p>
                <label className="field-label">
                  <span className="field-label-text">Email</span>
                  <input className="field-input" type="email" autoComplete="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
                </label>
                {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
                <button className="save-btn w-full" disabled={busy} type="submit">
                  {busy ? "Sending…" : "Send reset link"}
                </button>
              </>
            )}
            <button type="button" className="text-sm text-slate-400 hover:text-slate-700 transition-colors text-center"
              onClick={() => { setShowForgot(false); setResetSent(false); setError(null); }}>
              ← Back to sign in
            </button>
          </form>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="field-label">
              <span className="field-label-text">Email</span>
              <input className="field-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="field-label">
              <span className="field-label-text">Password</span>
              <div className="relative">
                <input className="field-input pr-10" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="8" ry="6" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="3" fill="currentColor" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M4 11c0 0 2 3 8 3s8-3 8-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="5.5" cy="14.5" r="0.7" fill="currentColor" /><circle cx="8" cy="15" r="0.7" fill="currentColor" /><circle cx="10.5" cy="15.3" r="0.7" fill="currentColor" /><circle cx="13" cy="15" r="0.7" fill="currentColor" /><circle cx="15.5" cy="14.5" r="0.7" fill="currentColor" /></svg>
                  )}
                </button>
              </div>
            </label>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
            <button className="save-btn w-full" disabled={busy} type="submit">
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <button type="button" className="text-sm text-slate-400 hover:text-slate-700 transition-colors text-center"
              onClick={() => { setShowForgot(true); setResetEmail(email); setError(null); }}>
              Forgot password?
            </button>
          </form>
        )}

        {/* Molaris credit — subtle, no extra space */}
        <p className="text-center text-[10px] text-slate-300 mt-5">Powered by Molaris · BeanStack Studio</p>
      </div>
    </main>
  );
}
