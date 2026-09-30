/**
 * Static configuration for the one league this site covers.
 *
 * Sleeper's v1 API is read-only, unauthenticated, and rate limited at roughly
 * 1000 calls/minute per IP. Everything here goes through the cached readers in
 * `./api`, so real traffic to Sleeper stays far below that.
 */

export const SLEEPER_BASE_URL = "https://api.sleeper.app/v1";

/**
 * Host root, without the version segment. The NFL schedule lives at
 * `/schedule/nfl/...` rather than under `/v1`.
 */
export const SLEEPER_ROOT_URL = "https://api.sleeper.app";

/** show me your TDs — https://sleeper.com/leagues/1371322798881910784 */
export const DEFAULT_LEAGUE_ID = "1371322798881910784";

export const LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID ?? DEFAULT_LEAGUE_ID;

/** Regular season weeks in the modern NFL schedule. */
export const REGULAR_SEASON_WEEKS = 18;

/** Sleeper counts fantasy weeks 1-18; playoffs live inside that range. */
export const MAX_FANTASY_WEEK = 18;

/**
 * Rounds in the annual rookie draft.
 *
 * From the league constitution, not the API: Sleeper's `draft_rounds` still
 * reports 29 from the inaugural auction and has no knowledge of the linear
 * rookie drafts that follow it.
 */
export const ROOKIE_DRAFT_ROUNDS = 4;

/**
 * Cache tags, so a single piece of data can be revalidated on demand via
 * `revalidateTag` (see app/api/revalidate/route.ts) instead of waiting out the
 * cacheLife window.
 */
export const CACHE_TAGS = {
  /** Everything Sleeper-derived. */
  all: "sleeper",
  league: (leagueId: string) => `sleeper:league:${leagueId}`,
  rosters: (leagueId: string) => `sleeper:rosters:${leagueId}`,
  users: (leagueId: string) => `sleeper:users:${leagueId}`,
  matchups: (leagueId: string, week: number) =>
    `sleeper:matchups:${leagueId}:${week}`,
  transactions: (leagueId: string, week: number) =>
    `sleeper:transactions:${leagueId}:${week}`,
  brackets: (leagueId: string) => `sleeper:brackets:${leagueId}`,
  drafts: (leagueId: string) => `sleeper:drafts:${leagueId}`,
  players: "sleeper:players",
  state: "sleeper:state",
} as const;
