import { cacheLife, cacheTag } from "next/cache";

import { getSnapShares, type SnapWeek } from "../nflverse/snaps";
import { getSleeperToGsis } from "../nflverse/usage";
import { getNflState } from "./api";
import { CACHE_TAGS, LEAGUE_ID } from "./config";
import { getAllPlayers } from "./players";
import { getRosterMembership, getTeams, type TeamRef } from "./queries";
import type { PlayerId } from "./types";

/**
 * Snap share for players this league can actually act on.
 *
 * Deliberately includes free agents as well as rostered players: a rising snap
 * share on somebody nobody owns is the most actionable thing on the page, and
 * limiting this to rosters would hide exactly the players worth claiming.
 */

const TRACKED_POSITIONS = ["QB", "RB", "WR", "TE"];

/**
 * A free agent needs a real role to be worth listing. Below this it is a
 * rotational player whose snap count says little.
 */
const FREE_AGENT_MIN_PCT = 0.35;

/** Free agents are ranked by trend and capped, so the table stays readable. */
const FREE_AGENT_LIMIT = 40;

/** Share-point change that counts as a genuine move rather than noise. */
const TREND_THRESHOLD = 0.08;

export type SnapTrend = "rising" | "steady" | "falling";

export interface SnapRow {
  playerId: PlayerId;
  name: string;
  position: string;
  nflTeam: string | null;
  /**
   * Current injury designation. Essential context here: a player who left a
   * game hurt shows a collapsing snap share that is not a role change, and
   * without this the table would read it as one.
   */
  injuryStatus: string | null;
  /** Null when no team in the league rosters the player. */
  team: TeamRef | null;
  weeks: SnapWeek[];
  totalSnaps: number;
  seasonPct: number;
  latestWeek: number;
  latestPct: number;
  trend: number | null;
  direction: SnapTrend;
}

export interface SnapAnalytics {
  available: boolean;
  season: string;
  /** The most recent week any snap data covers. */
  throughWeek: number | null;
  rows: SnapRow[];
}

export async function getSnapAnalytics(
  leagueId: string = LEAGUE_ID,
): Promise<SnapAnalytics> {
  "use cache";
  cacheLife("sleeperLeague");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.rosters(leagueId));

  const state = await getNflState();
  const season = state.season;

  const [snaps, crosswalk, teams, membership, dictionary] = await Promise.all([
    getSnapShares(season),
    getSleeperToGsis(season),
    getTeams(leagueId),
    getRosterMembership(leagueId),
    getAllPlayers(),
  ]);

  if (Object.keys(snaps).length === 0) {
    return { available: false, season, throughWeek: null, rows: [] };
  }

  const ownerByPlayer = new Map<PlayerId, TeamRef>();
  for (const team of teams) {
    const roster = membership[team.rosterId];
    if (!roster) continue;
    const ref: TeamRef = {
      rosterId: team.rosterId,
      teamName: team.teamName,
      managerName: team.managerName,
      avatarUrl: team.avatarUrl,
    };
    for (const id of roster.playerIds) ownerByPlayer.set(id, ref);
  }

  const direction = (trend: number | null): SnapTrend => {
    if (trend === null) return "steady";
    if (trend >= TREND_THRESHOLD) return "rising";
    if (trend <= -TREND_THRESHOLD) return "falling";
    return "steady";
  };

  const build = (playerId: PlayerId): SnapRow | null => {
    const player = dictionary[playerId];
    const position = player?.position ?? "";
    if (!player || !TRACKED_POSITIONS.includes(position)) return null;

    const gsisId = crosswalk[playerId];
    const share = gsisId ? snaps[gsisId] : undefined;
    if (!share) return null;

    return {
      playerId,
      name: player.name,
      position,
      nflTeam: player.team,
      injuryStatus: player.injury_status,
      team: ownerByPlayer.get(playerId) ?? null,
      weeks: share.weeks,
      totalSnaps: share.totalSnaps,
      seasonPct: share.seasonPct,
      latestWeek: share.latestWeek,
      latestPct: share.latestPct,
      trend: share.trend,
      direction: direction(share.trend),
    };
  };

  const rostered = [...ownerByPlayer.keys()]
    .map(build)
    .filter((row): row is SnapRow => row !== null);

  const owned = new Set(rostered.map((row) => row.playerId));

  // Free agents with a real role, the ones most likely to be worth a claim.
  const freeAgents = Object.keys(dictionary)
    .filter((id) => !owned.has(id) && !ownerByPlayer.has(id))
    .map(build)
    .filter(
      (row): row is SnapRow =>
        row !== null && row.seasonPct >= FREE_AGENT_MIN_PCT,
    )
    .sort(
      (a, b) =>
        (b.trend ?? -Infinity) - (a.trend ?? -Infinity) ||
        b.seasonPct - a.seasonPct,
    )
    .slice(0, FREE_AGENT_LIMIT);

  const rows = [...rostered, ...freeAgents];

  const throughWeek = rows.reduce(
    (latest, row) => Math.max(latest, row.latestWeek),
    0,
  );

  return {
    available: true,
    season,
    throughWeek: throughWeek > 0 ? throughWeek : null,
    rows,
  };
}
