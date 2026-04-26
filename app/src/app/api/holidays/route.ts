import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/holidays?year=2026
 * Returns PH public holidays as { dates: string[], names: Record<string, string> }
 *
 * Source: Google Calendar API — PH official holiday calendar
 *   Calendar ID: en.philippines.official#holiday@group.v.calendar.google.com
 *   Requires GOOGLE_CALENDAR_API_KEY in env vars.
 *
 * Falls open (empty array) so booking still works if the API is unreachable.
 * Results are cached in-memory per year for the process lifetime.
 */

interface HolidayPayload {
  dates: string[];
  names: Record<string, string>;
}

const CALENDAR_ID = "en.philippines.official#holiday@group.v.calendar.google.com";
const cache: Record<number, HolidayPayload> = {};

export async function GET(req: NextRequest) {
  const yearParam = req.nextUrl.searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  if (cache[year]) {
    return NextResponse.json(cache[year]);
  }

  const apiKey = process.env.GOOGLE_CALENDAR_API_KEY;
  if (!apiKey) {
    // Fallback: fetch from date.nager.at (public, no key required)
    try {
      const nagerRes = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/PH`, {
        next: { revalidate: 86400 },
      });
      if (nagerRes.ok) {
        const items: { date: string; localName: string; name: string }[] = await nagerRes.json();
        const payload: HolidayPayload = { dates: [], names: {} };
        for (const item of items) {
          payload.dates.push(item.date);
          payload.names[item.date] = item.localName || item.name;
        }
        cache[year] = payload;
        return NextResponse.json(payload);
      }
    } catch { /* fall through to empty */ }
    console.warn("[holidays] GOOGLE_CALENDAR_API_KEY not set and nager.at fallback failed");
    return NextResponse.json({ dates: [], names: {} });
  }

  try {
    const encodedId = encodeURIComponent(CALENDAR_ID);
    const timeMin  = `${year}-01-01T00:00:00Z`;
    const timeMax  = `${year + 1}-01-01T00:00:00Z`;
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodedId}/events`
      + `?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}`
      + `&singleEvents=true&orderBy=startTime&maxResults=100`;

    const res = await fetch(url, { next: { revalidate: 86400 } });

    if (!res.ok) {
      console.error("[holidays] Google Calendar API error", res.status, await res.text());
      return NextResponse.json({ dates: [], names: {} });
    }

    const data: { items?: { summary?: string; start?: { date?: string } }[] } = await res.json();
    const items = data.items ?? [];

    const payload: HolidayPayload = {
      dates: [],
      names: {},
    };

    for (const item of items) {
      const date = item.start?.date;
      const name = item.summary ?? "Holiday";
      if (date) {
        payload.dates.push(date);
        payload.names[date] = name;
      }
    }

    cache[year] = payload;
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[holidays] Fetch error", err);
    return NextResponse.json({ dates: [], names: {} });
  }
}
