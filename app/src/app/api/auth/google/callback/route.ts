import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * GET /api/auth/google/callback
 * Google redirects here after the user authorizes the app.
 * Exchanges the code for tokens and saves them to google_calendar_connections.
 *
 * Requires: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SUPABASE_SERVICE_ROLE_KEY
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const settingsUrl = `${origin}/settings/website-controls`;

  if (oauthError || !code || !stateParam) {
    return NextResponse.redirect(`${settingsUrl}?gc_error=access_denied`);
  }

  // Decode state to get uid
  let uid: string;
  try {
    const decoded = JSON.parse(Buffer.from(stateParam, "base64url").toString());
    uid = decoded.uid;
    if (!uid) throw new Error("no uid in state");
  } catch {
    return NextResponse.redirect(`${settingsUrl}?gc_error=invalid_state`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${settingsUrl}?gc_error=not_configured`);
  }

  try {
    const redirectUri = `${origin}/api/auth/google/callback`;

    // ── Step 1: Exchange code for tokens ─────────────────────────────────
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      console.error("[google/callback] Token exchange failed:", await tokenRes.text());
      return NextResponse.redirect(`${settingsUrl}?gc_error=token_exchange`);
    }

    const { access_token, refresh_token, expires_in } = await tokenRes.json();

    // ── Step 2: Get user's Google email ───────────────────────────────────
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const { email: googleEmail = "unknown" } = profileRes.ok ? await profileRes.json() : {};

    const tokenExpiry = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString();

    // ── Step 3: Upsert into google_calendar_connections ──────────────────
    const supabaseAdmin = getAdminClient();

    // Determine role so we can set a smart default for sync_own_only on first connect
    let autoSyncOwnOnly = false;
    try {
      const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(uid);
      const role =
        (authUser?.user_metadata?.role as string) ??
        (authUser?.app_metadata?.role as string) ??
        "staff";
      autoSyncOwnOnly = role === "dentist";
    } catch { /* non-fatal */ }

    // Only apply default on first connect; preserve existing preference on reconnect
    const { data: existing } = await supabaseAdmin
      .from("google_calendar_connections")
      .select("sync_own_only")
      .eq("user_id", uid)
      .maybeSingle();

    const upsertPayload: Record<string, unknown> = {
      user_id: uid,
      google_email: googleEmail,
      access_token,
      refresh_token,
      token_expiry: tokenExpiry,
      updated_at: new Date().toISOString(),
    };
    if (!existing) {
      upsertPayload.sync_own_only = autoSyncOwnOnly;
    }

    const { error: dbError } = await supabaseAdmin
      .from("google_calendar_connections")
      .upsert(upsertPayload, { onConflict: "user_id" });

    if (dbError) {
      console.error("[google/callback] DB upsert error:", JSON.stringify(dbError));
      return NextResponse.redirect(`${settingsUrl}?gc_error=db_error`);
    }

    return NextResponse.redirect(
      `${settingsUrl}?gc_connected=1&gc_email=${encodeURIComponent(googleEmail)}`
    );
  } catch (err) {
    console.error("[google/callback] Unexpected error:", err);
    return NextResponse.redirect(`${settingsUrl}?gc_error=server_error`);
  }
}
