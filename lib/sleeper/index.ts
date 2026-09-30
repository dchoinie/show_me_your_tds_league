/**
 * Sleeper data layer.
 *
 * Import from here in Server Components:
 *
 *   import { getStandings, getCurrentWeekMatchups } from "@/lib/sleeper";
 *
 * Layout:
 *   config.ts   league id, cache tags, constants
 *   types.ts    response shapes for every endpoint
 *   http.ts     fetch wrapper (timeouts, retries, SleeperApiError)
 *   api.ts      one cached reader per Sleeper endpoint
 *   players.ts  the ~5MB player dictionary, cached once per day
 *   scoring.ts  stat line -> fantasy points under the league's scoring
 *   projections.ts  weekly projections, scored for this league
 *   queries.ts  joined, page-ready views (teams, standings, matchups, activity)
 *   urls.ts     sleepercdn.com image helpers
 *
 * These modules read the filesystem and are cached per server instance, so they
 * are server-only. Client Components should receive the results as props, or
 * call the route handlers under app/api.
 */

export * from "./config";
export * from "./types";
export * from "./http";
export * from "./api";
export * from "./schedule";
export * from "./live";
export * from "./players";
export * from "./directory";
export * from "./scoring";
export * from "./projections";
export * from "./rules";
export * from "./draft";
export * from "./stats";
export * from "./analytics";
export * from "./player-analytics";
export * from "./queries";
export * from "./history";
export * from "./futures";
export * from "./urls";
