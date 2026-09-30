import { cacheLife, cacheTag } from "next/cache";

import { getCurrentWeek } from "./api";
import { CACHE_TAGS, LEAGUE_ID } from "./config";
import { getDraftRecap } from "./draft";
import type { TeamRef } from "./queries";
import { getSeasonPoints } from "./stats";
import type { PlayerId } from "./types";

/**
 * Draft value: did what a team paid predict what it got?
 *
 * The headline metric is a positional **rank differential**, not points per
 * dollar. 183 of this league's 348 auction picks went for the $1 minimum, so
 * a per-dollar ratio would rank every minimum bid above every star and the
 * expensive half of the draft could never appear. Comparing a player's price
 * rank at his position against his production rank is scale-free, survives
 * that cluster of ties, and reads plainly: bought as QB2, producing as QB19.
 */

/** Positions worth analysing separately. */
const ANALYSED_POSITIONS = ["QB", "RB", "WR", "TE"];

/** A position needs this many players before a correlation means anything. */
const MIN_SAMPLE = 5;

/**
 * Price bands, most expensive first.
 *
 * Fixed rather than computed so the bands mean the same thing across every
 * position, and chosen to keep the $1 flier cluster in a band of its own
 * instead of letting it swamp a band it shares.
 */
const PRICE_TIERS: { label: string; min: number; max: number }[] = [
  { label: "$30+", min: 30, max: Infinity },
  { label: "$10-29", min: 10, max: 29 },
  { label: "$5-9", min: 5, max: 9 },
  { label: "$1-4", min: 1, max: 4 },
];

function buildTiers(rows: ValueRow[]): PriceTier[] {
  return PRICE_TIERS.flatMap(({ label, min, max }) => {
    const band = rows.filter((row) => row.price >= min && row.price <= max);
    if (band.length === 0) return [];

    const total = band.reduce((sum, row) => sum + row.points, 0);
    const spend = band.reduce((sum, row) => sum + row.price, 0);

    return [
      {
        label,
        count: band.length,
        averagePoints: Number((total / band.length).toFixed(1)),
        averagePrice: Number((spend / band.length).toFixed(1)),
      },
    ];
  });
}

export interface ValueRow {
  playerId: PlayerId;
  playerName: string;
  position: string;
  nflTeam: string | null;
  price: number;
  points: number;
  games: number;
  pointsPerGame: number;
  /** 1 = most expensive at the position. Ties share an averaged rank. */
  priceRank: number;
  /** 1 = most points at the position. */
  pointsRank: number;
  /** priceRank - pointsRank. Positive outperformed the price, negative did not. */
  rankDelta: number;
  team: TeamRef | null;
}

/** A price band, and what players bought in it have actually produced. */
export interface PriceTier {
  label: string;
  count: number;
  averagePoints: number;
  averagePrice: number;
}

export interface PositionAnalysis {
  position: string;
  count: number;
  /**
   * Rank correlation between price and production, -1 to 1. Higher means the
   * auction market priced the position well.
   */
  correlation: number;
  rows: ValueRow[];
  /** Most expensive band first. Empty bands are dropped. */
  tiers: PriceTier[];
  maxPrice: number;
  maxPoints: number;
  bestValue: ValueRow | null;
  worstValue: ValueRow | null;
}

export interface DraftValueAnalysis {
  available: boolean;
  season: string;
  throughWeek: number;
  /** Drafted players analysed - those who have played at least one game. */
  analysed: number;
  /** Drafted players excluded for never taking the field. */
  withoutGames: number;
  positions: PositionAnalysis[];
  steals: ValueRow[];
  busts: ValueRow[];
}

/**
 * Descending ranks where equal values share the average of the positions they
 * span - the standard treatment, and the reason the $1 block does not skew
 * everything beneath it.
 */
function rankWithTies<T>(items: T[], value: (item: T) => number): Map<T, number> {
  const sorted = [...items].sort((a, b) => value(b) - value(a));
  const ranks = new Map<T, number>();

  let index = 0;
  while (index < sorted.length) {
    let last = index;
    while (
      last + 1 < sorted.length &&
      value(sorted[last + 1]) === value(sorted[index])
    ) {
      last += 1;
    }
    const average = (index + 1 + (last + 1)) / 2;
    for (let i = index; i <= last; i++) ranks.set(sorted[i], average);
    index = last + 1;
  }

  return ranks;
}

/** Pearson correlation. Applied to ranks, this is Spearman with tie support. */
function correlate(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;

  const mean = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const mx = mean(xs);
  const my = mean(ys);

  let numerator = 0;
  let dx = 0;
  let dy = 0;

  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    numerator += a * b;
    dx += a * a;
    dy += b * b;
  }

  if (dx === 0 || dy === 0) return 0;
  return numerator / Math.sqrt(dx * dy);
}

export async function getDraftValueAnalysis(
  leagueId: string = LEAGUE_ID,
): Promise<DraftValueAnalysis> {
  "use cache";
  cacheLife("sleeperLeague");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.drafts(leagueId));

  const [recap, currentWeek] = await Promise.all([
    getDraftRecap(leagueId),
    getCurrentWeek(),
  ]);

  const empty: DraftValueAnalysis = {
    available: false,
    season: recap?.season ?? "",
    throughWeek: currentWeek,
    analysed: 0,
    withoutGames: 0,
    positions: [],
    steals: [],
    busts: [],
  };

  if (!recap || !recap.isAuction) return empty;

  const seasonPoints = await getSeasonPoints(recap.season, leagueId);
  if (Object.keys(seasonPoints).length === 0) return empty;

  // Only players who have taken the field are ranked. A drafted player with
  // no games tells us nothing about whether his price was right, and a block
  // of them tied at zero would drag every correlation toward zero.
  const played: ValueRow[] = [];
  let withoutGames = 0;

  for (const pick of recap.picks) {
    const position = pick.position ?? "";
    if (!ANALYSED_POSITIONS.includes(position)) continue;

    const stat = seasonPoints[pick.playerId];
    if (!stat || stat.games === 0) {
      withoutGames += 1;
      continue;
    }

    played.push({
      playerId: pick.playerId,
      playerName: pick.playerName,
      position,
      nflTeam: pick.nflTeam,
      price: pick.amount ?? 0,
      points: stat.points,
      games: stat.games,
      pointsPerGame: Number((stat.points / stat.games).toFixed(2)),
      priceRank: 0,
      pointsRank: 0,
      rankDelta: 0,
      team: pick.team,
    });
  }

  const positions: PositionAnalysis[] = [];

  for (const position of ANALYSED_POSITIONS) {
    const rows = played.filter((row) => row.position === position);
    if (rows.length === 0) continue;

    const priceRanks = rankWithTies(rows, (row) => row.price);
    const pointsRanks = rankWithTies(rows, (row) => row.points);

    for (const row of rows) {
      row.priceRank = priceRanks.get(row) ?? 0;
      row.pointsRank = pointsRanks.get(row) ?? 0;
      row.rankDelta = Number((row.priceRank - row.pointsRank).toFixed(1));
    }

    const ordered = [...rows].sort((a, b) => b.rankDelta - a.rankDelta);

    positions.push({
      position,
      count: rows.length,
      correlation:
        rows.length >= MIN_SAMPLE
          ? correlate(
              rows.map((row) => row.priceRank),
              rows.map((row) => row.pointsRank),
            )
          : 0,
      rows,
      tiers: buildTiers(rows),
      maxPrice: Math.max(...rows.map((row) => row.price)),
      maxPoints: Math.max(...rows.map((row) => row.points)),
      bestValue: ordered[0] ?? null,
      worstValue: ordered[ordered.length - 1] ?? null,
    });
  }

  const byDelta = [...played].sort((a, b) => b.rankDelta - a.rankDelta);

  return {
    available: true,
    season: recap.season,
    throughWeek: currentWeek,
    analysed: played.length,
    withoutGames,
    positions,
    steals: byDelta.slice(0, 10),
    busts: byDelta.slice(-10).reverse(),
  };
}

// ---------------------------------------------------------------------------
// Draft composition
// ---------------------------------------------------------------------------

export interface CompositionPlayer {
  playerId: PlayerId;
  playerName: string;
  price: number;
  nflTeam: string | null;
  team: TeamRef | null;
}

export interface CompositionTier {
  label: string;
  count: number;
  /** Most expensive first. */
  players: CompositionPlayer[];
}

export interface PositionComposition {
  position: string;
  total: number;
  /** Most expensive band first. Empty bands are dropped. */
  tiers: CompositionTier[];
}

/**
 * Every drafted player, grouped by position and then by what they cost.
 *
 * Counts all picks, unlike the value analysis above: who was bought at what
 * price is a fact about the draft itself and does not depend on anyone having
 * played a game since.
 */
export async function getDraftComposition(
  leagueId: string = LEAGUE_ID,
): Promise<PositionComposition[]> {
  "use cache";
  cacheLife("sleeperHistory");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.drafts(leagueId));

  const recap = await getDraftRecap(leagueId);
  if (!recap || !recap.isAuction) return [];

  const priced = recap.picks.filter((pick) => pick.amount !== null);
  if (priced.length === 0) return [];

  // Analysed positions first in their usual order, then anything else the
  // draft happened to contain.
  const present = [...new Set(priced.map((pick) => pick.position ?? "—"))];
  const ordered = [
    ...ANALYSED_POSITIONS.filter((position) => present.includes(position)),
    ...present.filter((position) => !ANALYSED_POSITIONS.includes(position)).sort(),
  ];

  return ordered.flatMap((position) => {
    const atPosition = priced.filter(
      (pick) => (pick.position ?? "—") === position,
    );
    if (atPosition.length === 0) return [];

    const tiers = PRICE_TIERS.flatMap(({ label, min, max }) => {
      const band = atPosition
        .filter((pick) => (pick.amount ?? 0) >= min && (pick.amount ?? 0) <= max)
        .sort(
          (a, b) =>
            (b.amount ?? 0) - (a.amount ?? 0) ||
            a.playerName.localeCompare(b.playerName),
        );

      if (band.length === 0) return [];

      return [
        {
          label,
          count: band.length,
          players: band.map((pick) => ({
            playerId: pick.playerId,
            playerName: pick.playerName,
            price: pick.amount ?? 0,
            nflTeam: pick.nflTeam,
            team: pick.team,
          })),
        },
      ];
    });

    return [{ position, total: atPosition.length, tiers }];
  });
}
