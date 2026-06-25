/**
 * SETUP REQUIRED — Supabase Email Template
 *
 * Go to: https://supabase.com/dashboard/project/gigjvywfqguqpipovfyd/auth/templates
 * Select: "Reset Password" template
 * Update the redirect URL to: https://molaris-app-opal.vercel.app/reset-password
 *
 * Also go to: Authentication → URL Configuration
 * Add to "Redirect URLs": https://molaris-app-opal.vercel.app/reset-password
 *
 * TODO: Customize the email template branding to say "Molaris" instead of the default.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase puts the recovery token in the URL fragment.
    // onAuthStateChange fires with PASSWORD_RECOVERY when the token is valid.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    // If no PASSWORD_RECOVERY event fires within 8 seconds the link is invalid
    // or already used — redirect to login.
    const timeout = setTimeout(() => {
      setTimedOut(true);
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (timedOut && !ready) {
      router.replace("/login");
    }
  }, [timedOut, ready, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.replace("/dashboard"), 2000);
  }

  return (
    <main className="page-bg min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-md">
        <div className="mb-6">
          <h1 className="card-title text-xl">Set new password</h1>
          <p className="hint-text mt-1">Choose a strong password for your account.</p>
        </div>

        {done ? (
          <div className="success-banner text-center">
            Password updated successfully. Redirecting…
          </div>
        ) : !ready ? (
          <p className="loading-text">Verifying reset link…</p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="field-label">
              <span className="field-label-text">New Password</span>
              <input
                className="field-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>
            <label className="field-label">
              <span className="field-label-text">Confirm Password</span>
              <input
                className="field-input"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </label>
            {error && <div className="error-banner">{error}</div>}
            <button className="save-btn w-full" disabled={busy} type="submit">
              {busy ? "Saving…" : "Set new password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
