import { cacheLife, cacheTag } from "next/cache";

import { getDraftPicks, getLeagueDrafts } from "./api";
import { CACHE_TAGS, LEAGUE_ID } from "./config";
import { getStandings, indexTeams, type TeamRef } from "./queries";
import type { DraftType, PlayerId, RosterId } from "./types";

/**
 * Draft recap.
 *
 * Written to cover both formats this league will use: the inaugural auction
 * (29 rounds, a $200 budget per team) and the 4-round linear rookie drafts
 * every year after. `isAuction` decides whether a pick is described by price
 * or by draft position.
 *
 * Player details come from each pick's own metadata, which Sleeper populates
 * with name, position and team - so a draft recap never needs the ~5MB player
 * dictionary.
 */

export interface DraftPickView {
  pickNo: number;
  round: number;
  playerId: PlayerId;
  playerName: string;
  position: string | null;
  nflTeam: string | null;
  /** Winning bid in dollars. Null outside auction drafts. */
  amount: number | null;
  team: TeamRef | null;
}

export interface DraftTeamSummary {
  team: TeamRef;
  /** Most expensive first in an auction, pick order otherwise. */
  picks: DraftPickView[];
  spent: number;
  /** Picks bought at the $1 minimum - the flier count. */
  minimumBids: number;
  topPick: DraftPickView | null;
}

export interface PositionSpend {
  position: string;
  amount: number;
  count: number;
  /** Share of all money spent, 0-1. */
  share: number;
}

export interface DraftRecap {
  draftId: string;
  season: string;
  type: DraftType;
  isAuction: boolean;
  rounds: number;
  teamCount: number;
  /** Per-team auction budget. Null outside auction drafts. */
  budget: number | null;
  totalSpent: number;
  /** Every pick, in pick order. */
  picks: DraftPickView[];
  /** Most expensive buys league-wide. Empty outside auction drafts. */
  topBuys: DraftPickView[];
  /** Ordered by current league standing. */
  byTeam: DraftTeamSummary[];
  byPosition: PositionSpend[];
}

/** The cheapest an auction player can go for, and the flier price. */
const MINIMUM_BID = 1;

export async function getDraftRecap(
  leagueId: string = LEAGUE_ID,
): Promise<DraftRecap | null> {
  "use cache";
  cacheLife("sleeperHistory");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.drafts(leagueId));

  const drafts = await getLeagueDrafts(leagueId);
  // Sleeper lists newest first; the league's current draft is the one to show.
  const draft = drafts[0];
  if (!draft) return null;

  const [picks, standings] = await Promise.all([
    getDraftPicks(draft.draft_id),
    getStandings(leagueId),
  ]);

  const isAuction = draft.type === "auction";
  const budget = isAuction ? (draft.settings.budget ?? null) : null;

  const teamsByRoster = indexTeams(standings);

  const toRef = (rosterId: RosterId | null): TeamRef | null => {
    if (rosterId === null) return null;
    const team = teamsByRoster.get(rosterId);
    return team
      ? {
          rosterId: team.rosterId,
          teamName: team.teamName,
          managerName: team.managerName,
          avatarUrl: team.avatarUrl,
        }
      : null;
  };

  const views: DraftPickView[] = picks.map((pick) => {
    const meta = pick.metadata;
    const name =
      [meta?.first_name, meta?.last_name].filter(Boolean).join(" ").trim() ||
      pick.player_id;
    const raw = meta?.amount;
    const amount = raw === undefined ? null : Number(raw);

    return {
      pickNo: pick.pick_no,
      round: pick.round,
      playerId: pick.player_id,
      playerName: name,
      position: meta?.position ?? null,
      nflTeam: meta?.team || null,
      amount: amount !== null && Number.isFinite(amount) ? amount : null,
      team: toRef(pick.roster_id),
    };
  });

  const totalSpent = views.reduce((sum, pick) => sum + (pick.amount ?? 0), 0);

  // Group by team, then order to match the current standings so the recap
  // reads alongside how those rosters are actually performing.
  const byRosterId = new Map<RosterId, DraftPickView[]>();
  for (const pick of views) {
    if (!pick.team) continue;
    const list = byRosterId.get(pick.team.rosterId) ?? [];
    list.push(pick);
    byRosterId.set(pick.team.rosterId, list);
  }

  const byTeam: DraftTeamSummary[] = standings.flatMap((team) => {
    const teamPicks = byRosterId.get(team.rosterId);
    if (!teamPicks) return [];

    const ordered = [...teamPicks].sort((a, b) =>
      isAuction
        ? (b.amount ?? 0) - (a.amount ?? 0) || a.pickNo - b.pickNo
        : a.pickNo - b.pickNo,
    );

    return [
      {
        team: {
          rosterId: team.rosterId,
          teamName: team.teamName,
          managerName: team.managerName,
          avatarUrl: team.avatarUrl,
        },
        picks: ordered,
        spent: ordered.reduce((sum, pick) => sum + (pick.amount ?? 0), 0),
        minimumBids: ordered.filter((pick) => pick.amount === MINIMUM_BID)
          .length,
        topPick: ordered[0] ?? null,
      },
    ];
  });

  const positionTotals = new Map<string, { amount: number; count: number }>();
  for (const pick of views) {
    const key = pick.position ?? "—";
    const entry = positionTotals.get(key) ?? { amount: 0, count: 0 };
    entry.amount += pick.amount ?? 0;
    entry.count += 1;
    positionTotals.set(key, entry);
  }

  const byPosition: PositionSpend[] = [...positionTotals.entries()]
    .map(([position, entry]) => ({
      position,
      amount: entry.amount,
      count: entry.count,
      share: totalSpent > 0 ? entry.amount / totalSpent : 0,
    }))
    .sort((a, b) => b.amount - a.amount || b.count - a.count);

  return {
    draftId: draft.draft_id,
    season: draft.season,
    type: draft.type,
    isAuction,
    rounds: draft.settings.rounds ?? 0,
    teamCount: draft.settings.teams ?? standings.length,
    budget,
    totalSpent,
    picks: views,
    topBuys: isAuction
      ? [...views]
          .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0) || a.pickNo - b.pickNo)
          .slice(0, 10)
      : [],
    byTeam,
    byPosition,
  };
}
