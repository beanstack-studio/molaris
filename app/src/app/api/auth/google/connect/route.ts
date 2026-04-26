import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/google/connect?uid=<user_id>
 * Redirects the user to Google's OAuth consent screen.
 * After authorization Google sends the user back to /api/auth/google/callback.
 *
 * Requires: GOOGLE_CLIENT_ID env var
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "Google Calendar not configured — add GOOGLE_CLIENT_ID" },
      { status: 500 }
    );
  }

  const uid = request.nextUrl.searchParams.get("uid");
  if (!uid) {
    return NextResponse.json({ error: "Missing uid" }, { status: 400 });
  }

  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/google/callback`;
  const state = Buffer.from(JSON.stringify({ uid, ts: Date.now() })).toString("base64url");

  const oauthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  oauthUrl.searchParams.set("client_id", clientId);
  oauthUrl.searchParams.set("redirect_uri", redirectUri);
  oauthUrl.searchParams.set("response_type", "code");
  oauthUrl.searchParams.set(
    "scope",
    [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" ")
  );
  oauthUrl.searchParams.set("access_type", "offline");
  oauthUrl.searchParams.set("prompt", "consent"); // always return refresh_token
  oauthUrl.searchParams.set("state", state);

  return NextResponse.redirect(oauthUrl.toString());
}
