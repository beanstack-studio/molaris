import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function refreshToken(
  refreshTokenStr: string
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshTokenStr,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  return res.json();
}

/**
 * POST /api/google-calendar/sync
 * Body: { appointment_id: string, action: "upsert" | "delete" }
 *
 * Syncs a single appointment to all relevant dentists' Google Calendars.
 * - If action="upsert": creates or updates the Google Calendar event.
 * - If action="delete": deletes the event from Google Calendar (soft-delete support).
 *
 * Connections with sync_own_only=true only sync appointments whose dentist_id
 * matches that connection's dentist_id.
 *
 * Falls through silently on any per-connection error so one bad token
 * doesn't block the whole sync.
 */
export async function POST(request: NextRequest) {
  try {
    const { appointment_id, action = "upsert" } = await request.json();
    if (!appointment_id) {
      return NextResponse.json({ error: "Missing appointment_id" }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();

    // Fetch appointment with patient + dentist details
    const { data: appt, error: apptError } = await supabaseAdmin
      .from("appointments")
      .select("*, patients(full_name), dentists(full_name)")
      .eq("id", appointment_id)
      .single();

    if (apptError || !appt) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Fetch all connections
    const { data: allConnections } = await supabaseAdmin
      .from("google_calendar_connections")
      .select("*");

    if (!allConnections?.length) {
      return NextResponse.json({ ok: true, synced: 0 });
    }

    // Filter: include if sync_own_only=false, or dentist_id matches appointment's dentist
    const connections = allConnections.filter(
      (c) => !c.sync_own_only || c.dentist_id === appt.dentist_id
    );

    if (!connections.length) {
      return NextResponse.json({ ok: true, synced: 0 });
    }

    // Build event payload
    const patientName = (appt.patients as { full_name?: string } | null)?.full_name ?? "Patient";
    const dentistName = (appt.dentists as { full_name?: string } | null)?.full_name;
    const summary = appt.concern_type
      ? `${patientName} — ${appt.concern_type}`
      : `Dental Appointment: ${patientName}`;

    const [h, m] = appt.appointment_time.split(":").map(Number);
    const endHour = h + 1;
    const tzOffset = "+08:00";
    const startDt = `${appt.appointment_date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00${tzOffset}`;
    const endDt = `${appt.appointment_date}T${String(endHour).padStart(2, "0")}:${String(m).padStart(2, "0")}:00${tzOffset}`;

    const descLines = [
      `Patient: ${patientName}`,
      dentistName ? `Dentist: ${dentistName}` : null,
      appt.concern_type ? `Reason: ${appt.concern_type}` : null,
      `Status: ${appt.status}`,
      "",
      "Managed via Matira Dental Studio",
    ].filter(Boolean);

    const eventBody = {
      summary,
      description: descLines.join("\n"),
      start: { dateTime: startDt, timeZone: "Asia/Manila" },
      end: { dateTime: endDt, timeZone: "Asia/Manila" },
    };

    let synced = 0;
    let storedEventId: string | null = appt.google_event_id ?? null;

    for (const conn of connections) {
      try {
        let accessToken: string = conn.access_token;

        // Refresh if token expires within 5 minutes
        const expiresAt = new Date(conn.token_expiry).getTime();
        if (expiresAt <= Date.now() + 5 * 60 * 1000) {
          const refreshed = await refreshToken(conn.refresh_token);
          accessToken = refreshed.access_token;
          const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
          await supabaseAdmin
            .from("google_calendar_connections")
            .update({ access_token: accessToken, token_expiry: newExpiry })
            .eq("id", conn.id);
        }

        const calBase = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
        const headers = {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        };

        if (action === "delete" && storedEventId) {
          await fetch(`${calBase}/${storedEventId}`, { method: "DELETE", headers });
        } else if (action !== "delete" && storedEventId) {
          // Update existing event
          const updateRes = await fetch(`${calBase}/${storedEventId}`, {
            method: "PUT",
            headers,
            body: JSON.stringify(eventBody),
          });
          if (!updateRes.ok) {
            const errText = await updateRes.text();
            // If event was deleted on Google's side, clear the stored id and recreate
            if (updateRes.status === 404 || updateRes.status === 410) {
              storedEventId = null;
              // fall through to create below
            } else {
              console.error(`[gc/sync] Event update failed (${updateRes.status}):`, errText);
              continue;
            }
          }
        }

        if (action !== "delete" && !storedEventId) {
          // Create new event
          const createRes = await fetch(calBase, {
            method: "POST",
            headers,
            body: JSON.stringify(eventBody),
          });
          if (createRes.ok) {
            const created: { id: string } = await createRes.json();
            storedEventId = created.id;
            // Persist the event id on the appointment row
            await supabaseAdmin
              .from("appointments")
              .update({ google_event_id: storedEventId })
              .eq("id", appointment_id);
          } else {
            console.error(`[gc/sync] Event create failed (${createRes.status}):`, await createRes.text());
            continue;
          }
        }

        synced++;
      } catch (err) {
        console.error(`[gc/sync] Error for connection ${conn.id}:`, err);
      }
    }

    // If deleted, clear the event id from the appointment row
    if (action === "delete" && storedEventId) {
      await supabaseAdmin
        .from("appointments")
        .update({ google_event_id: null })
        .eq("id", appointment_id);
    }

    return NextResponse.json({ ok: true, synced });
  } catch (err) {
    console.error("[gc/sync] Unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
