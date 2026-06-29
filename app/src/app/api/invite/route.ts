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

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface InviteBody {
  email?: string;
  role?: "admin" | "dentist" | "staff";
  clinicId?: string;
  clinicName?: string;
  inviterName?: string;
  dentistId?: string;
  full_name?: string | null;
}

export async function POST(req: NextRequest) {
  // 1. Verify calling user via Authorization header token only
  const authHeader = req.headers.get("Authorization");
  console.log("Auth header:", authHeader ? `present (${authHeader.length} chars)` : "MISSING");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  console.log("User lookup:", user?.email ?? `failed: ${authError?.message}`);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse and validate body
  const body = await req.json() as InviteBody;
  const { email, role, clinicId, clinicName, inviterName, dentistId, full_name } = body;

  if (!email || !role || !clinicId) {
    return NextResponse.json({ error: "email, role, and clinicId are required." }, { status: 400 });
  }

  // 3. Verify calling user is admin of this clinic
  const { data: callerProfile } = await supabaseAdmin
    .from("profiles")
    .select("role, clinic_id")
    .eq("id", user.id)
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
    const { data: { user: existingAuthUser } } = await supabaseAdmin.auth.admin.getUserById(existingProfile.id);

    if (!existingAuthUser) {
      // Auth user already deleted — profiles row is stale, clean it up and proceed
      await supabaseAdmin.from("profiles").delete().eq("id", existingProfile.id);
    } else {
      // Auth user still exists. Check if a prior revoke partially completed.
      // For dentists: revoke clears dentists.profile_id first. If that link is gone,
      // the revoke started but FK constraints prevented the profiles/auth cleanup.
      let isPartialRevoke = false;
      if (dentistId) {
        const { data: dentistRow } = await supabaseAdmin
          .from("dentists")
          .select("profile_id")
          .eq("id", dentistId)
          .maybeSingle();
        isPartialRevoke = dentistRow != null && dentistRow.profile_id === null;
      }

      if (isPartialRevoke) {
        // The auth user exists with a confirmed Molaris account.
        // Deleting + re-inviting fails (inviteUserByEmail blocks confirmed users,
        // and the profiles row can't be deleted due to unknown FK constraints).
        // Solution: upsert the profiles row in-place and re-link the dentist.
        const reinstateId = existingProfile.id;

        const { error: upsertErr } = await supabaseAdmin.from("profiles").upsert({
          id: reinstateId,
          clinic_id: clinicId,
          email: email.trim().toLowerCase(),
          role,
          full_name: full_name ?? (existingAuthUser.user_metadata as Record<string, unknown>)?.full_name as string ?? null,
        }, { onConflict: "id" });
        if (upsertErr) {
          return NextResponse.json({ error: upsertErr.message }, { status: 500 });
        }

        // Re-link dentist record
        if (dentistId) {
          await supabaseAdmin.from("dentists")
            .update({ profile_id: reinstateId })
            .eq("id", dentistId)
            .eq("clinic_id", clinicId);
        }

        return NextResponse.json({ success: true, reinstated: true });
      } else {
        return NextResponse.json(
          { error: "This person already has access to this clinic." },
          { status: 409 }
        );
      }
    }
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
  // Note: staff_invites.full_name column required — run migration:
  // ALTER TABLE public.staff_invites ADD COLUMN IF NOT EXISTS full_name text;
  const { error: dbError } = await supabaseAdmin.from("staff_invites").insert({
    clinic_id: clinicId,
    email: normalizedEmail,
    role,
    dentist_id: dentistId ?? null,
    full_name: full_name ?? null,
    invited_by: user.id,
    token: crypto.randomUUID(),
    status: "pending",
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (dbError) {
    console.error("staff_invites insert failed:", dbError.message);
  }

  return NextResponse.json({ success: true });
}
