import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/webhooks/messenger/send
 * Send Messenger message via Facebook Graph API
 * 
 * Expected payload:
 * {
 *   "recipient_id": "PSID",
 *   "message": "Your appointment is confirmed"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { recipient_id, message } = await request.json();

    if (!recipient_id || !message) {
      return NextResponse.json(
        { error: "Missing recipient_id or message" },
        { status: 400 }
      );
    }

    const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

    if (!pageAccessToken) {
      console.error("Facebook Page Access Token not configured");
      return NextResponse.json(
        { error: "Messenger service not configured" },
        { status: 500 }
      );
    }

    // Send message via Facebook Graph API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient: { id: recipient_id },
          message: { text: message },
          access_token: pageAccessToken,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Facebook Graph API error:", response.status, errorData);
      return NextResponse.json(
        { error: "Failed to send Messenger message", details: errorData },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json(
      { success: true, messageId: result.message_id },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error sending Messenger message:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
