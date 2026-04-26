import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function refreshAccessToken(refreshTokenStr: string) {
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
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

/**
 * POST /api/google-calendar/sync/bulk
 * Syncs ALL upcoming appointments (from today onward) to all connected Google Calendars.
 * Used when connecting Google Calendar for the first time to push existing appointments.
 */
export async function POST() {
  try {
    const supabaseAdmin = getAdminClient();

    // Fetch all connections
    const { data: allConnections } = await supabaseAdmin
      .from("google_calendar_connections")
      .select("*");

    if (!allConnections?.length) {
      return NextResponse.json({ ok: true, synced: 0, total: 0 });
    }

    // Refresh tokens upfront
    const connections = await Promise.all(
      allConnections.map(async (conn) => {
        const expiresAt = new Date(conn.token_expiry ?? 0).getTime();
        if (expiresAt <= Date.now() + 5 * 60 * 1000) {
          try {
            const refreshed = await refreshAccessToken(conn.refresh_token);
            const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
            await supabaseAdmin
              .from("google_calendar_connections")
              .update({ access_token: refreshed.access_token, token_expiry: newExpiry })
              .eq("id", conn.id);
            return { ...conn, access_token: refreshed.access_token };
          } catch {
            return conn; // keep original token — will fail gracefully below
          }
        }
        return conn;
      })
    );

    // Fetch upcoming appointments (today and future)
    const today = new Date().toISOString().split("T")[0];
    const { data: appointments } = await supabaseAdmin
      .from("appointments")
      .select("*, patients(full_name), dentists(full_name)")
      .gte("appointment_date", today)
      .order("appointment_date", { ascending: true });

    if (!appointments?.length) {
      return NextResponse.json({ ok: true, synced: 0, total: 0 });
    }

    let synced = 0;

    for (const appt of appointments) {
      // Which connections should receive this appointment?
      const relevant = connections.filter(
        (c) => !c.sync_own_only || c.dentist_id === appt.dentist_id
      );
      if (!relevant.length) continue;

      const patientName = (appt.patients as { full_name?: string } | null)?.full_name ?? "Patient";
      const dentistName = (appt.dentists as { full_name?: string } | null)?.full_name;
      const summary = appt.concern_type
        ? `${patientName} — ${appt.concern_type}`
        : `Dental Appointment: ${patientName}`;

      const [h, m] = (appt.appointment_time as string).split(":").map(Number);
      const endHour = Math.min(h + 1, 23);
      const tzOffset = "+08:00";
      const pad = (n: number) => String(n).padStart(2, "0");
      const startDt = `${appt.appointment_date}T${pad(h)}:${pad(m)}:00${tzOffset}`;
      const endDt = `${appt.appointment_date}T${pad(endHour)}:${pad(m)}:00${tzOffset}`;

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

      let storedEventId: string | null = appt.google_event_id ?? null;
      const calBase = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

      for (const conn of relevant) {
        try {
          const headers = {
            Authorization: `Bearer ${conn.access_token}`,
            "Content-Type": "application/json",
          };

          if (storedEventId) {
            // Try to update existing event
            const updateRes = await fetch(`${calBase}/${storedEventId}`, {
              method: "PUT",
              headers,
              body: JSON.stringify(eventBody),
            });
            if (updateRes.status === 404 || updateRes.status === 410) {
              storedEventId = null; // fall through to create
            } else if (!updateRes.ok) {
              continue;
            }
          }

          if (!storedEventId) {
            const createRes = await fetch(calBase, {
              method: "POST",
              headers,
              body: JSON.stringify(eventBody),
            });
            if (createRes.ok) {
              const created: { id: string } = await createRes.json();
              storedEventId = created.id;
              await supabaseAdmin
                .from("appointments")
                .update({ google_event_id: storedEventId })
                .eq("id", appt.id);
            }
          }

          synced++;
        } catch {
          // silent — don't block other appointments
        }
      }
    }

    return NextResponse.json({ ok: true, synced, total: appointments.length });
  } catch (err) {
    console.error("[gc/sync/bulk] Unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
