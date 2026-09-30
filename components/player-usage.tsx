"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { PositionBadge } from "@/components/player-row";
import type { PlayerAnalytics, UsageRow, UsageSignal } from "@/lib/sleeper";

const POSITIONS = ["RB", "WR", "TE"] as const;

const SIGNAL_LABELS: Record<UsageSignal, string> = {
  underused: "Buy",
  aligned: "Aligned",
  overperforming: "Sell",
};

const SIGNAL_STYLES: Record<UsageSignal, string> = {
  underused: "bg-win/15 text-win",
  aligned: "bg-surface-2 text-ink-dim",
  overperforming: "bg-live/15 text-live",
};

const SIGNAL_TITLES: Record<UsageSignal, string> = {
  underused: "Opportunity outruns production — usually the better asset",
  aligned: "Production roughly matches opportunity",
  overperforming:
    "Scoring well above the underlying usage, which rarely holds",
};

type Sort = "usage" | "points" | "signal";

const SORTS: { key: Sort; label: string }[] = [
  { key: "usage", label: "Opportunity" },
  { key: "points", label: "Points" },
  { key: "signal", label: "Signal" },
];

function pct(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function Row({ row }: { row: UsageRow }) {
  return (
    <tr className="border-b border-line/60 transition-colors hover:bg-surface-2/60">
      <td className="px-3 py-2.5">
        <span className="flex items-center gap-2.5">
          <PositionBadge position={row.position} />
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

      <td className="numerals px-3 py-2.5 text-right text-ink">
        {row.opportunities}
      </td>
      <td className="numerals px-3 py-2.5 text-right text-ink-muted">
        {pct(row.targetShare)}
      </td>
      <td className="numerals px-3 py-2.5 text-right text-ink-muted">
        {row.wopr === null ? "—" : row.wopr.toFixed(2)}
      </td>
      <td className="numerals px-3 py-2.5 text-right text-ink">
        {row.points.toFixed(1)}
      </td>
      <td className="numerals px-3 py-2.5 text-right text-ink-muted">
        {row.pointsPerOpportunity?.toFixed(2) ?? "—"}
      </td>

      <td className="px-3 py-2.5 text-right">
        <span className="flex items-center justify-end gap-2">
          <span className="numerals text-[11px] text-ink-dim">
            {row.position}
            {Math.round(row.usageRank)} → {row.position}
            {Math.round(row.pointsRank)}
          </span>
          {row.signal ? (
            <span
              className={`eyebrow shrink-0 rounded px-1.5 py-0.5 text-[9px] ${SIGNAL_STYLES[row.signal]}`}
              title={SIGNAL_TITLES[row.signal]}
            >
              {SIGNAL_LABELS[row.signal]}
            </span>
          ) : (
            <span className="eyebrow shrink-0 px-1.5 text-[9px] text-ink-dim">
              —
            </span>
          )}
        </span>
      </td>
    </tr>
  );
}

export function PlayerUsageTable({
  analytics,
}: {
  analytics: PlayerAnalytics;
}) {
  const [position, setPosition] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("usage");

  const rows = useMemo(() => {
    const filtered = position
      ? analytics.rows.filter((row) => row.position === position)
      : analytics.rows;

    return [...filtered].sort((a, b) => {
      if (sort === "points") return b.points - a.points;
      // Most underused first: the acquisition targets lead the list.
      if (sort === "signal") {
        if (a.signal === null && b.signal === null) return 0;
        if (a.signal === null) return 1;
        if (b.signal === null) return -1;
        return a.rankDelta - b.rankDelta;
      }
      return b.opportunities - a.opportunities;
    });
  }, [analytics.rows, position, sort]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setPosition(null)}
            aria-pressed={position === null}
            className={`eyebrow rounded px-3 py-2 text-xs transition-colors ${
              position === null
                ? "bg-accent text-accent-ink"
                : "bg-surface text-ink-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            All
          </button>
          {POSITIONS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPosition(value)}
              aria-pressed={position === value}
              className={`eyebrow rounded px-3 py-2 text-xs transition-colors ${
                position === value
                  ? "bg-accent text-accent-ink"
                  : "bg-surface text-ink-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="flex gap-1 sm:ml-auto">
          <span className="eyebrow self-center pr-1 text-[10px] text-ink-dim">
            Sort
          </span>
          {SORTS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              aria-pressed={sort === key}
              className={`eyebrow rounded px-3 py-2 text-xs transition-colors ${
                sort === key
                  ? "bg-accent text-accent-ink"
                  : "bg-surface text-ink-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-216 border-collapse text-sm">
          <caption className="sr-only">
            Usage against production for rostered players
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th className="eyebrow px-3 py-2 text-left text-[10px] text-ink-dim">
                Player
              </th>
              <th className="eyebrow px-3 py-2 text-left text-[10px] text-ink-dim">
                Owner
              </th>
              <th
                className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim"
                title="Targets for receivers, touches for backs, attempts plus carries for quarterbacks"
              >
                Opp
              </th>
              <th
                className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim"
                title="Average weekly share of the team's targets"
              >
                Tgt share
              </th>
              <th
                className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim"
                title="Weighted Opportunity Rating"
              >
                WOPR
              </th>
              <th className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim">
                Pts
              </th>
              <th
                className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim"
                title="League points per opportunity"
              >
                Pts/opp
              </th>
              <th className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim">
                Usage → scoring
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Row key={row.playerId} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <p className="mt-4 rounded-lg border border-dashed border-line-bright bg-surface/40 px-6 py-14 text-center text-ink-muted">
          No players match that filter.
        </p>
      )}
    </div>
  );
}
