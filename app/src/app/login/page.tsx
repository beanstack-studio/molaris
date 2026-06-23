"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Tab = "signin" | "signup";

function validatePassword(pwd: string): string | null {
  if (pwd.length < 8) return "Password must be at least 8 characters.";
  if (!/\d/.test(pwd)) return "Password must contain at least one number.";
  return null;
}

function PasswordHints({ password }: { password: string }) {
  if (!password) return null;
  const hasLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  return (
    <div className="mt-1.5 flex gap-3 text-xs">
      <span className={hasLength ? "text-emerald-600 font-medium" : "text-slate-400"}>
        {hasLength ? "✓" : "·"} 8+ characters
      </span>
      <span className={hasNumber ? "text-emerald-600 font-medium" : "text-slate-400"}>
        {hasNumber ? "✓" : "·"} one number
      </span>
    </div>
  );
}

function IconEye() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  show,
  onToggleShow,
  autoComplete = "current-password",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  show: boolean;
  onToggleShow: () => void;
  autoComplete?: string;
}) {
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className={loginInput}
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <IconEyeOff /> : <IconEye />}
      </button>
    </div>
  );
}

const loginInput = "w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition";
const loginLabel = "block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5";

export default function LoginPage() {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [clinicName, setClinicName] = useState("Molaris");

  const [tab, setTab] = useState<Tab>("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupConfirm, setSignupConfirm] = useState("");
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem("clinic-logo-url");
    if (cached) setLogoSrc(cached);
    fetch("/api/clinic-info")
      .then((r) => r.json())
      .then((data: { logo_url?: string; clinic_name?: string }) => {
        if (data.logo_url) setLogoSrc(data.logo_url);
        if (data.clinic_name) setClinicName(data.clinic_name);
      })
      .catch(() => {});
  }, []);

  function switchTab(next: Tab) {
    setTab(next);
    setError(null);
    setShowForgot(false);
    setResetSent(false);
    setSignupSuccess(false);
  }

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) { setError(err.message); return; }
    if (typeof window !== "undefined") window.name = "molaris_auth_active";
    window.location.href = "/dashboard";
  }

  async function onSendReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setResetSent(true);
  }

  async function onSignUp(e: React.FormEvent) {
    e.preventDefault();
    const pwdError = validatePassword(signupPassword);
    if (pwdError) { setError(pwdError); return; }
    if (signupPassword !== signupConfirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signUp({
      email: signupEmail.trim(),
      password: signupPassword,
      options: { data: { full_name: signupName.trim() } },
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setSignupSuccess(true);
  }

  return (
    <main className="min-h-screen flex">

      {/* ── LEFT: Brand panel — dark navy, desktop only ── */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-2/5 login-brand-panel flex-col justify-between p-10 xl:p-14 shrink-0">
        {/* Top: Logo + clinic name */}
        <div className="flex items-center gap-3">
          {logoSrc ? (
            <img src={logoSrc} alt="Clinic logo" className="w-10 h-10 rounded-xl object-cover ring-2 ring-white/20" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-blue-500/80 flex items-center justify-center text-white font-bold text-lg select-none">
              {clinicName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="text-white font-bold text-base tracking-tight">{clinicName}</span>
        </div>

        {/* Middle: tagline */}
        <div className="flex flex-col gap-4">
          <h2 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight tracking-tight">
            Clinic management,<br />simplified.
          </h2>
          <p className="text-blue-300 text-sm leading-relaxed">
            Patients · Appointments · Treatments<br />
            Billing · Documents — all in one place.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 text-xs text-white/30">
          <span>Powered by</span>
          <img src="/icons/beanstack-logo.png" alt="Beanstack Studio" className="h-4 w-4 object-contain opacity-50" />
          <span className="font-medium text-white/50">Beanstack Studio</span>
        </div>
      </div>

      {/* ── RIGHT: Form panel — white, always visible ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 bg-white min-h-screen">

        {/* Mobile only: logo + clinic name (hidden on desktop where left panel shows) */}
        <div className="flex flex-col items-center gap-3 text-center mb-8 lg:hidden">
          {logoSrc ? (
            <img src={logoSrc} alt="Clinic logo" className="w-14 h-14 rounded-2xl object-cover shadow-md" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-blue-600 shadow-md flex items-center justify-center text-white font-bold text-2xl select-none">
              {clinicName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{clinicName}</h1>
            <p className="text-sm text-slate-500">Clinic Management Portal</p>
          </div>
        </div>

        {/* Form area */}
        <div className="w-full max-w-sm">

          {/* Heading — desktop only */}
          <div className="hidden lg:block mb-7">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {tab === "signin" && !showForgot
                ? "Welcome back"
                : tab === "signup"
                ? "Get started"
                : "Reset password"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {tab === "signin" && !showForgot
                ? "Sign in to your clinic account"
                : tab === "signup"
                ? "Create your clinic account"
                : "Enter your email to receive a reset link"}
            </p>
          </div>

          {/* Tab strip — pill style */}
          <div className="flex gap-1 mb-6 bg-slate-100 rounded-full p-1">
            {(["signin", "signup"] as Tab[]).map((t) => {
              const active = tab === t && !showForgot;
              const label = t === "signin" ? "Sign In" : "Sign Up";
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => switchTab(t)}
                  className={[
                    "flex-1 py-2 text-sm font-semibold transition-all rounded-full",
                    active
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* ── Sign In ── */}
          {tab === "signin" && !showForgot && (
            <form onSubmit={onSignIn} className="flex flex-col gap-4">
              <div>
                <label className={loginLabel}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className={loginInput}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={loginLabel}>Password</span>
                  <button
                    type="button"
                    onClick={() => { setShowForgot(true); setResetEmail(email); setError(null); }}
                    className="text-xs text-slate-400 hover:text-blue-600 transition-colors font-medium"
                  >
                    Forgot?
                  </button>
                </div>
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                  show={showPassword}
                  onToggleShow={() => setShowPassword(!showPassword)}
                />
              </div>

              {error && (
                <p className="rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-xs text-red-600 font-medium">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full h-11 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold tracking-wide transition-all disabled:opacity-60 shadow-sm shadow-blue-200 mt-1 hover:-translate-y-0.5"
              >
                {busy ? "Signing in…" : "Sign In"}
              </button>
            </form>
          )}

          {/* ── Forgot password ── */}
          {tab === "signin" && showForgot && (
            <form onSubmit={onSendReset} className="flex flex-col gap-4">
              {resetSent ? (
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-4 text-sm text-emerald-700 text-center font-medium">
                  Reset link sent! Check your email.
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Enter your email and we&apos;ll send you a password reset link.
                  </p>
                  <div>
                    <label className={loginLabel}>Email</label>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                      className={loginInput}
                    />
                  </div>
                  {error && (
                    <p className="rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-xs text-red-600 font-medium">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold tracking-wide transition-all disabled:opacity-60 shadow-sm shadow-blue-200"
                  >
                    {busy ? "Sending…" : "Send reset link"}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => { setShowForgot(false); setResetSent(false); setError(null); }}
                className="text-xs text-slate-400 hover:text-slate-700 transition-colors text-center font-medium"
              >
                ← Back to sign in
              </button>
            </form>
          )}

          {/* ── Sign Up ── */}
          {tab === "signup" && (
            signupSuccess ? (
              <div className="flex flex-col items-center gap-4 py-2 text-center">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-4 text-sm text-emerald-700 w-full font-medium">
                  Account created! Check your email to confirm, then sign in.
                </div>
                <button
                  type="button"
                  onClick={() => switchTab("signin")}
                  className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                >
                  Go to sign in →
                </button>
              </div>
            ) : (
              <form onSubmit={onSignUp} className="flex flex-col gap-4">
                <p className="text-xs text-slate-400 leading-relaxed bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                  For clinic owners only. Staff receive an email invite from their owner.
                </p>

                <div>
                  <label className={loginLabel}>Your Name</label>
                  <input
                    type="text"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    placeholder="Full name"
                    autoComplete="name"
                    required
                    className={loginInput}
                  />
                </div>

                <div>
                  <label className={loginLabel}>Email</label>
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className={loginInput}
                  />
                </div>

                <div>
                  <label className={loginLabel}>Password</label>
                  <PasswordInput
                    value={signupPassword}
                    onChange={setSignupPassword}
                    placeholder="8+ characters"
                    show={showSignupPassword}
                    onToggleShow={() => setShowSignupPassword(!showSignupPassword)}
                    autoComplete="new-password"
                  />
                  <PasswordHints password={signupPassword} />
                </div>

                <div>
                  <label className={loginLabel}>Confirm Password</label>
                  <PasswordInput
                    value={signupConfirm}
                    onChange={setSignupConfirm}
                    placeholder="Repeat password"
                    show={showSignupConfirm}
                    onToggleShow={() => setShowSignupConfirm(!showSignupConfirm)}
                    autoComplete="new-password"
                  />
                </div>

                {error && (
                  <p className="rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-xs text-red-600 font-medium">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full h-11 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold tracking-wide transition-all disabled:opacity-60 shadow-sm shadow-blue-200 mt-1 hover:-translate-y-0.5"
                >
                  {busy ? "Creating account…" : "Create Account"}
                </button>
              </form>
            )
          )}

        </div>

        {/* Mobile footer */}
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-10 lg:hidden">
          <span>Powered by</span>
          <img src="/icons/beanstack-logo.png" alt="Beanstack Studio" className="h-4 w-4 object-contain opacity-60" />
          <span className="font-medium text-slate-500">Beanstack Studio</span>
        </div>

      </div>

    </main>
  );
}
