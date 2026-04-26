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
 * DELETE /api/auth/google/disconnect
 * Body: { user_id: string }
 * Removes the Google Calendar connection and revokes the token.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { user_id } = await request.json();
    if (!user_id) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();

    // Get existing token to revoke
    const { data: conn } = await supabaseAdmin
      .from("google_calendar_connections")
      .select("access_token, refresh_token")
      .eq("user_id", user_id)
      .maybeSingle();

    // Revoke token with Google (best-effort, non-fatal)
    if (conn?.access_token) {
      try {
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(conn.access_token)}`,
          { method: "POST" }
        );
      } catch {
        // non-fatal
      }
    }

    // Remove from DB
    const { error: dbError } = await supabaseAdmin
      .from("google_calendar_connections")
      .delete()
      .eq("user_id", user_id);

    if (dbError) {
      console.error("[google/disconnect] DB error:", JSON.stringify(dbError));
      return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[google/disconnect] Unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/auth/google/disconnect (update connection settings)
 * Body: { user_id, sync_own_only?, dentist_id? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user_id, sync_own_only, dentist_id } = await request.json();
    if (!user_id) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (sync_own_only !== undefined) updates.sync_own_only = sync_own_only;
    if (dentist_id !== undefined) updates.dentist_id = dentist_id || null;

    const { error: dbError } = await supabaseAdmin
      .from("google_calendar_connections")
      .update(updates)
      .eq("user_id", user_id);

    if (dbError) {
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[google/disconnect PATCH] Unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
