"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/cn";
import { AuthCard } from "@/components/auth/AuthCard";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordRequirements } from "@/components/auth/PasswordRequirements";

type Tab = "signin" | "signup";

function validatePassword(pwd: string): string | null {
  if (pwd.length < 8) return "Password must be at least 8 characters.";
  if (!/\d/.test(pwd)) return "Password must contain at least one number.";
  return null;
}

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>("signin");

  // Sign-in state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Forgot-password state
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  // Sign-up state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [signupSuccess, setSignupSuccess] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (signupPassword !== signupConfirm) { setError("Passwords do not match."); return; }
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
    <AuthCard>

      {/* Tab strip — hidden during forgot-password flow */}
      {!showForgot && (
        <div className="bg-gray-100 p-1 rounded-full flex mb-6">
          {(["signin", "signup"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              className={cn(
                "flex-1 px-6 py-2 text-sm rounded-full transition-all",
                tab === t
                  ? "bg-white shadow-sm text-gray-900 font-semibold"
                  : "text-gray-400 hover:text-gray-500"
              )}
            >
              {t === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>
      )}

      {/* ── Sign In ── */}
      {tab === "signin" && !showForgot && (
        <form onSubmit={onSignIn} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="field-label-text">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              className="field-input"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between mb-0.5">
              <span className="field-label-text">Password</span>
              <button
                type="button"
                onClick={() => { setShowForgot(true); setResetEmail(email); setError(null); }}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                Forgot password?
              </button>
            </div>
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && <p className="error-banner">{error}</p>}

          <button type="submit" disabled={busy} className="auth-btn mt-1">
            {busy ? "Signing in\u2026" : "Sign In"}
          </button>
        </form>
      )}

      {/* ── Forgot password ── */}
      {tab === "signin" && showForgot && (
        <form onSubmit={onSendReset} className="flex flex-col gap-4">
          <div className="text-center mb-1">
            <p className="text-base font-semibold text-gray-900">Forgot your password?</p>
            <p className="text-xs text-gray-500 mt-1">Enter your email and we&rsquo;ll send you a reset link.</p>
          </div>
          {resetSent ? (
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700 text-center font-medium">
              Reset link sent! Check your email.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <span className="field-label-text">Email</span>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="field-input"
                />
              </div>
              {error && <p className="error-banner">{error}</p>}
              <button type="submit" disabled={busy} className="auth-btn">
                {busy ? "Sending\u2026" : "Send reset link"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => { setShowForgot(false); setResetSent(false); setError(null); }}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors text-center font-medium"
          >
            ← Back to sign in
          </button>
        </form>
      )}

      {/* ── Sign Up ── */}
      {tab === "signup" && (
        signupSuccess ? (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700 w-full font-medium">
              Account created! Check your email to confirm, then sign in.
            </div>
            <button
              type="button"
              onClick={() => switchTab("signin")}
              className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors"
            >
              Go to sign in \u2192
            </button>
          </div>
        ) : (
          <form onSubmit={onSignUp} className="flex flex-col gap-4">
            <div className="text-center mb-1">
              <p className="text-base font-semibold text-gray-900">Create clinic account</p>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
              For clinic owners only. Staff receive an email invite from their owner.
            </p>

            <div className="flex flex-col gap-1">
              <span className="field-label-text">Your Name</span>
              <input
                type="text"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                placeholder="Full name"
                autoComplete="name"
                required
                className="field-input"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="field-label-text">Email</span>
              <input
                type="email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="field-input"
              />
            </div>

            <PasswordInput
              value={signupPassword}
              onChange={setSignupPassword}
              placeholder="8+ characters"
              label="Password"
              autoComplete="new-password"
            />
            <PasswordRequirements password={signupPassword} />

            <PasswordInput
              value={signupConfirm}
              onChange={setSignupConfirm}
              placeholder="Repeat password"
              label="Confirm Password"
              autoComplete="new-password"
            />

            {error && <p className="error-banner">{error}</p>}

            <button type="submit" disabled={busy} className="auth-btn mt-1">
              {busy ? "Creating account\u2026" : "Create Account"}
            </button>
          </form>
        )
      )}
    </AuthCard>
  );
}
