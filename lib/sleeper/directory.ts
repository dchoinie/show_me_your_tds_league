import { cacheLife, cacheTag } from "next/cache";

import { getTrendingPlayers } from "./api";
import { CACHE_TAGS, LEAGUE_ID } from "./config";
import { getAllPlayers, getPlayers } from "./players";
import { getRosterMembership, getTeams, type TeamRef } from "./queries";
import { getSeasonPoints } from "./stats";
import type { PlayerId, RosterId } from "./types";

/**
 * The player directory: who owns whom, and who is available.
 *
 * Deliberately not the full ~11k player dictionary. The page is filtered in
 * the browser for instant search, so the list has to be a payload worth
 * shipping: every rostered player, plus the free agents who have actually
 * scored. An obscure practice-squad name is not what anyone comes here for.
 */

/** Free agents are ranked by production and capped at this many. */
const FREE_AGENT_LIMIT = 150;

/** Positions the league can actually start. */
const RELEVANT_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);

export type RosterSpot = "starter" | "bench" | "taxi" | "ir";

export interface DirectoryEntry {
  playerId: PlayerId;
  name: string;
  position: string | null;
  nflTeam: string | null;
  injuryStatus: string | null;
  points: number;
  games: number;
  /** Null when no team in the league rosters this player. */
  team: TeamRef | null;
  /** Where the player sits on that roster. */
  spot: RosterSpot | null;
}

export interface PlayerDirectory {
  entries: DirectoryEntry[];
  rosteredCount: number;
  freeAgentCount: number;
  /** How many free agents were left out of the cap. */
  freeAgentsOmitted: number;
}

interface Ownership {
  team: TeamRef;
  spot: RosterSpot;
}

function toRef(team: {
  rosterId: RosterId;
  teamName: string;
  managerName: string;
  avatarUrl: string | null;
}): TeamRef {
  return {
    rosterId: team.rosterId,
    teamName: team.teamName,
    managerName: team.managerName,
    avatarUrl: team.avatarUrl,
  };
}

export async function getPlayerDirectory(
  leagueId: string = LEAGUE_ID,
): Promise<PlayerDirectory> {
  "use cache";
  cacheLife("sleeperRoster");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.rosters(leagueId));

  const [teams, membership, dictionary, seasonPoints] = await Promise.all([
    getTeams(leagueId),
    getRosterMembership(leagueId),
    getAllPlayers(),
    getSeasonPoints(undefined, leagueId),
  ]);

  // Build ownership first, most specific spot wins: a player on IR is also
  // listed in `players`, so order matters here.
  const owned = new Map<PlayerId, Ownership>();

  for (const team of teams) {
    const roster = membership[team.rosterId];
    if (!roster) continue;

    const ref = toRef(team);
    const assign = (ids: PlayerId[], spot: RosterSpot) => {
      for (const id of ids) owned.set(id, { team: ref, spot });
    };

    assign(roster.playerIds, "bench");
    assign(roster.starterIds, "starter");
    assign(roster.taxiIds, "taxi");
    assign(roster.reserveIds, "ir");
  }

  const build = (id: PlayerId): DirectoryEntry | null => {
    const player = dictionary[id];
    if (!player) return null;

    const stat = seasonPoints[id];
    const ownership = owned.get(id);

    return {
      playerId: id,
      name: player.name,
      position: player.position,
      nflTeam: player.team,
      injuryStatus: player.injury_status,
      points: stat?.points ?? 0,
      games: stat?.games ?? 0,
      team: ownership?.team ?? null,
      spot: ownership?.spot ?? null,
    };
  };

  const rostered = [...owned.keys()]
    .map(build)
    .filter((entry): entry is DirectoryEntry => entry !== null);

  // Free agents worth listing: scored something, plays a position the league
  // starts, and not already on a roster.
  const candidates = Object.entries(seasonPoints)
    .filter(([id, stat]) => {
      if (owned.has(id)) return false;
      if (stat.points <= 0) return false;
      const player = dictionary[id];
      return Boolean(player && RELEVANT_POSITIONS.has(player.position ?? ""));
    })
    .sort(([, a], [, b]) => b.points - a.points);

  const freeAgents = candidates
    .slice(0, FREE_AGENT_LIMIT)
    .map(([id]) => build(id))
    .filter((entry): entry is DirectoryEntry => entry !== null);

  const entries = [...rostered, ...freeAgents].sort(
    (a, b) => b.points - a.points || a.name.localeCompare(b.name),
  );

  return {
    entries,
    rosteredCount: rostered.length,
    freeAgentCount: freeAgents.length,
    freeAgentsOmitted: Math.max(0, candidates.length - FREE_AGENT_LIMIT),
  };
}

// ---------------------------------------------------------------------------
// Trending
// ---------------------------------------------------------------------------

export interface TrendingEntry {
  playerId: PlayerId;
  name: string;
  position: string | null;
  nflTeam: string | null;
  /** Leagues across Sleeper that made this move in the last 24 hours. */
  count: number;
  /** The team rostering them here, or null if available. */
  team: TeamRef | null;
}

/**
 * Sleeper-wide waiver activity, annotated with whether the player is actually
 * available in this league - which is the only part that matters here.
 */
export async function getTrending(
  type: "add" | "drop",
  limit = 10,
  leagueId: string = LEAGUE_ID,
): Promise<TrendingEntry[]> {
  "use cache";
  cacheLife("sleeperLive");
  cacheTag(CACHE_TAGS.all, `sleeper:trending:${type}`);

  const [trending, teams, membership] = await Promise.all([
    getTrendingPlayers(type, limit),
    getTeams(leagueId),
    getRosterMembership(leagueId),
  ]);

  const owned = new Map<PlayerId, TeamRef>();
  for (const team of teams) {
    const ref = toRef(team);
    for (const id of membership[team.rosterId]?.playerIds ?? []) {
      owned.set(id, ref);
    }
  }

  const players = await getPlayers(trending.map((entry) => entry.player_id));

  return trending.flatMap((entry) => {
    const player = players[entry.player_id];
    if (!player) return [];

    return [
      {
        playerId: entry.player_id,
        name: player.name,
        position: player.position,
        nflTeam: player.team,
        count: entry.count,
        team: owned.get(entry.player_id) ?? null,
      },
    ];
  });
}
