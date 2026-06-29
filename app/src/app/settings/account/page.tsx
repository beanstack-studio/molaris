"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useClinic } from "@/contexts/ClinicContext";
import { supabase } from "@/lib/supabaseClient";
import { FeatureGate } from "@/components/shared/FeatureGate";
import { cn } from "@/lib/cn";

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdmin, isDentist, profileId, userFullName, userEmail } = useClinic();

  // ── Computed display values ─────────────────────────────────────────────────
  const initials =
    (userFullName ?? "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?";

  const maskedEmail = (() => {
    if (!userEmail) return "—";
    const atIdx = userEmail.indexOf("@");
    if (atIdx < 0) return userEmail;
    const local = userEmail.slice(0, atIdx);
    const domain = userEmail.slice(atIdx);
    return `${local.slice(0, 2)}${"*".repeat(4)}${domain}`;
  })();

  const roleBadgeClass = cn(
    "text-xs px-2.5 py-0.5 rounded-full font-semibold",
    isAdmin
      ? "bg-blue-50 text-blue-700"
      : isDentist
        ? "bg-green-50 text-green-700"
        : "bg-slate-100 text-slate-500",
  );
  const roleLabel = isAdmin ? "Admin" : isDentist ? "Dentist" : "Staff";

  // ── Member since ────────────────────────────────────────────────────────────
  const [memberSince, setMemberSince] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.created_at) {
        setMemberSince(
          new Date(user.created_at).toLocaleDateString("en-PH", {
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "Asia/Manila",
          }),
        );
      }
    });
  }, []);

  // ── Display name edit ──────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(userFullName ?? "");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(userFullName ?? "");
  }, [userFullName]);

  function openEdit() {
    setFullName(userFullName ?? "");
    setSaveError(null);
    setSaveSuccess(false);
    setEditing(true);
  }

  function cancelEdit() {
    setFullName(userFullName ?? "");
    setSaveError(null);
    setEditing(false);
  }

  async function saveName() {
    if (!fullName.trim()) return;
    setSaveBusy(true);
    setSaveError(null);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", profileId);
      if (error) throw error;
      setSaveSuccess(true);
      setEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaveBusy(false);
    }
  }

  // ── Email change ───────────────────────────────────────────────────────────
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailConfirmSuccess, setEmailConfirmSuccess] = useState(false);
  const [emailConfirmError, setEmailConfirmError] = useState<string | null>(null);

  const emailMismatch = confirmEmail.length > 0 && newEmail.trim() !== confirmEmail.trim();
  const emailFormValid =
    newEmail.trim().length > 0 && newEmail.trim() === confirmEmail.trim();

  // Handle Supabase email-change confirmation redirect
  useEffect(() => {
    const tokenHash = searchParams?.get("token_hash");
    const type = searchParams?.get("type");
    if (!tokenHash || type !== "email_change") return;

    supabase.auth
      .verifyOtp({ token_hash: tokenHash, type: "email_change" })
      .then(async ({ error }) => {
        if (error) {
          setEmailConfirmError(error.message);
        } else {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user?.email && profileId) {
            await supabase
              .from("profiles")
              .update({ email: user.email })
              .eq("id", profileId);
          }
          setEmailConfirmSuccess(true);
          setTimeout(() => setEmailConfirmSuccess(false), 5000);
        }
        router.replace("/settings/account");
      });
  }, [searchParams, profileId, router]);

  function openEmailForm() {
    setNewEmail("");
    setConfirmEmail("");
    setEmailError(null);
    setEmailMsg(null);
    setShowEmailForm(true);
  }

  function cancelEmailForm() {
    setNewEmail("");
    setConfirmEmail("");
    setEmailError(null);
    setEmailMsg(null);
    setShowEmailForm(false);
  }

  async function sendEmailChange() {
    if (!emailFormValid) return;
    setEmailBusy(true);
    setEmailError(null);

    const { error } = await supabase.auth.updateUser(
      { email: newEmail.trim() },
      { emailRedirectTo: `${window.location.origin}/settings/account` },
    );

    if (error) {
      setEmailError(error.message);
    } else {
      setEmailMsg(
        "Confirmation link sent. Check your new email inbox and click the link to complete the change.",
      );
      setShowEmailForm(false);
      setNewEmail("");
      setConfirmEmail("");
    }
    setEmailBusy(false);
  }

  // ── Password reset ─────────────────────────────────────────────────────────
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  async function sendPasswordReset() {
    if (!userEmail) return;
    setResetBusy(true);
    setResetMsg(null);
    setResetError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setResetError(error.message);
    } else {
      setResetMsg("Password reset link sent. Check your email inbox.");
    }
    setResetBusy(false);
  }

  return (
    <div className="max-w-2xl spacing-vertical-lg">

      {/* ── Profile card ──────────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Profile</h2>
          {editing ? (
            <div className="action-row">
              <button
                type="button"
                className="cancel-btn"
                onClick={cancelEdit}
                disabled={saveBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="save-btn"
                onClick={saveName}
                disabled={saveBusy || !fullName.trim()}
              >
                {saveBusy ? "Saving…" : "Save"}
              </button>
            </div>
          ) : (
            <button type="button" className="cancel-btn" onClick={openEdit}>
              Edit Name
            </button>
          )}
        </div>

        {saveError && <div className="error-banner">{saveError}</div>}
        {saveSuccess && <div className="success-banner">Name updated.</div>}
        {emailConfirmSuccess && (
          <div className="success-banner">Email address updated successfully.</div>
        )}
        {emailConfirmError && (
          <div className="error-banner">Email confirmation failed: {emailConfirmError}</div>
        )}

        {/* Avatar + identity summary */}
        <div className="flex items-center gap-4 mb-5">
          <div className="sidebar-user-avatar w-14 h-14 text-xl">{initials}</div>
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-800 dark:text-slate-100 truncate">
              {userFullName || "—"}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={roleBadgeClass}>{roleLabel}</span>
              {memberSince && (
                <span className="hint-text">Member since {memberSince}</span>
              )}
            </div>
          </div>
        </div>

        {/* Editable name field */}
        <div className="field-label">
          <span className="field-label-text">Display Name</span>
          {editing ? (
            <input
              className="field-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={saveBusy}
              placeholder="Your full name"
            />
          ) : (
            <div className="field-input-readonly">{userFullName || "—"}</div>
          )}
        </div>
      </div>

      {/* ── Security card ─────────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Security</h2>
        </div>

        {emailMsg && <div className="success-banner">{emailMsg}</div>}
        {resetMsg && <div className="success-banner">{resetMsg}</div>}
        {resetError && <div className="error-banner">{resetError}</div>}

        {/* Email row */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="field-label-text">Email</div>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-1">
              {maskedEmail}
            </div>
          </div>
          {!showEmailForm && (
            <button
              type="button"
              className="cancel-btn shrink-0"
              onClick={openEmailForm}
            >
              Change
            </button>
          )}
        </div>

        {/* Email change inline form */}
        {showEmailForm && (
          <div className="mt-4 card-light grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="field-label">
                <span className="field-label-text">New Email Address</span>
                <input
                  className="field-input"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="newemail@example.com"
                  disabled={emailBusy}
                  autoFocus
                />
              </div>
              <div className="field-label">
                <span className="field-label-text">Confirm New Email</span>
                <input
                  className="field-input"
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder="newemail@example.com"
                  disabled={emailBusy}
                />
                {emailMismatch && (
                  <span className="text-xs text-red-500 mt-0.5">Emails do not match</span>
                )}
              </div>
            </div>
            <p className="hint-text">
              A confirmation link will be sent to your new address. Click it to complete the change.
            </p>
            {emailError && <div className="error-banner">{emailError}</div>}
            <div className="action-row justify-end">
              <button
                type="button"
                className="cancel-btn"
                onClick={cancelEmailForm}
                disabled={emailBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="save-btn"
                onClick={sendEmailChange}
                disabled={emailBusy || !emailFormValid}
              >
                {emailBusy ? "Sending…" : "Send Confirmation"}
              </button>
            </div>
          </div>
        )}

        <hr className="my-4 border-t border-slate-200 dark:border-slate-700" />

        {/* Password row */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="field-label-text">Password</div>
            <div className="text-sm font-medium text-slate-400 mt-1 tracking-widest">
              ••••••••
            </div>
          </div>
          <button
            type="button"
            className="cancel-btn shrink-0"
            onClick={sendPasswordReset}
            disabled={resetBusy || !userEmail}
          >
            {resetBusy ? "Sending…" : "Change"}
          </button>
        </div>
      </div>

      {/* ── Calendar Sync card ─────────────────────────────────────────────── */}
      <FeatureGate feature="calendar_sync">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Calendar Sync</h2>
          </div>
          <div className="spacing-vertical-lg">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Sync your appointments with Google Calendar. Each team member connects their own
              account.
            </p>
            <div className="card-light flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-0.5">
                  Google Calendar
                </div>
                <div className="text-xs text-slate-500">Not connected</div>
              </div>
              <div className="relative group shrink-0">
                <button
                  type="button"
                  className="save-btn opacity-50 cursor-not-allowed"
                  disabled
                  aria-disabled="true"
                >
                  Connect Google Calendar
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
                  <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap">
                    Coming soon
                  </div>
                </div>
              </div>
            </div>
            <p className="hint-text">
              Google Calendar integration is in development and will be available in a future update.
            </p>
          </div>
        </div>
      </FeatureGate>
    </div>
  );
}
