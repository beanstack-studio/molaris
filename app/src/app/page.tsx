"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ensureSessionRestored } from "@/lib/initializeAuth";

export default function Home() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        // Wait for Supabase to restore session from storage
        await ensureSessionRestored();
        
        // Now check if we have a session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          router.push("/login");
          router.refresh();
        }
      } catch (error) {
        console.error("Auth check error:", error);
        router.push("/login");
        router.refresh();
      } finally {
        setChecked(true);
      }
    }

    checkAuth();
  }, [router]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  return null;
}
