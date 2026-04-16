import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

/**
 * GET /api/messenger/profile?psid=PSID
 * Server-side proxy for Facebook Graph API profile lookup.
 * The page access token never leaves the server.
 */
export async function GET(request: NextRequest) {
  const psid = request.nextUrl.searchParams.get("psid");
  if (!psid) return NextResponse.json({ name: null, picture_url: null });

  try {
    const { data: page } = await supabase
      .from("facebook_pages")
      .select("page_access_token")
      .maybeSingle();

    const token = (page as any)?.page_access_token as string | null;
    if (!token) return NextResponse.json({ name: null, picture_url: null });

    const graphRes = await fetch(
      `https://graph.facebook.com/v18.0/${psid}?fields=first_name,last_name,profile_pic&access_token=${token}`
    );

    if (!graphRes.ok) return NextResponse.json({ name: null, picture_url: null });

    const data = await graphRes.json();
    const name =
      data.first_name && data.last_name
        ? `${data.first_name} ${data.last_name}`
        : data.first_name || null;

    return NextResponse.json({ name, picture_url: data.profile_pic || null });
  } catch {
    return NextResponse.json({ name: null, picture_url: null });
  }
}
