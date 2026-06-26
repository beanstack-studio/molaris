/**
 * SETUP REQUIRED — Supabase invite template
 * Go to: https://supabase.com/dashboard/project/gigjvywfqguqpipovfyd/auth/templates
 * Template: "Invite user"
 * Set redirect URL to: https://molaris-app-opal.vercel.app/join
 * Paste the invite HTML template from EMAIL_SETUP.md
 *
 * Also go to: Authentication → URL Configuration
 * Add to Redirect URLs: https://molaris-app-opal.vercel.app/join
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface InviteBody {
  email?: string;
  role?: "admin" | "dentist" | "staff";
  clinicId?: string;
  clinicName?: string;
  inviterName?: string;
  dentistId?: string;
}

export async function POST(req: NextRequest) {
  // 1. Verify calling user
  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.replace("Bearer ", "").trim();

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: { user: callingUser }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !callingUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse and validate body
  const body = await req.json() as InviteBody;
  const { email, role, clinicId, clinicName, inviterName, dentistId } = body;

  if (!email || !role || !clinicId) {
    return NextResponse.json({ error: "email, role, and clinicId are required." }, { status: 400 });
  }

  // 3. Verify calling user is admin of this clinic
  const { data: callerProfile } = await supabaseAdmin
    .from("profiles")
    .select("role, clinic_id")
    .eq("id", callingUser.id)
    .maybeSingle();

  if (!callerProfile || callerProfile.clinic_id !== clinicId || callerProfile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 4. Check if email already has a profile in this clinic
  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (existingProfile) {
    return NextResponse.json(
      { error: "This person already has access to this clinic." },
      { status: 409 }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;

  // 5. Send invite via Supabase
  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail, {
    redirectTo: `${appUrl}/join`,
    data: {
      clinic_id: clinicId,
      clinic_name: clinicName ?? "",
      role,
      dentist_id: dentistId ?? null,
      inviter_name: inviterName ?? "",
    },
  });

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  // 6. Record invite in staff_invites
  const { error: dbError } = await supabaseAdmin.from("staff_invites").insert({
    clinic_id: clinicId,
    email: normalizedEmail,
    role,
    dentist_id: dentistId ?? null,
    invited_by: callingUser.id,
    token: crypto.randomUUID(),
    status: "pending",
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (dbError) {
    // Invite email was sent but DB record failed — log but don't fail the request
    console.error("staff_invites insert failed:", dbError.message);
  }

  return NextResponse.json({ success: true });
}
