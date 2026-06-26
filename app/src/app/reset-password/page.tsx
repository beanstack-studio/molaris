/**
 * SETUP REQUIRED — Supabase Email Template
 *
 * Go to: https://supabase.com/dashboard/project/gigjvywfqguqpipovfyd/auth/templates
 * Select: "Reset Password" template
 * Paste the HTML from EMAIL_SETUP.md (Template 3)
 *
 * Also go to: Authentication → URL Configuration
 * Add to "Redirect URLs": https://molaris-app-opal.vercel.app/reset-password
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthSuccess } from "@/components/auth/AuthSuccess";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordRequirements } from "@/components/auth/PasswordRequirements";

function validatePassword(pwd: string): string | null {
  if (pwd.length < 8) return "Password must be at least 8 characters.";
  if (!/\d/.test(pwd)) return "Password must contain at least one number.";
  return null;
}

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
    // Supabase fires PASSWORD_RECOVERY when the recovery token in the URL hash is valid.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    // If no PASSWORD_RECOVERY event within 5 seconds the link is invalid or already used.
    const timeout = setTimeout(() => setTimedOut(true), 5000);

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

    const validationError = validatePassword(password);
    if (validationError) { setError(validationError); return; }
    if (password !== confirm) { setError("Passwords don\u2019t match."); return; }

    setBusy(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (updateError) { setError(updateError.message); return; }

    setDone(true);
    setTimeout(() => router.replace("/dashboard"), 2500);
  }

  if (done) {
    return (
      <AuthSuccess
        message="Password updated!"
        subMessage="Taking you to the dashboard\u2026"
      />
    );
  }

  if (!ready) {
    return (
      <AuthCard title="Reset your password" subtitle="Verifying your reset link\u2026">
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter a new password for your account"
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <PasswordInput
          value={password}
          onChange={setPassword}
          placeholder="8+ characters"
          label="New password"
          autoComplete="new-password"
        />
        <div>
          <PasswordInput
            value={confirm}
            onChange={setConfirm}
            placeholder="Repeat password"
            label="Confirm password"
            autoComplete="new-password"
          />
          <PasswordRequirements password={password} />
        </div>

        {error && <p className="error-banner">{error}</p>}

        <button type="submit" disabled={busy} className="auth-btn mt-2">
          {busy ? "Updating\u2026" : "Update Password"}
        </button>
      </form>
    </AuthCard>
  );
}
