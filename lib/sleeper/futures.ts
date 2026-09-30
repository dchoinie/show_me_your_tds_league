import { cacheLife, cacheTag } from "next/cache";

import { getTradedPicks } from "./api";
import { CACHE_TAGS, LEAGUE_ID, ROOKIE_DRAFT_ROUNDS } from "./config";
import { getLeagueSummary, getStandings, type TeamRef } from "./queries";
import type { RosterId } from "./types";

/**
 * The playoff race and next year's rookie draft.
 *
 * Both fall out of the standings because of the 2026 constitution amendment:
 * with the Toilet Bowl and the weighted lottery removed, draft order is purely
 * inverse finishing position, so it can be projected rather than guessed at.
 */

export interface PlayoffSeed {
  team: TeamRef;
  rank: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  inPlayoffs: boolean;
  /** Games behind the final playoff spot. Zero for teams currently in. */
  gamesBack: number;
  /** Where this finish would land them in next year's draft. */
  projectedPick: string;
}

export interface DraftPickSlot {
  /** "1.01" style label. */
  label: string;
  round: number;
  /** 1-based position in the draft order. */
  slot: number;
  /** Whose slot this is, by projected finish. */
  originalTeam: TeamRef;
  /** Who holds it now. Differs from `originalTeam` once traded. */
  owner: TeamRef;
  traded: boolean;
}

export interface FutureTrade {
  season: string;
  round: number;
  originalTeam: TeamRef;
  owner: TeamRef;
}

export interface DraftOutlook {
  /** The season being projected, i.e. next year. */
  season: string;
  rounds: number;
  playoffTeams: number;
  playoffWeekStart: number | null;
  isPlayoffs: boolean;
  currentWeek: number;
  seeds: PlayoffSeed[];
  picks: DraftPickSlot[];
  /** Traded picks for seasons beyond the projected one. */
  futureTrades: FutureTrade[];
}

const toRef = (team: {
  rosterId: RosterId;
  teamName: string;
  managerName: string;
  avatarUrl: string | null;
}): TeamRef => ({
  rosterId: team.rosterId,
  teamName: team.teamName,
  managerName: team.managerName,
  avatarUrl: team.avatarUrl,
});

const pickLabel = (round: number, slot: number) =>
  `${round}.${String(slot).padStart(2, "0")}`;

export async function getDraftOutlook(
  leagueId: string = LEAGUE_ID,
): Promise<DraftOutlook> {
  "use cache";
  cacheLife("sleeperLeague");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.rosters(leagueId));

  const [standings, summary, traded] = await Promise.all([
    getStandings(leagueId),
    getLeagueSummary(leagueId),
    getTradedPicks(leagueId),
  ]);

  const playoffTeams = summary.playoffTeams ?? 6;
  const season = String(Number(summary.league.season) + 1);

  // Worst record picks first. With the lottery gone this is the whole rule.
  const order = [...standings].reverse();
  const slotByRosterId = new Map(
    order.map((team, index) => [team.rosterId, index + 1]),
  );

  const cut = standings[playoffTeams - 1];

  const seeds: PlayoffSeed[] = standings.map((team) => {
    const inPlayoffs = team.rank <= playoffTeams;

    // Standard games-back: half the combined win and loss gap.
    const gamesBack =
      inPlayoffs || !cut
        ? 0
        : (cut.wins - team.wins + (team.losses - cut.losses)) / 2;

    return {
      team: toRef(team),
      rank: team.rank,
      wins: team.wins,
      losses: team.losses,
      ties: team.ties,
      pointsFor: team.pointsFor,
      inPlayoffs,
      gamesBack: Math.max(0, gamesBack),
      projectedPick: pickLabel(1, slotByRosterId.get(team.rosterId) ?? 0),
    };
  });

  const byRosterId = new Map(standings.map((team) => [team.rosterId, team]));

  // `roster_id` on a traded pick is whose pick it originally was.
  const ownerByPick = new Map<string, RosterId>();
  for (const pick of traded) {
    if (pick.season !== season) continue;
    ownerByPick.set(`${pick.round}:${pick.roster_id}`, pick.owner_id);
  }

  const picks: DraftPickSlot[] = [];

  for (let round = 1; round <= ROOKIE_DRAFT_ROUNDS; round++) {
    order.forEach((team, index) => {
      const slot = index + 1;
      const ownerId =
        ownerByPick.get(`${round}:${team.rosterId}`) ?? team.rosterId;
      const owner = byRosterId.get(ownerId);

      picks.push({
        label: pickLabel(round, slot),
        round,
        slot,
        originalTeam: toRef(team),
        owner: owner ? toRef(owner) : toRef(team),
        traded: ownerId !== team.rosterId,
      });
    });
  }

  const futureTrades: FutureTrade[] = traded
    .filter((pick) => pick.season !== season)
    .flatMap((pick) => {
      const original = byRosterId.get(pick.roster_id);
      const owner = byRosterId.get(pick.owner_id);
      if (!original || !owner) return [];
      return [
        {
          season: pick.season,
          round: pick.round,
          originalTeam: toRef(original),
          owner: toRef(owner),
        },
      ];
    })
    .sort((a, b) => a.season.localeCompare(b.season) || a.round - b.round);

  return {
    season,
    rounds: ROOKIE_DRAFT_ROUNDS,
    playoffTeams,
    playoffWeekStart: summary.playoffWeekStart,
    isPlayoffs: summary.isPlayoffs,
    currentWeek: summary.currentWeek,
    seeds,
    picks,
    futureTrades,
  };
}
