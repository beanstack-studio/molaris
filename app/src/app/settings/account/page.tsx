"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useClinic } from "@/contexts/ClinicContext";
import { supabase } from "@/lib/supabaseClient";
import { FeatureGate } from "@/components/shared/FeatureGate";

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdmin, isDentist, profileId, userFullName, userEmail } = useClinic();

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
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailConfirmSuccess, setEmailConfirmSuccess] = useState(false);
  const [emailConfirmError, setEmailConfirmError] = useState<string | null>(null);

  // Handle email change confirmation redirect (Sub-task 4)
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
    setEmailError(null);
    setEmailMsg(null);
    setShowEmailForm(true);
  }

  function cancelEmailForm() {
    setNewEmail("");
    setEmailError(null);
    setEmailMsg(null);
    setShowEmailForm(false);
  }

  async function sendEmailChange() {
    const trimmed = newEmail.trim();
    if (!trimmed) return;
    setEmailBusy(true);
    setEmailError(null);

    const { error } = await supabase.auth.updateUser(
      { email: trimmed },
      { emailRedirectTo: `${window.location.origin}/settings/account` },
    );

    if (error) {
      setEmailError(error.message);
    } else {
      setEmailMsg(
        "Confirmation sent. Check both your current and new email inboxes to complete the change.",
      );
      setShowEmailForm(false);
      setNewEmail("");
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
      setResetMsg(`Password reset email sent to ${userEmail}. Check your inbox.`);
    }
    setResetBusy(false);
  }

  const roleBadgeClass = isAdmin
    ? "text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700"
    : isDentist
      ? "text-xs px-2.5 py-0.5 rounded-full font-semibold bg-green-50 text-green-700"
      : "text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-500";
  const roleLabel = isAdmin ? "Admin" : isDentist ? "Dentist" : "Staff";

  return (
    <div className="spacing-vertical-lg">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">My Account</h2>
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
            <button type="button" className="save-btn" onClick={openEdit}>
              Edit
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

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field-label">
            <span className="field-label-text">Full Name</span>
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
          </label>

          <div className="field-label">
            <span className="field-label-text">Email</span>
            <div className="flex items-center gap-2">
              <div className="field-input-readonly flex-1 min-w-0 truncate">
                {userEmail || "—"}
              </div>
              {!showEmailForm && (
                <button
                  type="button"
                  className="cancel-btn shrink-0"
                  onClick={openEmailForm}
                >
                  Change Email
                </button>
              )}
            </div>
          </div>

          <div className="field-label">
            <span className="field-label-text">Role</span>
            <div className="flex items-center h-[42px]">
              <span className={roleBadgeClass}>{roleLabel}</span>
            </div>
          </div>
        </div>

        {emailMsg && <div className="success-banner mt-4">{emailMsg}</div>}

        {showEmailForm && (
          <div className="mt-4 card-light grid gap-3">
            <label className="field-label">
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
            </label>
            <p className="hint-text">
              A confirmation link will be sent to both your current and new email addresses.
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
                disabled={emailBusy || !newEmail.trim()}
              >
                {emailBusy ? "Sending…" : "Send Confirmation"}
              </button>
            </div>
          </div>
        )}

        <hr className="my-5 border-t border-slate-200" />

        {resetMsg && <div className="success-banner">{resetMsg}</div>}
        {resetError && <div className="error-banner">{resetError}</div>}
        <button
          type="button"
          className="cancel-btn"
          onClick={sendPasswordReset}
          disabled={resetBusy || !userEmail}
        >
          {resetBusy ? "Sending…" : "Change Password"}
        </button>
      </div>

      {/* Calendar Sync card */}
      <FeatureGate feature="calendar_sync">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Calendar Sync</h2>
          </div>
          <div className="spacing-vertical-lg">
            <p className="text-sm text-slate-600">
              Sync your appointments with Google Calendar. Each team member connects their own
              account.
            </p>
            <div className="card card-light flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-700 mb-0.5">Google Calendar</div>
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
