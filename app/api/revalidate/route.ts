import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { CACHE_TAGS } from "@/lib/sleeper";

/**
 * On-demand cache busting, for when waiting out a cacheLife window is too slow
 * (a trade just processed, scores are stuck, the player list is stale).
 *
 *   curl -X POST localhost:3000/api/revalidate \
 *     -H "authorization: Bearer $REVALIDATE_SECRET" \
 *     -H "content-type: application/json" \
 *     -d '{"tags":["sleeper"]}'
 *
 * Omitting `tags` refreshes everything Sleeper-derived. Set REVALIDATE_SECRET
 * in the environment to enable the route; without it the route stays disabled
 * so nobody can force traffic to Sleeper.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "REVALIDATE_SECRET is not configured" },
      { status: 503 },
    );
  }

  const provided = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");

  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let tags: string[] = [CACHE_TAGS.all];
  try {
    const body: unknown = await request.json();
    if (
      body &&
      typeof body === "object" &&
      Array.isArray((body as { tags?: unknown }).tags)
    ) {
      const requested = (body as { tags: unknown[] }).tags.filter(
        (tag): tag is string => typeof tag === "string",
      );
      if (requested.length > 0) tags = requested;
    }
  } catch {
    // No body, or not JSON: fall through to revalidating everything.
  }

  // "max" = serve stale while the refresh happens in the background, so a
  // revalidate never makes a visitor wait on Sleeper.
  for (const tag of tags) revalidateTag(tag, "max");

  return NextResponse.json({ revalidated: tags, now: Date.now() });
}
