import { cacheLife, cacheTag } from "next/cache";

import {
  getNflverseUsage,
  getSleeperToGsis,
  type PlayerUsage,
} from "../nflverse/usage";
import { getLeague, getNflState } from "./api";
import { CACHE_TAGS, LEAGUE_ID } from "./config";
import { getAllPlayers } from "./players";
import { getRosterMembership, getTeams, type TeamRef } from "./queries";
import { getSeasonPoints } from "./stats";
import type { PlayerId } from "./types";

/**
 * Usage against production, per rostered player.
 *
 * nflverse supplies opportunity; Sleeper supplies points under this league's
 * scoring. The comparison is the point: a player producing far above his usage
 * is riding efficiency that rarely holds, while one whose usage outruns his
 * production is usually the better asset to acquire.
 *
 * Expressed as a rank differential within position, the same device the draft
 * value analysis uses - it is scale-free and reads in plain language.
 */

/**
 * Positions the usage table covers.
 *
 * Quarterbacks are handled separately by {@link getQbAnalysis}: attempt volume
 * sits in a narrow band across starters and rises when a team is trailing, so
 * ranking them by opportunity produces nonsense - it flags the league's top
 * scorer as a sell. Their scoring turns on touchdown rate instead.
 */
const USAGE_POSITIONS = ["RB", "WR", "TE"];

/** A position needs this many players before ranks mean anything. */
const MIN_SAMPLE = 4;

/**
 * Positions where air yards mean anything.
 *
 * Backs are excluded on purpose. A screen caught behind the line of scrimmage
 * has negative air yards, which makes depth of target negative, pushes yards
 * after the catch above 100% of total yards, and leaves the conversion ratio
 * at zero. The arithmetic is not wrong, it just does not describe anything.
 */
const AIR_YARD_POSITIONS = ["WR", "TE"];

/**
 * Targets needed before depth of target is worth showing at all.
 *
 * Position is not a sufficient filter: a receiver with three targets breaks
 * these metrics the same way a back does. Measured across every pass catcher
 * this season, this floor is where the nonsense stops - below it there are
 * depths of target near 37 yards and yards-after-catch shares past 500%, and
 * at it the deepest role in the league reads a believable 19. It is set to
 * keep genuine low-volume starters rather than only the target hogs.
 */
const MIN_TARGETS_FOR_DEPTH = 12;

/** Air yards needed before a conversion ratio is worth reading. */
const MIN_AIR_YARDS = 150;

/**
 * Targets needed before lagging conversion is called out.
 *
 * Higher than the display floor, because air yards alone are easy to
 * accumulate: five targets thrown 30 yards downfield clear the air-yard
 * threshold without describing a real role.
 */
const MIN_TARGETS_OWED = 15;

/** Share of the baseline below which conversion counts as lagging. */
const UNDER_CONVERTING_RATIO = 0.7;

export type UsageSignal = "underused" | "aligned" | "overperforming";

export interface UsageRow {
  playerId: PlayerId;
  name: string;
  position: string;
  nflTeam: string | null;
  team: TeamRef | null;
  games: number;
  /** Position-appropriate opportunity count. */
  opportunities: number;
  /** What `opportunities` counts, for the column header. */
  opportunityLabel: string;
  targetShare: number | null;
  wopr: number | null;
  epa: number | null;
  /** Average depth of target. Null for backs - see AIR_YARD_POSITIONS. */
  adot: number | null;
  /** Share of receiving yards gained after the catch, 0-1. */
  yacShare: number | null;
  /** Receiving yards per air yard. Low means deep targets are not landing. */
  racr: number | null;
  /**
   * True when a receiver has real downfield volume that has not converted -
   * the yards are owed rather than absent.
   */
  underConverting: boolean;
  /** Season points under this league's scoring. */
  points: number;
  pointsPerOpportunity: number | null;
  /** 1 = most opportunity at the position. */
  usageRank: number;
  /** 1 = most points at the position. */
  pointsRank: number;
  /** usageRank - pointsRank. Positive means outscoring the usage. */
  rankDelta: number;
  /** Null where opportunity does not predict scoring - see SIGNAL_POSITIONS. */
  signal: UsageSignal | null;
}

export interface PlayerAnalytics {
  available: boolean;
  season: string;
  /** Median conversion ratio among pass catchers, the comparison point. */
  racrBaseline: number | null;
  /** Rostered players with usage data. */
  matched: number;
  /** Rostered players we could not reach - almost all have no stat line. */
  unmatched: number;
  rows: UsageRow[];
}

/** Opportunity means different things by position. */
function opportunityFor(
  position: string,
  usage: { passAttempts: number; carries: number; targets: number },
): { count: number; label: string } {
  if (position === "RB") {
    return { count: usage.carries + usage.targets, label: "Touches" };
  }
  return { count: usage.targets, label: "Targets" };
}

/** Descending ranks, ties sharing the average of the span they cover. */
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

export async function getPlayerAnalytics(
  leagueId: string = LEAGUE_ID,
): Promise<PlayerAnalytics> {
  "use cache";
  cacheLife("sleeperLeague");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.rosters(leagueId));

  const state = await getNflState();
  const season = state.season;

  const [usage, crosswalk, teams, membership, dictionary, seasonPoints] =
    await Promise.all([
      getNflverseUsage(season),
      getSleeperToGsis(season),
      getTeams(leagueId),
      getRosterMembership(leagueId),
      getAllPlayers(),
      getSeasonPoints(season, leagueId),
    ]);

  const empty: PlayerAnalytics = {
    available: false,
    season,
    racrBaseline: null,
    matched: 0,
    unmatched: 0,
    rows: [],
  };

  if (Object.keys(usage).length === 0) return empty;

  // Who owns whom, so each row can name the manager holding the player.
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

  const rows: UsageRow[] = [];
  /** Raw stat lines, keyed by player id, for deriving the air-yard columns. */
  const statLines = new Map<string, PlayerUsage>();
  let unmatched = 0;

  for (const playerId of ownerByPlayer.keys()) {
    const player = dictionary[playerId];
    const position = player?.position ?? "";
    if (!player || !USAGE_POSITIONS.includes(position)) continue;

    const gsisId = crosswalk[playerId];
    const stats = gsisId ? usage[gsisId] : undefined;

    // No stat line means no opportunity to measure, not a broken join.
    if (!stats || stats.games === 0) {
      unmatched += 1;
      continue;
    }

    const opportunity = opportunityFor(position, stats);
    if (opportunity.count === 0) {
      unmatched += 1;
      continue;
    }

    const points = seasonPoints[playerId]?.points ?? 0;

    rows.push({
      playerId,
      name: player.name,
      position,
      nflTeam: player.team,
      team: ownerByPlayer.get(playerId) ?? null,
      games: stats.games,
      opportunities: opportunity.count,
      opportunityLabel: opportunity.label,
      targetShare: stats.targetShare,
      wopr: stats.wopr,
      epa: stats.epa,
      points,
      pointsPerOpportunity:
        opportunity.count > 0
          ? Number((points / opportunity.count).toFixed(2))
          : null,
      adot: null,
      yacShare: null,
      racr: null,
      underConverting: false,
      usageRank: 0,
      pointsRank: 0,
      rankDelta: 0,
      signal: null,
    });

    statLines.set(playerId, stats);
  }

  // Depth and yards-after-catch, for the positions where they describe
  // something real.
  for (const row of rows) {
    const stats = statLines.get(row.playerId);
    if (!stats || !AIR_YARD_POSITIONS.includes(row.position)) continue;
    if (stats.targets < MIN_TARGETS_FOR_DEPTH) continue;

    row.adot = Number((stats.receivingAirYards / stats.targets).toFixed(1));
    row.yacShare =
      stats.receivingYards > 0
        ? stats.receivingYac / stats.receivingYards
        : null;
    row.racr =
      stats.receivingAirYards > 0
        ? Number((stats.receivingYards / stats.receivingAirYards).toFixed(2))
        : null;
  }

  // Baseline taken from pass catchers only, which the loop above has already
  // arranged: a ratio exists only where it means something. Including backs
  // would drag it badly, their screens producing ratios of zero and four alike.
  const ratios = rows
    .filter(
      (row) =>
        row.racr !== null &&
        (statLines.get(row.playerId)?.receivingAirYards ?? 0) >=
          MIN_AIR_YARDS / 2,
    )
    .map((row) => row.racr as number)
    .sort((a, b) => a - b);

  const racrBaseline =
    ratios.length > 0
      ? Number(
          (ratios.length % 2 === 0
            ? (ratios[ratios.length / 2 - 1] + ratios[ratios.length / 2]) / 2
            : ratios[(ratios.length - 1) / 2]
          ).toFixed(2),
        )
      : null;

  if (racrBaseline !== null) {
    for (const row of rows) {
      const stats = statLines.get(row.playerId);
      row.underConverting =
        row.racr !== null &&
        (stats?.receivingAirYards ?? 0) >= MIN_AIR_YARDS &&
        (stats?.targets ?? 0) >= MIN_TARGETS_OWED &&
        row.racr <= racrBaseline * UNDER_CONVERTING_RATIO;
    }
  }

  // Rank within position, so a QB's attempt count is never compared to a
  // receiver's target count.
  for (const position of USAGE_POSITIONS) {
    const group = rows.filter((row) => row.position === position);
    if (group.length < MIN_SAMPLE) continue;

    const usageRanks = rankWithTies(group, (row) => row.opportunities);
    const pointsRanks = rankWithTies(group, (row) => row.points);

    // A tenth of the position's field: below that a gap is just noise.
    const threshold = Math.max(3, Math.round(group.length * 0.1));

    for (const row of group) {
      row.usageRank = usageRanks.get(row) ?? 0;
      row.pointsRank = pointsRanks.get(row) ?? 0;
      row.rankDelta = Number((row.usageRank - row.pointsRank).toFixed(1));
      row.signal =
        row.rankDelta >= threshold
          ? "overperforming"
          : row.rankDelta <= -threshold
            ? "underused"
            : "aligned";
    }
  }

  rows.sort(
    (a, b) =>
      USAGE_POSITIONS.indexOf(a.position) -
        USAGE_POSITIONS.indexOf(b.position) ||
      a.usageRank - b.usageRank,
  );

  return {
    available: true,
    season,
    racrBaseline,
    matched: rows.length,
    unmatched,
    rows,
  };
}

// ---------------------------------------------------------------------------
// Quarterbacks
// ---------------------------------------------------------------------------

/**
 * Quarterbacks need a different question asked of them.
 *
 * Attempt volume is close to uniform across starters and skews toward whoever
 * is trailing, so ranking QBs by it is meaningless. What actually moves their
 * scoring is touchdown rate, and touchdown rate regresses hard - while passing
 * and rushing *yards* are sticky week to week.
 *
 * So: keep each quarterback's real yards, replace his *passing* touchdowns
 * with what his attempt volume would produce at the league rate, and score
 * that under this league's own settings.
 *
 * Rushing touchdowns are deliberately left alone. Goal-line carries are a
 * designed role rather than luck, and the quarterbacks who get them keep
 * getting them - regressing those to a league average punished exactly the
 * players whose rushing floor makes them safest.
 */

export type QbSignal = "regression" | "aligned" | "rebound";

export interface QbRow {
  playerId: PlayerId;
  name: string;
  nflTeam: string | null;
  team: TeamRef | null;
  games: number;
  attempts: number;
  passingYards: number;
  passingTds: number;
  rushingYards: number;
  carries: number;
  /** Passing touchdowns per attempt. */
  tdRate: number | null;
  /** Points the yardage and volume support at league-average TD rates. */
  expectedPoints: number;
  /** Points actually scored under this league's scoring. */
  points: number;
  /** points - expectedPoints. Positive means scoring above the volume. */
  delta: number;
  /** Share of points coming from rushing, which is the stickier source. */
  rushingShare: number | null;
  signal: QbSignal;
}

export interface QbAnalysis {
  rows: QbRow[];
  /** League passing touchdowns per attempt, the regression anchor. */
  leagueTdRate: number | null;
}

export async function getQbAnalysis(
  leagueId: string = LEAGUE_ID,
): Promise<QbAnalysis> {
  "use cache";
  cacheLife("sleeperLeague");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.rosters(leagueId));

  const state = await getNflState();
  const season = state.season;

  const [usage, crosswalk, league, teams, membership, dictionary, seasonPoints] =
    await Promise.all([
      getNflverseUsage(season),
      getSleeperToGsis(season),
      getLeague(leagueId),
      getTeams(leagueId),
      getRosterMembership(leagueId),
      getAllPlayers(),
      getSeasonPoints(season, leagueId),
    ]);

  const empty: QbAnalysis = { rows: [], leagueTdRate: null };
  if (Object.keys(usage).length === 0) return empty;

  // League-wide rates, computed from this season rather than hardcoded, so the
  // anchor moves with the actual scoring environment.
  const quarterbacks = Object.values(usage).filter(
    (entry) => entry.position === "QB" && entry.passAttempts > 0,
  );

  const totalAttempts = quarterbacks.reduce((s, q) => s + q.passAttempts, 0);
  const totalPassTds = quarterbacks.reduce((s, q) => s + q.passingTds, 0);

  const leagueTdRate = totalAttempts > 0 ? totalPassTds / totalAttempts : null;

  if (leagueTdRate === null) return empty;

  const scoring = league.scoring_settings;
  const rate = (key: string) => scoring[key] ?? 0;

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

  const rows: QbRow[] = [];

  for (const [playerId, owner] of ownerByPlayer) {
    const player = dictionary[playerId];
    if (player?.position !== "QB") continue;

    const gsisId = crosswalk[playerId];
    const stats = gsisId ? usage[gsisId] : undefined;
    if (!stats || stats.passAttempts === 0) continue;

    // Real yards and real rushing scores; only passing touchdowns regress.
    const expectedPassTds = stats.passAttempts * leagueTdRate;

    const expectedPoints =
      stats.passingYards * rate("pass_yd") +
      expectedPassTds * rate("pass_td") +
      stats.interceptions * rate("pass_int") +
      stats.rushingYards * rate("rush_yd") +
      stats.rushingTds * rate("rush_td");

    const points = seasonPoints[playerId]?.points ?? 0;
    const delta = points - expectedPoints;

    const rushingPoints =
      stats.rushingYards * rate("rush_yd") +
      stats.rushingTds * rate("rush_td");

    // A tenth of expected output: below that the gap is noise this early.
    const threshold = Math.max(6, expectedPoints * 0.15);

    rows.push({
      playerId,
      name: player.name,
      nflTeam: player.team,
      team: owner,
      games: stats.games,
      attempts: stats.passAttempts,
      passingYards: stats.passingYards,
      passingTds: stats.passingTds,
      rushingYards: stats.rushingYards,
      carries: stats.carries,
      tdRate:
        stats.passAttempts > 0 ? stats.passingTds / stats.passAttempts : null,
      expectedPoints: Number(expectedPoints.toFixed(1)),
      points,
      delta: Number(delta.toFixed(1)),
      rushingShare: points > 0 ? rushingPoints / points : null,
      signal:
        delta >= threshold
          ? "regression"
          : delta <= -threshold
            ? "rebound"
            : "aligned",
    });
  }

  rows.sort((a, b) => b.points - a.points);

  return { rows, leagueTdRate };
}
