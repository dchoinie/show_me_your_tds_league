import { cacheLife, cacheTag } from "next/cache";

import { getCurrentWeek, getNflState } from "./api";
import { CACHE_TAGS, LEAGUE_ID, SLEEPER_ROOT_URL } from "./config";
import { sleeperFetch } from "./http";
import {
  fixtureKey,
  getNflverseGames,
  indexByFixture,
} from "../nflverse/games";
import { getPlayers } from "./players";
import { getWeekMatchups, type TeamRef } from "./queries";
import type { PlayerId } from "./types";

/**
 * The NFL schedule.
 *
 * Lives at `/schedule/nfl/...` rather than under `/v1`, and is undocumented -
 * so callers degrade to an empty preview rather than erroring.
 *
 * Important limitation: Sleeper gives each game a **date but no kickoff
 * time**. Everything here is therefore day-granular. Inventing times would
 * mean hardcoding 8:15pm for Thursday and 1:00pm for Sunday, which flex
 * scheduling, international games and late-season Saturday slates all break.
 */

export interface NflGame {
  gameId: string;
  week: number;
  /** YYYY-MM-DD. */
  date: string;
  home: string;
  away: string;
  status: string;
}

/** A league starter appearing in a given NFL game. */
export interface GameStarter {
  playerId: PlayerId;
  name: string;
  position: string | null;
  nflTeam: string | null;
  /** The fantasy team starting them. */
  fantasyTeam: TeamRef;
}

/** Fixed game facts from nflverse. Null when that join finds nothing. */
export interface GameFacts {
  /** Kickoff as an ISO instant. */
  kickoff: string | null;
  /** HH:MM in US Eastern. */
  gametime: string;
  stadium: string;
  roof: string;
  /** "Home", or "Neutral" for the international games. */
  location: string;
  /** Home spread; negative means the home side is favoured. */
  spreadLine: number | null;
  totalLine: number | null;
  divisionGame: boolean;
  awayQb: string;
  homeQb: string;
  awayScore: number | null;
  homeScore: number | null;
}

export interface PreviewGame extends NflGame {
  /** League starters playing in this game, best positions first. */
  starters: GameStarter[];
  /** nflverse metadata, or null if unavailable. */
  facts: GameFacts | null;
}

export interface WeekSlate {
  date: string;
  /** "Thursday", "Sunday", "Monday". */
  weekday: string;
  games: PreviewGame[];
  /** Whole days from today in US Eastern. Negative once the day has passed. */
  daysAway: number;
  /** True once every game on the slate has finished. */
  complete: boolean;
  /** League starters playing anywhere on this slate. */
  starterCount: number;
}

export interface WeekPreview {
  week: number;
  season: string;
  slates: WeekSlate[];
  totalGames: number;
  /** NFL teams with no game this week. */
  byeTeams: string[];
  /** Starters whose NFL team has no game this week. */
  startersOnBye: GameStarter[];
}

type SchedulePayload = {
  game_id: string;
  week: number;
  date: string;
  home: string;
  away: string;
  status: string;
}[];

/** Today in US Eastern as YYYY-MM-DD, so day maths never drifts by timezone. */
function easternToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Whole days between two YYYY-MM-DD dates, ignoring clocks entirely. */
function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

function weekdayOf(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
  }).format(new Date(`${date}T12:00:00Z`));
}

/** Every game in a season, across all weeks. */
export async function getNflSchedule(season: string): Promise<NflGame[]> {
  "use cache";
  cacheLife("sleeperHistory");
  cacheTag(CACHE_TAGS.all, `sleeper:schedule:${season}`);

  try {
    const payload = await sleeperFetch<SchedulePayload>(
      `/schedule/nfl/regular/${season}`,
      { baseUrl: SLEEPER_ROOT_URL },
    );

    return payload.map((game) => ({
      gameId: game.game_id,
      week: game.week,
      date: game.date,
      home: game.home,
      away: game.away,
      status: game.status,
    }));
  } catch {
    return [];
  }
}

/**
 * One week's NFL games, grouped into the days they are played on.
 *
 * Cached briefly rather than for a day because `daysAway` is relative to now -
 * a long-lived entry would keep saying "tomorrow" after tomorrow arrived.
 */
/** QB, RB, WR, TE first; anything else after. */
const POSITION_ORDER = ["QB", "RB", "WR", "TE", "K", "DEF"];

export async function getWeekPreview(
  week?: number,
  leagueId: string = LEAGUE_ID,
): Promise<WeekPreview | null> {
  "use cache";
  cacheLife("sleeperLive");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.state);

  const [state, currentWeek] = await Promise.all([
    getNflState(),
    getCurrentWeek(),
  ]);

  const target = week ?? currentWeek;
  const schedule = await getNflSchedule(state.season);
  if (schedule.length === 0) return null;

  const games = schedule.filter((game) => game.week === target);
  if (games.length === 0) return null;

  // Every league starter this week, tagged with who starts them.
  const matchups = await getWeekMatchups(target, leagueId);
  const lineup: { playerId: PlayerId; fantasyTeam: TeamRef }[] = [];

  for (const matchup of matchups) {
    for (const side of matchup.sides) {
      const fantasyTeam: TeamRef = {
        rosterId: side.team.rosterId,
        teamName: side.team.teamName,
        managerName: side.team.managerName,
        avatarUrl: side.team.avatarUrl,
      };
      for (const playerId of side.starterIds) {
        if (playerId) lineup.push({ playerId, fantasyTeam });
      }
    }
  }

  const players = await getPlayers(lineup.map((entry) => entry.playerId));

  const starters: GameStarter[] = lineup.flatMap((entry) => {
    const player = players[entry.playerId];
    if (!player) return [];
    return [
      {
        playerId: entry.playerId,
        name: player.name,
        position: player.position,
        nflTeam: player.team,
        fantasyTeam: entry.fantasyTeam,
      },
    ];
  });

  const rank = (starter: GameStarter) => {
    const index = POSITION_ORDER.indexOf(starter.position ?? "");
    return index === -1 ? POSITION_ORDER.length : index;
  };

  // Bucket starters into the game their NFL team is playing in.
  const byNflTeam = new Map<string, GameStarter[]>();
  for (const starter of starters) {
    if (!starter.nflTeam) continue;
    byNflTeam.set(starter.nflTeam, [
      ...(byNflTeam.get(starter.nflTeam) ?? []),
      starter,
    ]);
  }

  // Kickoff times, venue and lines. Optional - an empty result just means the
  // preview stays day-granular.
  const facts = indexByFixture(await getNflverseGames(state.season));

  const today = easternToday();
  const byDate = new Map<string, PreviewGame[]>();

  for (const game of games) {
    const inGame = [
      ...(byNflTeam.get(game.away) ?? []),
      ...(byNflTeam.get(game.home) ?? []),
    ].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));

    // Joined on the fixture, not the date: Sleeper dates a game by its local
    // kickoff day while nflverse uses Eastern, which disagree for late games.
    const match = facts[fixtureKey(game.week, game.away, game.home)];

    byDate.set(game.date, [
      ...(byDate.get(game.date) ?? []),
      {
        ...game,
        starters: inGame,
        facts: match
          ? {
              kickoff: match.kickoff,
              gametime: match.gametime,
              stadium: match.stadium,
              roof: match.roof,
              location: match.location,
              spreadLine: match.spreadLine,
              totalLine: match.totalLine,
              divisionGame: match.divisionGame,
              awayQb: match.awayQb,
              homeQb: match.homeQb,
              awayScore: match.awayScore,
              homeScore: match.homeScore,
            }
          : null,
      },
    ]);
  }

  const slates: WeekSlate[] = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayGames]) => ({
      date,
      weekday: weekdayOf(date),
      // Busiest games first, so the ones worth reading lead the grid.
      games: dayGames.sort(
        (a, b) =>
          b.starters.length - a.starters.length ||
          a.home.localeCompare(b.home),
      ),
      daysAway: daysBetween(today, date),
      complete: dayGames.every((game) => game.status === "complete"),
      starterCount: dayGames.reduce(
        (total, game) => total + game.starters.length,
        0,
      ),
    }));

  // A bye is simply a team with no game this week, measured against every
  // team that appears anywhere in the season's schedule.
  const allTeams = new Set<string>();
  for (const game of schedule) {
    allTeams.add(game.home);
    allTeams.add(game.away);
  }
  const playing = new Set<string>();
  for (const game of games) {
    playing.add(game.home);
    playing.add(game.away);
  }

  const byeTeams = [...allTeams].filter((team) => !playing.has(team)).sort();
  const byeSet = new Set(byeTeams);

  return {
    week: target,
    season: state.season,
    slates,
    totalGames: games.length,
    byeTeams,
    // A starter with no game this week is a lineup problem worth flagging.
    startersOnBye: starters
      .filter((starter) => !starter.nflTeam || byeSet.has(starter.nflTeam))
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)),
  };
}
