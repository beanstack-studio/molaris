import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/webhooks/bulksms/send
 * Send SMS via Bulksms API
 * 
 * Expected payload:
 * {
 *   "phone": "+639XXXXXXXXX",
 *   "message": "Your appointment is confirmed"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { phone, message } = await request.json();

    if (!phone || !message) {
      return NextResponse.json(
        { error: "Missing phone or message" },
        { status: 400 }
      );
    }

    // Get Bulksms credentials from environment
    const bulksmsUsername = process.env.BULKSMS_USERNAME;
    const bulksmsPassword = process.env.BULKSMS_PASSWORD;

    if (!bulksmsUsername || !bulksmsPassword) {
      console.error("Bulksms credentials not configured");
      return NextResponse.json(
        { error: "SMS service not configured" },
        { status: 500 }
      );
    }

    // Send SMS via Bulksms API
    const response = await fetch("https://api.bulksms.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(
          `${bulksmsUsername}:${bulksmsPassword}`
        ).toString("base64")}`,
      },
      body: JSON.stringify({
        to: phone,
        body: message,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Bulksms API error:", response.status, errorData);
      return NextResponse.json(
        { error: "Failed to send SMS", details: errorData },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json(
      { success: true, messageId: result.id },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error sending SMS:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
