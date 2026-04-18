import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

/**
 * POST /api/webhooks/messenger/send
 * Send a Messenger text or attachment message via Facebook Graph API.
 *
 * Body for text:       { recipient_id, message: string }
 * Body for attachment: { recipient_id, attachment: { type: "image"|"audio"|"video"|"file", url: string } }
 */
export async function POST(request: NextRequest) {
  try {
    const { recipient_id, message, attachment } = await request.json();

    if (!recipient_id || (!message && !attachment)) {
      return NextResponse.json(
        { error: "Missing recipient_id and message/attachment" },
        { status: 400 }
      );
    }

    const { data: page } = await supabase
      .from("facebook_pages")
      .select("page_access_token")
      .maybeSingle();

    const pageToken = (page as any)?.page_access_token as string | null;

    if (!pageToken) {
      return NextResponse.json(
        { error: "Facebook page not connected. Go to Settings → Website Controls to connect." },
        { status: 503 }
      );
    }

    // Build the FB message payload
    const fbMessage = attachment
      ? {
          attachment: {
            type: attachment.type,           // "image" | "audio" | "video" | "file"
            payload: { url: attachment.url, is_reusable: true },
          },
        }
      : { text: message };

    const graphRes = await fetch("https://graph.facebook.com/v18.0/me/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient:    { id: recipient_id },
        message:      fbMessage,
        access_token: pageToken,
      }),
    });

    if (!graphRes.ok) {
      const errorText = await graphRes.text();
      console.error("Facebook Graph API error:", graphRes.status, errorText);
      return NextResponse.json(
        { error: "Failed to send Messenger message", details: errorText },
        { status: graphRes.status }
      );
    }

    const result = await graphRes.json();
    return NextResponse.json({ success: true, messageId: result.message_id });
  } catch (err) {
    console.error("Error sending Messenger message:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
