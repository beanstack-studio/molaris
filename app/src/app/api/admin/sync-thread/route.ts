import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const FB = "https://graph.facebook.com/v18.0";

/**
 * POST /api/admin/sync-thread?thread_id=xxx
 *
 * Syncs messages for a single thread. Looks up the FB conversation by PSID,
 * then fetches all messages newer than what's already stored (stop-early pagination).
 */
export async function POST(request: NextRequest) {
  const supabase  = getAdminClient();
  const threadId  = request.nextUrl.searchParams.get("thread_id");

  if (!threadId) {
    return NextResponse.json({ error: "thread_id is required" }, { status: 400 });
  }

  const { data: pageRow } = await supabase
    .from("facebook_pages")
    .select("page_id, page_access_token")
    .maybeSingle();

  if (!pageRow) {
    return NextResponse.json({ error: "No Facebook page connected" }, { status: 400 });
  }

  const pageId    = (pageRow as any).page_id as string;
  const pageToken = (pageRow as any).page_access_token as string;

  // Load thread from DB
  const { data: thread, error: threadErr } = await supabase
    .from("message_threads")
    .select("id, external_thread_id, last_message_at")
    .eq("id", threadId)
    .eq("channel", "messenger")
    .maybeSingle();

  if (threadErr || !thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const psid = (thread as any).external_thread_id as string;
  const lastMessageAt = (thread as any).last_message_at as string | null;

  // Find FB conversation ID for this PSID
  const convRes = await fetch(
    `${FB}/${pageId}/conversations?user_id=${psid}&fields=id&limit=1&access_token=${pageToken}`
  );
  if (!convRes.ok) {
    const txt = await convRes.text();
    return NextResponse.json({ error: `FB API error: ${txt.slice(0, 200)}` }, { status: 502 });
  }
  const convData = await convRes.json() as { data: { id: string }[] };
  const convId = convData.data?.[0]?.id;

  if (!convId) {
    return NextResponse.json({ error: "No FB conversation found for this thread" }, { status: 404 });
  }

  // Sync messages (stop-early when hitting already-stored messages)
  const sinceTimestamp = lastMessageAt
    ? Math.floor(new Date(lastMessageAt).getTime() / 1000)
    : 0;

  const newMessages: Array<{ id: string; message?: string; from?: { id: string; name?: string }; created_time: string }> = [];

  let msgUrl = `${FB}/${convId}/messages?fields=id,message,from,created_time&limit=100&access_token=${pageToken}`;
  while (msgUrl) {
    const res = await fetch(msgUrl);
    if (!res.ok) break;
    const data = await res.json() as { data: typeof newMessages; paging?: { next?: string } };
    const page = data.data ?? [];

    let reachedOld = false;
    for (const msg of page) {
      const msgTs = Math.floor(new Date(msg.created_time).getTime() / 1000);
      if (sinceTimestamp > 0 && msgTs <= sinceTimestamp) { reachedOld = true; break; }
      newMessages.push(msg);
    }
    if (reachedOld) break;
    msgUrl = data.paging?.next ?? "";
  }

  if (newMessages.length === 0) {
    return NextResponse.json({ ok: true, messages: 0 });
  }

  // Oldest first
  newMessages.reverse();

  let count = 0;
  for (const msg of newMessages) {
    if (!msg.message) continue;
    const { error } = await supabase.from("messages").upsert(
      {
        thread_id: threadId,
        sender_type: msg.from?.id === pageId ? "staff" : "patient",
        sender_id: null,
        sender_name: msg.from?.name ?? null,
        content: msg.message,
        message_type: "text",
        external_id: msg.id,
        created_at: msg.created_time,
        metadata: { channel: "messenger", fb_mid: msg.id },
      },
      { onConflict: "external_id", ignoreDuplicates: true }
    );
    if (!error) count++;
  }

  // Update last_message_at
  const newestMsg = newMessages[newMessages.length - 1];
  await supabase
    .from("message_threads")
    .update({ last_message_at: newestMsg.created_time })
    .eq("id", threadId);

  return NextResponse.json({ ok: true, messages: count });
}
