"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot password
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

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

        {/* Molaris wordmark */}
        <div className="flex flex-col items-center mb-7">
          <div className="mb-3">
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="52" height="52" rx="14" fill="#2563eb" />
              <path d="M13 34C13 34 14 20 19 18C22 17 24 21 26 21C28 21 30 17 33 18C38 20 39 34 39 34" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <path d="M19 18C19 18 20 26 23 28C24.5 29 27.5 29 29 28C32 26 33 18 33 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.6"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Molaris</h1>
          <p className="text-xs text-slate-400 mt-1">Clinic management portal</p>
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
                  <input
                    className="field-input"
                    type="email"
                    autoComplete="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </label>
                {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
                <button className="save-btn w-full" disabled={busy} type="submit">
                  {busy ? "Sending…" : "Send reset link"}
                </button>
              </>
            )}
            <button
              type="button"
              className="text-sm text-slate-400 hover:text-slate-700 transition-colors text-center"
              onClick={() => { setShowForgot(false); setResetSent(false); setError(null); }}
            >
              ← Back to sign in
            </button>
          </form>
        ) : (
          /* ── Sign in view ── */
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="field-label">
              <span className="field-label-text">Email</span>
              <input
                className="field-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="field-label">
              <span className="field-label-text">Password</span>
              <div className="relative">
                <input
                  className="field-input pr-10"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <ellipse cx="12" cy="12" rx="8" ry="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="12" cy="12" r="3" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M4 11c0 0 2 3 8 3s8-3 8-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="5.5" cy="14.5" r="0.7" fill="currentColor" />
                      <circle cx="8" cy="15" r="0.7" fill="currentColor" />
                      <circle cx="10.5" cy="15.3" r="0.7" fill="currentColor" />
                      <circle cx="13" cy="15" r="0.7" fill="currentColor" />
                      <circle cx="15.5" cy="14.5" r="0.7" fill="currentColor" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}

            <button className="save-btn w-full" disabled={busy} type="submit">
              {busy ? "Signing in…" : "Sign in"}
            </button>

            <button
              type="button"
              className="text-sm text-slate-400 hover:text-slate-700 transition-colors text-center"
              onClick={() => { setShowForgot(true); setResetEmail(email); setError(null); }}
            >
              Forgot password?
            </button>
          </form>
        )}
        {/* Footer */}
        <div className="border-t border-slate-100 -mx-6 mt-6 pt-4 px-6 flex flex-col items-center gap-0.5">
          <p className="text-[10px] text-slate-300">by BeanStack Studio</p>
        </div>
      </div>
    </main>
  );
}
