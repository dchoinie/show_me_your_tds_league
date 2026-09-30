import type { ScoringSettings } from "./types";

/**
 * Applying a league's scoring settings to a stat line.
 *
 * Sleeper's stat and projection payloads use the same keys as a league's
 * `scoring_settings`, so a fantasy total is the dot product of the two. That
 * is what makes custom scoring work without special cases: this league's
 * `bonus_rec_te: 0.5` lines up with a `bonus_rec_te` stat holding a tight
 * end's reception count, so the TE premium falls out of the same multiply.
 *
 * Verified against Sleeper's own `pts_ppr` projections: mean absolute
 * difference of 0.17 points across 306 projected players.
 */

/**
 * Projections bucket a few kicking stats differently from how leagues score
 * them - projections carry `fgm_50p` and split `fgmiss_*` buckets, while
 * leagues score `fgm_50_59`/`fgm_60p` and a flat `fgmiss`. Without these,
 * kickers under-score by about two points.
 */
const STAT_ALIASES: Record<string, string> = {
  fgm_50p: "fgm_50_59",
  fgmiss_30_39: "fgmiss",
  fgmiss_40_49: "fgmiss",
  fgmiss_50p: "fgmiss",
};

/**
 * Fantasy points for one stat line under one league's scoring.
 *
 * Keys the league does not score (`adp_dd_ppr`, `gp`, `pass_att`, …) are
 * ignored, since the sum only walks scoring settings.
 *
 * Known gap: team defenses. Projections report a raw `pts_allow`, while
 * leagues score bucketed `pts_allow_0`/`pts_allow_1_6`/… so a defense's
 * points-allowed bonus is not projected. Harmless here, as this league has no
 * DEF or K starting slot.
 */
export function scoreStatLine(
  stats: Record<string, number> | null | undefined,
  scoring: ScoringSettings,
): number {
  if (!stats) return 0;

  let total = 0;

  for (const [key, weight] of Object.entries(scoring)) {
    const value = stats[key];
    if (typeof value === "number") total += value * weight;
  }

  for (const [statKey, scoringKey] of Object.entries(STAT_ALIASES)) {
    // Skip when the league scores the projection's own key directly, or the
    // main loop above already counted it.
    if (statKey in scoring) continue;
    const value = stats[statKey];
    const weight = scoring[scoringKey];
    if (typeof value === "number" && typeof weight === "number") {
      total += value * weight;
    }
  }

  return total;
}
