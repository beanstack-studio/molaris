import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server is not configured for invites. Contact your system administrator." },
      { status: 503 }
    );
  }

  const body = await req.json() as {
    email?: string;
    clinicId?: string;
    clinicName?: string;
    inviterName?: string;
    role?: string;
  };

  const { email, clinicId, clinicName, inviterName, role } = body;

  if (!email || !clinicId) {
    return NextResponse.json({ error: "email and clinicId are required." }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
    redirectTo: `${appUrl}/dashboard`,
    data: {
      clinic_id: clinicId,
      clinic_name: clinicName ?? "",
      inviter_name: inviterName ?? "",
      role: role ?? "staff",
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId: data.user.id });
}
