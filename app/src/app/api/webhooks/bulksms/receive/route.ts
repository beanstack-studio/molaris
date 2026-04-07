import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

/**
 * POST /api/webhooks/bulksms/receive
 * Webhook to receive incoming SMS messages from Bulksms
 * 
 * Expected payload from Bulksms:
 * {
 *   "msisdn": "+639XXXXXXXXX",
 *   "message": "Hello, I want to book an appointment",
 *   "api_token": "your_token",
 *   "id": "bulksms_message_id"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { msisdn, message, id: externalMessageId } = body;

    if (!msisdn || !message) {
      return NextResponse.json(
        { error: "Missing msisdn or message" },
        { status: 400 }
      );
    }

    // Find patient by phone number
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, full_name")
      .eq("phone", msisdn)
      .single();

    if (patientError || !patient) {
      return NextResponse.json(
        { error: "Patient not found", msisdn },
        { status: 404 }
      );
    }

    // Get or create message thread
    const { data: existingThread } = await supabase
      .from("message_threads")
      .select("id")
      .eq("patient_id", patient.id)
      .eq("channel", "sms")
      .is("deleted_at", null)
      .single();

    let threadId = existingThread?.id;

    if (!threadId) {
      const { data: newThread, error: threadError } = await supabase
        .from("message_threads")
        .insert({
          patient_id: patient.id,
          channel: "sms",
          external_thread_id: msisdn,
        })
        .select()
        .single();

      if (threadError) throw threadError;
      threadId = newThread.id;
    }

    // Store incoming message
    const { error: messageError } = await supabase
      .from("messages")
      .insert({
        thread_id: threadId,
        sender_type: "patient",
        sender_id: patient.id,
        sender_name: patient.full_name,
        content: message,
        message_type: "text",
        external_id: externalMessageId,
        metadata: {
          channel: "sms",
          from: msisdn,
        },
      });

    if (messageError) throw messageError;

    return NextResponse.json(
      { success: true, threadId, patientId: patient.id },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error handling Bulksms webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
