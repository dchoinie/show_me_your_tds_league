import { cacheLife, cacheTag } from "next/cache";

import { fetchCsv, NFLVERSE_RELEASE, NFLVERSE_TAG, num } from "./csv";

/**
 * NFL game metadata from nflverse.
 *
 * Source: https://github.com/nflverse/nflverse-data (schedules release),
 * licensed CC BY 4.0. Attribution is rendered in the site footer.
 *
 * Used only for fixed game facts - kickoff time, venue, betting line, final
 * score. Deliberately not used for live scoring: nflverse rebuilds a few times
 * a day, so anything in-play would be hours stale. Live fantasy points come
 * from Sleeper.
 */

/** Sleeper calls the Rams LAR; nflverse calls them LA. Only mismatch of 32. */
const TEAM_ALIASES: Record<string, string> = { LA: "LAR" };

const normalizeTeam = (team: string) => TEAM_ALIASES[team] ?? team;

export interface NflverseGame {
  /** nflverse id, e.g. "2026_04_PIT_CLE". */
  gameId: string;
  season: string;
  week: number;
  /** YYYY-MM-DD in US Eastern. */
  gameday: string;
  weekday: string;
  /** HH:MM, US Eastern. */
  gametime: string;
  /** Kickoff as an ISO instant, or null when the time is missing. */
  kickoff: string | null;
  away: string;
  home: string;
  awayScore: number | null;
  homeScore: number | null;
  /** "Home" or "Neutral" - the London and Munich games are neutral. */
  location: string;
  stadium: string;
  roof: string;
  surface: string;
  /** Home spread. Negative means the home side is favoured. */
  spreadLine: number | null;
  totalLine: number | null;
  divisionGame: boolean;
  awayQb: string;
  homeQb: string;
}

/**
 * Offset between UTC and US Eastern at a given instant, in ms.
 *
 * Derived from the runtime's own timezone database rather than hardcoded, so
 * the Thursday-night games either side of the November DST switch both land
 * correctly.
 */
function easternOffsetMs(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(utcMs));

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  // The Eastern wall clock, reinterpreted as if it were UTC.
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
  );

  return utcMs - asUtc;
}

/** nflverse gives Eastern wall-clock times; turn one into a real instant. */
function toKickoff(gameday: string, gametime: string): string | null {
  if (!gameday || !gametime) return null;

  const [year, month, day] = gameday.split("-").map(Number);
  const [hour, minute] = gametime.split(":").map(Number);
  if ([year, month, day, hour, minute].some((n) => !Number.isFinite(n))) {
    return null;
  }

  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  return new Date(
    wallClockAsUtc + easternOffsetMs(wallClockAsUtc),
  ).toISOString();
}

/**
 * Every game in one season.
 *
 * The published file covers all seasons at ~2MB; this parses it once and keeps
 * only the requested season, so the cache entry stays small.
 */
export async function getNflverseGames(
  season: string,
): Promise<NflverseGame[]> {
  "use cache";
  cacheLife("nflverseData");
  cacheTag(NFLVERSE_TAG, "nflverse:games", `nflverse:games:${season}`);

  // Optional enrichment: a failure degrades to Sleeper's day-granular data.
  const table = await fetchCsv(`${NFLVERSE_RELEASE}/schedules/games.csv`, 30_000);
  if (!table) return [];

  const at = (row: string[], name: string) => row[table.index(name)] ?? "";

  const games: NflverseGame[] = [];

  for (const row of table.rows) {
    if (at(row, "season") !== season) continue;

    const gameday = at(row, "gameday");
    const gametime = at(row, "gametime");

    games.push({
      gameId: at(row, "game_id"),
      season,
      week: Number(at(row, "week")),
      gameday,
      weekday: at(row, "weekday"),
      gametime,
      kickoff: toKickoff(gameday, gametime),
      away: normalizeTeam(at(row, "away_team")),
      home: normalizeTeam(at(row, "home_team")),
      awayScore: num(at(row, "away_score")),
      homeScore: num(at(row, "home_score")),
      location: at(row, "location"),
      stadium: at(row, "stadium"),
      roof: at(row, "roof"),
      surface: at(row, "surface"),
      spreadLine: num(at(row, "spread_line")),
      totalLine: num(at(row, "total_line")),
      divisionGame: at(row, "div_game") === "1",
      awayQb: at(row, "away_qb_name"),
      homeQb: at(row, "home_qb_name"),
    });
  }

  return games;
}

/**
 * Index a season's games by `week:away:home`, the key Sleeper's schedule can
 * also produce. Matching on the fixture rather than the date avoids the two
 * sources' differing date conventions.
 */
export function indexByFixture(
  games: NflverseGame[],
): Record<string, NflverseGame> {
  const index: Record<string, NflverseGame> = {};
  for (const game of games) {
    index[`${game.week}:${game.away}:${game.home}`] = game;
  }
  return index;
}

export const fixtureKey = (week: number, away: string, home: string) =>
  `${week}:${normalizeTeam(away)}:${normalizeTeam(home)}`;
