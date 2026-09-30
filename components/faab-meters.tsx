import Link from "next/link";

import type { FaabState } from "@/lib/sleeper";

/**
 * Remaining waiver budget, one meter per team.
 *
 * A single measure compared across teams, so it is one hue rather than twelve:
 * the row label carries identity, the bar carries magnitude. The unfilled
 * track is the same hue at low alpha, so each row also reads as a ratio
 * against the $100 cap, not just a length.
 */
export function FaabMeters({ state }: { state: FaabState }) {
  const { budget, rows, average, anyTraded } = state;

  if (budget <= 0 || rows.length === 0) return null;

  // Bars are drawn against the largest balance in the league, not the starting
  // budget, so the spread stays visible once everyone has spent something.
  const ceiling = Math.max(budget, ...rows.map((row) => row.remaining));
  const toPercent = (value: number) =>
    `${Math.max(0, Math.min(100, (value / ceiling) * 100))}%`;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
          FAAB remaining
        </h2>
        <p className="text-xs text-ink-dim">
          ${budget} budget · league average{" "}
          <span className="numerals text-ink-muted">${average.toFixed(0)}</span>
        </p>
      </div>

      <ul className="space-y-3">
        {rows.map((row) => {
          const depleted = row.remaining <= 0;

          return (
            <li key={row.team.rosterId}>
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={`/teams/${row.team.rosterId}`}
                  className="min-w-0 truncate text-sm text-ink-muted transition-colors hover:text-accent"
                >
                  {row.team.teamName}
                </Link>
                <span
                  className={`numerals shrink-0 text-sm ${
                    depleted ? "text-ink-dim" : "text-ink"
                  }`}
                >
                  ${row.remaining}
                </span>
              </div>

              <div
                className="relative mt-1.5 h-2 rounded-r-full bg-accent/15"
                title={`Spent $${row.spent} of $${budget}${
                  row.traded !== 0
                    ? `, ${row.traded > 0 ? "+" : ""}$${row.traded} traded`
                    : ""
                }`}
              >
                {/* Square at the baseline, rounded at the data end. */}
                <div
                  className="h-2 rounded-r-full bg-accent"
                  style={{ width: toPercent(row.remaining) }}
                />
                {/* Recessive hairline reference: the league average. */}
                <span
                  aria-hidden="true"
                  className="absolute -top-0.5 h-3 w-px bg-line-bright"
                  style={{ left: toPercent(average) }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-xs text-ink-dim">
        The hairline marks the league average.
        {anyTraded && " Totals include FAAB moved in trades."}
      </p>
    </section>
  );
}
