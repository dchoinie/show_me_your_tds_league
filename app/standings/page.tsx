import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-shell";
import { StandingsDetailTable } from "@/components/standings-detail-table";
import {
  getLeagueSummary,
  getStandingsDetail,
  type StandingsDetailRow,
} from "@/lib/sleeper";

export const metadata: Metadata = {
  title: "Standings",
  description:
    "Records, points, lineup efficiency and all-play records for the league.",
};

function Note({
  label,
  team,
  value,
  hint,
}: {
  label: string;
  team: StandingsDetailRow;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="eyebrow text-[10px] text-ink-dim">{label}</p>
      <p className="numerals mt-1 text-2xl text-accent">{value}</p>
      <Link
        href={`/teams/${team.rosterId}`}
        className="mt-1 block truncate text-sm text-ink-muted transition-colors hover:text-accent"
      >
        {team.teamName}
      </Link>
      {hint && <p className="mt-1 text-xs text-ink-dim">{hint}</p>}
    </div>
  );
}

/** Highest value wins; ties break toward the better-ranked team. */
function leader(
  rows: StandingsDetailRow[],
  score: (row: StandingsDetailRow) => number | null,
): { row: StandingsDetailRow; value: number } | null {
  let best: { row: StandingsDetailRow; value: number } | null = null;

  for (const row of rows) {
    const value = score(row);
    if (value === null) continue;
    if (!best || value > best.value) best = { row, value };
  }

  return best;
}

export default async function StandingsPage() {
  const [rows, summary] = await Promise.all([
    getStandingsDetail(),
    getLeagueSummary(),
  ]);

  const played = rows.some((row) => row.gamesPlayed > 0);

  const topScorer = leader(rows, (row) => row.pointsFor);
  const bestWeek = leader(rows, (row) => row.highScore);
  const bestEfficiency = leader(rows, (row) => row.efficiency);

  // All-play win rate minus real win rate: positive means the schedule has
  // been unkind relative to how much the team actually scores.
  const unluckiest = leader(rows, (row) => {
    const games = row.allPlayWins + row.allPlayLosses + row.allPlayTies;
    if (games === 0 || row.gamesPlayed === 0) return null;
    const allPlayPct =
      (row.allPlayWins + row.allPlayTies / 2) / games;
    return allPlayPct - row.winPct;
  });

  return (
    <>
      <PageHeader eyebrow="League" title="Standings">
        Through week {summary.currentWeek} of the {summary.league.season}{" "}
        season.
      </PageHeader>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 sm:py-12">
        {played && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {topScorer && (
              <Note
                label="Most points"
                team={topScorer.row}
                value={topScorer.value.toFixed(2)}
              />
            )}
            {bestWeek && (
              <Note
                label="Best single week"
                team={bestWeek.row}
                value={bestWeek.value.toFixed(2)}
              />
            )}
            {bestEfficiency && (
              <Note
                label="Best lineup efficiency"
                team={bestEfficiency.row}
                value={`${(bestEfficiency.value * 100).toFixed(1)}%`}
                hint="Points started vs. points available"
              />
            )}
            {unluckiest && unluckiest.value > 0 && (
              <Note
                label="Unluckiest"
                team={unluckiest.row}
                value={`+${(unluckiest.value * 100).toFixed(0)}%`}
                hint="All-play rate above actual win rate"
              />
            )}
          </div>
        )}

        <StandingsDetailTable
          rows={rows}
          playoffTeams={summary.playoffTeams}
        />

        <div className="space-y-2 text-xs text-ink-dim">
          {summary.playoffTeams !== null && (
            <p>
              The amber line marks the playoff cut — the top{" "}
              {summary.playoffTeams} of {summary.teamCount} advance, with
              seeding by record and points for as the tiebreaker.
            </p>
          )}
          <p>
            <span className="text-ink-muted">Eff</span> is the share of
            available points a manager actually started — lineup decisions
            rather than luck.
          </p>
          <p>
            <span className="text-ink-muted">All-play</span> is the record each
            team would hold if it played every other team every week. A team
            well above its real record has been scoring enough to win more
            games than the schedule has given it.
          </p>
        </div>
      </div>
    </>
  );
}
