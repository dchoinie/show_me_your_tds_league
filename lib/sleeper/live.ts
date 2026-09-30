import { cacheLife, cacheTag } from "next/cache";

import { CACHE_TAGS, LEAGUE_ID } from "./config";
import { sleeperFetchList } from "./http";
import {
  getWeekPreview,
  type GameFacts,
  type GameStarter,
} from "./schedule";
import type { Matchup, PlayerId } from "./types";

/**
 * Live scoring for the game tracker.
 *
 * One call to `/matchups/<week>` (~9KB) returns `players_points` for every
 * rostered player on all twelve teams, already scored under this league's
 * rules - TE premium included. So a tracker costs exactly one upstream
 * request per cache window no matter how many games or viewers there are.
 *
 * This deliberately does not go through `getMatchups`, which sits on the
 * slower `sleeperLive` profile. An explicit cacheLife governs a function's own
 * output but not how stale its dependencies already are, so reading through
 * that would cap freshness at 60s regardless of what this asked for.
 */

/** Points for every rostered player this week, keyed by player id. */
export async function getLivePlayerPoints(
  week: number,
  leagueId: string = LEAGUE_ID,
): Promise<Record<PlayerId, number>> {
  "use cache";
  cacheLife("sleeperGameday");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.matchups(leagueId, week));

  const matchups = await sleeperFetchList<Matchup>(
    `/league/${leagueId}/matchups/${week}`,
  );

  const points: Record<PlayerId, number> = {};
  for (const matchup of matchups) {
    for (const [playerId, value] of Object.entries(
      matchup.players_points ?? {},
    )) {
      if (typeof value === "number") points[playerId] = value;
    }
  }

  return points;
}

export interface GameTracker {
  week: number;
  gameId: string;
  home: string;
  away: string;
  /** YYYY-MM-DD. Sleeper gives no kickoff time. */
  date: string;
  weekday: string;
  /** Sleeper's coarse state: pre_game, complete, or similar. */
  status: string;
  /** Whole days until the game, in US Eastern. Negative once past. */
  daysAway: number;
  /** League starters playing in this game. */
  starters: GameStarter[];
  /** Kickoff, venue and line from nflverse. Null if unavailable. */
  facts: GameFacts | null;
}

/**
 * One NFL game, with the league starters playing in it.
 *
 * Static for the page shell - the points themselves arrive separately so the
 * shell can render immediately and the numbers can refresh on their own.
 */
export async function getGameTracker(
  week: number,
  gameId: string,
  leagueId: string = LEAGUE_ID,
): Promise<GameTracker | null> {
  "use cache";
  cacheLife("sleeperLive");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.matchups(leagueId, week));

  const preview = await getWeekPreview(week, leagueId);
  if (!preview) return null;

  for (const slate of preview.slates) {
    const game = slate.games.find((entry) => entry.gameId === gameId);
    if (!game) continue;

    return {
      week,
      gameId: game.gameId,
      home: game.home,
      away: game.away,
      date: game.date,
      weekday: slate.weekday,
      status: game.status,
      daysAway: slate.daysAway,
      starters: game.starters,
      facts: game.facts,
    };
  }

  return null;
}
