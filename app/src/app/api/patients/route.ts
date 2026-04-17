import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** GET /api/patients — returns all non-deleted patients for staff use */
export async function GET() {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("patients")
    .select("id, full_name, first_name, last_name, phone")
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
