import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/holidays?year=2026
 * Returns an array of PH public holiday date strings ("YYYY-MM-DD")
 * sourced from date.nager.at — cached in memory per-year per process lifetime.
 */

const cache: Record<number, string[]> = {};

export async function GET(req: NextRequest) {
  const yearParam = req.nextUrl.searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  if (cache[year]) {
    return NextResponse.json(cache[year]);
  }

  try {
    const res = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/PH`,
      { next: { revalidate: 86400 } } // cache for 24 h at the edge
    );

    if (!res.ok) {
      return NextResponse.json([], { status: 200 }); // fail open — no holidays
    }

    const data: { date: string }[] = await res.json();
    const dates = data.map((h) => h.date);
    cache[year] = dates;
    return NextResponse.json(dates);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
