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

// All REST API data calls get a 15-second timeout so the UI never hangs indefinitely.
// Auth and realtime requests are excluded — they must complete on their own schedule.
const QUERY_TIMEOUT_MS = 15_000;
function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
  // Skip timeout for: existing abort signals, auth endpoints, realtime/websocket
  if (init.signal || url.includes("/auth/v1/") || url.includes("/realtime/")) {
    return fetch(input, init);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: sessionStorageAdapter,
  },
  global: {
    fetch: fetchWithTimeout,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
