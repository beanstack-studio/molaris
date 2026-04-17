import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

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
 *
 * Incremental sync — only fetches messages newer than what's already in the DB.
 * First call (or ?full=true) processes conversations active in the last 365 days.
 * Subsequent calls only grab messages newer than the thread's latest stored message.
 *
 * Safe to run repeatedly — deduplicates by external_id.
 */
export async function POST(request: NextRequest) {
  const supabase = getAdminClient();
  const full        = request.nextUrl.searchParams.get("full") === "true";
  const threadsOnly = request.nextUrl.searchParams.get("threads_only") === "true";

  const { data: pageRow } = await supabase
    .from("facebook_pages")
    .select("page_id, page_access_token")
    .maybeSingle();

  if (!pageRow) {
    return NextResponse.json({ error: "No Facebook page connected" }, { status: 400 });
  }

  const pageId    = (pageRow as any).page_id    as string;
  const pageToken = (pageRow as any).page_access_token as string;
  const errors: string[] = [];

  // ── Step 1: Collect conversation list ────────────────────────────────
  // threads_only / full: no time limit — get everything
  // default incremental: last 365 days
  const sinceTs = (full || threadsOnly)
    ? 0
    : Math.floor(Date.now() / 1000) - 365 * 24 * 3600;

  const allConvs: ConvItem[] = [];
  const convsSeen = new Set<string>();

  async function fetchConvFolder(folder: string) {
    const sinceParam = sinceTs > 0 ? `&since=${sinceTs}` : "";
    let url = `${FB}/${pageId}/conversations?platform=messenger&folder=${folder}&fields=id,participants,updated_time&limit=100${sinceParam}&access_token=${pageToken}`;
    while (url) {
      const res: Response = await fetch(url);
      if (!res.ok) {
        const txt = await res.text();
        // Some folders may not exist — skip gracefully
        if (!txt.includes("Invalid parameter")) {
          errors.push(`folder=${folder}: ${txt.slice(0, 200)}`);
        }
        break;
      }
      const data = await res.json() as { data: ConvItem[]; paging?: { next?: string } };
      for (const conv of (data.data ?? [])) {
        if (!convsSeen.has(conv.id)) {
          convsSeen.add(conv.id);
          allConvs.push(conv);
        }
      }
      url = data.paging?.next ?? "";
    }
  }

  await fetchConvFolder("inbox");
  await fetchConvFolder("other");
  await fetchConvFolder("other_inbox");
  await fetchConvFolder("spam");

  console.log(`[sync] ${allConvs.length} conversations to process (since=${new Date(sinceTs * 1000).toISOString()})`);

  // ── Step 2: threads_only — fast bulk upsert, no messages, no profile pics ──
  if (threadsOnly) {
    const rows = allConvs.flatMap((conv) => {
      const user = (conv.participants?.data ?? []).find((p) => p.id !== pageId);
      if (!user) return [];
      return [{ channel: "messenger", external_thread_id: user.id, external_user_name: user.name ?? null }];
    });

    // Bulk upsert in chunks of 100
    const CHUNK = 100;
    let upserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await supabase
        .from("message_threads")
        .upsert(rows.slice(i, i + CHUNK), { onConflict: "channel,external_thread_id", ignoreDuplicates: true });
      if (!error) upserted += rows.slice(i, i + CHUNK).length;
    }
    return NextResponse.json({ ok: true, conversations_found: allConvs.length, threads: upserted, messages: 0 });
  }

  // ── Step 3: Load existing threads so we know what's already synced ───
  const { data: existingThreads } = await supabase
    .from("message_threads")
    .select("id, external_thread_id, last_message_at")
    .eq("channel", "messenger");

  const threadByPsid = new Map<string, { id: string; last_message_at: string | null }>();
  for (const t of (existingThreads ?? [])) {
    threadByPsid.set(t.external_thread_id, { id: t.id, last_message_at: t.last_message_at });
  }

  // ── Step 4: Process in batches of 5 ─────────────────────────────────
  const BATCH = 5;
  let totalThreads = 0;
  let totalMessages = 0;

  for (let i = 0; i < allConvs.length; i += BATCH) {
    const batch = allConvs.slice(i, i + BATCH);
    const batchResults = await Promise.allSettled(
      batch.map(async (conv) => {
        const participants: Participant[] = conv.participants?.data ?? [];
        const user = participants.find((p) => p.id !== pageId);
        if (!user) return { threads: 0, messages: 0 };

        // Upsert thread
        const profilePicUrl = await fetchProfilePic(user.id, pageToken);
        const threadId = await upsertThread(supabase, user.id, user.name ?? null, profilePicUrl);
        if (!threadId) {
          errors.push(`Could not upsert thread for PSID ${user.id}`);
          return { threads: 0, messages: 0 };
        }

        // Only fetch messages newer than what we already have
        const existing = threadByPsid.get(user.id);
        const since = existing?.last_message_at
          ? Math.floor(new Date(existing.last_message_at).getTime() / 1000)
          : 0;

        const msgCount = await syncMessages(supabase, conv.id, pageId, pageToken, threadId, since);
        return { threads: 1, messages: msgCount };
      })
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled") {
        totalThreads  += r.value.threads;
        totalMessages += r.value.messages;
      } else {
        errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
      }
    }
  }

  return NextResponse.json({
    ok: true,
    conversations_found: allConvs.length,
    threads: totalThreads,
    messages: totalMessages,
    ...(errors.length ? { errors } : {}),
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Participant = { id: string; name?: string };
type ConvItem    = { id: string; participants?: { data: Participant[] }; updated_time?: string };
type FbMessage   = { id: string; message?: string; from?: { id: string; name?: string }; created_time: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchProfilePic(psid: string, pageToken: string): Promise<string | null> {
  try {
    const res: Response = await fetch(`${FB}/${psid}?fields=profile_pic&access_token=${pageToken}`);
    if (!res.ok) return null;
    const data = await res.json() as { profile_pic?: string };
    return data.profile_pic ?? null;
  } catch {
    return null;
  }
}

async function upsertThread(
  supabase: ReturnType<typeof getAdminClient>,
  psid: string,
  name: string | null,
  profilePicUrl: string | null
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("message_threads")
    .select("id, metadata")
    .eq("channel", "messenger")
    .eq("external_thread_id", psid)
    .maybeSingle();

  if (existing) {
    const row = existing as { id: string; metadata: Record<string, unknown> | null };
    await supabase
      .from("message_threads")
      .update({
        ...(name ? { external_user_name: name } : {}),
        metadata: { ...(row.metadata ?? {}), ...(profilePicUrl ? { profile_pic_url: profilePicUrl } : {}) },
      })
      .eq("id", row.id);
    return row.id;
  }

  const { data: inserted, error } = await supabase
    .from("message_threads")
    .insert({
      channel: "messenger",
      external_thread_id: psid,
      external_user_name: name,
      metadata: profilePicUrl ? { profile_pic_url: profilePicUrl } : {},
    })
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
  threadId: string,
  sinceTimestamp: number // unix seconds — stop when we see messages older than this
): Promise<number> {
  // FB returns messages newest-first. We paginate until we hit messages older
  // than sinceTimestamp (or run out of pages). This correctly handles the case
  // where FB's `since` param behaves as a pagination cursor rather than a filter.
  const newMessages: FbMessage[] = [];

  let msgUrl = `${FB}/${convId}/messages?fields=id,message,from,created_time&limit=100&access_token=${pageToken}`;

  while (msgUrl) {
    const res: Response = await fetch(msgUrl);
    if (!res.ok) break;
    const data = await res.json() as { data: FbMessage[]; paging?: { next?: string } };
    const page = data.data ?? [];

    let reachedOld = false;
    for (const msg of page) {
      const msgTs = Math.floor(new Date(msg.created_time).getTime() / 1000);
      if (sinceTimestamp > 0 && msgTs <= sinceTimestamp) {
        reachedOld = true;
        break;
      }
      newMessages.push(msg);
    }

    if (reachedOld) break;
    msgUrl = data.paging?.next ?? "";
  }

  if (newMessages.length === 0) return 0;

  // Oldest first for correct ordering
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

  // Update last_message_at to the newest message we just synced
  const newestMsg = newMessages[newMessages.length - 1];
  await supabase
    .from("message_threads")
    .update({ last_message_at: newestMsg.created_time })
    .eq("id", threadId);

  return count;
}
