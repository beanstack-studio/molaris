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

export async function GET() {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not configured. Add it to .env.local." },
      { status: 503 }
    );
  }

  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email,
    role: (u.user_metadata?.role as string) ?? "staff",
    last_sign_in: u.last_sign_in_at ?? null,
    created_at: u.created_at,
    confirmed: !!u.confirmed_at,
  }));

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not configured." },
      { status: 503 }
    );
  }

  const { email, role } = await req.json();
  if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { role: role ?? "staff" },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ user: { id: data.user.id, email: data.user.email } });
}

export async function PATCH(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not configured." },
      { status: 503 }
    );
  }

  const { id, role } = await req.json();
  if (!id) return NextResponse.json({ error: "User ID is required." }, { status: 400 });

  const { error } = await admin.auth.admin.updateUserById(id, {
    user_metadata: { role },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not configured." },
      { status: 503 }
    );
  }

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "User ID is required." }, { status: 400 });

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
