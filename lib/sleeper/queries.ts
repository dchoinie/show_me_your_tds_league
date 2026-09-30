import { cacheLife, cacheTag } from "next/cache";

import {
  getAllTransactions,
  getCurrentWeek,
  getLeague,
  getLeagueUsers,
  getMatchups,
  getRosters,
  getWeekStatus,
  type WeekStatus,
} from "./api";
import { CACHE_TAGS, LEAGUE_ID, MAX_FANTASY_WEEK } from "./config";
import { getPlayers } from "./players";
import { getProjectedPoints, sumProjected } from "./projections";
import type {
  League,
  LeagueUser,
  Matchup,
  PlayerId,
  PlayerLite,
  Roster,
  RosterId,
  Transaction,
  TransactionType,
  UserId,
} from "./types";
import { userAvatarUrl } from "./urls";

/**
 * Page-ready views over the raw Sleeper endpoints.
 *
 * The API in `./api` mirrors Sleeper one-to-one; this module does the joins
 * every page would otherwise repeat - rosters to owners, matchups to teams,
 * transactions to player names.
 */

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export interface Team {
  rosterId: RosterId;
  ownerId: UserId | null;
  coOwnerIds: UserId[];
  /** Custom team name, falling back to the manager's display name. */
  teamName: string;
  /** The manager's Sleeper display name. */
  managerName: string;
  avatarUrl: string | null;
  /** Sleeper flags commissioners with `is_owner`; the field is tri-state. */
  isCommissioner: boolean;
  wins: number;
  losses: number;
  ties: number;
  /** Wins + half-ties over games played; 0 before the first game. */
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Points available with a perfect lineup each week. */
  potentialPoints: number;
  division: number | null;
  totalMoves: number;
  waiverPosition: number | null;
  waiverBudgetUsed: number;
}

/**
 * Who is actually on a roster, kept separate from {@link Team}.
 *
 * Membership changes the instant anyone adds, drops or trades, while a team's
 * identity and record change weekly at most. Folding them together meant every
 * cache holding a Team - standings, schedules, draft analysis - also held a
 * roster, and served it at whatever lifetime that cache happened to use. This
 * split lets each be cached on its own clock.
 */
export interface RosterMembership {
  rosterId: RosterId;
  /** Everyone on the roster, taxi and IR included. */
  playerIds: PlayerId[];
  /** Index-aligned with the league's starting slots. */
  starterIds: PlayerId[];
  reserveIds: PlayerId[];
  taxiIds: PlayerId[];
}

/** Sleeper splits scores into whole points and hundredths. */
function combinePoints(whole = 0, decimal = 0): number {
  return Number((whole + decimal / 100).toFixed(2));
}

function buildTeam(roster: Roster, user: LeagueUser | undefined): Team {
  const settings = roster.settings;
  const games = settings.wins + settings.losses + settings.ties;
  const managerName = user?.display_name ?? "Orphan team";

  return {
    rosterId: roster.roster_id,
    ownerId: roster.owner_id,
    coOwnerIds: roster.co_owners ?? [],
    teamName: user?.metadata?.team_name?.trim() || managerName,
    managerName,
    avatarUrl: user ? userAvatarUrl(user) : null,
    isCommissioner: user?.is_owner === true,
    wins: settings.wins,
    losses: settings.losses,
    ties: settings.ties,
    winPct: games === 0 ? 0 : (settings.wins + settings.ties / 2) / games,
    pointsFor: combinePoints(settings.fpts, settings.fpts_decimal),
    pointsAgainst: combinePoints(
      settings.fpts_against,
      settings.fpts_against_decimal,
    ),
    potentialPoints: combinePoints(settings.ppts, settings.ppts_decimal),
    division: settings.division ?? null,
    totalMoves: settings.total_moves ?? 0,
    waiverPosition: settings.waiver_position ?? null,
    waiverBudgetUsed: settings.waiver_budget_used ?? 0,
  };
}

/**
 * Every team in the league, rosters joined to their managers.
 *
 * Identity and record only - see {@link getRosterMembership} for who is on
 * each roster. That separation is what lets this sit on the calmer
 * league-settings clock without ever serving a stale roster.
 */
export async function getTeams(leagueId: string = LEAGUE_ID): Promise<Team[]> {
  "use cache";
  cacheLife("sleeperLeague");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.rosters(leagueId));

  const [rosters, users] = await Promise.all([
    getRosters(leagueId),
    getLeagueUsers(leagueId),
  ]);

  const usersById = new Map(users.map((user) => [user.user_id, user]));

  return rosters
    .map((roster) =>
      buildTeam(roster, roster.owner_id ? usersById.get(roster.owner_id) : undefined),
    )
    .sort((a, b) => a.rosterId - b.rosterId);
}

/**
 * Who is on each roster right now, keyed by roster id.
 *
 * Cached on the roster clock, so anything rendering a roster gets minute-fresh
 * data no matter how long-lived the cache that fetched the team alongside it.
 */
export async function getRosterMembership(
  leagueId: string = LEAGUE_ID,
): Promise<Record<RosterId, RosterMembership>> {
  "use cache";
  cacheLife("sleeperRoster");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.rosters(leagueId));

  const rosters = await getRosters(leagueId);
  const membership: Record<RosterId, RosterMembership> = {};

  for (const roster of rosters) {
    membership[roster.roster_id] = {
      rosterId: roster.roster_id,
      playerIds: roster.players ?? [],
      starterIds: roster.starters ?? [],
      reserveIds: roster.reserve ?? [],
      taxiIds: roster.taxi ?? [],
    };
  }

  return membership;
}

/** Index teams by roster id, the key Sleeper uses in matchups and brackets. */
export function indexTeams(teams: Team[]): Map<RosterId, Team> {
  return new Map(teams.map((team) => [team.rosterId, team]));
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

export interface StandingsRow extends Team {
  /** 1-indexed league rank. */
  rank: number;
}

/**
 * League standings: record first, then points for as the tiebreaker.
 *
 * This matches Sleeper's default ordering. Leagues using divisions or
 * head-to-head tiebreakers may differ during the regular season.
 */
export async function getStandings(
  leagueId: string = LEAGUE_ID,
): Promise<StandingsRow[]> {
  "use cache";
  cacheLife("sleeperLeague");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.rosters(leagueId));

  const teams = await getTeams(leagueId);

  return [...teams]
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.ties !== a.ties) return b.ties - a.ties;
      return b.pointsFor - a.pointsFor;
    })
    .map((team, index) => ({ ...team, rank: index + 1 }));
}

// ---------------------------------------------------------------------------
// Weekly matchups
// ---------------------------------------------------------------------------

export interface MatchupSide {
  team: Team;
  points: number;
  /**
   * Projected total for the starting lineup, or null when Sleeper has no
   * projection for any starter.
   */
  projectedPoints: number | null;
  starterIds: PlayerId[];
  /** Index-aligned with `starterIds`; empty when Sleeper omits it. */
  starterPoints: number[];
  playerPoints: Record<PlayerId, number>;
}

export interface WeekMatchup {
  /**
   * Stable key for this game. `matchupId` is null for an unpaired roster, so
   * byes fall back to their roster id rather than colliding on null.
   */
  id: string;
  matchupId: number | null;
  /** Drives the card state: records, live scores, or a final. */
  status: WeekStatus;
  /** Both sides of the game. Length 1 for a bye or an unpaired roster. */
  sides: MatchupSide[];
  /** Highest scorer of the pair; null while both are at zero. */
  winnerRosterId: RosterId | null;
  isTie: boolean;
  /** Absolute points difference between the two sides. */
  margin: number;
}

function toSide(
  matchup: Matchup,
  team: Team,
  projections: Record<PlayerId, number>,
): MatchupSide {
  const starterIds = matchup.starters ?? [];

  return {
    team,
    // custom_points is a commissioner override and wins when present.
    points: matchup.custom_points ?? matchup.points ?? 0,
    projectedPoints: sumProjected(starterIds, projections),
    starterIds,
    starterPoints: matchup.starters_points ?? [],
    playerPoints: matchup.players_points ?? {},
  };
}

/** One week's games, paired up and joined to team info. */
export async function getWeekMatchups(
  week: number,
  leagueId: string = LEAGUE_ID,
): Promise<WeekMatchup[]> {
  "use cache";
  cacheLife("sleeperLive");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.matchups(leagueId, week));

  const [matchups, teams, projections] = await Promise.all([
    getMatchups(week, leagueId),
    getTeams(leagueId),
    getProjectedPoints(week, leagueId),
  ]);

  // Any points at all means the week has kicked off. Before kickoff Sleeper
  // reports every score as 0, which would otherwise render as a 0-0 "final".
  const hasScores = matchups.some(
    (matchup) => (matchup.custom_points ?? matchup.points ?? 0) > 0,
  );
  const status = await getWeekStatus(week, hasScores);

  const teamsByRoster = indexTeams(teams);
  const groups = new Map<string, Matchup[]>();

  for (const matchup of matchups) {
    // Rosters without a matchup_id had no opponent; keep them separate.
    const key =
      matchup.matchup_id === null
        ? `bye-${matchup.roster_id}`
        : String(matchup.matchup_id);
    const group = groups.get(key);
    if (group) group.push(matchup);
    else groups.set(key, [matchup]);
  }

  const result: WeekMatchup[] = [];

  for (const [groupKey, group] of groups) {
    const sides = group
      .map((matchup) => {
        const team = teamsByRoster.get(matchup.roster_id);
        return team ? toSide(matchup, team, projections) : null;
      })
      .filter((side): side is MatchupSide => side !== null);

    if (sides.length === 0) continue;

    const [first, second] = sides;
    // Before kickoff every score is 0, which is not a tie - it is no result.
    const scored = status !== "preview" && sides.length === 2;
    const isTie = scored && first.points === second.points;
    const leader =
      scored && !isTie ? (first.points > second.points ? first : second) : null;

    result.push({
      id: groupKey,
      matchupId: group[0].matchup_id,
      status,
      sides,
      winnerRosterId: leader?.team.rosterId ?? null,
      isTie,
      // Rounded because subtracting two decimal scores drifts (46.2600000001).
      margin: scored
        ? Number(Math.abs(first.points - second.points).toFixed(2))
        : 0,
    });
  }

  return result.sort((a, b) => (a.matchupId ?? 99) - (b.matchupId ?? 99));
}

/**
 * The week the score strip should show, and its games.
 *
 * Between Tuesday and Thursday kickoff the current week exists but has no
 * scores, so a ticker pointed at it would read "0.00 vs 0.00" for days. This
 * falls back to the most recent week that actually has results, and flips
 * forward on its own once the new week kicks off.
 */
export async function getScoreStrip(
  leagueId: string = LEAGUE_ID,
): Promise<{ week: number; matchups: WeekMatchup[] }> {
  "use cache";
  cacheLife("sleeperLive");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.league(leagueId));

  const current = await getCurrentWeek();
  const currentMatchups = await getWeekMatchups(current, leagueId);

  const kickedOff = currentMatchups.some(
    (matchup) => matchup.status !== "preview",
  );
  if (kickedOff || current <= 1) {
    return { week: current, matchups: currentMatchups };
  }

  const previous = await getWeekMatchups(current - 1, leagueId);
  return previous.length > 0
    ? { week: current - 1, matchups: previous }
    : { week: current, matchups: currentMatchups };
}

/** Shorthand for the week currently in progress. */
export async function getCurrentWeekMatchups(
  leagueId: string = LEAGUE_ID,
): Promise<{ week: number; matchups: WeekMatchup[] }> {
  "use cache";
  cacheLife("sleeperLive");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.league(leagueId));

  const week = await getCurrentWeek();
  return { week, matchups: await getWeekMatchups(week, leagueId) };
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

/**
 * Compact team reference.
 *
 * Activity lists are filtered in the browser, so they ship to the client -
 * and a full `Team` carries every player id on the roster. This is the subset
 * the UI actually renders.
 */
export interface TeamRef {
  rosterId: RosterId;
  teamName: string;
  managerName: string;
  avatarUrl: string | null;
}

function toTeamRef(team: Team): TeamRef {
  return {
    rosterId: team.rosterId,
    teamName: team.teamName,
    managerName: team.managerName,
    avatarUrl: team.avatarUrl,
  };
}

export interface TransactionMove {
  playerId: PlayerId;
  playerName: string;
  position: string | null;
  /** NFL team abbreviation, or null for free agents. */
  nflTeam: string | null;
  /** The fantasy team on the other end of the move. */
  team: TeamRef | null;
}

/** A draft pick changing hands. */
export interface ActivityPick {
  season: string;
  round: number;
  /** Whose pick it originally was - the detail that matters in dynasty. */
  originalTeam: TeamRef | null;
  toTeam: TeamRef | null;
}

/** One side of a trade: everything this team walked away with. */
export interface TradeSide {
  team: TeamRef;
  players: TransactionMove[];
  picks: ActivityPick[];
  /** FAAB received, in dollars. */
  faab: number;
}

export interface ActivityItem {
  id: string;
  type: TransactionType;
  status: Transaction["status"];
  week: number;
  /** Unix ms, as Sleeper reports it. */
  createdAt: number;
  teams: TeamRef[];
  adds: TransactionMove[];
  drops: TransactionMove[];
  /** Winning FAAB bid, for waiver claims. */
  waiverBid: number | null;
  /** Populated for trades only, one entry per team involved. */
  tradeSides: TradeSide[];
}

/**
 * Every completed transaction this season, newest first, with players, teams
 * and draft picks resolved.
 *
 * Trades are additionally split into per-team `tradeSides`, since "what did
 * each side get" is the only useful way to read a trade.
 */
export async function getActivity(
  leagueId: string = LEAGUE_ID,
): Promise<ActivityItem[]> {
  "use cache";
  cacheLife("sleeperLive");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.league(leagueId));

  const [transactions, teams] = await Promise.all([
    getAllTransactions(leagueId),
    getTeams(leagueId),
  ]);

  const completed = transactions.filter(
    (transaction) => transaction.status === "complete",
  );

  const playerIds = new Set<PlayerId>();
  for (const transaction of completed) {
    for (const id of Object.keys(transaction.adds ?? {})) playerIds.add(id);
    for (const id of Object.keys(transaction.drops ?? {})) playerIds.add(id);
  }

  const players = await getPlayers([...playerIds]);
  const teamsByRoster = indexTeams(teams);

  const refFor = (rosterId: RosterId): TeamRef | null => {
    const team = teamsByRoster.get(rosterId);
    return team ? toTeamRef(team) : null;
  };

  const toMoves = (
    map: Record<PlayerId, RosterId> | null,
  ): TransactionMove[] =>
    Object.entries(map ?? {}).map(([playerId, rosterId]) => {
      const player = players[playerId];
      return {
        playerId,
        playerName: player?.name ?? playerId,
        position: player?.position ?? null,
        nflTeam: player?.team ?? null,
        team: refFor(rosterId),
      };
    });

  return completed.map((transaction) => {
    const adds = toMoves(transaction.adds);
    const drops = toMoves(transaction.drops);

    // Only trades need per-side bundles; a waiver claim is just an add.
    const tradeSides: TradeSide[] =
      transaction.type === "trade"
        ? transaction.roster_ids.flatMap((rosterId) => {
            const team = refFor(rosterId);
            if (!team) return [];

            return [
              {
                team,
                players: adds.filter(
                  (move) => move.team?.rosterId === rosterId,
                ),
                picks: (transaction.draft_picks ?? [])
                  .filter((pick) => pick.owner_id === rosterId)
                  .map((pick) => ({
                    season: pick.season,
                    round: pick.round,
                    originalTeam: refFor(pick.roster_id),
                    toTeam: refFor(pick.owner_id),
                  })),
                faab: (transaction.waiver_budget ?? [])
                  .filter((transfer) => transfer.receiver === rosterId)
                  .reduce((sum, transfer) => sum + transfer.amount, 0),
              },
            ];
          })
        : [];

    return {
      id: transaction.transaction_id,
      type: transaction.type,
      status: transaction.status,
      week: transaction.leg,
      createdAt: transaction.created,
      teams: transaction.roster_ids
        .map(refFor)
        .filter((team): team is TeamRef => team !== null),
      adds,
      drops,
      waiverBid: transaction.settings?.waiver_bid ?? null,
      tradeSides,
    };
  });
}

/** The newest slice of {@link getActivity}, for home page rails. */
export async function getRecentActivity(
  limit = 25,
  leagueId: string = LEAGUE_ID,
): Promise<ActivityItem[]> {
  "use cache";
  cacheLife("sleeperLive");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.league(leagueId));

  const activity = await getActivity(leagueId);
  return activity.slice(0, limit);
}

// ---------------------------------------------------------------------------
// League summary
// ---------------------------------------------------------------------------

export interface LeagueSummary {
  league: League;
  currentWeek: number;
  teamCount: number;
  /** Roster slots that are actually started (bench and IR removed). */
  startingSlots: string[];
  /** How many teams make the playoffs, when configured. */
  playoffTeams: number | null;
  isPlayoffs: boolean;
  /** Week the playoffs begin, when the league has it configured. */
  playoffWeekStart: number | null;
  /** Whole weeks until the playoffs start; null once they have begun. */
  weeksToPlayoffs: number | null;
  /**
   * Last week the league plays, including playoff rounds. Used to bound week
   * navigation so it does not offer weeks that will never have games.
   */
  lastWeek: number;
  /**
   * Short format descriptors for display, e.g.
   * `["Dynasty", "Superflex", "Full PPR", "TE Premium"]`. Derived from the
   * league's own settings so they stay true if the format changes.
   */
  formatLabels: string[];
}

/** Human-readable format tags, read off the league's settings and scoring. */
function describeFormat(league: League): string[] {
  const labels: string[] = [];

  // Sleeper encodes league type as 0 redraft, 1 keeper, 2 dynasty.
  if (league.settings.type === 2) labels.push("Dynasty");
  else if (league.settings.type === 1) labels.push("Keeper");

  if (league.roster_positions.includes("SUPER_FLEX")) labels.push("Superflex");

  const perReception = league.scoring_settings.rec ?? 0;
  if (perReception >= 1) labels.push("Full PPR");
  else if (perReception > 0) labels.push("Half PPR");
  else labels.push("Standard");

  if ((league.scoring_settings.bonus_rec_te ?? 0) > 0) {
    labels.push("TE Premium");
  }

  return labels;
}

/** Header/nav level facts about the league. */
export async function getLeagueSummary(
  leagueId: string = LEAGUE_ID,
): Promise<LeagueSummary> {
  "use cache";
  cacheLife("sleeperLeague");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.league(leagueId));

  const [league, currentWeek] = await Promise.all([
    getLeague(leagueId),
    getCurrentWeek(),
  ]);

  const playoffWeekStart = league.settings.playoff_week_start ?? null;
  const hasPlayoffWeek = playoffWeekStart !== null && playoffWeekStart > 0;
  const isPlayoffs = hasPlayoffWeek && currentWeek >= playoffWeekStart;
  const playoffTeams = league.settings.playoff_teams ?? null;

  // A bracket of N teams takes ceil(log2(N)) rounds, so 6 teams (two byes
  // plus two first-round games) runs three weeks: 15, 16, 17 here.
  const playoffRounds = playoffTeams ? Math.ceil(Math.log2(playoffTeams)) : 0;
  const lastWeek =
    hasPlayoffWeek && playoffRounds > 0
      ? Math.min(playoffWeekStart + playoffRounds - 1, MAX_FANTASY_WEEK)
      : MAX_FANTASY_WEEK;

  return {
    league,
    currentWeek,
    teamCount: league.total_rosters,
    startingSlots: league.roster_positions.filter(
      (slot) => slot !== "BN" && slot !== "IR" && slot !== "TAXI",
    ),
    playoffTeams,
    isPlayoffs,
    playoffWeekStart,
    weeksToPlayoffs:
      hasPlayoffWeek && !isPlayoffs ? playoffWeekStart - currentWeek : null,
    lastWeek,
    formatLabels: describeFormat(league),
  };
}

// ---------------------------------------------------------------------------
// Team rosters
// ---------------------------------------------------------------------------

export interface RosterSlot {
  /** Lineup slot label from the league config: "QB", "FLEX", "SUPER_FLEX". */
  slot: string;
  /** Null when the manager left the slot empty. */
  player: PlayerLite | null;
}

export interface TeamRoster {
  team: Team;
  /** Index-aligned with the league's starting slots. */
  starters: RosterSlot[];
  bench: PlayerLite[];
  taxi: PlayerLite[];
  reserve: PlayerLite[];
}

const POSITION_ORDER = ["QB", "RB", "WR", "TE", "K", "DEF"];

function byPosition(a: PlayerLite, b: PlayerLite): number {
  const rank = (player: PlayerLite) => {
    const index = POSITION_ORDER.indexOf(player.position ?? "");
    return index === -1 ? POSITION_ORDER.length : index;
  };
  const difference = rank(a) - rank(b);
  return difference !== 0 ? difference : a.name.localeCompare(b.name);
}

/**
 * One team's roster, split into lineup, bench, taxi squad and IR.
 *
 * Sleeper's `players` array holds every player including taxi and IR, so the
 * bench is what remains after removing starters, taxi and reserve.
 */
export async function getTeamRoster(
  rosterId: RosterId,
  leagueId: string = LEAGUE_ID,
): Promise<TeamRoster | null> {
  "use cache";
  cacheLife("sleeperRoster");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.rosters(leagueId));

  const [teams, summary, membership] = await Promise.all([
    getTeams(leagueId),
    getLeagueSummary(leagueId),
    getRosterMembership(leagueId),
  ]);

  const team = teams.find((entry) => entry.rosterId === rosterId);
  const roster = membership[rosterId];
  if (!team || !roster) return null;

  const players = await getPlayers([
    ...roster.playerIds,
    ...roster.starterIds,
    ...roster.taxiIds,
    ...roster.reserveIds,
  ]);

  const starters = summary.startingSlots.map((slot, index) => ({
    slot,
    player: players[roster.starterIds[index]] ?? null,
  }));

  const starting = new Set(roster.starterIds);
  const taxi = new Set(roster.taxiIds);
  const reserve = new Set(roster.reserveIds);

  const resolve = (ids: PlayerId[]) =>
    ids
      .map((id) => players[id])
      .filter((player): player is PlayerLite => Boolean(player))
      .sort(byPosition);

  return {
    team,
    starters,
    bench: resolve(
      roster.playerIds.filter(
        (id) => !starting.has(id) && !taxi.has(id) && !reserve.has(id),
      ),
    ),
    taxi: resolve(roster.taxiIds),
    reserve: resolve(roster.reserveIds),
  };
}

// ---------------------------------------------------------------------------
// Team schedule
// ---------------------------------------------------------------------------

export type TeamOutcome = "win" | "loss" | "tie" | "bye" | "upcoming";

export interface TeamWeekResult {
  week: number;
  points: number;
  opponent: Team | null;
  opponentPoints: number | null;
  outcome: TeamOutcome;
}

/**
 * A team's week-by-week results for the season.
 *
 * Deliberately built on the raw `getMatchups` rather than `getWeekMatchups`:
 * the latter also loads projections, which would mean a ~600KB fetch per week
 * just to render a list of final scores.
 */
export async function getTeamSchedule(
  rosterId: RosterId,
  leagueId: string = LEAGUE_ID,
): Promise<TeamWeekResult[]> {
  "use cache";
  cacheLife("sleeperLeague");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.rosters(leagueId));

  const [teams, summary] = await Promise.all([
    getTeams(leagueId),
    getLeagueSummary(leagueId),
  ]);

  const byRoster = indexTeams(teams);
  const weeks = Array.from({ length: summary.lastWeek }, (_, i) => i + 1);
  const perWeek = await Promise.all(
    weeks.map((week) => getMatchups(week, leagueId)),
  );

  return weeks.map((week, index) => {
    const entries = perWeek[index];
    const mine = entries.find((entry) => entry.roster_id === rosterId);

    if (!mine) {
      return {
        week,
        points: 0,
        opponent: null,
        opponentPoints: null,
        outcome: "upcoming" as const,
      };
    }

    const theirs =
      mine.matchup_id === null
        ? undefined
        : entries.find(
            (entry) =>
              entry.roster_id !== rosterId &&
              entry.matchup_id === mine.matchup_id,
          );

    const points = mine.custom_points ?? mine.points ?? 0;
    const opponentPoints = theirs
      ? (theirs.custom_points ?? theirs.points ?? 0)
      : null;

    let outcome: TeamOutcome;
    if (!theirs || opponentPoints === null) outcome = "bye";
    else if (points === 0 && opponentPoints === 0) outcome = "upcoming";
    else if (points > opponentPoints) outcome = "win";
    else if (points < opponentPoints) outcome = "loss";
    else outcome = "tie";

    return {
      week,
      points,
      opponent: theirs ? (byRoster.get(theirs.roster_id) ?? null) : null,
      opponentPoints,
      outcome,
    };
  });
}

// ---------------------------------------------------------------------------
// Detailed standings
// ---------------------------------------------------------------------------

/** Head-to-head results only; byes are excluded from form and streaks. */
export type PlayedOutcome = "win" | "loss" | "tie";

export interface StandingsDetailRow extends StandingsRow {
  gamesPlayed: number;
  pointsPerGame: number;
  /** Points for minus points against. */
  pointsDiff: number;
  /**
   * Share of potential points actually started, 0-1. High means the manager
   * sets good lineups; low means points are dying on the bench.
   */
  efficiency: number | null;
  /** Current run of the same result, most recent first. */
  streak: { outcome: PlayedOutcome; length: number } | null;
  /** Up to the last five results, oldest first. */
  form: PlayedOutcome[];
  /**
   * Record if this team had played every other team every week. Separates
   * scoring from schedule luck: a team well above its real record has been
   * unlucky in matchups.
   */
  allPlayWins: number;
  allPlayLosses: number;
  allPlayTies: number;
  highScore: number | null;
  lowScore: number | null;
}

/**
 * Standings enriched with per-week analysis.
 *
 * Walks the season with the raw `getMatchups` rather than `getWeekMatchups`,
 * which would pull projections for every week (see `getTeamSchedule`).
 */
export async function getStandingsDetail(
  leagueId: string = LEAGUE_ID,
): Promise<StandingsDetailRow[]> {
  "use cache";
  cacheLife("sleeperLeague");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.rosters(leagueId));

  const [standings, summary] = await Promise.all([
    getStandings(leagueId),
    getLeagueSummary(leagueId),
  ]);

  const weeks = Array.from({ length: summary.currentWeek }, (_, i) => i + 1);
  const perWeek = await Promise.all(
    weeks.map((week) => getMatchups(week, leagueId)),
  );

  // A week with no points has not been played; including it would hand every
  // team a tie against the field.
  const played = perWeek.filter((entries) =>
    entries.some((entry) => (entry.custom_points ?? entry.points ?? 0) > 0),
  );

  const results = new Map<RosterId, PlayedOutcome[]>();
  const scores = new Map<RosterId, number[]>();
  const allPlay = new Map<RosterId, { w: number; l: number; t: number }>();

  const bump = (rosterId: RosterId, key: "w" | "l" | "t") => {
    const tally = allPlay.get(rosterId) ?? { w: 0, l: 0, t: 0 };
    tally[key] += 1;
    allPlay.set(rosterId, tally);
  };

  for (const entries of played) {
    const points = new Map<RosterId, number>();
    for (const entry of entries) {
      points.set(entry.roster_id, entry.custom_points ?? entry.points ?? 0);
    }

    for (const entry of entries) {
      const mine = points.get(entry.roster_id) ?? 0;

      scores.set(entry.roster_id, [
        ...(scores.get(entry.roster_id) ?? []),
        mine,
      ]);

      const opponent =
        entry.matchup_id === null
          ? undefined
          : entries.find(
              (other) =>
                other.roster_id !== entry.roster_id &&
                other.matchup_id === entry.matchup_id,
            );

      if (opponent) {
        const theirs = points.get(opponent.roster_id) ?? 0;
        const outcome: PlayedOutcome =
          mine > theirs ? "win" : mine < theirs ? "loss" : "tie";
        results.set(entry.roster_id, [
          ...(results.get(entry.roster_id) ?? []),
          outcome,
        ]);
      }

      // Compare against every other score that week.
      for (const [rosterId, theirs] of points) {
        if (rosterId === entry.roster_id) continue;
        if (mine > theirs) bump(entry.roster_id, "w");
        else if (mine < theirs) bump(entry.roster_id, "l");
        else bump(entry.roster_id, "t");
      }
    }
  }

  return standings.map((team) => {
    const outcomes = results.get(team.rosterId) ?? [];
    const weekScores = scores.get(team.rosterId) ?? [];
    const tally = allPlay.get(team.rosterId) ?? { w: 0, l: 0, t: 0 };
    const gamesPlayed = team.wins + team.losses + team.ties;

    // Walk back from the most recent result while it keeps matching.
    let streak: StandingsDetailRow["streak"] = null;
    if (outcomes.length > 0) {
      const latest = outcomes[outcomes.length - 1];
      let length = 0;
      for (let i = outcomes.length - 1; i >= 0; i--) {
        if (outcomes[i] !== latest) break;
        length += 1;
      }
      streak = { outcome: latest, length };
    }

    return {
      ...team,
      gamesPlayed,
      pointsPerGame:
        gamesPlayed === 0
          ? 0
          : Number((team.pointsFor / gamesPlayed).toFixed(2)),
      pointsDiff: Number((team.pointsFor - team.pointsAgainst).toFixed(2)),
      efficiency:
        team.potentialPoints > 0 ? team.pointsFor / team.potentialPoints : null,
      streak,
      form: outcomes.slice(-5),
      allPlayWins: tally.w,
      allPlayLosses: tally.l,
      allPlayTies: tally.t,
      highScore: weekScores.length > 0 ? Math.max(...weekScores) : null,
      lowScore: weekScores.length > 0 ? Math.min(...weekScores) : null,
    };
  });
}

// ---------------------------------------------------------------------------
// FAAB budgets
// ---------------------------------------------------------------------------

export interface FaabRow {
  team: TeamRef;
  /** Dollars spent on winning waiver claims. */
  spent: number;
  /** Net dollars gained (or lost, when negative) in trades. */
  traded: number;
  remaining: number;
}

export interface FaabState {
  /** Starting budget every team gets. */
  budget: number;
  rows: FaabRow[];
  /** Mean remaining across the league, for the reference marker. */
  average: number;
  /** Whether any FAAB has changed hands in a trade. */
  anyTraded: boolean;
}

/**
 * Remaining waiver budget per team, most left first.
 *
 * Sleeper's `waiver_budget_used` only counts claim spending, so FAAB moved in
 * a trade has to be folded in separately or a team that traded for budget
 * shows less than it really has.
 */
export async function getFaabBudgets(
  leagueId: string = LEAGUE_ID,
): Promise<FaabState> {
  "use cache";
  cacheLife("sleeperLive");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.league(leagueId));

  const [teams, league, transactions] = await Promise.all([
    getTeams(leagueId),
    getLeague(leagueId),
    getAllTransactions(leagueId),
  ]);

  const budget = league.settings.waiver_budget ?? 0;

  const traded = new Map<RosterId, number>();
  let anyTraded = false;

  for (const transaction of transactions) {
    if (transaction.status !== "complete") continue;
    for (const transfer of transaction.waiver_budget ?? []) {
      anyTraded = true;
      traded.set(
        transfer.receiver,
        (traded.get(transfer.receiver) ?? 0) + transfer.amount,
      );
      traded.set(
        transfer.sender,
        (traded.get(transfer.sender) ?? 0) - transfer.amount,
      );
    }
  }

  const rows = teams
    .map((team) => {
      const net = traded.get(team.rosterId) ?? 0;
      return {
        team: toTeamRef(team),
        spent: team.waiverBudgetUsed,
        traded: net,
        remaining: budget + net - team.waiverBudgetUsed,
      };
    })
    .sort(
      (a, b) =>
        b.remaining - a.remaining ||
        a.team.teamName.localeCompare(b.team.teamName),
    );

  const average =
    rows.length === 0
      ? 0
      : rows.reduce((sum, row) => sum + row.remaining, 0) / rows.length;

  return { budget, rows, average, anyTraded };
}

// ---------------------------------------------------------------------------
// Matchup detail
// ---------------------------------------------------------------------------

export interface LineupEntry {
  player: PlayerLite | null;
  /** Points scored. Zero before kickoff. */
  points: number;
  /** Projected points, or null when Sleeper has no projection. */
  projected: number | null;
}

export interface LineupSlot {
  /** Lineup slot label from the league config. */
  slot: string;
  /** Index-aligned with the matchup's sides. */
  entries: (LineupEntry | null)[];
}

export interface MatchupDetail {
  week: number;
  matchup: WeekMatchup;
  slots: LineupSlot[];
}

/**
 * One game, broken out slot by slot so the two lineups can be read against
 * each other - QB against QB, each FLEX against its opposite number.
 *
 * Sleeper's `starters` array is positional: index 0 is the first starting slot
 * in `roster_positions`, index 1 the second, and so on. That alignment is what
 * makes a head-to-head comparison possible at all.
 */
export async function getMatchupDetail(
  week: number,
  matchupId: string,
  leagueId: string = LEAGUE_ID,
): Promise<MatchupDetail | null> {
  "use cache";
  cacheLife("sleeperLive");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.matchups(leagueId, week));

  const [matchups, summary, projections] = await Promise.all([
    getWeekMatchups(week, leagueId),
    getLeagueSummary(leagueId),
    getProjectedPoints(week, leagueId),
  ]);

  const matchup = matchups.find((entry) => entry.id === matchupId);
  if (!matchup) return null;

  const players = await getPlayers(
    matchup.sides.flatMap((side) => side.starterIds),
  );

  const slots: LineupSlot[] = summary.startingSlots.map((slot, index) => ({
    slot,
    entries: matchup.sides.map((side) => {
      const playerId = side.starterIds[index];
      if (!playerId) return null;

      const projected = projections[playerId];

      return {
        player: players[playerId] ?? null,
        points: side.starterPoints[index] ?? 0,
        projected: typeof projected === "number" ? projected : null,
      };
    }),
  }));

  return { week, matchup, slots };
}
