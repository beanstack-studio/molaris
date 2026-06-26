"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthSuccess } from "@/components/auth/AuthSuccess";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordRequirements } from "@/components/auth/PasswordRequirements";
import { Spinner } from "@/components/Spinner";
import type { User } from "@supabase/supabase-js";

type PageState = "loading" | "error" | "form" | "success";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  dentist: "Dentist",
  staff: "Staff",
};

function validatePassword(pwd: string): string | null {
  if (pwd.length < 8) return "Password must be at least 8 characters";
  if (!/\d/.test(pwd)) return "Password must contain at least one number";
  return null;
}

export default function JoinPage() {
  const router = useRouter();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [clinicName, setClinicName] = useState("your clinic");
  const [role, setRole] = useState("staff");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const type = params.get("type");

    if (type === "invite" && accessToken) {
      supabase.auth
        .setSession({
          access_token: accessToken,
          refresh_token: params.get("refresh_token") ?? "",
        })
        .then(({ data, error: sessionError }) => {
          if (sessionError || !data.user) {
            setPageState("error");
            return;
          }
          setUser(data.user);
          setClinicName(data.user.user_metadata?.clinic_name ?? "your clinic");
          setRole(data.user.user_metadata?.role ?? "staff");
          setPageState("form");
        });
    } else {
      setPageState("error");
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validatePassword(password);
    if (validationError) { setError(validationError); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }

    setBusy(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) { setError(updateError.message); setBusy(false); return; }

    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/api/join-complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        clinicId: user?.user_metadata?.clinic_id,
        role: user?.user_metadata?.role,
        dentistId: user?.user_metadata?.dentist_id ?? null,
      }),
    });

    setBusy(false);
    setPageState("success");
    setTimeout(() => router.replace("/dashboard"), 2500);
  }

  if (pageState === "success") {
    return (
      <AuthSuccess
        message="Account created!"
        subMessage={`Welcome to ${clinicName}. Taking you to the dashboard\u2026`}
      />
    );
  }

  if (pageState === "loading") {
    return (
      <AuthCard>
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      </AuthCard>
    );
  }

  if (pageState === "error") {
    return (
      <AuthCard title="Invalid invite link">
        <div className="flex flex-col gap-4 items-center text-center pb-2">
          <p className="text-sm text-gray-500 leading-relaxed">
            This link may have expired or already been used.<br />
            Ask your admin to send a new invite.
          </p>
          <a
            href="/login"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            \u2190 Back to login
          </a>
        </div>
      </AuthCard>
    );
  }

  // form state
  const roleLabel = ROLE_LABELS[role] ?? role;
  const cardSubtitle = `Set a password to access ${clinicName} as ${roleLabel}.`;

  return (
    <AuthCard title="You've been invited!" subtitle={cardSubtitle}>
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
          {busy ? "Creating account\u2026" : "Create Account"}
        </button>
      </form>
    </AuthCard>
  );
}
