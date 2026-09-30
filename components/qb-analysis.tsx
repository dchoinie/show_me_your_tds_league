import Link from "next/link";

import { PositionBadge } from "@/components/player-row";
import type { QbAnalysis, QbRow, QbSignal } from "@/lib/sleeper";

const SIGNAL_LABELS: Record<QbSignal, string> = {
  rebound: "Due up",
  aligned: "Aligned",
  regression: "Due down",
};

const SIGNAL_STYLES: Record<QbSignal, string> = {
  rebound: "bg-win/15 text-win",
  aligned: "bg-surface-2 text-ink-dim",
  regression: "bg-live/15 text-live",
};

const SIGNAL_TITLES: Record<QbSignal, string> = {
  rebound:
    "Scoring below what the yardage supports — a low touchdown rate that should correct upward",
  aligned: "Scoring roughly what the volume and yardage support",
  regression:
    "Scoring above what the yardage supports, on a touchdown rate unlikely to hold",
};

function Row({ row, leagueTdRate }: { row: QbRow; leagueTdRate: number | null }) {
  const hot =
    leagueTdRate !== null && row.tdRate !== null && row.tdRate > leagueTdRate;

  return (
    <tr className="border-b border-line/60 transition-colors hover:bg-surface-2/60">
      <td className="px-3 py-2.5">
        <span className="flex items-center gap-2.5">
          <PositionBadge position="QB" />
          <span className="min-w-0">
            <span className="block truncate text-ink">{row.name}</span>
            <span className="numerals text-[11px] text-ink-dim">
              {row.nflTeam ?? "FA"} · {row.games} gm
            </span>
          </span>
        </span>
      </td>

      <td className="px-3 py-2.5">
        {row.team ? (
          <Link
            href={`/teams/${row.team.rosterId}`}
            className="block max-w-36 truncate text-xs text-ink-muted transition-colors hover:text-accent"
          >
            {row.team.teamName}
          </Link>
        ) : (
          <span className="text-xs text-ink-dim">—</span>
        )}
      </td>

      <td className="numerals px-3 py-2.5 text-right text-ink-muted">
        {row.attempts}
      </td>
      <td className="numerals px-3 py-2.5 text-right text-ink-muted">
        {Math.round(row.passingYards)}
      </td>
      <td className="numerals px-3 py-2.5 text-right text-ink-muted">
        {Math.round(row.rushingYards)}
      </td>
      <td
        className={`numerals px-3 py-2.5 text-right ${hot ? "text-live" : "text-ink-muted"}`}
        title={
          leagueTdRate === null
            ? undefined
            : `League average ${(leagueTdRate * 100).toFixed(1)}%`
        }
      >
        {row.tdRate === null ? "—" : `${(row.tdRate * 100).toFixed(1)}%`}
      </td>
      <td className="numerals px-3 py-2.5 text-right text-ink-dim">
        {row.expectedPoints.toFixed(1)}
      </td>
      <td className="numerals px-3 py-2.5 text-right text-ink">
        {row.points.toFixed(1)}
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="flex items-center justify-end gap-2">
          <span
            className={`numerals text-[11px] ${
              row.delta > 0 ? "text-live" : row.delta < 0 ? "text-win" : "text-ink-dim"
            }`}
          >
            {row.delta > 0 ? "+" : ""}
            {row.delta.toFixed(1)}
          </span>
          <span
            className={`eyebrow shrink-0 rounded px-1.5 py-0.5 text-[9px] ${SIGNAL_STYLES[row.signal]}`}
            title={SIGNAL_TITLES[row.signal]}
          >
            {SIGNAL_LABELS[row.signal]}
          </span>
        </span>
      </td>
    </tr>
  );
}

export function QbAnalysisSection({ analysis }: { analysis: QbAnalysis }) {
  const { rows, leagueTdRate } = analysis;
  if (rows.length === 0) return null;

  return (
    <section>
      <div className="mb-4">
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
          Quarterbacks
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-ink-dim">
          Volume tells you almost nothing about a quarterback — attempts run in
          a narrow band and rise when a team is losing. Passing touchdown rate
          is what moves their scoring, and it regresses hard, while yards are
          sticky. So this keeps each passer&apos;s real yards, swaps his passing
          touchdowns for what his volume would produce at the league rate
          {leagueTdRate !== null && (
            <>
              {" "}
              (<span className="numerals">{(leagueTdRate * 100).toFixed(1)}%</span>{" "}
              per attempt)
            </>
          )}
          , and scores that under this league&apos;s rules.
        </p>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-216 border-collapse text-sm">
          <caption className="sr-only">
            Quarterback expected points against actual points
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th className="eyebrow px-3 py-2 text-left text-[10px] text-ink-dim">
                Player
              </th>
              <th className="eyebrow px-3 py-2 text-left text-[10px] text-ink-dim">
                Owner
              </th>
              <th className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim">
                Att
              </th>
              <th className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim">
                Pass yd
              </th>
              <th className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim">
                Rush yd
              </th>
              <th
                className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim"
                title="Passing touchdowns per attempt, against the league average"
              >
                TD rate
              </th>
              <th
                className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim"
                title="Points the yardage and volume support at league-average touchdown rates"
              >
                Expected
              </th>
              <th className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim">
                Actual
              </th>
              <th className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim">
                Gap
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Row key={row.playerId} row={row} leagueTdRate={leagueTdRate} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 max-w-3xl space-y-2 text-xs text-ink-dim">
        <p>
          A <span className="text-live">positive gap</span> means a quarterback
          is scoring more than his yardage supports, on a touchdown rate that
          usually comes down. A <span className="text-win">negative</span> one
          means the yards are there and the touchdowns are not — historically
          the better side of that trade to be on.
        </p>
        <p>
          Rushing scores are left exactly as they happened rather than
          regressed. Goal-line carries are a designed role, not luck, and the
          quarterbacks who get them keep getting them — regressing those would
          penalise the very players whose rushing floor makes them safest.
        </p>
      </div>
    </section>
  );
}
