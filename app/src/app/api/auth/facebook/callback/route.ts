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
 * GET /api/auth/facebook/callback
 * Facebook redirects here after the admin authorizes the app.
 * Exchanges the code for a Page Access Token and saves it to Supabase.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const settingsUrl = `${origin}/settings/website-controls`;

  if (error || !code) {
    return NextResponse.redirect(`${settingsUrl}?fb_error=access_denied`);
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    return NextResponse.redirect(`${settingsUrl}?fb_error=not_configured`);
  }

  try {
    const redirectUri = `${origin}/api/auth/facebook/callback`;

    // ── Step 1: Exchange code for user access token ──────────────────────
    const tokenRes = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token` +
        `?client_id=${appId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&client_secret=${appSecret}` +
        `&code=${code}`
    );

    if (!tokenRes.ok) {
      console.error("Token exchange failed:", await tokenRes.text());
      return NextResponse.redirect(`${settingsUrl}?fb_error=token_exchange`);
    }

    const { access_token: userToken } = await tokenRes.json();

    // ── Step 2: List pages this user manages ────────────────────────────
    const pagesRes = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${userToken}`
    );

    if (!pagesRes.ok) {
      console.error("Pages fetch failed:", await pagesRes.text());
      return NextResponse.redirect(`${settingsUrl}?fb_error=no_pages`);
    }

    const { data: pages = [] } = await pagesRes.json();

    if (!pages.length) {
      return NextResponse.redirect(`${settingsUrl}?fb_error=no_pages`);
    }

    // Use first page (single-clinic setup)
    const page = pages[0] as { id: string; name: string; access_token: string };

    // ── Step 3: Subscribe page to receive webhook events ─────────────────
    try {
      await fetch(`https://graph.facebook.com/v18.0/${page.id}/subscribed_apps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscribed_fields: "messages,messaging_postbacks",
          access_token: page.access_token,
        }),
      });
    } catch (subErr) {
      console.warn("Page subscription warning (non-fatal):", subErr);
    }

    // ── Step 4: Save / update in Supabase ────────────────────────────────
    const supabaseAdmin = getAdminClient();
    const { error: dbError } = await supabaseAdmin.from("facebook_pages").upsert(
      {
        page_id: page.id,
        page_name: page.name,
        page_access_token: page.access_token,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "page_id" }
    );

    if (dbError) {
      console.error("Supabase upsert error:", JSON.stringify(dbError));
      const code = (dbError as { code?: string }).code ?? "unknown";
      return NextResponse.redirect(`${settingsUrl}?fb_error=db_error&db_code=${encodeURIComponent(code)}&db_msg=${encodeURIComponent(dbError.message ?? "")}`);
    }

    return NextResponse.redirect(
      `${settingsUrl}?fb_connected=1&page_name=${encodeURIComponent(page.name)}`
    );
  } catch (err) {
    console.error("Facebook OAuth callback error:", err);
    return NextResponse.redirect(`${settingsUrl}?fb_error=server_error`);
  }
}
