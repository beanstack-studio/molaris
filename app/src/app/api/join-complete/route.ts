export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface JoinCompleteBody {
  clinicId?: string;
  role?: string;
  dentistId?: string | null;
}

export async function POST(req: NextRequest) {
  // Verify the calling user via Authorization header token only
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as JoinCompleteBody;
  const { clinicId, role, dentistId } = body;

  if (!clinicId || !role) {
    return NextResponse.json({ error: "clinicId and role are required." }, { status: 400 });
  }

  const userId = user.id;
  const userEmail = user.email ?? null;

  // 1. Verify clinic exists — never create a new one here
  const { data: clinic, error: clinicError } = await supabaseAdmin
    .from("clinics")
    .select("id, name")
    .eq("id", clinicId)
    .single();

  if (clinicError || !clinic) {
    return NextResponse.json({ error: "Clinic not found" }, { status: 400 });
  }

  // 2. Check if profile already exists
  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existingProfile) {
    // Profile already exists — update clinic_id and role to match the invite
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ clinic_id: clinicId, role })
      .eq("id", userId);

    if (updateError) {
      console.error("Profile update error:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  } else {
    // Insert new profile linked to the EXISTING clinic
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        clinic_id: clinicId,
        role,
        email: userEmail,
        full_name: null,
      });

    if (profileError) {
      console.error("Profile insert error:", profileError);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
  }

  // 3. Link dentist profile_id if dentistId provided
  if (dentistId) {
    await supabaseAdmin
      .from("dentists")
      .update({ profile_id: userId })
      .eq("id", dentistId)
      .eq("clinic_id", clinicId);
  }

  // 4. Mark invite as accepted
  if (userEmail) {
    await supabaseAdmin
      .from("staff_invites")
      .update({ status: "accepted" })
      .eq("email", userEmail.toLowerCase())
      .eq("clinic_id", clinicId)
      .eq("status", "pending");
  }

  return NextResponse.json({ success: true });
}
