import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * GET /api/clinic-info
 * Public endpoint — returns clinic_name and logo_url using service role.
 * Used by login page (no session available there).
 */
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data } = await supabase
      .from("clinic_profile")
      .select("clinic_name, logo_url")
      .limit(1);
    const row = data?.[0];
    return NextResponse.json({
      clinic_name: row?.clinic_name ?? null,
      logo_url: row?.logo_url ?? null,
    });
  } catch {
    return NextResponse.json({ clinic_name: null, logo_url: null });
  }
}
