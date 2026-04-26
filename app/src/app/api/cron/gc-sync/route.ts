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
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

const VACATION_KEYWORDS = [
  "flight", "vacation", "leave", "day off", "off", "holiday",
  "ooo", "out of office", "travel", "trip", "rest day",
  "personal", "sick", "absent", "unavailable",
];

/**
 * GET /api/cron/gc-sync
 * Vercel cron job — runs hourly.
 * For each Google Calendar connection that has a dentist_id linked,
 * fetches upcoming vacation events and imports new ones as dentist_blockouts.
 *
 * Protected by Authorization: Bearer {CRON_SECRET}
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabaseAdmin = getAdminClient();

  // Only sync connections that have a dentist linked
  const { data: connections } = await supabaseAdmin
    .from("google_calendar_connections")
    .select("user_id, dentist_id, access_token, refresh_token, token_expiry")
    .not("dentist_id", "is", null);

  if (!connections?.length) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  let totalImported = 0;
  let processed = 0;

  for (const conn of connections) {
    try {
      let accessToken: string = conn.access_token;

      // Refresh if expiring
      const expiresAt = new Date(conn.token_expiry ?? 0).getTime();
      if (expiresAt <= Date.now() + 5 * 60 * 1000) {
        const refreshed = await refreshAccessToken(conn.refresh_token);
        accessToken = refreshed.access_token;
        const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
        await supabaseAdmin
          .from("google_calendar_connections")
          .update({ access_token: accessToken, token_expiry: newExpiry })
          .eq("user_id", conn.user_id);
      }

      // Fetch events
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

      if (!calRes.ok) continue; // skip this connection, try next

      const calData: {
        items?: {
          id: string;
          summary?: string;
          start?: { date?: string; dateTime?: string };
          end?: { date?: string; dateTime?: string };
        }[];
      } = await calRes.json();

      for (const item of calData.items ?? []) {
        if (!item.id || !item.start) continue;

        const isAllDay = !!item.start.date && !item.start.dateTime;
        const startDate = item.start.date ?? item.start.dateTime?.substring(0, 10);
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
        const isMultiDay = startDate !== endDate;
        const hasKeyword = VACATION_KEYWORDS.some((kw) => titleLower.includes(kw));

        if (!isAllDay && !isMultiDay && !hasKeyword) continue;

        // Dedup: skip if blockout already exists
        const { data: existing } = await supabaseAdmin
          .from("dentist_blockouts")
          .select("id")
          .eq("dentist_id", conn.dentist_id)
          .eq("start_date", startDate)
          .eq("end_date", endDate)
          .maybeSingle();

        if (existing) continue;

        const { error } = await supabaseAdmin.from("dentist_blockouts").insert({
          dentist_id: conn.dentist_id,
          start_date: startDate,
          end_date: endDate,
          reason: title,
        });

        if (!error) totalImported++;
      }

      processed++;
    } catch {
      // Skip connection, don't block others
    }
  }

  return NextResponse.json({ ok: true, processed, totalImported });
}
