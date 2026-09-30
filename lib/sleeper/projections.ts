import { cacheLife, cacheTag } from "next/cache";

import { getLeague, getNflState } from "./api";
import { CACHE_TAGS, LEAGUE_ID } from "./config";
import { sleeperFetch } from "./http";
import { scoreStatLine } from "./scoring";
import type { PlayerId } from "./types";

/**
 * Weekly player projections, converted to this league's scoring.
 *
 * Note: `/projections` is not part of Sleeper's documented API. It is stable
 * in practice and shares the stat-key vocabulary of the documented endpoints,
 * but treat it as a nicety - callers get `null` rather than an error when a
 * projection is unavailable, and nothing on the site should depend on it.
 */

/** Raw payload: player id -> projected stat line. */
type ProjectionPayload = Record<PlayerId, Record<string, number> | null>;

/**
 * Projected fantasy points per player for a week, under the league's scoring.
 *
 * Only players with a positive projection are kept, which takes the map from
 * ~9,400 entries down to ~1,000 and keeps the cache entry small.
 */
export async function getProjectedPoints(
  week: number,
  leagueId: string = LEAGUE_ID,
): Promise<Record<PlayerId, number>> {
  "use cache";
  cacheLife("sleeperLeague");
  cacheTag(CACHE_TAGS.all, `sleeper:projections:${leagueId}:${week}`);

  const [state, league] = await Promise.all([
    getNflState(),
    getLeague(leagueId),
  ]);

  // Always "regular": fantasy weeks 15-18 are still NFL regular season, and
  // the offseason season_type values ("off", "pre") have no projections.
  const path = `/projections/nfl/regular/${state.season}/${week}`;

  let payload: ProjectionPayload;
  try {
    payload = await sleeperFetch<ProjectionPayload>(path, {
      // Larger than a normal request: this response is ~600KB.
      timeoutMs: 30_000,
    });
  } catch {
    // Projections are undocumented and optional. Degrade to "no projections"
    // rather than taking a page down.
    return {};
  }

  const points: Record<PlayerId, number> = {};
  for (const [playerId, stats] of Object.entries(payload)) {
    const value = scoreStatLine(stats, league.scoring_settings);
    if (value > 0) points[playerId] = Number(value.toFixed(2));
  }

  return points;
}

/**
 * Sum projected points over a set of starters.
 *
 * Returns `null` when no starter has a projection at all, so callers can hide
 * the figure instead of showing a misleading 0.
 */
export function sumProjected(
  starterIds: PlayerId[],
  projections: Record<PlayerId, number>,
): number | null {
  let total = 0;
  let matched = false;

  for (const id of starterIds) {
    const value = projections[id];
    if (typeof value === "number") {
      total += value;
      matched = true;
    }
  }

  return matched ? Number(total.toFixed(2)) : null;
}
