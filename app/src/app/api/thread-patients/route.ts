import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** GET /api/thread-patients?thread_id=xxx — list patients linked to a thread
 *  GET /api/thread-patients?patient_id=xxx — reverse: find threads for a patient */
export async function GET(request: NextRequest) {
  const threadId  = request.nextUrl.searchParams.get("thread_id");
  const patientId = request.nextUrl.searchParams.get("patient_id");

  if (!threadId && !patientId) {
    return NextResponse.json({ error: "thread_id or patient_id required" }, { status: 400 });
  }

  const supabase = getAdminClient();

  // ── Reverse lookup: threads for a given patient ──────────────────────────
  if (patientId) {
    const { data: links, error: linksErr } = await supabase
      .from("thread_patients")
      .select("id, thread_id, patient_id")
      .eq("patient_id", patientId)
      .order("linked_at", { ascending: false });

    if (linksErr) return NextResponse.json({ error: linksErr.message }, { status: 500 });
    if (!links || links.length === 0) return NextResponse.json([]);

    const threadIds = links.map((l) => l.thread_id);
    const { data: threads, error: tErr } = await supabase
      .from("message_threads")
      .select("id, external_thread_id, channel, external_user_name, last_message_at")
      .in("id", threadIds)
      .is("deleted_at", null);

    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

    const threadMap = new Map((threads ?? []).map((t) => [t.id, t]));
    const result = links
      .map((l) => {
        const t = threadMap.get(l.thread_id);
        if (!t) return null;
        return {
          id: l.id,
          thread_id: l.thread_id,
          patient_id: l.patient_id,
          external_thread_id: t.external_thread_id,
          channel: t.channel,
          external_user_name: t.external_user_name,
          last_message_at: t.last_message_at ?? null,
        };
      })
      .filter((r) => r != null && r.external_thread_id);

    return NextResponse.json(result);
  }

  // ── Forward lookup: patients for a given thread ──────────────────────────

  // Step 1: get link rows (table uses linked_at, not created_at)
  const { data: links, error: linksErr } = await supabase
    .from("thread_patients")
    .select("id, patient_id, linked_at")
    .eq("thread_id", threadId)
    .order("linked_at", { ascending: true });

  if (linksErr) return NextResponse.json({ error: linksErr.message }, { status: 500 });
  if (!links || links.length === 0) return NextResponse.json([]);

  // Step 2: fetch patient records directly (avoids reliance on FK join)
  const patientIds = links.map((l) => l.patient_id);
  const { data: patients, error: pErr } = await supabase
    .from("patients")
    .select("id, full_name, first_name, last_name, phone")
    .in("id", patientIds);

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const patientMap = new Map((patients ?? []).map((p) => [p.id, p]));

  const result = links
    .map((l) => ({ id: l.id, patient_id: l.patient_id, patients: patientMap.get(l.patient_id) ?? null }))
    .filter((r) => r.patients != null);

  return NextResponse.json(result);
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
