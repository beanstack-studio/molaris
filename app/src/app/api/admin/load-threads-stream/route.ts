import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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
 * POST /api/admin/load-threads-stream
 *
 * Streams SSE events as FB conversation threads are loaded in batches.
 * Only upserts thread metadata (name, PSID) — no messages, no profile pics.
 * Fast enough to handle thousands of conversations within the timeout.
 *
 * Client consumes: data: { upserted, total, done }
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

  const pageId    = (pageRow as any).page_id as string;
  const pageToken = (pageRow as any).page_access_token as string;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        // ── Collect all FB conversations across folders ──────────────────
        const folders = ["inbox", "other", "other_inbox", "spam"];
        const allUsers: Array<{ psid: string; name: string | null }> = [];
        const seen = new Set<string>();

        for (const folder of folders) {
          let url = `${FB}/${pageId}/conversations?platform=messenger&folder=${folder}&fields=id,participants&limit=100&access_token=${pageToken}`;
          while (url) {
            const res = await fetch(url);
            if (!res.ok) break;
            const data = await res.json() as {
              data: Array<{ id: string; participants?: { data: Array<{ id: string; name?: string }> } }>;
              paging?: { next?: string };
            };
            for (const conv of (data.data ?? [])) {
              const user = (conv.participants?.data ?? []).find((p) => p.id !== pageId);
              if (user && !seen.has(user.id)) {
                seen.add(user.id);
                allUsers.push({ psid: user.id, name: user.name ?? null });
              }
            }
            url = data.paging?.next ?? "";
          }
        }

        send({ upserted: 0, total: allUsers.length, done: false });

        // ── Bulk upsert in chunks of 50, streaming progress ─────────────
        const CHUNK = 50;
        let upserted = 0;

        for (let i = 0; i < allUsers.length; i += CHUNK) {
          const chunk = allUsers.slice(i, i + CHUNK).map(({ psid, name }) => ({
            channel: "messenger",
            external_thread_id: psid,
            external_user_name: name,
          }));

          await supabase
            .from("message_threads")
            .upsert(chunk, { onConflict: "channel,external_thread_id", ignoreDuplicates: true });

          upserted += chunk.length;
          send({ upserted, total: allUsers.length, done: false });
        }

        send({ upserted, total: allUsers.length, done: true });
      } catch (e) {
        send({ error: e instanceof Error ? e.message : "Unknown error", done: true });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
