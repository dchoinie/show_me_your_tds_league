import { cacheLife, cacheTag } from "next/cache";

import { getCurrentWeek } from "./api";
import { CACHE_TAGS, LEAGUE_ID } from "./config";
import { getDraftRecap } from "./draft";
import { getAllPlayers } from "./players";
import { getRosterMembership, getStandings, type TeamRef } from "./queries";
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

// ---------------------------------------------------------------------------
// Roster age and competitive window
// ---------------------------------------------------------------------------

/** Where a franchise sits on the age/results grid. */
export type Window = "contend" | "ascend" | "retool" | "stuck";

/**
 * Age bands chosen to match how fantasy production actually curves rather
 * than as round numbers: players are still ascending into their mid-twenties,
 * hold a prime through about 28, and decline after it.
 */
const AGE_BANDS: { key: string; label: string; min: number; max: number }[] = [
  { key: "young", label: "Under 25", min: 0, max: 24 },
  { key: "prime", label: "25-28", min: 25, max: 28 },
  { key: "old", label: "29+", min: 29, max: 99 },
];

export interface AgeBand {
  key: string;
  label: string;
  /** Players on the roster in this band. */
  players: number;
  /** Season points scored by them, under this league's rules. */
  points: number;
  /** Share of the team's total points, 0-1. */
  pointsShare: number;
  /** Points per player in the band - whether the bodies are productive. */
  pointsPerPlayer: number;
}

export interface PositionAge {
  position: string;
  age: number;
  count: number;
}

export interface TeamAgeProfile {
  team: TeamRef;
  rank: number;
  winPct: number;
  pointsFor: number;
  /** Plain average age of everyone on the roster. */
  rosterAge: number | null;
  /**
   * Average age weighted by season points, so it reflects who is actually
   * producing rather than who is merely on the roster.
   */
  productionAge: number | null;
  /**
   * productionAge - rosterAge. The interesting number: negative means the
   * young players are already carrying the scoring, positive means the
   * veterans are and the youth has yet to arrive.
   */
  ageDelta: number | null;
  /** Share of points from players under 25. */
  youthShare: number | null;
  bands: AgeBand[];
  byPosition: PositionAge[];
  /** Players still taxi-eligible under the constitution's 3-year rule. */
  taxiEligible: number;
  window: Window;
}

export interface AgeAnalysis {
  teams: TeamAgeProfile[];
  /** League median production age - the axis the window split uses. */
  medianAge: number | null;
  /** League-wide share of points by band, as a baseline to compare against. */
  leagueBands: AgeBand[];
}

const mean = (values: number[]) =>
  values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

const bandFor = (age: number) =>
  AGE_BANDS.find((band) => age >= band.min && age <= band.max) ?? null;

function buildBands(
  entries: { age: number; points: number }[],
): AgeBand[] {
  const total = entries.reduce((sum, entry) => sum + entry.points, 0);

  return AGE_BANDS.map((band) => {
    const inBand = entries.filter((entry) => bandFor(entry.age)?.key === band.key);
    const points = inBand.reduce((sum, entry) => sum + entry.points, 0);

    return {
      key: band.key,
      label: band.label,
      players: inBand.length,
      points: Number(points.toFixed(1)),
      pointsShare: total > 0 ? points / total : 0,
      pointsPerPlayer:
        inBand.length > 0 ? Number((points / inBand.length).toFixed(1)) : 0,
    };
  });
}

/**
 * Roster age against results and against production.
 *
 * Two questions, not one. First, how old is a team's *scoring* - which the
 * points-weighted age answers, and which the age bands break down. Second,
 * whether that scoring is older or younger than the roster carrying it: a
 * young team whose points all come from its veterans is a different prospect
 * from a young team whose youth is already producing, even though a single
 * average age cannot tell them apart.
 */
export async function getAgeAnalysis(
  leagueId: string = LEAGUE_ID,
): Promise<AgeAnalysis> {
  "use cache";
  cacheLife("sleeperLeague");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.rosters(leagueId));

  const [standings, membership, dictionary, seasonPoints] = await Promise.all([
    getStandings(leagueId),
    getRosterMembership(leagueId),
    getAllPlayers(),
    getSeasonPoints(undefined, leagueId),
  ]);

  const leagueEntries: { age: number; points: number }[] = [];

  const built = standings.flatMap((team) => {
    const roster = membership[team.rosterId];
    if (!roster) return [];

    const entries = roster.playerIds.flatMap((id) => {
      const player = dictionary[id];
      if (!player?.age) return [];
      return [
        {
          age: player.age,
          points: seasonPoints[id]?.points ?? 0,
          position: player.position ?? "-",
        },
      ];
    });

    if (entries.length === 0) return [];
    leagueEntries.push(...entries.map(({ age, points }) => ({ age, points })));

    const totalPoints = entries.reduce((sum, entry) => sum + entry.points, 0);

    const rosterAge = mean(entries.map((entry) => entry.age));
    const productionAge =
      totalPoints > 0
        ? entries.reduce((sum, entry) => sum + entry.age * entry.points, 0) /
          totalPoints
        : null;

    const byPositionMap = new Map<string, number[]>();
    for (const entry of entries) {
      byPositionMap.set(entry.position, [
        ...(byPositionMap.get(entry.position) ?? []),
        entry.age,
      ]);
    }

    const bands = buildBands(entries);
    const youth = bands.find((band) => band.key === "young");

    return [
      {
        team: {
          rosterId: team.rosterId,
          teamName: team.teamName,
          managerName: team.managerName,
          avatarUrl: team.avatarUrl,
        },
        rank: team.rank,
        winPct: team.winPct,
        pointsFor: team.pointsFor,
        rosterAge: rosterAge === null ? null : Number(rosterAge.toFixed(1)),
        productionAge:
          productionAge === null ? null : Number(productionAge.toFixed(1)),
        ageDelta:
          productionAge === null || rosterAge === null
            ? null
            : Number((productionAge - rosterAge).toFixed(1)),
        youthShare: youth ? youth.pointsShare : null,
        bands,
        byPosition: [...byPositionMap.entries()]
          .filter(([position]) => ANALYSED_POSITIONS.includes(position))
          .map(([position, ages]) => ({
            position,
            age: Number((mean(ages) ?? 0).toFixed(1)),
            count: ages.length,
          }))
          .sort(
            (a, b) =>
              ANALYSED_POSITIONS.indexOf(a.position) -
              ANALYSED_POSITIONS.indexOf(b.position),
          ),
        // The constitution's taxi rule: 3 or fewer years of experience.
        taxiEligible: roster.playerIds.filter(
          (id) => (dictionary[id]?.years_exp ?? 99) <= 3,
        ).length,
        window: "retool" as Window,
      },
    ];
  });

  const medianAge = median(
    built
      .map((entry) => entry.productionAge)
      .filter((age): age is number => age !== null),
  );

  const teams = built.map((entry) => {
    const young =
      medianAge === null ||
      entry.productionAge === null ||
      entry.productionAge <= medianAge;
    const winning = entry.winPct >= 0.5;

    const window: Window = winning
      ? young
        ? "ascend"
        : "contend"
      : young
        ? "retool"
        : "stuck";

    return { ...entry, window };
  });

  return { teams, medianAge, leagueBands: buildBands(leagueEntries) };
}
