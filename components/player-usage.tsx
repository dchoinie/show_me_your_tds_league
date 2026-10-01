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

/**
 * A buy signal reads differently when the volume is specifically downfield
 * work that has not converted — the yards are owed rather than absent, which
 * is the stronger version of the same case.
 */
const OWED_TITLE =
  "Real downfield volume that has not converted to yards — the targets are landing, the production is not yet";

type Sort = "usage" | "points" | "signal";

const SORTS: { key: Sort; label: string }[] = [
  { key: "usage", label: "Opportunity" },
  { key: "points", label: "Points" },
  { key: "signal", label: "Signal" },
];

/**
 * What the table shows by default.
 *
 * "Movers" rather than everything: the point of this table is the players
 * whose production has come loose from their usage, and a reader scrolling
 * hundreds of rows to find them is being handed a database instead of an
 * answer. The full list is one click away, and /players is the reference view.
 */
type View = "movers" | "all";

/** Rows rendered at once; more load on request. */
const PAGE_SIZE = 25;

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
      <td className="numerals px-3 py-2.5 text-right text-ink-muted">
        {row.adot === null ? "—" : row.adot.toFixed(1)}
      </td>
      <td
        className={`numerals px-3 py-2.5 text-right ${
          row.yacShare !== null && row.yacShare >= 0.6
            ? "text-accent"
            : "text-ink-muted"
        }`}
        title={
          row.yacShare !== null && row.yacShare >= 0.6
            ? "Most of these yards came after the catch, which repeats less reliably than downfield volume"
            : undefined
        }
      >
        {row.yacShare === null ? "—" : `${Math.round(row.yacShare * 100)}%`}
      </td>
      <td className="numerals px-3 py-2.5 text-right text-ink">
        {row.points.toFixed(1)}
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
              title={
                row.signal === "underused" && row.underConverting
                  ? OWED_TITLE
                  : SIGNAL_TITLES[row.signal]
              }
            >
              {SIGNAL_LABELS[row.signal]}
              {row.signal === "underused" && row.underConverting && " · owed"}
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
  const [sort, setSort] = useState<Sort>("signal");
  const [view, setView] = useState<View>("movers");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const rows = useMemo(() => {
    const filtered = analytics.rows.filter((row) => {
      if (position && row.position !== position) return false;
      if (view === "movers" && (!row.signal || row.signal === "aligned")) {
        return false;
      }
      return true;
    });

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
  }, [analytics.rows, position, sort, view]);

  const shown = rows.slice(0, visible);

  // Any control change restarts the list from the top.
  const reset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setVisible(PAGE_SIZE);
    };

  const button = (active: boolean) =>
    `eyebrow rounded px-3 py-2 text-xs transition-colors ${
      active
        ? "bg-accent text-accent-ink"
        : "bg-surface text-ink-muted hover:bg-surface-2 hover:text-ink"
    }`;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => reset(setPosition)(null)}
            aria-pressed={position === null}
            className={button(position === null)}
          >
            All
          </button>
          {POSITIONS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => reset(setPosition)(value)}
              aria-pressed={position === value}
              className={button(position === value)}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1 sm:ml-auto">
          {(
            [
              ["movers", "Movers"],
              ["all", "All"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => reset(setView)(value)}
              aria-pressed={view === value}
              className={button(view === value)}
            >
              {label}
            </button>
          ))}
          <span className="eyebrow self-center pr-1 pl-2 text-[10px] text-ink-dim">
            Sort
          </span>
          {SORTS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => reset(setSort)(key)}
              aria-pressed={sort === key}
              className={button(sort === key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-240 border-collapse text-sm">
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
              <th
                className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim"
                title="Average depth of target, in yards. Receivers and tight ends only"
              >
                aDOT
              </th>
              <th
                className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim"
                title="Share of receiving yards gained after the catch"
              >
                YAC
              </th>
              <th className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim">
                Pts
              </th>
              <th className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim">
                Usage → scoring
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
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

      {visible < rows.length && (
        <button
          type="button"
          onClick={() => setVisible((value) => value + PAGE_SIZE)}
          className="eyebrow mt-4 w-full rounded border border-line bg-surface px-4 py-3 text-xs text-ink-muted transition-colors hover:border-line-bright hover:text-ink"
        >
          Show more · {rows.length - visible} remaining
        </button>
      )}
    </div>
  );
}
