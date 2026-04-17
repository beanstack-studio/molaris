import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** GET /api/thread-patients?thread_id=xxx — list patients linked to a thread */
export async function GET(request: NextRequest) {
  const threadId = request.nextUrl.searchParams.get("thread_id");
  if (!threadId) return NextResponse.json({ error: "thread_id required" }, { status: 400 });

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("thread_patients")
    .select("id, patient_id, patients(id, full_name, first_name, last_name, phone)")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/thread-patients — link a patient to a thread */
export async function POST(request: NextRequest) {
  const { thread_id, patient_id } = await request.json();
  if (!thread_id || !patient_id) {
    return NextResponse.json({ error: "thread_id and patient_id required" }, { status: 400 });
  }

  const supabase = getAdminClient();

  // Check patient is not already linked to a different thread
  const { data: existing } = await supabase
    .from("thread_patients")
    .select("thread_id")
    .eq("patient_id", patient_id)
    .maybeSingle();

  if (existing && existing.thread_id !== thread_id) {
    return NextResponse.json(
      { error: "This patient is already linked to another conversation." },
      { status: 409 }
    );
  }

  // Check if already linked to this same thread — idempotent
  const { data: duplicate } = await supabase
    .from("thread_patients")
    .select("id")
    .eq("thread_id", thread_id)
    .eq("patient_id", patient_id)
    .maybeSingle();

  if (duplicate) return NextResponse.json({ ok: true });

  const { error } = await supabase
    .from("thread_patients")
    .insert({ thread_id, patient_id });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also set patient_id on the thread (for backward compat with queries that use it)
  await supabase
    .from("message_threads")
    .update({ patient_id })
    .eq("id", thread_id)
    .is("patient_id", null); // only set if not already set

  return NextResponse.json({ ok: true });
}

/** DELETE /api/thread-patients — unlink a patient from a thread */
export async function DELETE(request: NextRequest) {
  const { thread_id, patient_id } = await request.json();
  if (!thread_id || !patient_id) {
    return NextResponse.json({ error: "thread_id and patient_id required" }, { status: 400 });
  }

  const supabase = getAdminClient();
  const { error } = await supabase
    .from("thread_patients")
    .delete()
    .eq("thread_id", thread_id)
    .eq("patient_id", patient_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If no patients left, clear patient_id on thread
  const { data: remaining } = await supabase
    .from("thread_patients")
    .select("patient_id")
    .eq("thread_id", thread_id);

  if ((remaining?.length ?? 0) === 0) {
    await supabase.from("message_threads").update({ patient_id: null }).eq("id", thread_id);
  } else {
    // Set patient_id to first remaining
    await supabase
      .from("message_threads")
      .update({ patient_id: remaining![0].patient_id })
      .eq("id", thread_id);
  }

  return NextResponse.json({ ok: true });
}
