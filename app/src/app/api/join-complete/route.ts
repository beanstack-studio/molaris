export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface JoinCompleteBody {
  email?: string;
}

export async function POST(request: Request) {
  console.log("join-complete called");

  const body = await request.json() as JoinCompleteBody;
  const { email } = body;

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Look up the pending invite by email — no auth token needed
  const { data: invite, error: inviteError } = await supabaseAdmin
    .from("staff_invites")
    .select("clinic_id, role, dentist_id, email, full_name")
    .eq("email", normalizedEmail)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (inviteError || !invite) {
    console.error("Invite not found for:", normalizedEmail);
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  // Get auth user by email via admin API
  const listResult = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (listResult.error) {
    console.error("Failed to list users:", listResult.error.message);
    return NextResponse.json({ error: "Failed to lookup user" }, { status: 500 });
  }

  const user = listResult.data.users.find(
    (u) => u.email?.toLowerCase() === normalizedEmail,
  );

  if (!user) {
    console.error("Auth user not found for:", normalizedEmail);
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  console.log("Found user:", user.email, "for clinic:", invite.clinic_id);

  // Upsert profile — handles both new and existing profiles
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id: user.id,
        clinic_id: invite.clinic_id,
        role: invite.role,
        email: invite.email,
        full_name: (invite as { full_name?: string | null }).full_name ?? null,
      },
      { onConflict: "id" },
    );

  if (profileError) {
    console.error("Profile upsert error:", profileError.message);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Link dentist profile_id if applicable
  if (invite.dentist_id) {
    await supabaseAdmin
      .from("dentists")
      .update({ profile_id: user.id })
      .eq("id", invite.dentist_id)
      .eq("clinic_id", invite.clinic_id);
  }

  // Mark invite accepted
  await supabaseAdmin
    .from("staff_invites")
    .update({ status: "accepted" })
    .eq("email", normalizedEmail)
    .eq("status", "pending");

  console.log("Profile created successfully for:", normalizedEmail);
  return NextResponse.json({ success: true });
}
