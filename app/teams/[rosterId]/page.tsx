import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PlayerGroup, PlayerRow } from "@/components/player-row";
import { TeamAvatar } from "@/components/team-avatar";
import {
  getLeagueSummary,
  getStandings,
  getTeamRoster,
  getTeamSchedule,
  getTeams,
  type TeamOutcome,
  type TeamWeekResult,
} from "@/lib/sleeper";

export async function generateStaticParams() {
  const teams = await getTeams();
  return teams.map((team) => ({ rosterId: String(team.rosterId) }));
}

export async function generateMetadata({
  params,
}: PageProps<"/teams/[rosterId]">): Promise<Metadata> {
  const { rosterId } = await params;
  const roster = await getTeamRoster(Number(rosterId));

  if (!roster) return { title: "Team" };

  return {
    title: roster.team.teamName,
    description: `Roster, record and results for ${roster.team.teamName}, managed by ${roster.team.managerName}.`,
  };
}

const OUTCOME_STYLES: Record<TeamOutcome, string> = {
  win: "bg-win/15 text-win",
  loss: "bg-live/15 text-live",
  tie: "bg-surface-2 text-ink-muted",
  bye: "bg-surface-2 text-ink-dim",
  upcoming: "bg-surface-2/50 text-ink-dim",
};

const OUTCOME_LABELS: Record<TeamOutcome, string> = {
  win: "W",
  loss: "L",
  tie: "T",
  bye: "—",
  upcoming: "·",
};

function ResultRow({ result }: { result: TeamWeekResult }) {
  const played = result.outcome === "win" || result.outcome === "loss" || result.outcome === "tie";

  return (
    <div className="flex items-center gap-3 py-2 text-sm">
      <span className="eyebrow w-10 shrink-0 text-[10px] text-ink-dim">
        Wk {result.week}
      </span>
      <span
        className={`numerals flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs ${OUTCOME_STYLES[result.outcome]}`}
      >
        {OUTCOME_LABELS[result.outcome]}
      </span>
      <span className="min-w-0 flex-1 truncate text-ink-muted">
        {result.opponent ? (
          <Link
            href={`/teams/${result.opponent.rosterId}`}
            className="transition-colors hover:text-accent"
          >
            {result.opponent.teamName}
          </Link>
        ) : (
          <span className="text-ink-dim">Bye</span>
        )}
      </span>
      {played && (
        <span className="numerals shrink-0 text-ink">
          {result.points.toFixed(2)}
          <span className="px-1 text-ink-dim">–</span>
          {result.opponentPoints?.toFixed(2)}
        </span>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="eyebrow text-[10px] text-ink-dim">{label}</dt>
      <dd className="numerals text-2xl text-ink">{value}</dd>
    </div>
  );
}

export default async function TeamPage({
  params,
}: PageProps<"/teams/[rosterId]">) {
  const { rosterId } = await params;
  const id = Number(rosterId);
  if (!Number.isInteger(id)) notFound();

  const roster = await getTeamRoster(id);
  if (!roster) notFound();

  const [standings, summary, schedule] = await Promise.all([
    getStandings(),
    getLeagueSummary(),
    getTeamSchedule(id),
  ]);

  const { team } = roster;
  const rank = standings.find((row) => row.rosterId === id)?.rank ?? null;
  const record =
    team.ties > 0
      ? `${team.wins}-${team.losses}-${team.ties}`
      : `${team.wins}-${team.losses}`;

  const taxiLimit = summary.league.settings.taxi_slots ?? undefined;
  const reserveLimit = summary.league.settings.reserve_slots ?? undefined;
  const faabBudget = summary.league.settings.waiver_budget ?? null;

  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
          <Link
            href="/teams"
            className="eyebrow text-xs text-ink-dim transition-colors hover:text-accent"
          >
            ← All teams
          </Link>

          <div className="mt-4 flex items-center gap-5">
            <TeamAvatar name={team.teamName} src={team.avatarUrl} size={72} />
            <div className="min-w-0">
              <h1 className="truncate font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
                {team.teamName}
              </h1>
              <p className="mt-1 text-ink-muted">{team.managerName}</p>
            </div>
          </div>

          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-6">
            {rank !== null && <Stat label="Rank" value={rank} />}
            <Stat label="Record" value={record} />
            <Stat label="Points for" value={team.pointsFor.toFixed(2)} />
            <Stat label="Points against" value={team.pointsAgainst.toFixed(2)} />
            {team.potentialPoints > 0 && (
              <Stat label="Potential" value={team.potentialPoints.toFixed(2)} />
            )}
            <Stat
              label="FAAB left"
              value={
                faabBudget !== null
                  ? `$${faabBudget - team.waiverBudgetUsed}`
                  : `$${team.waiverBudgetUsed} used`
              }
            />
            <Stat label="Moves" value={team.totalMoves} />
          </dl>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-10">
          <section>
            <h2 className="eyebrow mb-1 text-xs text-ink-muted">
              Starting lineup
            </h2>
            <div className="divide-y divide-line/60">
              {roster.starters.map((entry, index) => (
                <PlayerRow
                  // Slots repeat (RB, RB), so the index is what makes it unique.
                  key={`${entry.slot}-${index}`}
                  slot={entry.slot}
                  player={entry.player}
                />
              ))}
            </div>
          </section>

          <PlayerGroup
            title="Bench"
            players={roster.bench}
            emptyLabel="No bench players."
          />

          <PlayerGroup
            title="Taxi squad"
            players={roster.taxi}
            emptyLabel="No players on the taxi squad."
            limit={taxiLimit}
          />

          <PlayerGroup
            title="Injured reserve"
            players={roster.reserve}
            emptyLabel="Nobody on IR."
            limit={reserveLimit}
          />
        </div>

        <section>
          <h2 className="eyebrow mb-1 text-xs text-ink-muted">Results</h2>
          <div className="divide-y divide-line/60">
            {schedule.map((result) => (
              <ResultRow key={result.week} result={result} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
