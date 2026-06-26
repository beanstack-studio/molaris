export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface JoinCompleteBody {
  clinicId?: string;
  role?: string;
  dentistId?: string | null;
  email?: string;
}

export async function POST(req: NextRequest) {
  console.log("join-complete called");

  // 1. Verify the calling user via Authorization header token only
  const authHeader = req.headers.get("Authorization");
  console.log("Auth header:", authHeader ? "present" : "MISSING");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body for logging (before user lookup — token already checked above)
  const body = await req.json() as JoinCompleteBody;
  console.log("Body received:", JSON.stringify(body));
  const { clinicId, role, dentistId } = body;

  // 3. Verify user from token
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  console.log("User from token:", user?.email ?? `NOT FOUND: ${authError?.message}`);

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!clinicId || !role) {
    return NextResponse.json({ error: "clinicId and role are required." }, { status: 400 });
  }

  const userId = user.id;
  const userEmail = user.email ?? null;

  // 4. Verify clinic exists — never create a new one here
  const { data: clinic, error: clinicError } = await supabaseAdmin
    .from("clinics")
    .select("id, name")
    .eq("id", clinicId)
    .single();

  if (clinicError || !clinic) {
    console.log("Clinic not found:", clinicId, clinicError?.message);
    return NextResponse.json({ error: "Clinic not found" }, { status: 400 });
  }

  // 5. Check if profile already exists
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

    console.log("Profile result:", updateError?.message ?? "updated existing");

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

    console.log("Profile result:", profileError?.message ?? "inserted new");

    if (profileError) {
      console.error("Profile insert error:", profileError);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
  }

  // 6. Link dentist profile_id if dentistId provided
  if (dentistId) {
    await supabaseAdmin
      .from("dentists")
      .update({ profile_id: userId })
      .eq("id", dentistId)
      .eq("clinic_id", clinicId);
  }

  // 7. Mark invite as accepted
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
