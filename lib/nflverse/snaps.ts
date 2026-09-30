import { cacheLife, cacheTag } from "next/cache";

import { fetchCsv, NFLVERSE_RELEASE, num } from "./csv";
import { getNflverseIdMaps } from "./ids";

/**
 * Snap share from nflverse.
 *
 * The leading indicator the usage table cannot give you. Target share says
 * what a player's role *is*; snap share says where it is *going*. A receiver
 * climbing from 40% to 65% of his offense's snaps is about to matter, and that
 * shows up a week or two before the targets follow.
 *
 * `snap_counts` keys on Pro Football Reference ids rather than GSIS, so it is
 * bridged through the player file - see {@link getNflverseIdMaps}.
 *
 * Source: nflverse-data `snap_counts` release, CC BY 4.0.
 */

export interface SnapWeek {
  week: number;
  snaps: number;
  /** Share of the team's offensive snaps, 0-1. */
  pct: number;
}

export interface SnapShare {
  gsisId: string;
  name: string;
  position: string;
  team: string;
  /** Ascending by week. */
  weeks: SnapWeek[];
  totalSnaps: number;
  /** Mean weekly share across the season. */
  seasonPct: number;
  latestWeek: number;
  latestPct: number;
  /**
   * The latest week against the mean of the weeks before it, in share points.
   * Null until there is something to compare against.
   *
   * Measured from the latest week rather than a two-week window so the number
   * always agrees with the right-hand end of the sparkline. A window average
   * could report a rise while the most recent game was a fall, which reads as
   * a bug even when the arithmetic is right.
   */
  trend: number | null;
}

const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

export async function getSnapShares(
  season: string,
): Promise<Record<string, SnapShare>> {
  "use cache";
  cacheLife("nflverseData");
  cacheTag("nflverse:snaps", `nflverse:snaps:${season}`);

  const [table, ids] = await Promise.all([
    fetchCsv(`${NFLVERSE_RELEASE}/snap_counts/snap_counts_${season}.csv`),
    getNflverseIdMaps(),
  ]);
  if (!table) return {};

  const at = (row: string[], column: string) => row[table.index(column)];

  interface Accumulator {
    gsisId: string;
    name: string;
    position: string;
    team: string;
    weeks: SnapWeek[];
  }

  const byPlayer = new Map<string, Accumulator>();

  for (const row of table.rows) {
    if (row.length < table.header.length) continue;

    const pfrId = at(row, "pfr_player_id");
    if (!pfrId) continue;

    const gsisId = ids.pfrToGsis[pfrId];
    // Without a GSIS id the row cannot be joined to anything else.
    if (!gsisId) continue;

    const week = num(at(row, "week"));
    const pct = num(at(row, "offense_pct"));
    const snaps = num(at(row, "offense_snaps"));
    if (week === null || pct === null) continue;

    const entry =
      byPlayer.get(gsisId) ??
      {
        gsisId,
        name: at(row, "player") ?? "",
        position: at(row, "position") ?? "",
        team: at(row, "team") ?? "",
        weeks: [],
      };

    entry.weeks.push({ week, snaps: snaps ?? 0, pct });
    // Most recent team wins, so a mid-season move reads correctly.
    entry.team = at(row, "team") ?? entry.team;
    byPlayer.set(gsisId, entry);
  }

  const results: Record<string, SnapShare> = {};

  for (const [gsisId, entry] of byPlayer) {
    const weeks = [...entry.weeks].sort((a, b) => a.week - b.week);
    if (weeks.length === 0) continue;

    const shares = weeks.map((w) => w.pct);
    const latest = weeks[weeks.length - 1];

    // Needs at least one earlier week to compare the latest one against.
    const earlier = shares.slice(0, -1);
    const trend =
      earlier.length > 0
        ? Number((latest.pct - mean(earlier)).toFixed(3))
        : null;

    results[gsisId] = {
      gsisId,
      name: entry.name,
      position: entry.position,
      team: entry.team,
      weeks,
      totalSnaps: weeks.reduce((sum, w) => sum + w.snaps, 0),
      seasonPct: Number(mean(shares).toFixed(3)),
      latestWeek: latest.week,
      latestPct: latest.pct,
      trend,
    };
  }

  return results;
}
