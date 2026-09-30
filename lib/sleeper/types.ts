/**
 * Response shapes for the Sleeper read-only API (https://docs.sleeper.com).
 *
 * Sleeper returns a lot of optional/nullable fields and the `settings` blobs
 * differ per league, so those are typed as open records. Everything a page is
 * likely to render is typed explicitly.
 */

/** Sleeper player ids are strings ("4034"), as are defenses ("KC", "SF"). */
export type PlayerId = string;

/** Roster ids are 1..N within a league and are stable across the season. */
export type RosterId = number;

export type UserId = string;

export type LeagueStatus = "pre_draft" | "drafting" | "in_season" | "complete";

export type SeasonType = "pre" | "regular" | "post" | "off";

/** A roster slot in `roster_positions`, e.g. "QB", "FLEX", "BN", "IDP_FLEX". */
export type RosterPosition = string;

// ---------------------------------------------------------------------------
// GET /state/nfl
// ---------------------------------------------------------------------------

export interface NflState {
  /** Current fantasy week. 0 during the offseason. */
  week: number;
  /** Week Sleeper shows in its UI; can lag `week` between Tue and Thu. */
  display_week: number;
  /** Same as `week`, kept by Sleeper for historical reasons. */
  leg: number;
  season: string;
  season_type: SeasonType;
  season_start_date: string;
  previous_season: string;
  league_season: string;
  league_create_season: string;
  season_has_scores?: boolean;
}

// ---------------------------------------------------------------------------
// GET /league/<league_id>
// ---------------------------------------------------------------------------

/**
 * League rules. Keys vary with league format (dynasty, IDP, taxi squads, ...),
 * so the commonly used ones are typed and the rest stay reachable.
 */
export interface LeagueSettings extends Record<string, number | undefined> {
  num_teams?: number;
  playoff_teams?: number;
  playoff_week_start?: number;
  playoff_type?: number;
  playoff_round_type?: number;
  playoff_seed_type?: number;
  trade_deadline?: number;
  waiver_type?: number;
  waiver_budget?: number;
  waiver_clear_days?: number;
  waiver_day_of_week?: number;
  daily_waivers?: number;
  start_week?: number;
  last_scored_leg?: number;
  leg?: number;
  draft_rounds?: number;
  max_keepers?: number;
  reserve_slots?: number;
  taxi_slots?: number;
  divisions?: number;
  type?: number;
  best_ball?: number;
  disable_trades?: number;
  pick_trading?: number;
}

/** Points awarded per stat, e.g. pass_yd: 0.04, rec: 0.5, rec_td: 6. */
export type ScoringSettings = Record<string, number>;

export interface League {
  league_id: string;
  name: string;
  season: string;
  season_type: string;
  sport: string;
  status: LeagueStatus;
  total_rosters: number;
  avatar: string | null;
  draft_id: string | null;
  /** Last season's league id - the chain used to walk league history. */
  previous_league_id: string | null;
  bracket_id: number | string | null;
  loser_bracket_id: number | string | null;
  bracket_overrides_id?: number | string | null;
  loser_bracket_overrides_id?: number | string | null;
  group_id: string | null;
  company_id: string | null;
  shard: number | null;
  roster_positions: RosterPosition[];
  settings: LeagueSettings;
  scoring_settings: ScoringSettings;
  metadata: Record<string, string> | null;
  last_message_id: string | null;
  last_message_time: number | null;
  last_author_display_name?: string | null;
  last_author_id?: string | null;
  last_read_id?: string | null;
  last_pinned_message_id?: string | null;
}

// ---------------------------------------------------------------------------
// GET /league/<league_id>/rosters
// ---------------------------------------------------------------------------

export interface RosterSettings extends Record<string, number | undefined> {
  wins: number;
  losses: number;
  ties: number;
  /** Points for, integer part. Combine with `fpts_decimal`. */
  fpts: number;
  fpts_decimal?: number;
  fpts_against?: number;
  fpts_against_decimal?: number;
  /** Max points possible with optimal lineups ("potential points"). */
  ppts?: number;
  ppts_decimal?: number;
  total_moves?: number;
  waiver_position?: number;
  waiver_budget_used?: number;
  division?: number;
}

export interface Roster {
  roster_id: RosterId;
  league_id: string;
  /** Null for orphan teams with no manager. */
  owner_id: UserId | null;
  co_owners: UserId[] | null;
  /** Every player on the roster, including bench and IR. */
  players: PlayerId[] | null;
  /** Starting lineup, index-aligned with the starters in `roster_positions`. */
  starters: PlayerId[] | null;
  reserve: PlayerId[] | null;
  taxi: PlayerId[] | null;
  keepers: PlayerId[] | null;
  settings: RosterSettings;
  metadata: Record<string, string | null> | null;
  player_map: Record<PlayerId, unknown> | null;
}

// ---------------------------------------------------------------------------
// GET /league/<league_id>/users
// ---------------------------------------------------------------------------

export interface LeagueUserMetadata
  extends Record<string, string | null | undefined> {
  /** Manager's custom team name. Falls back to `display_name` when unset. */
  team_name?: string | null;
  /** Custom uploaded team avatar id (different from the account `avatar`). */
  avatar?: string | null;
}

export interface LeagueUser {
  user_id: UserId;
  display_name: string;
  /** Sleeper account avatar id; null when the user never set one. */
  avatar: string | null;
  league_id: string;
  is_owner: boolean | null;
  is_bot?: boolean;
  metadata: LeagueUserMetadata | null;
  settings: Record<string, unknown> | null;
}

/** GET /user/<username|user_id> */
export interface SleeperUser {
  user_id: UserId;
  username: string | null;
  display_name: string;
  avatar: string | null;
  metadata?: Record<string, unknown> | null;
  is_bot?: boolean;
  verification?: unknown;
}

// ---------------------------------------------------------------------------
// GET /league/<league_id>/matchups/<week>
// ---------------------------------------------------------------------------

export interface Matchup {
  roster_id: RosterId;
  /**
   * Teams sharing a `matchup_id` played each other. Null when the roster had
   * no opponent that week (bye, or a week outside the schedule).
   */
  matchup_id: number | null;
  points: number;
  /** Commissioner-adjusted score; when set it overrides `points`. */
  custom_points: number | null;
  starters: PlayerId[] | null;
  players: PlayerId[] | null;
  /** Index-aligned with `starters`. Absent on some historical weeks. */
  starters_points?: number[] | null;
  players_points?: Record<PlayerId, number> | null;
}

// ---------------------------------------------------------------------------
// GET /league/<league_id>/transactions/<week>
// ---------------------------------------------------------------------------

export type TransactionType =
  | "trade"
  | "free_agent"
  | "waiver"
  | "commissioner";

export type TransactionStatus = "complete" | "failed" | "pending";

export interface WaiverBudgetTransfer {
  /** Roster id sending FAAB. */
  sender: RosterId;
  /** Roster id receiving FAAB. */
  receiver: RosterId;
  amount: number;
}

export interface Transaction {
  transaction_id: string;
  type: TransactionType;
  status: TransactionStatus;
  /** Fantasy week the move landed in. */
  leg: number;
  created: number;
  status_updated: number;
  creator: UserId;
  /** Every roster involved. Length > 1 means a trade or multi-team move. */
  roster_ids: RosterId[];
  consenter_ids: RosterId[] | null;
  /** Map of player id -> roster id that added the player. */
  adds: Record<PlayerId, RosterId> | null;
  /** Map of player id -> roster id that dropped the player. */
  drops: Record<PlayerId, RosterId> | null;
  draft_picks: TradedPick[];
  waiver_budget: WaiverBudgetTransfer[];
  settings: { waiver_bid?: number; seq?: number } | null;
  metadata: Record<string, string> | null;
}

// ---------------------------------------------------------------------------
// GET /league/<league_id>/traded_picks
// ---------------------------------------------------------------------------

export interface TradedPick {
  season: string;
  round: number;
  /** Roster the pick originally belonged to. */
  roster_id: RosterId;
  previous_owner_id: RosterId | null;
  /** Roster that holds the pick now. */
  owner_id: RosterId;
}

// ---------------------------------------------------------------------------
// GET /league/<league_id>/winners_bracket | /losers_bracket
// ---------------------------------------------------------------------------

/** Points at another match: `w` = its winner, `l` = its loser. */
export type BracketSource = { w: number } | { l: number };

export interface BracketMatchup {
  /** Round number, 1-indexed. */
  r: number;
  /** Match id, unique within the bracket. */
  m: number;
  /** Roster id, or null until the feeding match resolves. */
  t1: RosterId | null;
  t2: RosterId | null;
  t1_from?: BracketSource | null;
  t2_from?: BracketSource | null;
  /** Winner / loser roster ids; null while the game is unplayed. */
  w: RosterId | null;
  l: RosterId | null;
  /** Final placement decided by this match (1 = championship). */
  p?: number | null;
}

export type Bracket = BracketMatchup[];

// ---------------------------------------------------------------------------
// GET /league/<league_id>/drafts, GET /draft/<draft_id>, /draft/<id>/picks
// ---------------------------------------------------------------------------

export type DraftType = "snake" | "linear" | "auction";

export type DraftStatus = "pre_draft" | "drafting" | "paused" | "complete";

export interface Draft {
  draft_id: string;
  league_id: string;
  type: DraftType;
  status: DraftStatus;
  sport: string;
  season: string;
  season_type: string;
  start_time: number | null;
  created: number;
  /** Map of user id -> draft slot. Null before the order is set. */
  draft_order?: Record<UserId, number> | null;
  /** Map of draft slot -> roster id. Absent on auction drafts. */
  slot_to_roster_id?: Record<string, RosterId> | null;
  settings: Record<string, number> & { rounds?: number; teams?: number };
  metadata: Record<string, string> | null;
  creators: UserId[] | null;
  last_picked: number | null;
  last_message_id: string | null;
  last_message_time: number | null;
}

export interface DraftPickMetadata extends Record<string, string | undefined> {
  first_name?: string;
  last_name?: string;
  position?: string;
  team?: string;
  status?: string;
  injury_status?: string;
  number?: string;
  years_exp?: string;
  /** Auction leagues only: winning bid, in dollars. */
  amount?: string;
  /** Draft slot, as a string. */
  slot?: string;
  player_id?: string;
  sport?: string;
  news_updated?: string;
}

export interface DraftPick {
  draft_id: string;
  player_id: PlayerId;
  /** Overall pick number, 1-indexed. */
  pick_no: number;
  round: number;
  /** Column in the draft board, 1-indexed. */
  draft_slot: number;
  roster_id: RosterId | null;
  /** Empty string when the pick was autodrafted. */
  picked_by: UserId | "";
  is_keeper: boolean | null;
  metadata: DraftPickMetadata | null;
  reactions?: unknown;
}

// ---------------------------------------------------------------------------
// GET /players/nfl
// ---------------------------------------------------------------------------

export interface Player {
  player_id: PlayerId;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  /** Primary position. Null for a handful of malformed records. */
  position: string | null;
  /** Positions the player is eligible at for fantasy purposes. */
  fantasy_positions: string[] | null;
  /** NFL team abbreviation, or null for free agents. */
  team: string | null;
  status: string | null;
  injury_status: string | null;
  injury_body_part?: string | null;
  injury_notes?: string | null;
  number: number | null;
  age: number | null;
  years_exp: number | null;
  height: string | null;
  weight: string | null;
  college: string | null;
  birth_date: string | null;
  active: boolean;
  depth_chart_position: string | null;
  depth_chart_order: number | null;
  search_rank: number | null;
  search_full_name: string | null;
  hashtag: string | null;
  news_updated: number | null;
  espn_id?: number | null;
  yahoo_id?: number | null;
  gsis_id?: string | null;
  sportradar_id?: string | null;
  rotowire_id?: number | null;
  fantasy_data_id?: number | null;
  stats_id?: number | null;
  metadata?: Record<string, string> | null;
}

/** The full dictionary, keyed by player id. */
export type PlayerMap = Record<PlayerId, Player>;

/**
 * Trimmed player record kept in the daily cache. The raw payload is ~5MB and
 * most of it (external ids, bio text) is never rendered, so `./players` stores
 * only these fields.
 */
export interface PlayerLite {
  player_id: PlayerId;
  name: string;
  position: string | null;
  fantasy_positions: string[] | null;
  team: string | null;
  status: string | null;
  injury_status: string | null;
  number: number | null;
  years_exp: number | null;
  age: number | null;
  search_rank: number | null;
  active: boolean;
  /**
   * External ids kept for joining to nflverse, which keys on GSIS. Sleeper
   * populates `gsis_id` for only about a third of its dictionary, so espn_id
   * serves as a fallback.
   */
  gsisId: string | null;
  espnId: number | null;
}

export type PlayerLiteMap = Record<PlayerId, PlayerLite>;
