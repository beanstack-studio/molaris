"use client";

import { useEffect, useState } from "react";
import { useClinic } from "@/contexts/ClinicContext";
import { supabase } from "@/lib/supabaseClient";

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

  const roleBadgeClass = isAdmin
    ? "text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700"
    : isDentist
    ? "text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700"
    : "text-xs px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-500";

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

      {/* ── Calendar Sync ─────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Google Calendar Sync</h2>
          <span className="badge badge-secondary">Coming soon</span>
        </div>
        <p className="text-sm text-slate-600 mt-2">
          Connect your clinic&apos;s Google Calendar to automatically sync appointments.
          Confirmed appointments will appear in your calendar, and cancellations will
          be removed automatically.
        </p>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-700 mb-0.5">Google Calendar</div>
            <div className="text-xs text-slate-500">Not connected</div>
          </div>
          <button type="button" className="save-btn opacity-50 cursor-not-allowed" disabled aria-disabled="true">
            Connect Google Calendar
          </button>
        </div>
        <p className="hint-text mt-3">Google Calendar integration is coming in a future update.</p>
      </div>

    </div>
  );
}
