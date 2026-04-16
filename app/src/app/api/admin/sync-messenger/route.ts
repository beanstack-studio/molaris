import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const FB_VERSION = "v18.0";

/**
 * POST /api/admin/sync-messenger
 * Fetches all historical conversations + messages from the connected
 * Facebook Page and upserts them into Supabase. Safe to run multiple
 * times — messages are deduplicated by external_id.
 */
export async function POST() {
  const supabase = getAdminClient();

  // ── Get stored page credentials ──────────────────────────────────────
  const { data: pageRow, error: pageErr } = await supabase
    .from("facebook_pages")
    .select("page_id, page_access_token")
    .maybeSingle();

  if (pageErr || !pageRow) {
    return NextResponse.json({ error: "No Facebook page connected" }, { status: 400 });
  }

  const { page_id: pageId, page_access_token: pageToken } = pageRow as {
    page_id: string;
    page_access_token: string;
  };

  let totalThreads = 0;
  let totalMessages = 0;
  const errors: string[] = [];

  try {
    // ── Fetch all conversations (paginated) ───────────────────────────
    let convUrl: string | null =
      `https://graph.facebook.com/${FB_VERSION}/${pageId}/conversations` +
      `?platform=messenger&fields=id,participants&limit=100&access_token=${pageToken}`;

    while (convUrl) {
      const convRes = await fetch(convUrl);
      if (!convRes.ok) {
        errors.push(`Conversations fetch failed: ${await convRes.text()}`);
        break;
      }
      const convData = await convRes.json();
      const conversations: any[] = convData.data ?? [];

      for (const conv of conversations) {
        try {
          // Identify the user's PSID (the participant who is NOT the page)
          const participants: any[] = conv.participants?.data ?? [];
          const userParticipant = participants.find((p: any) => p.id !== pageId);
          if (!userParticipant) continue;

          const userPsid: string = userParticipant.id;
          const userName: string | null = userParticipant.name ?? null;

          // ── Upsert thread ──────────────────────────────────────────
          const { data: threadRow, error: threadErr } = await supabase
            .from("message_threads")
            .upsert(
              {
                channel: "messenger",
                external_thread_id: userPsid,
                external_user_name: userName,
              },
              { onConflict: "channel,external_thread_id", ignoreDuplicates: false }
            )
            .select("id")
            .single();

          if (threadErr || !threadRow) {
            // Try selecting existing thread if upsert conflicts
            const { data: existing } = await supabase
              .from("message_threads")
              .select("id, external_user_name")
              .eq("channel", "messenger")
              .eq("external_thread_id", userPsid)
              .maybeSingle();

            if (!existing) {
              errors.push(`Thread upsert failed for PSID ${userPsid}: ${threadErr?.message}`);
              continue;
            }
            // Update name if we now have it
            if (userName && !existing.external_user_name) {
              await supabase
                .from("message_threads")
                .update({ external_user_name: userName })
                .eq("id", existing.id);
            }
            (threadRow as any) ?? Object.assign({}, existing);
            const threadId = existing.id;
            totalThreads++;
            await syncMessages(supabase, conv.id, pageId, pageToken, threadId);
            const count = await getMessageCount(supabase, threadId);
            totalMessages += count;
            continue;
          }

          totalThreads++;
          const threadId = (threadRow as any).id;
          const msgCount = await syncMessages(supabase, conv.id, pageId, pageToken, threadId);
          totalMessages += msgCount;
        } catch (convErr: any) {
          errors.push(`Error processing conversation ${conv.id}: ${convErr.message}`);
        }
      }

      // Follow pagination cursor
      convUrl = convData.paging?.next ?? null;
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    threads: totalThreads,
    messages: totalMessages,
    errors: errors.length ? errors : undefined,
  });
}

async function syncMessages(
  supabase: ReturnType<typeof getAdminClient>,
  convId: string,
  pageId: string,
  pageToken: string,
  threadId: string
): Promise<number> {
  let count = 0;
  let msgUrl: string | null =
    `https://graph.facebook.com/v18.0/${convId}/messages` +
    `?fields=id,message,from,created_time&limit=100&access_token=${pageToken}`;

  // Collect all pages first (FB returns newest first; we insert oldest first)
  const allMessages: any[] = [];
  while (msgUrl) {
    const res = await fetch(msgUrl);
    if (!res.ok) break;
    const data = await res.json();
    allMessages.push(...(data.data ?? []));
    msgUrl = data.paging?.next ?? null;
  }

  // Insert oldest first so last_message_at ends up correct
  allMessages.reverse();

  for (const msg of allMessages) {
    if (!msg.message) continue; // skip attachment-only messages

    const isStaff = msg.from?.id === pageId;
    const { error } = await supabase.from("messages").upsert(
      {
        thread_id: threadId,
        sender_type: isStaff ? "staff" : "patient",
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

  // Update last_message_at to the last message time
  if (allMessages.length > 0) {
    const lastMsg = allMessages[allMessages.length - 1];
    await supabase
      .from("message_threads")
      .update({ last_message_at: lastMsg.created_time })
      .eq("id", threadId);
  }

  return count;
}

async function getMessageCount(
  supabase: ReturnType<typeof getAdminClient>,
  threadId: string
): Promise<number> {
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", threadId);
  return count ?? 0;
}
