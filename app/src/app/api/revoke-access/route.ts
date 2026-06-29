export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface RevokeBody {
  profile_id?: string;
}

export async function POST(req: NextRequest) {
  // Verify calling user via Authorization header
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  const body = await req.json() as RevokeBody;
  const { profile_id } = body;

  if (!profile_id) {
    return NextResponse.json({ error: "profile_id is required" }, { status: 400 });
  }

  // Prevent self-revocation
  if (profile_id === user.id) {
    return NextResponse.json({ error: "Cannot revoke your own access" }, { status: 400 });
  }

  // Verify caller is admin of their clinic
  const { data: callerProfile } = await supabaseAdmin
    .from("profiles")
    .select("role, clinic_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!callerProfile || callerProfile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Look up target profile — verify it belongs to same clinic
  const { data: targetProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, clinic_id")
    .eq("id", profile_id)
    .maybeSingle();

  if (!targetProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (targetProfile.clinic_id !== callerProfile.clinic_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Clear dentist.profile_id link if target was a dentist
  await supabaseAdmin
    .from("dentists")
    .update({ profile_id: null })
    .eq("profile_id", profile_id)
    .eq("clinic_id", callerProfile.clinic_id);

  // Delete handler assignments for this profile
  await supabaseAdmin
    .from("dentist_handlers")
    .delete()
    .eq("profile_id", profile_id)
    .eq("clinic_id", callerProfile.clinic_id);

  // Null out every column across every table that might hold this profile_id as a FK.
  // This covers both tables with formal REFERENCES profiles(id) constraints and those
  // that store the UUID loosely — running all in parallel, failures are non-fatal.
  await Promise.allSettled([
    // Scheduling
    supabaseAdmin.from("appointments").update({ created_by: null }).eq("created_by", profile_id),
    supabaseAdmin.from("appointments").update({ updated_by: null }).eq("updated_by", profile_id),
    // Expenses
    supabaseAdmin.from("clinic_operating_expenses").update({ created_by: null }).eq("created_by", profile_id),
    supabaseAdmin.from("clinic_bills").update({ created_by: null }).eq("created_by", profile_id),
    supabaseAdmin.from("payroll_runs").update({ created_by: null }).eq("created_by", profile_id),
    supabaseAdmin.from("maintenance_logs").update({ created_by: null }).eq("created_by", profile_id),
    // Billing
    supabaseAdmin.from("invoices").update({ created_by: null }).eq("created_by", profile_id),
    supabaseAdmin.from("payments").update({ created_by: null }).eq("created_by", profile_id),
    supabaseAdmin.from("payments").update({ verified_by: null }).eq("verified_by", profile_id),
    supabaseAdmin.from("receipts").update({ created_by: null }).eq("created_by", profile_id),
    supabaseAdmin.from("receipts").update({ voided_by: null }).eq("voided_by", profile_id),
    // Patients & clinical
    supabaseAdmin.from("patients").update({ created_by: null }).eq("created_by", profile_id),
    supabaseAdmin.from("treatments").update({ created_by: null }).eq("created_by", profile_id),
    supabaseAdmin.from("documents").update({ issued_by: null }).eq("issued_by", profile_id),
    // Staff & invites
    supabaseAdmin.from("staff").update({ created_by: null }).eq("created_by", profile_id),
    supabaseAdmin.from("staff_invites").update({ invited_by: null }).eq("invited_by", profile_id),
  ]);

  // Delete the profiles row — all FK refs are now nulled
  const { error: profileDeleteError } = await supabaseAdmin
    .from("profiles")
    .delete()
    .eq("id", profile_id);
  if (profileDeleteError) {
    console.error("profiles delete failed:", profileDeleteError.message);
    return NextResponse.json({ error: `Could not remove profile: ${profileDeleteError.message}` }, { status: 500 });
  }

  // Delete the auth user — profile is gone so they can no longer log in.
  // If this fails (e.g. already deleted), it's non-fatal since access is already revoked.
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(profile_id);
  if (deleteError) {
    console.warn("deleteUser warning (non-fatal, access already revoked):", deleteError.message);
  }

  console.log("Access fully revoked for profile:", profile_id);
  return NextResponse.json({ success: true });
}
