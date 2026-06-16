"use client";

import { useEffect, useState } from "react";
import { useClinic } from "@/contexts/ClinicContext";
import { supabase } from "@/lib/supabaseClient";

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

export default function AccountPage() {
  const { role, isAdmin, isDentist, userFullName, userEmail } = useClinic();

  // ── Personal info ──────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState(userFullName ?? "");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => { setFullName(userFullName ?? ""); }, [userFullName]);

  async function saveName() {
    if (!fullName.trim()) return;
    setNameBusy(true); setNameError(null); setNameSuccess(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", user.id);
      if (error) throw error;
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Failed to save");
    } finally { setNameBusy(false); }
  }

  // ── Password reset ─────────────────────────────────────────────────────────
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  async function sendPasswordReset() {
    if (!userEmail) return;
    setResetBusy(true); setResetMsg(null); setResetError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) { setResetError(error.message); }
    else { setResetMsg(`Password reset email sent to ${userEmail}`); }
    setResetBusy(false);
  }

  // ── Appearance ─────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setIsDark(localStorage.getItem("molaris_theme") === "dark");
  }, []);
  function toggleDark() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("molaris_theme", next ? "dark" : "light");
  }

  const roleBadgeClass = isAdmin
    ? "text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    : isDentist
    ? "text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    : "text-xs px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300";

  const roleLabel = isAdmin ? "Admin" : isDentist ? "Dentist" : "Staff";

  return (
    <div className="spacing-vertical-lg">

      {/* ── Personal Info ──────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">My Account</h2>
          <span className={roleBadgeClass}>{roleLabel}</span>
        </div>

        {nameError && <div className="error-banner mt-3">{nameError}</div>}
        {nameSuccess && <div className="success-banner mt-3">Name updated.</div>}

        <div className="grid gap-4 mt-4 sm:grid-cols-2">
          <label className="field-label">
            <span className="field-label-text">Full name</span>
            <input
              className="field-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={nameBusy}
              placeholder="Your full name"
            />
          </label>

          <label className="field-label">
            <span className="field-label-text">Email</span>
            <input
              className="field-input"
              value={userEmail ?? ""}
              readOnly
              tabIndex={-1}
            />
          </label>
        </div>

        <div className="mt-4">
          <button
            type="button"
            className="save-btn"
            onClick={saveName}
            disabled={nameBusy || !fullName.trim() || fullName.trim() === (userFullName ?? "")}
          >
            {nameBusy ? "Saving…" : "Save name"}
          </button>
        </div>
      </div>

      {/* ── Security ──────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Security</h2>
        </div>

        <div className="mt-4">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            We&rsquo;ll send a password reset link to <strong>{userEmail}</strong>.
          </p>

          {resetMsg && <div className="success-banner mb-3">{resetMsg}</div>}
          {resetError && <div className="error-banner mb-3">{resetError}</div>}

          <button
            type="button"
            className="save-btn"
            onClick={sendPasswordReset}
            disabled={resetBusy || !userEmail}
          >
            {resetBusy ? "Sending…" : "Send password reset link"}
          </button>
        </div>
      </div>

      {/* ── Appearance ────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Appearance</h2>
        </div>

        <div className="card card-light flex items-center justify-between gap-4 p-4 mt-4">
          <div className="flex items-center gap-3">
            <span className="text-slate-500 dark:text-slate-400">
              {isDark ? <IconMoon /> : <IconSun />}
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {isDark ? "Dark mode" : "Light mode"}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Saved per browser
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
  );
}
