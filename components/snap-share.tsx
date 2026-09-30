"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { PositionBadge } from "@/components/player-row";
import type { SnapAnalytics, SnapRow, SnapTrend } from "@/lib/sleeper";

const POSITIONS = ["QB", "RB", "WR", "TE"] as const;

type Ownership = "all" | "rostered" | "available";

const TREND_STYLES: Record<SnapTrend, string> = {
  rising: "text-win",
  steady: "text-ink-dim",
  falling: "text-live",
};

const TREND_GLYPHS: Record<SnapTrend, string> = {
  rising: "▲",
  steady: "·",
  falling: "▼",
};

const pct = (value: number) => `${Math.round(value * 100)}%`;

/**
 * What the table shows by default.
 *
 * Movers, not everyone: the whole point is roles that are changing, and a
 * steady 70% snap share is the absence of news. The full list is a click away.
 */
type Movement = "movers" | "rising" | "falling" | "all";

/** Rows rendered at once; more load on request. */
const PAGE_SIZE = 25;

/**
 * Weekly snap share as a sparkline.
 *
 * The shape is the point - a number cannot show you a role climbing. Bars sit
 * in the de-emphasis tone with the most recent week in the accent, so the eye
 * lands on where the player is now.
 */
function Sparkline({
  row,
  throughWeek,
}: {
  row: SnapRow;
  throughWeek: number;
}) {
  if (row.weeks.length === 0) return null;

  const byWeek = new Map(row.weeks.map((week) => [week.week, week]));
  const slots = Array.from({ length: throughWeek }, (_, i) => i + 1);
  const lastPlayed = row.weeks[row.weeks.length - 1].week;

  return (
    <span
      className="flex h-6 items-end gap-0.5"
      role="img"
      aria-label={slots
        .map((week) => {
          const played = byWeek.get(week);
          return played
            ? `week ${week} ${pct(played.pct)}`
            : `week ${week} did not play`;
        })
        .join(", ")}
    >
      {slots.map((week) => {
        const played = byWeek.get(week);

        // A week with no row is a game missed, not a zero. Drawing a slot for
        // every week is what makes an absence visible - otherwise a player
        // returning from injury looks like a sudden promotion.
        if (!played) {
          return (
            <span
              key={week}
              className="h-0.5 w-1.5 rounded-sm bg-line-bright"
              title={`Week ${week}: did not play`}
            />
          );
        }

        return (
          <span
            key={week}
            style={{ height: `${Math.max(8, played.pct * 100)}%` }}
            className={`w-1.5 rounded-sm ${
              week === lastPlayed ? "bg-accent" : "bg-accent/30"
            }`}
            title={`Week ${week}: ${pct(played.pct)} (${played.snaps} snaps)`}
          />
        );
      })}
    </span>
  );
}

function Row({ row, throughWeek }: { row: SnapRow; throughWeek: number }) {
  return (
    <tr className="border-b border-line/60 transition-colors hover:bg-surface-2/60">
      <td className="px-3 py-2.5">
        <span className="flex items-center gap-2.5">
          <PositionBadge position={row.position} />
          <span className="min-w-0">
            <span className="block truncate text-ink">
              {row.name}
              {row.injuryStatus && (
                <span className="ml-2 text-[10px] font-semibold text-live">
                  {row.injuryStatus}
                </span>
              )}
            </span>
            <span className="numerals text-[11px] text-ink-dim">
              {row.nflTeam ?? "FA"} · {row.totalSnaps} snaps
              {row.weeks.length < throughWeek && (
                <span className="text-live">
                  {" "}
                  · missed {throughWeek - row.weeks.length}
                </span>
              )}
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
          <span className="eyebrow text-[10px] text-win">Available</span>
        )}
      </td>

      <td className="px-3 py-2.5">
        <Sparkline row={row} throughWeek={throughWeek} />
      </td>

      <td className="numerals px-3 py-2.5 text-right text-ink-muted">
        {pct(row.seasonPct)}
      </td>
      <td className="numerals px-3 py-2.5 text-right text-ink">
        {pct(row.latestPct)}
      </td>
      <td className="px-3 py-2.5 text-right">
        <span
          className={`numerals text-xs ${TREND_STYLES[row.direction]}`}
          title={
            row.trend === null
              ? "Not enough weeks yet to call a trend"
              : `${row.trend > 0 ? "Up" : "Down"} ${pct(Math.abs(row.trend))} against earlier weeks`
          }
        >
          {TREND_GLYPHS[row.direction]}
          {row.trend !== null && row.direction !== "steady" && (
            <> {pct(Math.abs(row.trend))}</>
          )}
        </span>
      </td>
    </tr>
  );
}

export function SnapShareTable({ analytics }: { analytics: SnapAnalytics }) {
  const [position, setPosition] = useState<string | null>(null);
  const [ownership, setOwnership] = useState<Ownership>("all");
  const [movement, setMovement] = useState<Movement>("movers");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const rows = useMemo(() => {
    return analytics.rows
      .filter((row) => {
        if (position && row.position !== position) return false;
        if (ownership === "rostered" && !row.team) return false;
        if (ownership === "available" && row.team) return false;
        if (movement === "movers" && row.direction === "steady") return false;
        if (movement === "rising" && row.direction !== "rising") return false;
        if (movement === "falling" && row.direction !== "falling") return false;
        return true;
      })
      .sort(
        (a, b) =>
          (b.trend ?? -Infinity) - (a.trend ?? -Infinity) ||
          b.latestPct - a.latestPct,
      );
  }, [analytics.rows, position, ownership, movement]);

  const shown = rows.slice(0, visible);
  const throughWeek = analytics.throughWeek ?? 0;

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
              ["all", "All"],
              ["rostered", "Rostered"],
              ["available", "Available"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => reset(setOwnership)(value)}
              aria-pressed={ownership === value}
              className={button(ownership === value)}
            >
              {label}
            </button>
          ))}
          <span className="eyebrow self-center pr-1 pl-2 text-[10px] text-ink-dim">
            Show
          </span>
          {(
            [
              ["movers", "Movers"],
              ["rising", "Rising"],
              ["falling", "Falling"],
              ["all", "All"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => reset(setMovement)(value)}
              aria-pressed={movement === value}
              className={button(movement === value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-2 text-xs text-ink-dim">
        <span className="numerals text-ink-muted">{rows.length}</span>{" "}
        {rows.length === 1 ? "player" : "players"}
      </p>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-bright bg-surface/40 px-6 py-14 text-center text-ink-muted">
          No players match those filters.
        </p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-176 border-collapse text-sm">
            <caption className="sr-only">Snap share by week</caption>
            <thead>
              <tr className="border-b border-line">
                <th className="eyebrow px-3 py-2 text-left text-[10px] text-ink-dim">
                  Player
                </th>
                <th className="eyebrow px-3 py-2 text-left text-[10px] text-ink-dim">
                  Owner
                </th>
                <th className="eyebrow px-3 py-2 text-left text-[10px] text-ink-dim">
                  By week
                </th>
                <th className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim">
                  Season
                </th>
                <th className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim">
                  Latest
                </th>
                <th
                  className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim"
                  title="The latest week against the average of the weeks before it"
                >
                  Trend
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <Row key={row.playerId} row={row} throughWeek={throughWeek} />
              ))}
            </tbody>
          </table>
        </div>
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
