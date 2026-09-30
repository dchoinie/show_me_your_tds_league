import { cacheLife, cacheTag } from "next/cache";

import { getCurrentWeek, getWeekStatus, type WeekStatus } from "./api";
import { CACHE_TAGS, LEAGUE_ID } from "./config";
import { sleeperFetchList } from "./http";
import { getTeams } from "./queries";
import {
  getWeekPreview,
  type GameFacts,
  type GameStarter,
} from "./schedule";
import type { Matchup, PlayerId, RosterId } from "./types";

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

// ---------------------------------------------------------------------------
// Score ticker
// ---------------------------------------------------------------------------

export interface TickerSide {
  rosterId: RosterId;
  teamName: string;
  points: number;
}

export interface TickerGame {
  id: string;
  status: WeekStatus;
  sides: TickerSide[];
  winnerRosterId: RosterId | null;
}

export interface TickerPayload {
  week: number;
  games: TickerGame[];
  updatedAt: number;
}

/**
 * The header ticker, trimmed to what a chip actually renders.
 *
 * Fetches Sleeper directly under a single 30s cache rather than reading
 * through `getScoreStrip` -> `getWeekMatchups` -> `getMatchups`. Those are
 * four nested caches at 60s each, and because a refreshing outer layer can
 * read a still-stale inner one, staleness compounds: a score could be five
 * minutes old before it reached the strip.
 *
 * The cost is repeating the week-selection rule and a simple pairing here.
 * That is a deliberate trade - the ticker only needs team names and totals,
 * not the lineups and projections `getWeekMatchups` assembles.
 */
export async function getTickerPayload(
  leagueId: string = LEAGUE_ID,
): Promise<TickerPayload> {
  "use cache";
  cacheLife("sleeperGameday");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.league(leagueId));

  const [currentWeek, teams] = await Promise.all([
    getCurrentWeek(),
    getTeams(leagueId),
  ]);

  const byRosterId = new Map(teams.map((team) => [team.rosterId, team]));
  const load = (week: number) =>
    sleeperFetchList<Matchup>(`/league/${leagueId}/matchups/${week}`);
  const scored = (entries: Matchup[]) =>
    entries.some((entry) => (entry.custom_points ?? entry.points ?? 0) > 0);

  let week = currentWeek;
  let raw = await load(week);
  let hasScores = scored(raw);

  // Hold last week's finals until the new week actually has points, so the
  // strip never shows a row of 0.00 between Tuesday and Thursday kickoff.
  if (!hasScores && week > 1) {
    const previous = await load(week - 1);
    if (previous.length > 0) {
      week -= 1;
      raw = previous;
      hasScores = scored(previous);
    }
  }

  const status = await getWeekStatus(week, hasScores);

  // Pair rosters that share a matchup_id; a null id means no opponent.
  const groups = new Map<string, Matchup[]>();
  for (const entry of raw) {
    const key =
      entry.matchup_id === null
        ? `bye-${entry.roster_id}`
        : String(entry.matchup_id);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  const games: TickerGame[] = [];

  for (const [id, group] of groups) {
    const sides: TickerSide[] = group.flatMap((entry) => {
      const team = byRosterId.get(entry.roster_id);
      if (!team) return [];
      return [
        {
          rosterId: team.rosterId,
          teamName: team.teamName,
          points: entry.custom_points ?? entry.points ?? 0,
        },
      ];
    });

    if (sides.length === 0) continue;

    const [first, second] = sides;
    const decided = status !== "preview" && sides.length === 2;
    const leader =
      decided && first.points !== second.points
        ? first.points > second.points
          ? first
          : second
        : null;

    games.push({
      id,
      status,
      sides,
      winnerRosterId: leader?.rosterId ?? null,
    });
  }

  games.sort((a, b) => a.id.localeCompare(b.id));

  return { week, games, updatedAt: Date.now() };
}
