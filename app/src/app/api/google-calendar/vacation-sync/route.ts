import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

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
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

const VACATION_KEYWORDS = [
  "flight", "vacation", "leave", "day off", "off", "holiday",
  "ooo", "out of office", "travel", "trip", "rest day", "birthday",
  "personal", "sick", "absent", "unavailable",
];

/**
 * POST /api/google-calendar/vacation-sync
 * Body: { user_id: string, dentist_id: string }
 *
 * Fetches upcoming all-day / vacation events from the user's Google Calendar
 * and inserts them as dentist_blockouts. Skips dates already blocked out.
 * Returns { imported: number, skipped: number }.
 */
export async function POST(request: NextRequest) {
  try {
    const { user_id, dentist_id } = await request.json();
    if (!user_id || !dentist_id) {
      return NextResponse.json({ error: "Missing user_id or dentist_id" }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();

    // Load GC connection
    const { data: conn } = await supabaseAdmin
      .from("google_calendar_connections")
      .select("access_token, refresh_token, token_expiry")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!conn) {
      return NextResponse.json({ error: "No Google Calendar connection found" }, { status: 404 });
    }

    let accessToken: string = conn.access_token;

    // Refresh if token is expiring
    const expiresAt = new Date(conn.token_expiry ?? 0).getTime();
    if (expiresAt <= Date.now() + 5 * 60 * 1000) {
      const refreshed = await refreshAccessToken(conn.refresh_token);
      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await supabaseAdmin
        .from("google_calendar_connections")
        .update({ access_token: accessToken, token_expiry: newExpiry })
        .eq("user_id", user_id);
    }

    // Fetch 6 months of events
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "250");

    const calRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!calRes.ok) {
      const errText = await calRes.text();
      console.error("[vacation-sync] Calendar fetch failed:", calRes.status, errText);
      if (calRes.status === 401 || calRes.status === 403) {
        return NextResponse.json(
          { error: "calendar_permission_denied", message: "Calendar access not granted. Please reconnect Google Calendar and make sure to check the 'View and edit events' permission." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: "calendar_fetch_failed" }, { status: 502 });
    }

    const calData: {
      items?: {
        id: string;
        summary?: string;
        start?: { date?: string; dateTime?: string };
        end?: { date?: string; dateTime?: string };
      }[];
    } = await calRes.json();

    let imported = 0;
    let skipped = 0;

    for (const item of calData.items ?? []) {
      if (!item.id || !item.start) continue;

      const isAllDay = !!item.start.date && !item.start.dateTime;
      const startDate = item.start.date ?? item.start.dateTime?.substring(0, 10);
      let endDateRaw = item.end?.date ?? item.end?.dateTime?.substring(0, 10);
      let endDate = endDateRaw;

      // Google all-day end dates are exclusive (next day) — subtract 1 day
      if (isAllDay && endDateRaw) {
        const d = new Date(endDateRaw + "T00:00:00");
        d.setDate(d.getDate() - 1);
        endDate = d.toISOString().split("T")[0];
      }

      if (!startDate || !endDate) continue;

      const title = item.summary ?? "Untitled event";
      const titleLower = title.toLowerCase();
      const isMultiDay = startDate !== endDate;
      const hasKeyword = VACATION_KEYWORDS.some((kw) => titleLower.includes(kw));

      if (!isAllDay && !isMultiDay && !hasKeyword) continue;

      // Skip if blockout already exists for this dentist + date range
      const { data: existing } = await supabaseAdmin
        .from("dentist_blockouts")
        .select("id")
        .eq("dentist_id", dentist_id)
        .eq("start_date", startDate)
        .eq("end_date", endDate)
        .maybeSingle();

      if (existing) { skipped++; continue; }

      const { error } = await supabaseAdmin.from("dentist_blockouts").insert({
        dentist_id,
        start_date: startDate,
        end_date: endDate,
        reason: title,
      });

      if (!error) imported++;
    }

    return NextResponse.json({ imported, skipped });
  } catch (err) {
    console.error("[vacation-sync] Unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
