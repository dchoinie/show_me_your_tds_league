import { cacheLife, cacheTag } from "next/cache";

import { getAllPlayers } from "../sleeper/players";
import type { PlayerId } from "../sleeper/types";
import { NFLVERSE_RELEASE, NFLVERSE_TAG, fetchCsv, num } from "./csv";
import { getNflverseIdMaps } from "./ids";

/**
 * Player opportunity data from nflverse.
 *
 * The division of labour matters: nflverse supplies **usage** (targets, target
 * share, air yards, weighted opportunity), Sleeper supplies **points** under
 * this league's own scoring. Mixing in nflverse's `fantasy_points_ppr` would
 * quietly ignore the TE premium, so it is not used.
 *
 * Source: nflverse-data `stats_player` and `players` releases, CC BY 4.0.
 */

export interface PlayerUsage {
  /** nflverse keys on GSIS ids. */
  gsisId: string;
  name: string;
  position: string;
  team: string;
  /** Weeks with a stat line. */
  games: number;
  passAttempts: number;
  carries: number;
  targets: number;
  receptions: number;
  passingYards: number;
  passingTds: number;
  interceptions: number;
  rushingYards: number;
  rushingTds: number;
  /** Mean weekly share of the team's targets, 0-1. */
  targetShare: number | null;
  /** Mean weekly share of the team's air yards, 0-1. */
  airYardsShare: number | null;
  /** Weighted Opportunity Rating, the standard usage composite. */
  wopr: number | null;
  /** Expected points added, summed across the season. */
  epa: number | null;
}

/** Season-to-date usage per player, keyed by GSIS id. */
export async function getNflverseUsage(
  season: string,
): Promise<Record<string, PlayerUsage>> {
  "use cache";
  cacheLife("nflverseData");
  cacheTag(NFLVERSE_TAG, "nflverse:usage", `nflverse:usage:${season}`);

  const table = await fetchCsv(
    `${NFLVERSE_RELEASE}/stats_player/stats_player_week_${season}.csv`,
  );
  if (!table) return {};

  const at = (row: string[], column: string) => row[table.index(column)];

  type Accumulator = PlayerUsage & {
    shareSum: number;
    shareCount: number;
    airSum: number;
    airCount: number;
    woprSum: number;
    woprCount: number;
  };

  const totals = new Map<string, Accumulator>();

  for (const row of table.rows) {
    if (row.length < table.header.length) continue;

    const gsisId = at(row, "player_id");
    if (!gsisId) continue;

    const entry: Accumulator =
      totals.get(gsisId) ??
      {
        gsisId,
        name: at(row, "player_display_name") ?? "",
        position: at(row, "position") ?? "",
        team: at(row, "team") ?? "",
        games: 0,
        passAttempts: 0,
        carries: 0,
        targets: 0,
        receptions: 0,
        passingYards: 0,
        passingTds: 0,
        interceptions: 0,
        rushingYards: 0,
        rushingTds: 0,
        targetShare: null,
        airYardsShare: null,
        wopr: null,
        epa: 0,
        shareSum: 0,
        shareCount: 0,
        airSum: 0,
        airCount: 0,
        woprSum: 0,
        woprCount: 0,
      };

    entry.games += 1;
    entry.passAttempts += num(at(row, "attempts")) ?? 0;
    entry.carries += num(at(row, "carries")) ?? 0;
    entry.targets += num(at(row, "targets")) ?? 0;
    entry.receptions += num(at(row, "receptions")) ?? 0;
    entry.passingYards += num(at(row, "passing_yards")) ?? 0;
    entry.passingTds += num(at(row, "passing_tds")) ?? 0;
    entry.interceptions += num(at(row, "passing_interceptions")) ?? 0;
    entry.rushingYards += num(at(row, "rushing_yards")) ?? 0;
    entry.rushingTds += num(at(row, "rushing_tds")) ?? 0;

    // EPA is additive across weeks; the share metrics are rates, so they are
    // averaged over the weeks that actually reported one.
    entry.epa =
      (entry.epa ?? 0) +
      (num(at(row, "receiving_epa")) ?? 0) +
      (num(at(row, "rushing_epa")) ?? 0) +
      (num(at(row, "passing_epa")) ?? 0);

    const share = num(at(row, "target_share"));
    if (share !== null) {
      entry.shareSum += share;
      entry.shareCount += 1;
    }
    const air = num(at(row, "air_yards_share"));
    if (air !== null) {
      entry.airSum += air;
      entry.airCount += 1;
    }
    const wopr = num(at(row, "wopr"));
    if (wopr !== null) {
      entry.woprSum += wopr;
      entry.woprCount += 1;
    }

    // Keep the most recent team seen, so mid-season moves read correctly.
    entry.team = at(row, "team") ?? entry.team;
    totals.set(gsisId, entry);
  }

  const results: Record<string, PlayerUsage> = {};

  for (const [gsisId, entry] of totals) {
    results[gsisId] = {
      gsisId,
      name: entry.name,
      position: entry.position,
      team: entry.team,
      games: entry.games,
      passAttempts: entry.passAttempts,
      carries: entry.carries,
      targets: entry.targets,
      receptions: entry.receptions,
      passingYards: entry.passingYards,
      passingTds: entry.passingTds,
      interceptions: entry.interceptions,
      rushingYards: entry.rushingYards,
      rushingTds: entry.rushingTds,
      targetShare:
        entry.shareCount > 0 ? entry.shareSum / entry.shareCount : null,
      airYardsShare:
        entry.airCount > 0 ? entry.airSum / entry.airCount : null,
      wopr: entry.woprCount > 0 ? entry.woprSum / entry.woprCount : null,
      epa: Number((entry.epa ?? 0).toFixed(2)),
    };
  }

  return results;
}

/** Strip a name to letters only, so punctuation and case stop mattering. */
const normalizeName = (name: string) =>
  name.toLowerCase().replace(/[^a-z]/g, "");

/**
 * Sleeper player id -> nflverse GSIS id.
 *
 * Neither side publishes the other's key, so this is layered: Sleeper's own
 * `gsis_id` where present, then `espn_id` matched through nflverse's player
 * file, then normalised name plus position. Measured coverage of this league's
 * rosters is roughly 78%, and nearly every miss is a player with no stat line
 * at all - a benched rookie or third-string quarterback.
 *
 * Name matches are dropped when ambiguous rather than guessed at: two players
 * sharing a normalised name and position would otherwise be silently conflated.
 */
export async function getSleeperToGsis(
  season: string,
): Promise<Record<PlayerId, string>> {
  "use cache";
  cacheLife("nflverseData");
  cacheTag(NFLVERSE_TAG, "nflverse:crosswalk", `nflverse:crosswalk:${season}`);

  const [usage, dictionary, ids] = await Promise.all([
    getNflverseUsage(season),
    getAllPlayers(),
    getNflverseIdMaps(),
  ]);

  const active = new Set(Object.keys(usage));
  if (active.size === 0) return {};

  // Name index built from the usage rows themselves, with collisions poisoned.
  const byName = new Map<string, string | null>();
  for (const entry of Object.values(usage)) {
    const key = `${normalizeName(entry.name)}|${entry.position}`;
    byName.set(key, byName.has(key) ? null : entry.gsisId);
  }

  const crosswalk: Record<PlayerId, string> = {};

  for (const [sleeperId, player] of Object.entries(dictionary)) {
    const direct = player.gsisId;
    if (direct && active.has(direct)) {
      crosswalk[sleeperId] = direct;
      continue;
    }

    const espn = player.espnId;
    const viaEspn = espn ? ids.espnToGsis[String(espn)] : undefined;
    if (viaEspn && active.has(viaEspn)) {
      crosswalk[sleeperId] = viaEspn;
      continue;
    }

    const named = byName.get(
      `${normalizeName(player.name)}|${player.position ?? ""}`,
    );
    if (named) crosswalk[sleeperId] = named;
  }

  return crosswalk;
}
