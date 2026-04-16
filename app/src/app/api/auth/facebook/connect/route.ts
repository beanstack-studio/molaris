import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/facebook/connect
 * Redirects the admin to Facebook's OAuth dialog.
 * After authorization, Facebook sends the user back to /api/auth/facebook/callback
 */
export async function GET(request: NextRequest) {
  const appId = process.env.FACEBOOK_APP_ID;

  if (!appId) {
    return NextResponse.json(
      { error: "Facebook App ID not configured" },
      { status: 500 }
    );
  }

  const origin = request.nextUrl.origin; // e.g. https://matiradentalstudio.xyz
  const redirectUri = `${origin}/api/auth/facebook/callback`;

  const oauthUrl = new URL("https://www.facebook.com/v18.0/dialog/oauth");
  oauthUrl.searchParams.set("client_id", appId);
  oauthUrl.searchParams.set("redirect_uri", redirectUri);
  oauthUrl.searchParams.set(
    "scope",
    "pages_messaging,pages_show_list,pages_read_engagement,pages_manage_metadata"
  );
  oauthUrl.searchParams.set("response_type", "code");

  return NextResponse.redirect(oauthUrl.toString());
}
