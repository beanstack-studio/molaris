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

type StaffInviteRow = {
  clinic_id: string;
  role: string;
  dentist_id: string | null;
  clinics: { name: string }[] | { name: string } | null;
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
  const [clinicId, setClinicId] = useState("");
  const [clinicName, setClinicName] = useState("your clinic");
  const [role, setRole] = useState("staff");
  const [dentistId, setDentistId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        .then(async ({ error: sessionError }) => {
          if (sessionError) {
            setErrorMessage("This invite link is invalid or has expired.");
            setPageState("error");
            return;
          }

          // Get the freshest user data with metadata from the server
          const { data: { user: freshUser } } = await supabase.auth.getUser();
          setUser(freshUser);

          if (!freshUser) {
            setErrorMessage("This invite link is invalid or has expired.");
            setPageState("error");
            return;
          }

          const metaClinicId = freshUser.user_metadata?.clinic_id as string | undefined;
          const metaRole = (freshUser.user_metadata?.role as string | undefined) ?? "staff";
          const metaDentistId = (freshUser.user_metadata?.dentist_id as string | undefined) ?? null;
          const metaClinicName = (freshUser.user_metadata?.clinic_name as string | undefined) ?? "";

          if (!metaClinicId) {
            // Fallback: look up from staff_invites by email
            const { data: invite } = await supabase
              .from("staff_invites")
              .select("clinic_id, role, dentist_id, clinics(name)")
              .eq("email", freshUser.email ?? "")
              .eq("status", "pending")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (!invite) {
              setErrorMessage("Could not find your invite. Please ask your admin to resend.");
              setPageState("error");
              return;
            }

            const row = invite as unknown as StaffInviteRow;
            const clinicEntry = Array.isArray(row.clinics) ? row.clinics[0] : row.clinics;
            setClinicId(row.clinic_id);
            setRole(row.role);
            setDentistId(row.dentist_id);
            setClinicName(clinicEntry?.name ?? "your clinic");
          } else {
            setClinicId(metaClinicId);
            setRole(metaRole);
            setDentistId(metaDentistId);
            setClinicName(metaClinicName || "your clinic");
          }

          setPageState("form");
        });
    } else {
      setErrorMessage("Invalid invite link.");
      setPageState("error");
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validatePassword(password);
    if (validationError) { setError(validationError); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }

    const currentUser = user;
    if (!currentUser) {
      setError("Session expired. Please click the invite link again.");
      return;
    }

    setBusy(true);
    setError(null);

    // Step 1: Update password
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) { setError(updateError.message); setBusy(false); return; }

    // Step 2: Call join-complete with email only — server looks up invite record
    const joinResponse = await fetch("/api/join-complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: currentUser.email }),
    });

    const joinResult = await joinResponse.json() as { success?: boolean; error?: string };
    console.log("join-complete:", joinResponse.status, joinResult);

    if (!joinResponse.ok) {
      console.error("join-complete failed:", joinResult);
      // Don't block user — admin can fix manually
    }

    setBusy(false);
    setPageState("success");
    setTimeout(() => router.replace("/dashboard"), 2500);
  }

  if (pageState === "success") {
    return (
      <AuthSuccess
        message="Account created!"
        subMessage={`Welcome to ${clinicName}. Taking you to the dashboard…`}
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
    const displayError = errorMessage ?? "This link may have expired or already been used.";
    return (
      <AuthCard title="Invalid invite link">
        <div className="flex flex-col gap-4 items-center text-center pb-2">
          <p className="text-sm text-gray-500 leading-relaxed">
            {displayError}
            <br />
            Ask your admin to send a new invite.
          </p>
          <a
            href="/login"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            ← Back to login
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
          {busy ? "Creating account…" : "Create Account"}
        </button>
      </form>
    </AuthCard>
  );
}
