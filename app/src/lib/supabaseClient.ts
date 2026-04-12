import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Use sessionStorage so sessions are scoped to the browser tab.
// Closing the tab or browser clears the session — patients data is never
// accessible to anyone who opens the URL in a fresh window.
const sessionStorageAdapter =
  typeof window !== "undefined"
    ? {
        getItem: (key: string) => window.sessionStorage.getItem(key),
        setItem: (key: string, value: string) => window.sessionStorage.setItem(key, value),
        removeItem: (key: string) => window.sessionStorage.removeItem(key),
      }
    : undefined;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: sessionStorageAdapter,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
