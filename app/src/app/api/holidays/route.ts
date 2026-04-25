import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/holidays?year=2026
 * Returns PH public holidays as { dates: string[], names: Record<string, string> }
 * sourced from date.nager.at — cached in memory per-year per process lifetime.
 * Fails open (empty) so appointment booking still works if the API is unreachable.
 */

interface HolidayPayload {
  dates: string[];
  names: Record<string, string>;
}

const cache: Record<number, HolidayPayload> = {};

export async function GET(req: NextRequest) {
  const yearParam = req.nextUrl.searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  if (cache[year]) {
    return NextResponse.json(cache[year]);
  }

  try {
    const res = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/PH`,
      { next: { revalidate: 86400 } }
    );

    if (!res.ok) {
      return NextResponse.json({ dates: [], names: {} }, { status: 200 });
    }

    const data: { date: string; name: string; localName: string }[] = await res.json();
    const payload: HolidayPayload = {
      dates: data.map((h) => h.date),
      names: Object.fromEntries(data.map((h) => [h.date, h.localName || h.name])),
    };
    cache[year] = payload;
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ dates: [], names: {} }, { status: 200 });
  }
}
