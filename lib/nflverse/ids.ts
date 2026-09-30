import { cacheLife, cacheTag } from "next/cache";

import { NFLVERSE_RELEASE, NFLVERSE_TAG, fetchCsv } from "./csv";

/**
 * Cross-reference between the id schemes nflverse publishes.
 *
 * Its releases do not all key the same way - `stats_player` uses GSIS ids
 * while `snap_counts` uses Pro Football Reference ids - so joining them needs
 * the player file as a bridge. Extracted into its own cached reader so the
 * 7MB download happens once per window rather than once per consumer.
 */

export interface NflverseIdMaps {
  /** ESPN id -> GSIS id. */
  espnToGsis: Record<string, string>;
  /** Pro Football Reference id -> GSIS id. */
  pfrToGsis: Record<string, string>;
}

export async function getNflverseIdMaps(): Promise<NflverseIdMaps> {
  "use cache";
  cacheLife("nflverseData");
  cacheTag(NFLVERSE_TAG, "nflverse:ids");

  const table = await fetchCsv(`${NFLVERSE_RELEASE}/players/players.csv`);
  if (!table) return { espnToGsis: {}, pfrToGsis: {} };

  const at = (row: string[], column: string) => row[table.index(column)];

  const espnToGsis: Record<string, string> = {};
  const pfrToGsis: Record<string, string> = {};

  for (const row of table.rows) {
    const gsis = at(row, "gsis_id");
    if (!gsis) continue;

    const espn = at(row, "espn_id");
    if (espn) espnToGsis[String(espn)] = gsis;

    const pfr = at(row, "pfr_id");
    if (pfr) pfrToGsis[String(pfr)] = gsis;
  }

  return { espnToGsis, pfrToGsis };
}
