import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function refreshToken(refreshTokenStr: string) {
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

export interface GcEvent {
  id: string;
  title: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD (inclusive, so single-day = start_date)
  is_all_day: boolean;
}

/**
 * GET /api/google-calendar/vacations?user_id=<uid>
 * Returns upcoming all-day / multi-day events from the dentist's Google Calendar
 * that are candidates for importing as dentist blockouts.
 *
 * Filters for:
 * - All-day events (Google stores these with start.date, not start.dateTime)
 * - Events spanning 2+ days
 * - Events with keywords: flight, vacation, leave, off, holiday, ooo, out of office, travel, trip
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  const supabaseAdmin = getAdminClient();

  // Load connection
  const { data: conn } = await supabaseAdmin
    .from("google_calendar_connections")
    .select("access_token, refresh_token, token_expiry")
    .eq("user_id", userId)
    .maybeSingle();

  if (!conn) {
    return NextResponse.json({ error: "No Google Calendar connection found" }, { status: 404 });
  }

  let accessToken: string = conn.access_token;

  // Refresh if expiring within 5 minutes
  const expiresAt = new Date(conn.token_expiry).getTime();
  if (expiresAt <= Date.now() + 5 * 60 * 1000) {
    try {
      const refreshed = await refreshToken(conn.refresh_token);
      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await supabaseAdmin
        .from("google_calendar_connections")
        .update({ access_token: accessToken, token_expiry: newExpiry })
        .eq("user_id", userId);
    } catch (err) {
      console.error("[gc/vacations] Token refresh failed:", err);
      return NextResponse.json({ error: "Token refresh failed — please reconnect Google Calendar" }, { status: 401 });
    }
  }

  // Fetch events from today to 6 months out
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

  try {
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
      console.error("[gc/vacations] Calendar fetch failed:", calRes.status, await calRes.text());
      return NextResponse.json({ error: "Failed to fetch calendar events" }, { status: 502 });
    }

    const calData: {
      items?: {
        id: string;
        summary?: string;
        start?: { date?: string; dateTime?: string };
        end?: { date?: string; dateTime?: string };
      }[];
    } = await calRes.json();

    const VACATION_KEYWORDS = [
      "flight", "vacation", "leave", "day off", "off", "holiday",
      "ooo", "out of office", "travel", "trip", "rest day", "birthday",
      "personal", "sick", "absent", "unavailable",
    ];

    const events: GcEvent[] = [];

    for (const item of calData.items ?? []) {
      if (!item.id || !item.start) continue;

      const isAllDay = !!item.start.date && !item.start.dateTime;
      const startDate = item.start.date ?? item.start.dateTime?.substring(0, 10);
      // Google Calendar end date for all-day events is exclusive (next day), so subtract 1
      let endDateRaw = item.end?.date ?? item.end?.dateTime?.substring(0, 10);
      let endDate = endDateRaw;
      if (isAllDay && endDateRaw) {
        const d = new Date(endDateRaw + "T00:00:00");
        d.setDate(d.getDate() - 1);
        endDate = d.toISOString().split("T")[0];
      }

      if (!startDate || !endDate) continue;

      const title = item.summary ?? "Untitled event";
      const titleLower = title.toLowerCase();

      // Include if: all-day, multi-day (>1), or keyword match
      const isMultiDay = startDate !== endDate;
      const hasKeyword = VACATION_KEYWORDS.some((kw) => titleLower.includes(kw));

      if (isAllDay || isMultiDay || hasKeyword) {
        events.push({ id: item.id, title, start_date: startDate, end_date: endDate, is_all_day: isAllDay });
      }
    }

    return NextResponse.json({ events });
  } catch (err) {
    console.error("[gc/vacations] Unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
