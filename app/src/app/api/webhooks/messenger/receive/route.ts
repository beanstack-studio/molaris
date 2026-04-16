import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
const supabase = getAdminClient();

/**
 * GET /api/webhooks/messenger/receive
 * Webhook verification endpoint — Facebook calls this once to confirm ownership.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.MESSENGER_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Webhook verification failed" }, { status: 403 });
}

/**
 * POST /api/webhooks/messenger/receive
 * Facebook posts incoming messages here in real time.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.object !== "page") {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Return 200 immediately; process async so Facebook doesn't retry
    processEntries(body.entry).catch((err) =>
      console.error("Messenger processing error:", err)
    );

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("Messenger webhook error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function processEntries(entries: any[]) {
  // Get page token once (for fetching sender names on new threads)
  const { data: pageRow } = await supabase
    .from("facebook_pages")
    .select("page_access_token")
    .maybeSingle();
  const pageToken: string | null = (pageRow as any)?.page_access_token ?? null;

  for (const entry of entries) {
    for (const messaging of (entry.messaging ?? [])) {
      if (!messaging.message || messaging.message.is_echo) continue;

      await handleIncomingMessage(
        pageToken,
        messaging.sender.id,
        messaging.recipient.id,
        messaging.message.text ?? "",
        messaging.message.mid
      );
    }
  }
}

async function handleIncomingMessage(
  pageToken: string | null,
  senderId: string,
  pageId: string,
  messageText: string,
  externalMessageId: string
) {
  try {
    // ── Find existing thread ─────────────────────────────────────────────
    const { data: existingThread } = await supabase
      .from("message_threads")
      .select("id, patient_id, external_user_name, patients(id, full_name)")
      .eq("channel", "messenger")
      .eq("external_thread_id", senderId)
      .maybeSingle();

    let threadId: string | null = (existingThread as any)?.id ?? null;
    const patientId: string | null = (existingThread as any)?.patient_id ?? null;
    const patientName: string | null = (existingThread as any)?.patients?.full_name ?? null;

    if (!threadId) {
      // ── New sender — look up their name from Graph API ───────────────
      let senderName: string | null = null;
      let profilePicUrl: string | null = null;
      if (pageToken) {
        try {
          const profileRes = await fetch(
            `https://graph.facebook.com/v18.0/${senderId}?fields=first_name,last_name,profile_pic&access_token=${pageToken}`
          );
          if (profileRes.ok) {
            const nd = await profileRes.json();
            senderName =
              nd.first_name && nd.last_name
                ? `${nd.first_name} ${nd.last_name}`
                : nd.first_name || null;
            profilePicUrl = nd.profile_pic ?? null;
          }
        } catch {
          // Non-critical
        }
      }

      const { data: newThread, error: threadErr } = await supabase
        .from("message_threads")
        .insert({
          patient_id: null,
          channel: "messenger",
          external_thread_id: senderId,
          external_user_name: senderName,
          metadata: profilePicUrl ? { profile_pic_url: profilePicUrl } : {},
        })
        .select("id")
        .single();

      if (threadErr || !newThread) {
        console.error("Error creating thread:", threadErr);
        return;
      }
      threadId = (newThread as any).id;
    }

    // ── Store the message ────────────────────────────────────────────────
    const { error: msgErr } = await supabase.from("messages").insert({
      thread_id: threadId,
      sender_type: "patient",
      sender_id: patientId,
      sender_name: patientName ?? (existingThread as any)?.external_user_name ?? null,
      content: messageText,
      message_type: "text",
      external_id: externalMessageId,
      metadata: { channel: "messenger", sender_psid: senderId, page_id: pageId },
    });

    if (msgErr) throw msgErr;

    // ── Bump last_message_at ─────────────────────────────────────────────
    await supabase
      .from("message_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", threadId);
  } catch (err) {
    console.error("Error storing message:", err);
  }
}
