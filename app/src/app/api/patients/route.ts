import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** GET /api/patients — returns ALL patients (paginated past Supabase 1000-row limit) */
export async function GET() {
  const supabase = getAdminClient();
  const PAGE = 10000;
  let all: any[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("patients")
      .select("id, full_name, first_name, last_name, phone")
      .order("full_name", { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    all = [...all, ...data];
    if (data.length < PAGE) break;
    offset += data.length;
  }

  return NextResponse.json(all);
}
