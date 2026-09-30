import Link from "next/link";

import { MatchupCard } from "@/components/matchup-card";
import { DraftOutlookSection } from "@/components/draft-outlook";
import { LeagueHistorySection } from "@/components/league-history";
import { StandingsTable } from "@/components/standings-table";
import { WeekPreviewSection } from "@/components/week-preview";
import {
  getCurrentWeekMatchups,
  getDraftOutlook,
  getLeagueHistorySummary,
  getLeagueSummary,
  getStandings,
  getWeekPreview,
} from "@/lib/sleeper";

export default async function Home() {
  const summary = await getLeagueSummary();
  const standings = await getStandings();
  const { week: matchupWeek, matchups } = await getCurrentWeekMatchups();
  const history = await getLeagueHistorySummary();
  const preview = await getWeekPreview();
  const outlook = await getDraftOutlook();

  const { league, formatLabels, weeksToPlayoffs } = summary;

  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="eyebrow mb-3 text-xs text-accent">
            {[`${league.season} Season`, ...formatLabels].join(" · ")}
          </p>
          <h1 className="font-display text-5xl font-bold tracking-tight text-ink sm:text-7xl">
            {league.name}
          </h1>

          {preview && (
            <WeekPreviewSection
              preview={preview}
              leagueMatchups={matchups.length}
              weeksToPlayoffs={weeksToPlayoffs}
            />
          )}
        </div>
      </section>

      {/* No border-t here: the hero above already closes with a border-b. */}
      <section className="bg-surface/30">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
              Week {matchupWeek} Matchups
            </h2>
            <Link
              href={`/matchups/${matchupWeek}`}
              className="eyebrow text-xs text-ink-muted transition-colors hover:text-accent"
            >
              All matchups →
            </Link>
          </div>

          {matchups.length === 0 ? (
            <p className="text-ink-dim">
              No matchups scheduled for this week yet.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {matchups.map((matchup) => (
                <MatchupCard key={matchup.id} matchup={matchup} week={matchupWeek} />
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
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
              Standings
            </h2>
            <Link
              href="/standings"
              className="eyebrow text-xs text-ink-muted transition-colors hover:text-accent"
            >
              View all →
            </Link>
          </div>

          <StandingsTable
            rows={standings}
            playoffTeams={summary.playoffTeams}
          />

          {summary.playoffTeams !== null && (
            <p className="mt-3 text-xs text-ink-dim">
              Top {summary.playoffTeams} make the playoffs — the line marks the
              current cut.
            </p>
          )}
        </div>
      </section>

      <section className="border-t border-line bg-surface/30">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <DraftOutlookSection outlook={outlook} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <LeagueHistorySection history={history} />
      </section>
    </>
  );
}
