import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * POST /api/settings/clinic-profile
 * Creates the initial clinic_profile row using the service role key so that
 * RLS policies on the client-facing anon key don't block the initial INSERT.
 * Safe to call multiple times — uses upsert so it won't duplicate rows.
 */
export async function POST() {
  try {
    const supabaseAdmin = getAdminClient();

    // Check if a row already exists first
    const { data: existing } = await supabaseAdmin
      .from("clinic_profile")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ id: existing.id, created: false });
    }

    const { data, error } = await supabaseAdmin
      .from("clinic_profile")
      .insert({ clinic_name: "Matira Dental Studio", sunday_end_hour: 11 })
      .select()
      .single();

    if (error) {
      console.error("[clinic-profile/init] Insert error:", JSON.stringify(error));
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id, created: true });
  } catch (err) {
    console.error("[clinic-profile/init] Unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
