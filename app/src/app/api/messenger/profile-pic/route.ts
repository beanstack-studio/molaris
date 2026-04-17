import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * GET /api/messenger/profile-pic?psid=PSID
 * Redirects to a fresh Facebook profile picture URL using the stored page token.
 * Using redirect means the browser always gets a current CDN URL — no expiry issues.
 */
export async function GET(request: NextRequest) {
  const psid = request.nextUrl.searchParams.get("psid");
  if (!psid) return new NextResponse(null, { status: 400 });

  const supabase = getAdminClient();
  const { data: page } = await supabase
    .from("facebook_pages")
    .select("page_access_token")
    .maybeSingle();

  const token = (page as any)?.page_access_token as string | null;
  if (!token) return new NextResponse(null, { status: 404 });

  // Redirect to Facebook's picture endpoint — Graph API resolves it to a fresh CDN URL
  const url = `https://graph.facebook.com/v18.0/${encodeURIComponent(psid)}/picture?type=square&redirect=true&access_token=${token}`;
  return NextResponse.redirect(url);
}
