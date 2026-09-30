import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MatchupCard } from "@/components/matchup-card";
import { PageHeader } from "@/components/page-shell";
import { WeekPicker } from "@/components/week-picker";
import { getLeagueSummary, getWeekMatchups } from "@/lib/sleeper";

/** Prerender every week the league will actually play. */
export async function generateStaticParams() {
  const { lastWeek } = await getLeagueSummary();
  return Array.from({ length: lastWeek }, (_, index) => ({
    week: String(index + 1),
  }));
}

/** Parse and bound the route param, or 404. */
async function resolveWeek(raw: string): Promise<number> {
  const week = Number(raw);
  const { lastWeek } = await getLeagueSummary();

  if (!Number.isInteger(week) || week < 1 || week > lastWeek) notFound();
  return week;
}

export async function generateMetadata({
  params,
}: PageProps<"/matchups/[week]">): Promise<Metadata> {
  const { week } = await params;
  return {
    title: `Week ${week} Matchups`,
    description: `Scores, lineups and projections for week ${week}.`,
  };
}

export default async function MatchupsWeekPage({
  params,
}: PageProps<"/matchups/[week]">) {
  const { week: raw } = await params;
  const week = await resolveWeek(raw);

  const summary = await getLeagueSummary();
  const matchups = await getWeekMatchups(week);

  const isPlayoffWeek =
    summary.playoffWeekStart !== null && week >= summary.playoffWeekStart;

  return (
    <>
      <PageHeader
        eyebrow={isPlayoffWeek ? "Playoffs" : "Scoreboard"}
        title={`Week ${week}`}
      >
        {week === summary.currentWeek
          ? "This week's games, with projected totals for each lineup."
          : `Week ${week} of the ${summary.league.season} season.`}
      </PageHeader>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <WeekPicker
          week={week}
          lastWeek={summary.lastWeek}
          currentWeek={summary.currentWeek}
          playoffWeekStart={summary.playoffWeekStart}
          basePath="/matchups"
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        {matchups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-bright bg-surface/40 px-6 py-14 text-center text-ink-muted">
            Sleeper has no matchups for week {week} yet.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {matchups.map((matchup) => (
              <MatchupCard key={matchup.id} matchup={matchup} week={week} />
            ))}
          </div>
        )}

        {matchups.some((matchup) =>
          matchup.sides.some((side) => side.projectedPoints !== null),
        ) && (
          <p className="mt-4 text-xs text-ink-dim">
            Projections are Sleeper&apos;s weekly player projections scored
            under this league&apos;s rules, including the TE premium.
          </p>
        )}
      </div>
    </>
  );
}
