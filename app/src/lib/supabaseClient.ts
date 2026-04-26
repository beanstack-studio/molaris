import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// All REST API data calls get a 30-second timeout so the UI never hangs indefinitely.
// Uses Promise.race instead of AbortController — Safari has a known bug where
// AbortController.abort() on a fetch does not reliably reject the Promise, causing
// permanent hangs. Promise.race is cross-browser safe and does not need abort().
// Auth and realtime requests are excluded — they must complete on their own schedule.
const QUERY_TIMEOUT_MS = 30_000;
function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  try {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    // Skip timeout for: existing abort signals, auth endpoints, realtime/websocket
    if (init.signal || url.includes("/auth/v1/") || url.includes("/realtime/")) {
      return fetch(input, init);
    }
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out after 30s")), QUERY_TIMEOUT_MS)
    );
    return Promise.race([fetch(input, init), timeoutPromise]);
  } catch {
    // Fallback: plain fetch with no timeout if anything above fails
    return fetch(input, init);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // localStorage (default) persists across page refreshes and tabs — required for
    // Safari, which aggressively clears sessionStorage between navigations and on
    // refresh, causing pages to hang on spinners instead of redirecting to /login.
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
