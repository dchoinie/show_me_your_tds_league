import { NextResponse } from "next/server";

import { getLivePlayerPoints, MAX_FANTASY_WEEK } from "@/lib/sleeper";

/**
 * Live scoring feed for the game tracker.
 *
 * Returns every rostered player's points for the week rather than just one
 * game's, so a single cached response serves every game page open at once.
 * That keeps upstream traffic at one Sleeper request per cache window no
 * matter how many people are watching.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ week: string }> },
) {
  const { week: raw } = await params;
  const week = Number(raw);

  if (!Number.isInteger(week) || week < 1 || week > MAX_FANTASY_WEEK) {
    return NextResponse.json({ error: "Invalid week" }, { status: 400 });
  }

  try {
    const points = await getLivePlayerPoints(week);
    return NextResponse.json({ points, updatedAt: Date.now() });
  } catch {
    // A failed poll should leave the last good numbers on screen, not blank
    // the tracker out.
    return NextResponse.json(
      { error: "Scoring unavailable" },
      { status: 503 },
    );
  }
}
