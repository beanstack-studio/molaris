import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

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

    // Use admin client so RLS doesn't block the page token read
    const supabase = getAdminClient();

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
            type: attachment.type,
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

    const graphBody = await graphRes.json().catch(() => ({}));

    if (!graphRes.ok) {
      const fbError = (graphBody as any)?.error;
      const detail  = fbError?.message ?? JSON.stringify(graphBody);
      console.error("Facebook Graph API error:", graphRes.status, detail);

      // Surface a human-readable reason
      let reason = "Messenger send failed.";
      if (fbError?.code === 10 || fbError?.code === 200) {
        reason = "App permission denied — the Facebook App may not have 'pages_messaging' permission.";
      } else if (fbError?.code === 100 && String(fbError?.error_subcode) === "2018109") {
        reason = "This user hasn't messaged the page yet, or the 24-hour messaging window has closed.";
      } else if (fbError?.code === 190) {
        reason = "Page access token is expired. Reconnect Facebook Messenger in Settings.";
      } else if (detail) {
        reason = detail;
      }

      return NextResponse.json({ error: reason }, { status: graphRes.status });
    }

    return NextResponse.json({ success: true, messageId: (graphBody as any).message_id });
  } catch (err) {
    console.error("Error sending Messenger message:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
