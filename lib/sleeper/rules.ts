import { cacheLife, cacheTag } from "next/cache";

import { getLeague } from "./api";
import { CACHE_TAGS, LEAGUE_ID } from "./config";
import type { League } from "./types";

/**
 * League rules, derived from Sleeper's own settings.
 *
 * Everything here is read live, so the rules page can never drift from what
 * the league is actually configured to do. The prose half of the page lives
 * in content/constitution.md.
 */

export interface ScoringRule {
  key: string;
  label: string;
  value: number;
}

export interface ScoringGroup {
  title: string;
  rules: ScoringRule[];
  /**
   * False when no starting slot can hold the position this group scores, so
   * the page can mark it as configured-but-unused rather than hiding it.
   */
  applies: boolean;
}

export interface RosterSlotCount {
  slot: string;
  label: string;
  count: number;
}

export interface LeagueRules {
  startingSlots: RosterSlotCount[];
  startersTotal: number;
  benchSlots: number;
  taxiSlots: number;
  taxiYears: number | null;
  reserveSlots: number;
  /** Starters + bench: the active roster limit. */
  activeRoster: number;
  /**
   * Active roster plus the taxi squad - the number of players a team can hold
   * at once. IR is excluded, since those slots sit outside the roster limit.
   */
  totalRoster: number;
  faabBudget: number;
  waiverType: string;
  waiverClearDays: number | null;
  tradeDeadlineWeek: number | null;
  playoffTeams: number | null;
  playoffWeekStart: number | null;
  scoring: ScoringGroup[];
}

const SLOT_LABELS: Record<string, string> = {
  QB: "Quarterback",
  RB: "Running back",
  WR: "Wide receiver",
  TE: "Tight end",
  K: "Kicker",
  DEF: "Team defense",
  FLEX: "Flex (RB/WR/TE)",
  SUPER_FLEX: "Superflex (QB/RB/WR/TE)",
  REC_FLEX: "Flex (WR/TE)",
  WRRB_FLEX: "Flex (WR/RB)",
  IDP_FLEX: "IDP flex",
  BN: "Bench",
  IR: "Injured reserve",
  TAXI: "Taxi squad",
};

const SCORING_LABELS: Record<string, string> = {
  pass_yd: "Passing yards",
  pass_td: "Passing touchdown",
  pass_int: "Interception thrown",
  pass_2pt: "2-point conversion (pass)",
  rush_yd: "Rushing yards",
  rush_td: "Rushing touchdown",
  rush_2pt: "2-point conversion (rush)",
  rec: "Reception",
  rec_yd: "Receiving yards",
  rec_td: "Receiving touchdown",
  rec_2pt: "2-point conversion (reception)",
  bonus_rec_te: "Tight end reception bonus",
  fum: "Fumble",
  fum_lost: "Fumble lost",
  fum_rec: "Fumble recovered",
  fum_rec_td: "Fumble recovery touchdown",
  fgm_0_19: "Field goal 0-19 yards",
  fgm_20_29: "Field goal 20-29 yards",
  fgm_30_39: "Field goal 30-39 yards",
  fgm_40_49: "Field goal 40-49 yards",
  fgm_50_59: "Field goal 50-59 yards",
  fgm_60p: "Field goal 60+ yards",
  fgmiss: "Field goal missed",
  xpm: "Extra point made",
  xpmiss: "Extra point missed",
  def_td: "Defensive touchdown",
  def_st_td: "Defense / special teams touchdown",
  def_st_ff: "Defense / special teams forced fumble",
  def_st_fum_rec: "Defense / special teams fumble recovery",
  st_td: "Special teams touchdown",
  st_ff: "Special teams forced fumble",
  st_fum_rec: "Special teams fumble recovery",
  sack: "Sack",
  int: "Interception",
  ff: "Forced fumble",
  safe: "Safety",
  blk_kick: "Blocked kick",
  pts_allow_0: "Points allowed: 0",
  pts_allow_1_6: "Points allowed: 1-6",
  pts_allow_7_13: "Points allowed: 7-13",
  pts_allow_14_20: "Points allowed: 14-20",
  pts_allow_21_27: "Points allowed: 21-27",
  pts_allow_28_34: "Points allowed: 28-34",
  pts_allow_35p: "Points allowed: 35+",
};

/** Turns an unmapped key like `pass_fd` into "Pass fd" so nothing is hidden. */
function prettify(key: string): string {
  const spaced = key.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Scoring keys, in the order each group should list them. */
const SCORING_GROUPS: { title: string; keys: string[]; requires?: string }[] = [
  {
    title: "Passing",
    keys: ["pass_yd", "pass_td", "pass_2pt", "pass_int"],
  },
  {
    title: "Rushing",
    keys: ["rush_yd", "rush_td", "rush_2pt"],
  },
  {
    title: "Receiving",
    keys: ["rec", "rec_yd", "rec_td", "rec_2pt", "bonus_rec_te"],
  },
  {
    title: "Fumbles",
    keys: ["fum", "fum_lost", "fum_rec", "fum_rec_td"],
  },
  {
    title: "Kicking",
    keys: [
      "fgm_0_19",
      "fgm_20_29",
      "fgm_30_39",
      "fgm_40_49",
      "fgm_50_59",
      "fgm_60p",
      "fgmiss",
      "xpm",
      "xpmiss",
    ],
    requires: "K",
  },
  {
    title: "Defense & special teams",
    keys: [
      "sack",
      "int",
      "ff",
      "fum_rec",
      "safe",
      "blk_kick",
      "def_td",
      "def_st_td",
      "def_st_ff",
      "def_st_fum_rec",
      "st_td",
      "st_ff",
      "st_fum_rec",
      "pts_allow_0",
      "pts_allow_1_6",
      "pts_allow_7_13",
      "pts_allow_14_20",
      "pts_allow_21_27",
      "pts_allow_28_34",
      "pts_allow_35p",
    ],
    requires: "DEF",
  },
];

const WAIVER_TYPES: Record<number, string> = {
  0: "Rolling waivers",
  1: "Reverse standings",
  2: "FAAB blind bidding",
};

function buildScoring(league: League): ScoringGroup[] {
  const scoring = league.scoring_settings;
  const slots = new Set(league.roster_positions);
  const claimed = new Set<string>();

  const groups = SCORING_GROUPS.map(({ title, keys, requires }) => {
    const rules = keys
      .filter((key) => typeof scoring[key] === "number")
      .map((key) => {
        claimed.add(key);
        return {
          key,
          label: SCORING_LABELS[key] ?? prettify(key),
          value: scoring[key],
        };
      });

    return {
      title,
      rules,
      applies: requires === undefined || slots.has(requires),
    };
  }).filter((group) => group.rules.length > 0);

  // Anything the league scores that no group claimed, so a custom setting is
  // never silently dropped from the page.
  const rest = Object.keys(scoring)
    .filter((key) => !claimed.has(key))
    .sort()
    .map((key) => ({
      key,
      label: SCORING_LABELS[key] ?? prettify(key),
      value: scoring[key],
    }));

  if (rest.length > 0) {
    groups.push({ title: "Other", rules: rest, applies: true });
  }

  return groups;
}

export async function getLeagueRules(
  leagueId: string = LEAGUE_ID,
): Promise<LeagueRules> {
  "use cache";
  cacheLife("sleeperLeague");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.league(leagueId));

  const league = await getLeague(leagueId);
  const settings = league.settings;

  // Count starting slots in the order the league lists them.
  const counts = new Map<string, number>();
  let bench = 0;

  for (const slot of league.roster_positions) {
    if (slot === "BN") {
      bench += 1;
      continue;
    }
    if (slot === "IR" || slot === "TAXI") continue;
    counts.set(slot, (counts.get(slot) ?? 0) + 1);
  }

  const startingSlots = [...counts.entries()].map(([slot, count]) => ({
    slot,
    label: SLOT_LABELS[slot] ?? slot,
    count,
  }));

  const startersTotal = startingSlots.reduce(
    (total, entry) => total + entry.count,
    0,
  );

  const taxiSlots = settings.taxi_slots ?? 0;

  return {
    startingSlots,
    startersTotal,
    benchSlots: bench,
    taxiSlots,
    taxiYears: settings.taxi_years ?? null,
    reserveSlots: settings.reserve_slots ?? 0,
    activeRoster: startersTotal + bench,
    totalRoster: startersTotal + bench + taxiSlots,
    faabBudget: settings.waiver_budget ?? 0,
    waiverType:
      WAIVER_TYPES[settings.waiver_type ?? -1] ?? "Waivers",
    waiverClearDays: settings.waiver_clear_days ?? null,
    tradeDeadlineWeek: settings.trade_deadline ?? null,
    playoffTeams: settings.playoff_teams ?? null,
    playoffWeekStart: settings.playoff_week_start ?? null,
    scoring: buildScoring(league),
  };
}
