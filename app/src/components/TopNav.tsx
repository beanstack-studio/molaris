"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useState } from "react";

export default function TopNav({ title = "Matira Dental Studio" }: { title?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await supabase.auth.signOut();
    setBusy(false);
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="sticky top-0 z-50 border-b bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <Link href="/patients" className="text-sm font-semibold text-slate-900 hover:underline">
          {title}
        </Link>

        <div className="flex items-center gap-2">
          <Link href="/settings" className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
            Settings
          </Link>

          <button
            type="button"
            className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
            onClick={signOut}
            disabled={busy}
            title="Sign out"
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}
