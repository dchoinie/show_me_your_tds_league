import { NextResponse } from "next/server";

import { getTickerPayload } from "@/lib/sleeper";

/**
 * Feed for the header ticker.
 *
 * Small on purpose - roughly a kilobyte of team names and totals - so polling
 * it costs far less than re-rendering the whole page would.
 */
export async function GET() {
  try {
    return NextResponse.json(await getTickerPayload());
  } catch {
    // The strip keeps its last good scores rather than emptying out.
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
}
