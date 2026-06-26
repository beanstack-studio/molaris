export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface JoinCompleteBody {
  clinicId?: string;
  role?: string;
  dentistId?: string | null;
}

export async function POST(req: NextRequest) {
  // Verify the calling user — cookie first, Authorization header fallback
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser();

  let user = cookieUser;
  if (cookieError || !cookieUser) {
    // Fallback: verify via Authorization header token
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: { user: headerUser }, error: headerError } = await supabaseAdmin.auth.getUser(token);
    if (headerError || !headerUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    user = headerUser;
  }

  const body = await req.json() as JoinCompleteBody;
  const { clinicId, role, dentistId } = body;

  if (!clinicId || !role) {
    return NextResponse.json({ error: "clinicId and role are required." }, { status: 400 });
  }

  // 1. Insert profile (upsert in case of retry)
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id: user!.id,
        clinic_id: clinicId,
        role,
        email: user!.email ?? null,
        full_name: null,
      },
      { onConflict: "id" }
    );

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // 2. Link dentist profile if dentistId provided
  if (dentistId) {
    await supabaseAdmin
      .from("dentists")
      .update({ profile_id: user!.id })
      .eq("id", dentistId)
      .eq("clinic_id", clinicId);
  }

  // 3. Mark invite as accepted
  if (user!.email) {
    await supabaseAdmin
      .from("staff_invites")
      .update({ status: "accepted" })
      .eq("email", user!.email.toLowerCase())
      .eq("clinic_id", clinicId)
      .eq("status", "pending");
  }

  return NextResponse.json({ success: true });
}
