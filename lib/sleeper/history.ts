import { cacheLife, cacheTag } from "next/cache";

import {
  getCurrentWeek,
  getLeague,
  getLeagueHistory,
  getLeagueUsers,
  getRosters,
  getWinnersBracket,
} from "./api";
import { CACHE_TAGS, LEAGUE_ID } from "./config";
import type { League, Roster, UserId } from "./types";
import { userAvatarUrl } from "./urls";

/**
 * This league's season-by-season record, including the season in progress.
 *
 * Past seasons come from Sleeper's `previous_league_id` chain, which
 * `getLeagueHistory` walks. A league in its first year has an empty chain, so
 * the current season carries the tables on its own until there is something
 * behind it - nothing needs to change when 2026 finishes and 2027 links back.
 */

export interface HistoryManager {
  ownerId: UserId;
  managerName: string;
  teamName: string;
  avatarUrl: string | null;
}

export interface SeasonResult {
  season: string;
  leagueId: string;
  teamCount: number;
  /** True for the season currently being played. */
  inProgress: boolean;
  /** Week the in-progress season has reached; null once complete. */
  throughWeek: number | null;
  /** Null until the championship game resolves. */
  champion: HistoryManager | null;
  runnerUp: HistoryManager | null;
  /** Standings leader. The champion once the season is decided. */
  leader: HistoryManager | null;
  leaderRecord: string | null;
  /** Most points scored that season, regardless of finish. */
  topScorer: HistoryManager | null;
  topScorerPoints: number | null;
}

export interface AllTimeRow {
  manager: HistoryManager;
  seasons: number;
  titles: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  /** Best regular-season finish across all seasons. */
  bestFinish: number | null;
}

export interface LeagueHistory {
  /** Newest first, with the in-progress season at the top. */
  seasons: SeasonResult[];
  /** All-time table, titles first. */
  allTime: AllTimeRow[];
  /** False while the league is still in its first season. */
  hasCompletedSeason: boolean;
}

const points = (roster: Roster) =>
  roster.settings.fpts + (roster.settings.fpts_decimal ?? 0) / 100;

const formatRecord = (roster: Roster) =>
  `${roster.settings.wins}-${roster.settings.losses}${
    roster.settings.ties > 0 ? `-${roster.settings.ties}` : ""
  }`;

/** Same ordering the live standings use: record, then points for. */
function rankRosters(rosters: Roster[]): Roster[] {
  return [...rosters].sort((a, b) => {
    if (b.settings.wins !== a.settings.wins) {
      return b.settings.wins - a.settings.wins;
    }
    if (b.settings.ties !== a.settings.ties) {
      return b.settings.ties - a.settings.ties;
    }
    return points(b) - points(a);
  });
}

export async function getLeagueHistorySummary(
  leagueId: string = LEAGUE_ID,
): Promise<LeagueHistory> {
  "use cache";
  cacheLife("sleeperLeague");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.league(leagueId));

  const [past, current, currentWeek] = await Promise.all([
    getLeagueHistory(leagueId),
    getLeague(leagueId),
    getCurrentWeek(),
  ]);

  const completed = past.filter((league) => league.status === "complete");
  const isComplete = current.status === "complete";

  // The season in progress is processed exactly like a finished one; its
  // champion simply stays null until the bracket resolves.
  const ledger: { league: League; inProgress: boolean }[] = [
    ...completed.map((league) => ({ league, inProgress: false })),
    { league: current, inProgress: !isComplete },
  ];

  const totals = new Map<UserId, AllTimeRow>();

  const seasons = await Promise.all(
    ledger.map(async ({ league, inProgress }): Promise<SeasonResult> => {
      const [rosters, users, bracket] = await Promise.all([
        getRosters(league.league_id),
        getLeagueUsers(league.league_id),
        getWinnersBracket(league.league_id),
      ]);

      const usersById = new Map(users.map((user) => [user.user_id, user]));

      const describe = (ownerId: UserId | null): HistoryManager | null => {
        if (!ownerId) return null;
        const user = usersById.get(ownerId);
        const managerName = user?.display_name ?? "Unknown manager";
        return {
          ownerId,
          managerName,
          teamName: user?.metadata?.team_name?.trim() || managerName,
          avatarUrl: user ? userAvatarUrl(user) : null,
        };
      };

      const byRosterId = new Map(
        rosters.map((roster) => [roster.roster_id, roster]),
      );

      // Sleeper flags the championship game p:1; w and l stay null until it
      // is played, which is exactly what an in-progress season should show.
      const final = bracket.find((match) => match.p === 1);
      const championRoster = final?.w ? byRosterId.get(final.w) : undefined;
      const runnerUpRoster = final?.l ? byRosterId.get(final.l) : undefined;

      const ranked = rankRosters(rosters);
      const leaderRoster = ranked[0];
      const topRoster = [...rosters].sort((a, b) => points(b) - points(a))[0];

      // Fold this season into each manager's all-time line.
      ranked.forEach((roster, index) => {
        const ownerId = roster.owner_id;
        const manager = describe(ownerId);
        if (!ownerId || !manager) return;

        const row = totals.get(ownerId) ?? {
          manager,
          seasons: 0,
          titles: 0,
          wins: 0,
          losses: 0,
          ties: 0,
          pointsFor: 0,
          bestFinish: null,
        };

        row.manager = manager;
        row.seasons += 1;
        row.wins += roster.settings.wins;
        row.losses += roster.settings.losses;
        row.ties += roster.settings.ties;
        row.pointsFor = Number((row.pointsFor + points(roster)).toFixed(2));
        row.bestFinish =
          row.bestFinish === null
            ? index + 1
            : Math.min(row.bestFinish, index + 1);
        if (championRoster && roster.roster_id === championRoster.roster_id) {
          row.titles += 1;
        }

        totals.set(ownerId, row);
      });

      return {
        season: league.season,
        leagueId: league.league_id,
        teamCount: rosters.length,
        inProgress,
        throughWeek: inProgress ? currentWeek : null,
        champion: describe(championRoster?.owner_id ?? null),
        runnerUp: describe(runnerUpRoster?.owner_id ?? null),
        leader: describe(leaderRoster?.owner_id ?? null),
        leaderRecord: leaderRoster ? formatRecord(leaderRoster) : null,
        topScorer: describe(topRoster?.owner_id ?? null),
        topScorerPoints: topRoster ? Number(points(topRoster).toFixed(2)) : null,
      };
    }),
  );

  seasons.sort((a, b) => Number(b.season) - Number(a.season));

  const allTime = [...totals.values()].sort(
    (a, b) =>
      b.titles - a.titles || b.wins - a.wins || b.pointsFor - a.pointsFor,
  );

  return { seasons, allTime, hasCompletedSeason: completed.length > 0 };
}
