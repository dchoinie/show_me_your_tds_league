import { cacheLife, cacheTag } from "next/cache";

import { getLeague, getNflState } from "./api";
import { CACHE_TAGS, LEAGUE_ID } from "./config";
import { sleeperFetch } from "./http";
import { scoreStatLine } from "./scoring";
import type { PlayerId } from "./types";

/**
 * Season-to-date player stats, scored under this league's rules.
 *
 * Like `/projections`, `/stats` is not part of Sleeper's documented API. It
 * shares the same stat-key vocabulary, so the scoring dot product applies
 * unchanged - but callers get an empty map rather than an error if it ever
 * disappears.
 */

type StatsPayload = Record<PlayerId, Record<string, number> | null>;

export interface SeasonStatLine {
  points: number;
  /** Games played. Zero means the player has not taken the field. */
  games: number;
}

/**
 * Fantasy points and games played per player for a season.
 *
 * Only players with a stat line are kept, taking the map from ~11k entries
 * down to roughly 1k.
 */
export async function getSeasonPoints(
  season?: string,
  leagueId: string = LEAGUE_ID,
): Promise<Record<PlayerId, SeasonStatLine>> {
  "use cache";
  cacheLife("sleeperLeague");
  cacheTag(CACHE_TAGS.all, `sleeper:stats:${leagueId}:${season ?? "current"}`);

  const [state, league] = await Promise.all([
    getNflState(),
    getLeague(leagueId),
  ]);

  const year = season ?? state.season;

  let payload: StatsPayload;
  try {
    payload = await sleeperFetch<StatsPayload>(
      `/stats/nfl/regular/${year}`,
      // The response runs to roughly 850KB.
      { timeoutMs: 30_000 },
    );
  } catch {
    return {};
  }

  const results: Record<PlayerId, SeasonStatLine> = {};

  for (const [playerId, stats] of Object.entries(payload)) {
    if (!stats) continue;
    const games = typeof stats.gp === "number" ? stats.gp : 0;
    const points = scoreStatLine(stats, league.scoring_settings);
    if (games === 0 && points === 0) continue;
    results[playerId] = { points: Number(points.toFixed(2)), games };
  }

  return results;
}
