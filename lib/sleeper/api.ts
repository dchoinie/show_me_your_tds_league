import { cacheLife, cacheTag } from "next/cache";

import { CACHE_TAGS, LEAGUE_ID, MAX_FANTASY_WEEK } from "./config";
import { sleeperFetch, sleeperFetchList, sleeperFetchOptional } from "./http";
import type {
  Bracket,
  Draft,
  DraftPick,
  League,
  LeagueUser,
  Matchup,
  NflState,
  PlayerId,
  Roster,
  SleeperUser,
  TradedPick,
  Transaction,
} from "./types";

/**
 * Cached readers for every Sleeper endpoint this site uses.
 *
 * Each function owns its own `cacheLife` profile (defined in next.config.ts),
 * so a page can call these freely without worrying about request volume: the
 * cache, not the caller, decides when Sleeper is actually contacted.
 */

// ---------------------------------------------------------------------------
// NFL state
// ---------------------------------------------------------------------------

/** Current season and fantasy week. */
export async function getNflState(): Promise<NflState> {
  "use cache";
  cacheLife("sleeperLeague");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.state);

  return sleeperFetch<NflState>("/state/nfl");
}

/**
 * The week the league is currently on.
 *
 * Uses `state.week`, which rolls over on Tuesday morning once the week's last
 * game (Monday night) is final. `display_week` is deliberately not used: it
 * holds the finished week an extra day, so on Tuesday it still reads 3 while
 * the NFL has moved to 4.
 *
 * Clamped into 1..18 so the offseason (`week: 0`) still renders a real week.
 */
export async function getCurrentWeek(): Promise<number> {
  "use cache";
  cacheLife("sleeperLeague");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.state);

  const state = await getNflState();
  const week = state.week || state.display_week || 1;
  return Math.min(Math.max(week, 1), MAX_FANTASY_WEEK);
}

/** Whether a fantasy week is upcoming, being played, or done. */
export type WeekStatus = "preview" | "live" | "final";

/**
 * Where a week sits relative to the NFL calendar.
 *
 * Note this compares against `NflState.week`, not `display_week`. The two
 * diverge Tue-Wed: Sleeper keeps *displaying* the finished week while the NFL
 * has already moved on. For "are these scores still moving?" the real week is
 * the right question, so week 3 reads `final` on Tuesday of week 4.
 *
 * `hasScores` distinguishes a kicked-off week from one that has not started,
 * since a pre-kickoff week reports every score as 0.
 */
export async function getWeekStatus(
  week: number,
  hasScores: boolean,
): Promise<WeekStatus> {
  "use cache";
  cacheLife("sleeperLeague");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.state);

  const state = await getNflState();

  if (week < state.week) return "final";
  if (week > state.week) return "preview";
  return hasScores ? "live" : "preview";
}

// ---------------------------------------------------------------------------
// League
// ---------------------------------------------------------------------------

/** League settings, scoring, and roster positions. */
export async function getLeague(leagueId: string = LEAGUE_ID): Promise<League> {
  "use cache";
  cacheLife("sleeperLeague");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.league(leagueId));

  return sleeperFetch<League>(`/league/${leagueId}`);
}

/** Every roster, including records, points, and player ids. */
export async function getRosters(
  leagueId: string = LEAGUE_ID,
): Promise<Roster[]> {
  "use cache";
  cacheLife("sleeperRoster");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.rosters(leagueId));

  return sleeperFetchList<Roster>(`/league/${leagueId}/rosters`);
}

/** Managers in the league: display names, team names, avatars. */
export async function getLeagueUsers(
  leagueId: string = LEAGUE_ID,
): Promise<LeagueUser[]> {
  "use cache";
  cacheLife("sleeperLeague");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.users(leagueId));

  return sleeperFetchList<LeagueUser>(`/league/${leagueId}/users`);
}

/**
 * Previous seasons of this league, oldest first, by following the
 * `previous_league_id` chain. Excludes the league passed in.
 */
export async function getLeagueHistory(
  leagueId: string = LEAGUE_ID,
): Promise<League[]> {
  "use cache";
  cacheLife("sleeperHistory");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.league(leagueId));

  const history: League[] = [];
  const seen = new Set<string>([leagueId]);

  let current = await getLeague(leagueId);

  // Guard against a malformed chain pointing back at itself.
  while (current.previous_league_id && !seen.has(current.previous_league_id)) {
    seen.add(current.previous_league_id);
    const previous = await sleeperFetchOptional<League>(
      `/league/${current.previous_league_id}`,
    );
    if (!previous) break;
    history.push(previous);
    current = previous;
  }

  return history.reverse();
}

// ---------------------------------------------------------------------------
// Matchups
// ---------------------------------------------------------------------------

/**
 * Every roster's lineup and score for one fantasy week.
 *
 * The in-progress week uses a short cache so live scores move; completed weeks
 * are treated as history.
 */
export async function getMatchups(
  week: number,
  leagueId: string = LEAGUE_ID,
): Promise<Matchup[]> {
  "use cache";

  const currentWeek = await getCurrentWeek();
  if (week >= currentWeek) {
    cacheLife("sleeperLive");
  } else {
    cacheLife("sleeperHistory");
  }
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.matchups(leagueId, week));

  return sleeperFetchList<Matchup>(`/league/${leagueId}/matchups/${week}`);
}

/**
 * Matchups for weeks 1 through `throughWeek` (default: the current week).
 *
 * Indexed by week, so `result[3]` is week 3. Index 0 is always empty.
 */
export async function getMatchupsByWeek(
  throughWeek?: number,
  leagueId: string = LEAGUE_ID,
): Promise<Matchup[][]> {
  "use cache";
  cacheLife("sleeperLive");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.league(leagueId));

  const lastWeek = throughWeek ?? (await getCurrentWeek());
  const weeks = Array.from({ length: lastWeek }, (_, index) => index + 1);
  const results = await Promise.all(
    weeks.map((week) => getMatchups(week, leagueId)),
  );

  return [[], ...results];
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

/** Trades, waiver claims, and free-agent moves for one week. */
export async function getTransactions(
  week: number,
  leagueId: string = LEAGUE_ID,
): Promise<Transaction[]> {
  "use cache";

  const currentWeek = await getCurrentWeek();
  if (week >= currentWeek) {
    cacheLife("sleeperLive");
  } else {
    cacheLife("sleeperHistory");
  }
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.transactions(leagueId, week));

  return sleeperFetchList<Transaction>(
    `/league/${leagueId}/transactions/${week}`,
  );
}

/**
 * Every transaction in the season so far, newest first.
 *
 * Sleeper only exposes transactions a week at a time, so this fans out across
 * weeks 1..current. Each week is independently cached.
 */
export async function getAllTransactions(
  leagueId: string = LEAGUE_ID,
): Promise<Transaction[]> {
  "use cache";
  cacheLife("sleeperLive");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.league(leagueId));

  const currentWeek = await getCurrentWeek();
  const weeks = Array.from({ length: currentWeek }, (_, index) => index + 1);
  const perWeek = await Promise.all(
    weeks.map((week) => getTransactions(week, leagueId)),
  );

  return perWeek.flat().sort((a, b) => b.created - a.created);
}

/** Draft picks that have changed hands, for dynasty/keeper trade history. */
export async function getTradedPicks(
  leagueId: string = LEAGUE_ID,
): Promise<TradedPick[]> {
  "use cache";
  cacheLife("sleeperLeague");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.league(leagueId));

  return sleeperFetchList<TradedPick>(`/league/${leagueId}/traded_picks`);
}

// ---------------------------------------------------------------------------
// Playoff brackets
// ---------------------------------------------------------------------------

/** Championship bracket. Empty until Sleeper generates it. */
export async function getWinnersBracket(
  leagueId: string = LEAGUE_ID,
): Promise<Bracket> {
  "use cache";
  cacheLife("sleeperLive");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.brackets(leagueId));

  return sleeperFetchList(`/league/${leagueId}/winners_bracket`);
}

/** Consolation bracket. Empty until Sleeper generates it. */
export async function getLosersBracket(
  leagueId: string = LEAGUE_ID,
): Promise<Bracket> {
  "use cache";
  cacheLife("sleeperLive");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.brackets(leagueId));

  return sleeperFetchList(`/league/${leagueId}/losers_bracket`);
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

/** All drafts for the league, most recent first. */
export async function getLeagueDrafts(
  leagueId: string = LEAGUE_ID,
): Promise<Draft[]> {
  "use cache";
  cacheLife("sleeperHistory");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.drafts(leagueId));

  return sleeperFetchList<Draft>(`/league/${leagueId}/drafts`);
}

export async function getDraft(draftId: string): Promise<Draft | null> {
  "use cache";
  cacheLife("sleeperHistory");
  cacheTag(CACHE_TAGS.all, `sleeper:draft:${draftId}`);

  return sleeperFetchOptional<Draft>(`/draft/${draftId}`);
}

/** Every pick in a draft, in pick order. */
export async function getDraftPicks(draftId: string): Promise<DraftPick[]> {
  "use cache";
  cacheLife("sleeperHistory");
  cacheTag(CACHE_TAGS.all, `sleeper:draft:${draftId}`);

  const picks = await sleeperFetchList<DraftPick>(`/draft/${draftId}/picks`);
  return picks.sort((a, b) => a.pick_no - b.pick_no);
}

// ---------------------------------------------------------------------------
// Trending players
// ---------------------------------------------------------------------------

export interface TrendingPlayer {
  player_id: PlayerId;
  /** How many leagues across Sleeper made this move in the window. */
  count: number;
}

/**
 * Players being added or dropped across all of Sleeper.
 *
 * League-agnostic: this is the whole platform's waiver activity, which is why
 * it is useful as a signal about who is worth a claim here.
 */
export async function getTrendingPlayers(
  type: "add" | "drop",
  limit = 25,
  lookbackHours = 24,
): Promise<TrendingPlayer[]> {
  "use cache";
  cacheLife("sleeperLive");
  cacheTag(CACHE_TAGS.all, `sleeper:trending:${type}`);

  return sleeperFetchList<TrendingPlayer>(
    `/players/nfl/trending/${type}?lookback_hours=${lookbackHours}&limit=${limit}`,
  );
}

// ---------------------------------------------------------------------------
// Users (handy for looking up ids outside the league context)
// ---------------------------------------------------------------------------

/** Look up a Sleeper account by username or user id. */
export async function getUser(
  usernameOrId: string,
): Promise<SleeperUser | null> {
  "use cache";
  cacheLife("sleeperHistory");
  cacheTag(CACHE_TAGS.all, `sleeper:user:${usernameOrId}`);

  return sleeperFetchOptional<SleeperUser>(`/user/${usernameOrId}`);
}

/** Every NFL league a user is in for a given season. */
export async function getUserLeagues(
  userId: string,
  season: string,
): Promise<League[]> {
  "use cache";
  cacheLife("sleeperLeague");
  cacheTag(CACHE_TAGS.all, `sleeper:user:${userId}`);

  return sleeperFetchList<League>(
    `/user/${userId}/leagues/nfl/${season}`,
  );
}
