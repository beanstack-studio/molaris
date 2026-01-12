import { supabase } from "./supabaseClient";

/**
 * Wait for Supabase to restore session from storage.
 * This is needed because when the page first loads, the auth state
 * needs to be restored from localStorage/cookies before queries can work.
 */
export async function ensureSessionRestored(): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;

    // Listen for auth state changes to detect when session is restored
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!resolved) {
        resolved = true;
        subscription?.unsubscribe();
        resolve(!!session);
      }
    });

    // Also try to get session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!resolved) {
        resolved = true;
        subscription?.unsubscribe();
        resolve(!!session);
      }
    });

    // Timeout after 5 seconds just in case
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        subscription?.unsubscribe();
        resolve(false);
      }
    }, 5000);
  });
}
