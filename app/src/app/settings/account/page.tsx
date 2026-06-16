"use client";

import { useEffect, useState } from "react";
import { useClinic } from "@/contexts/ClinicContext";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/cn";

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconCheck() {
  return (
    <svg className="w-4 h-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconXMark() {
  return (
    <svg className="w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292Z" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" />
      <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

// ─── Password helpers ────────────────────────────────────────────────────────

function validatePassword(pwd: string): string | null {
  if (pwd.length < 8) return "Password must be at least 8 characters.";
  if (!/\d/.test(pwd)) return "Password must contain at least one number.";
  return null;
}

function IconEye() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

// ─── Plan feature lists ───────────────────────────────────────────────────────

const FREE_INCLUDED = [
  "Patient records (unlimited)",
  "Appointments calendar",
  "Treatment records",
  "Billing & invoicing",
  "Document generation",
];

const FREE_EXCLUDED = [
  "Unlimited staff accounts",
  "Advanced reports & analytics",
  "Priority support",
];

const PRO_FEATURES_LIST = [
  "Everything in Free",
  "Unlimited staff accounts",
  "Advanced reports & analytics",
  "Priority support",
];

// ─── AccountPage ──────────────────────────────────────────────────────────────

export default function AccountPage() {
  const { plan, clinicName, isOwner } = useClinic();
  const isPro = plan === "pro";

  // Appearance
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("molaris_theme");
    setIsDark(stored === "dark");
  }, []);

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState(false);

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    const err = validatePassword(newPassword);
    if (err) { setPwdError(err); return; }
    if (newPassword !== confirmPassword) { setPwdError("Passwords do not match."); return; }
    setPwdBusy(true);
    setPwdError(null);
    setPwdSuccess(false);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwdBusy(false);
    if (error) { setPwdError(error.message); return; }
    setPwdSuccess(true);
    setNewPassword("");
    setConfirmPassword("");
    setTimeout(() => setPwdSuccess(false), 4000);
  }

  function toggleDark() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("molaris_theme", next ? "dark" : "light");
  }

  return (
    <div className="spacing-vertical-lg">

      {/* ── Plan ─────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Plan</h2>
        </div>

        <div className="spacing-vertical-lg">
          {/* Pricing cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Free card */}
            <div className={cn(
              "rounded-xl border-2 p-5 flex flex-col gap-4 transition-colors",
              !isPro
                ? "border-slate-700 dark:border-slate-300 bg-white dark:bg-slate-900"
                : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40"
            )}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Free</span>
                  {!isPro && (
                    <span className="badge badge-secondary text-xs">Your plan</span>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">₱0</span>
                  <span className="text-sm text-slate-400 dark:text-slate-500">/month</span>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">1 owner · up to 2 staff</p>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-700 pt-4 flex flex-col gap-2.5 flex-1">
                {FREE_INCLUDED.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <IconCheck />
                    {f}
                  </div>
                ))}
                {FREE_EXCLUDED.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-sm text-slate-400 dark:text-slate-600">
                    <IconXMark />
                    {f}
                  </div>
                ))}
              </div>
            </div>

            {/* Pro card */}
            <div className={cn(
              "rounded-xl border-2 p-5 flex flex-col gap-4 relative transition-colors",
              isPro
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                : "border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900"
            )}>
              {/* Badges */}
              <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs font-bold bg-blue-500 text-white px-2.5 py-0.5 rounded-full">
                  <IconStar /> Popular
                </span>
                {isPro && (
                  <span className="badge badge-info text-xs">Your plan</span>
                )}
              </div>

              <div>
                <div className="mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">Pro</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">₱499</span>
                  <span className="text-sm text-slate-400 dark:text-slate-500">/month</span>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Unlimited owner · unlimited staff</p>
              </div>

              <div className="border-t border-blue-100 dark:border-blue-900 pt-4 flex flex-col gap-2.5 flex-1">
                {PRO_FEATURES_LIST.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <IconCheck />
                    {f}
                  </div>
                ))}
              </div>

              {!isPro && (
                <div className="relative group">
                  <button
                    type="button"
                    className="save-btn w-full opacity-70 cursor-not-allowed"
                    disabled
                    aria-disabled="true"
                  >
                    Upgrade to Pro
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
                    <div className="bg-slate-800 dark:bg-slate-700 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap">
                      Contact hello@beanstack.studio to upgrade
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
            You&rsquo;re on the <strong className="text-slate-700 dark:text-slate-300">{isPro ? "Pro" : "Free"}</strong> plan — thank you for supporting Molaris!{" "}
            Questions? <span className="font-medium">hello@beanstack.studio</span>
          </p>

          {!isOwner && (
            <p className="hint-text text-center">Plan changes can only be made by the clinic owner.</p>
          )}
        </div>
      </div>

      {/* ── Appearance ───────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Appearance</h2>
        </div>

        <div className="spacing-vertical-lg">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Customize how Molaris looks on your device. This setting is saved per browser.
          </p>

          <div className="card card-light flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <span className="text-slate-500 dark:text-slate-400">
                {isDark ? <IconMoon /> : <IconSun />}
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {isDark ? "Dark mode" : "Light mode"}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {isDark ? "Using dark theme" : "Using light theme"}
                </div>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isDark}
              onClick={toggleDark}
              className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 bg-slate-200 dark:bg-blue-600"
              aria-label="Toggle dark mode"
            >
              <span className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out translate-x-0 dark:translate-x-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Integrations ─────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Integrations</h2>
        </div>

        <div className="spacing-vertical-lg">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Connect external services to extend Molaris.
          </p>

          <div className="card card-light flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-0.5">
                Google Calendar
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Sync confirmed appointments to Google Calendar automatically.
              </div>
            </div>
            <div className="relative group shrink-0">
              <button
                type="button"
                className="save-btn opacity-50 cursor-not-allowed"
                disabled
                aria-disabled="true"
              >
                Connect
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
                <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap">
                  Coming soon
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Security ─────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Security</h2>
        </div>

        <form onSubmit={onChangePassword} className="spacing-vertical-lg mt-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Change the password for your account.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field-label">
              <span className="field-label-text">New password</span>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  autoComplete="new-password"
                  required
                  className="field-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                  aria-label={showNew ? "Hide password" : "Show password"}
                >
                  {showNew ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
              {newPassword && (
                <div className="flex gap-3 text-xs mt-1">
                  <span className={newPassword.length >= 8 ? "text-emerald-600 font-medium" : "text-slate-400"}>
                    {newPassword.length >= 8 ? "✓" : "·"} 8+ characters
                  </span>
                  <span className={/\d/.test(newPassword) ? "text-emerald-600 font-medium" : "text-slate-400"}>
                    {/\d/.test(newPassword) ? "✓" : "·"} one number
                  </span>
                </div>
              )}
            </div>

            <div className="field-label">
              <span className="field-label-text">Confirm new password</span>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  required
                  className="field-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            </div>
          </div>

          {pwdError && (
            <p className="error-banner">{pwdError}</p>
          )}
          {pwdSuccess && (
            <p className="success-banner">Password updated successfully.</p>
          )}

          <div>
            <button type="submit" className="save-btn" disabled={pwdBusy}>
              {pwdBusy ? "Saving…" : "Update password"}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
