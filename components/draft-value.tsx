import Link from "next/link";

import { PositionBadge } from "@/components/player-row";
import type {
  DraftValueAnalysis,
  PositionAnalysis,
  ValueRow,
} from "@/lib/sleeper";

function describeCorrelation(value: number): string {
  if (value >= 0.7) return "priced well";
  if (value >= 0.5) return "roughly right";
  if (value >= 0.3) return "hit and miss";
  return "mispriced";
}

/**
 * What each price band actually produced, for one position.
 *
 * Bands rather than a scatter of every pick: more than half this draft went
 * for $1, so a price axis is one dense wall of ties with a few stragglers -
 * unreadable. Grouped bands answer the question the reader actually has,
 * which is whether paying more got you more. If the bars step down from top
 * to bottom, the market worked.
 */
function PositionTiers({ analysis }: { analysis: PositionAnalysis }) {
  const ceiling = Math.max(...analysis.tiers.map((tier) => tier.averagePoints));

  return (
    <figure className="rounded-lg border border-line bg-surface p-4">
      <figcaption className="mb-3 flex items-baseline justify-between gap-3">
        <span className="flex items-baseline gap-2">
          <span className="font-display text-lg font-semibold text-ink">
            {analysis.position}
          </span>
          <span className="text-xs text-ink-dim">
            {analysis.count} drafted
          </span>
        </span>
        <span className="text-xs text-ink-dim">
          {describeCorrelation(analysis.correlation)}
        </span>
      </figcaption>

      <ul className="space-y-2.5">
        {analysis.tiers.map((tier) => (
          <li key={tier.label}>
            <div className="flex items-baseline gap-3 text-sm">
              <span className="numerals w-14 shrink-0 text-ink-muted">
                {tier.label}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-ink-dim">
                <span className="numerals text-ink-muted">{tier.count}</span>{" "}
                {tier.count === 1 ? "player" : "players"}
                {analysis.count > 0 && (
                  <span className="numerals">
                    {" "}
                    ({Math.round((tier.count / analysis.count) * 100)}%)
                  </span>
                )}
              </span>
              <span className="numerals shrink-0 text-ink">
                {tier.averagePoints.toFixed(1)}
                <span className="ml-1 text-[11px] text-ink-dim">pts avg</span>
              </span>
            </div>
            <div className="mt-1 h-2.5 rounded-r-full bg-accent/15">
              <div
                className="h-2.5 rounded-r-full bg-accent"
                style={{
                  width: `${ceiling > 0 ? (tier.averagePoints / ceiling) * 100 : 0}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function ValueTable({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: ValueRow[];
  tone: "steal" | "bust";
}) {
  return (
    <div>
      <h3 className="eyebrow mb-2 text-xs text-ink-muted">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-120 border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="eyebrow px-3 py-2 text-left text-[10px] text-ink-dim">
                Player
              </th>
              <th className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim">
                Paid
              </th>
              <th className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim">
                Pts
              </th>
              <th className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim">
                GP
              </th>
              <th className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim">
                Rank
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.playerId} className="border-b border-line/60">
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    <PositionBadge position={row.position} />
                    <span className="min-w-0 truncate text-ink">
                      {row.playerName}
                    </span>
                    {row.team && (
                      <Link
                        href={`/teams/${row.team.rosterId}`}
                        className="hidden shrink-0 truncate text-xs text-ink-dim transition-colors hover:text-accent sm:block"
                      >
                        {row.team.teamName}
                      </Link>
                    )}
                  </span>
                </td>
                <td className="numerals px-3 py-2 text-right text-ink-muted">
                  ${row.price}
                </td>
                <td className="numerals px-3 py-2 text-right text-ink">
                  {row.points.toFixed(1)}
                </td>
                <td className="numerals px-3 py-2 text-right text-ink-dim">
                  {row.games}
                </td>
                <td className="px-3 py-2 text-right">
                  {/* "Bought as the 2nd priciest QB, producing as the 19th." */}
                  <span className="numerals text-xs text-ink-dim">
                    {row.position}
                    {Math.round(row.priceRank)} →{" "}
                    <span
                      className={tone === "steal" ? "text-win" : "text-live"}
                    >
                      {row.position}
                      {Math.round(row.pointsRank)}
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DraftValueSection({
  analysis,
}: {
  analysis: DraftValueAnalysis;
}) {
  return (
    <div className="space-y-10">
      <div>
        <h3 className="eyebrow mb-1 text-xs text-ink-muted">
          Did paying more get you more?
        </h3>
        <p className="mb-3 max-w-2xl text-sm text-ink-dim">
          Average points scored by the players bought in each price band. Bars
          that step down from top to bottom mean the market priced that
          position correctly.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {analysis.positions.map((position) => (
            <PositionTiers key={position.position} analysis={position} />
          ))}
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <ValueTable title="Best value" rows={analysis.steals} tone="steal" />
        <ValueTable title="Worst value" rows={analysis.busts} tone="bust" />
      </div>
    </div>
  );
}
