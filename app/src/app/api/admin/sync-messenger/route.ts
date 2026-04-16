import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const FB = "https://graph.facebook.com/v18.0";

/**
 * POST /api/admin/sync-messenger
 * Fetches all historical conversations + messages from the connected
 * Facebook Page and upserts them into Supabase.
 * Safe to run multiple times — deduplicates by external_id.
 */
export async function POST() {
  const supabase = getAdminClient();

  const { data: pageRow } = await supabase
    .from("facebook_pages")
    .select("page_id, page_access_token")
    .maybeSingle();

  if (!pageRow) {
    return NextResponse.json({ error: "No Facebook page connected" }, { status: 400 });
  }

  const pageId: string = (pageRow as { page_id: string; page_access_token: string }).page_id;
  const pageToken: string = (pageRow as { page_id: string; page_access_token: string }).page_access_token;

  const errors: string[] = [];

  // ── Collect all conversations across pages first ─────────────────────
  const allConvs: ConvItem[] = [];
  let convUrl = `${FB}/${pageId}/conversations?platform=messenger&fields=id,participants&limit=100&access_token=${pageToken}`;

  while (convUrl) {
    const convRes: Response = await fetch(convUrl);
    if (!convRes.ok) {
      errors.push(`Conversations fetch failed: ${await convRes.text()}`);
      break;
    }
    const convData = await convRes.json() as { data: ConvItem[]; paging?: { next?: string } };
    allConvs.push(...(convData.data ?? []));
    convUrl = convData.paging?.next ?? "";
  }

  // ── Process conversations in parallel batches of 8 ───────────────────
  const BATCH = 8;
  const results: { threads: number; messages: number }[] = [];

  for (let i = 0; i < allConvs.length; i += BATCH) {
    const batch = allConvs.slice(i, i + BATCH);
    const batchResults = await Promise.allSettled(
      batch.map(async (conv) => {
        const participants: Participant[] = conv.participants?.data ?? [];
        const user = participants.find((p) => p.id !== pageId);
        if (!user) return { threads: 0, messages: 0 };

        const threadId = await upsertThread(supabase, user.id, user.name ?? null);
        if (!threadId) {
          errors.push(`Could not upsert thread for PSID ${user.id}`);
          return { threads: 0, messages: 0 };
        }

        const msgCount = await syncMessages(supabase, conv.id, pageId, pageToken, threadId);
        return { threads: 1, messages: msgCount };
      })
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled") {
        results.push(r.value);
      } else {
        errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
      }
    }
  }

  const totalThreads  = results.reduce((s, r) => s + r.threads, 0);
  const totalMessages = results.reduce((s, r) => s + r.messages, 0);

  return NextResponse.json({
    ok: true,
    threads: totalThreads,
    messages: totalMessages,
    ...(errors.length ? { errors } : {}),
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type Participant = { id: string; name?: string };
type ConvItem    = { id: string; participants?: { data: Participant[] } };
type FbMessage   = { id: string; message?: string; from?: { id: string; name?: string }; created_time: string };

async function upsertThread(
  supabase: ReturnType<typeof getAdminClient>,
  psid: string,
  name: string | null
): Promise<string | null> {
  // Try to find existing thread first
  const { data: existing } = await supabase
    .from("message_threads")
    .select("id")
    .eq("channel", "messenger")
    .eq("external_thread_id", psid)
    .maybeSingle();

  if (existing) {
    // Update name if we now have one
    if (name) {
      await supabase
        .from("message_threads")
        .update({ external_user_name: name })
        .eq("id", (existing as { id: string }).id);
    }
    return (existing as { id: string }).id;
  }

  // Insert new thread
  const { data: inserted, error } = await supabase
    .from("message_threads")
    .insert({ channel: "messenger", external_thread_id: psid, external_user_name: name })
    .select("id")
    .single();

  if (error || !inserted) return null;
  return (inserted as { id: string }).id;
}

async function syncMessages(
  supabase: ReturnType<typeof getAdminClient>,
  convId: string,
  pageId: string,
  pageToken: string,
  threadId: string
): Promise<number> {
  // Collect all pages (FB returns newest first)
  const allMessages: FbMessage[] = [];
  let msgUrl = `${FB}/${convId}/messages?fields=id,message,from,created_time&limit=100&access_token=${pageToken}`;

  while (msgUrl) {
    const res: Response = await fetch(msgUrl);
    if (!res.ok) break;
    const data = await res.json() as { data: FbMessage[]; paging?: { next?: string } };
    allMessages.push(...(data.data ?? []));
    msgUrl = data.paging?.next ?? "";
  }

  // Insert oldest first so last_message_at ends up correct after update
  allMessages.reverse();

  let count = 0;
  for (const msg of allMessages) {
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

  // Bump last_message_at on the thread
  if (allMessages.length > 0) {
    await supabase
      .from("message_threads")
      .update({ last_message_at: allMessages[allMessages.length - 1].created_time })
      .eq("id", threadId);
  }

  return count;
}
