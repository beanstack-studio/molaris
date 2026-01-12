"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { initializePaymentModes } from "@/lib/initPaymentModes";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize payment modes on page load
    initializePaymentModes().catch(err => console.error("Payment modes initialization error:", err));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Matira Dental Studio</h1>
        <p className="text-sm text-slate-600 mt-1">Clinic management login</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Password</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}

          <button
            className="w-full rounded-lg bg-slate-900 text-white py-2 font-medium disabled:opacity-60"
            disabled={busy}
            type="submit"
          >
            {busy ? "Signing in..." : "Sign in"}
          </button>

          {/* Dev only: Skip login - REMOVE BEFORE PUSH */}
          {/*}
          <button
            className="w-full rounded-lg bg-slate-500 text-white py-2 font-medium mt-2"
            onClick={() => router.push("/dashboard")}
            type="button"
          >
            Skip Login (Dev)
          </button>
          */}
        </form>
      </div>
    </main>
  );
}
