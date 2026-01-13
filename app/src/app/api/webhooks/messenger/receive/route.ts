import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

/**
 * GET /api/webhooks/messenger/receive
 * Webhook verification endpoint for Facebook Messenger
 * Facebook will call this to verify the webhook
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    const verifyToken = process.env.MESSENGER_WEBHOOK_VERIFY_TOKEN;

    if (mode === "subscribe" && token === verifyToken) {
      console.log("Webhook verified");
      return new NextResponse(challenge, { status: 200 });
    }

    return NextResponse.json(
      { error: "Webhook verification failed" },
      { status: 403 }
    );
  } catch (error) {
    console.error("Error in webhook verification:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/webhooks/messenger/receive
 * Webhook to receive incoming Messenger messages
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.object !== "page") {
      return NextResponse.json(
        { error: "Not a page event" },
        { status: 400 }
      );
    }

    // Process each entry
    for (const entry of body.entry) {
      for (const messaging of entry.messaging) {
        if (messaging.message && !messaging.message.is_echo) {
          await handleIncomingMessage(
            messaging.sender.id,
            messaging.recipient.id,
            messaging.message.text,
            messaging.message.mid
          );
        }
      }
    }

    // Return 200 immediately to acknowledge receipt
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Error handling Messenger webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleIncomingMessage(
  senderId: string,
  pageId: string,
  messageText: string,
  externalMessageId: string
) {
  try {
    // Find patient by messenger PSID (stored in metadata)
    const { data: threads } = await supabase
      .from("message_threads")
      .select("*, patients(id, full_name)")
      .eq("channel", "messenger")
      .eq("external_thread_id", senderId)
      .single();

    let patient = threads?.patients;
    let threadId = threads?.id;

    if (!threadId) {
      // Try to find patient by name/phone
      // In production, you'd want better matching logic
      console.log(`Creating new thread for Messenger sender: ${senderId}`);

      // For now, log that we received a message from an unknown sender
      // In production, you might create a stub patient or handle this differently
      console.log(`No patient found for Messenger PSID: ${senderId}`);
      return;
    }

    // Store message
    const { error: messageError } = await supabase
      .from("messages")
      .insert({
        thread_id: threadId,
        sender_type: "patient",
        sender_id: patient?.id,
        sender_name: patient?.full_name,
        content: messageText,
        message_type: "text",
        external_id: externalMessageId,
        metadata: {
          channel: "messenger",
          sender_id: senderId,
          page_id: pageId,
        },
      });

    if (messageError) throw messageError;
  } catch (error) {
    console.error("Error processing Messenger message:", error);
  }
}
