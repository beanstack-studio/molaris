"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            <div className="mt-1 relative">
              <input
                className="w-full rounded-lg border px-3 py-2 pr-10"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <ellipse cx="12" cy="12" rx="8" ry="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="12" cy="12" r="3" fill="currentColor" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4 11c0 0 2 3 8 3s8-3 8-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="5.5" cy="14.5" r="0.7" fill="currentColor" />
                    <circle cx="8" cy="15" r="0.7" fill="currentColor" />
                    <circle cx="10.5" cy="15.3" r="0.7" fill="currentColor" />
                    <circle cx="13" cy="15" r="0.7" fill="currentColor" />
                    <circle cx="15.5" cy="14.5" r="0.7" fill="currentColor" />
                  </svg>
                )}
              </button>
            </div>
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

          {/* Forget password - hidden until needed */}
          {/*
          <button
            className="w-full text-sm text-slate-600 hover:text-slate-900 py-2 mt-2"
            type="button"
            onClick={() => {}}
          >
            Forgot password?
          </button>
          */}

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
