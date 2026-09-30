"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { PositionBadge } from "@/components/player-row";
import type { DirectoryEntry, RosterSpot } from "@/lib/sleeper";

const POSITIONS = ["QB", "RB", "WR", "TE"] as const;

type Ownership = "all" | "rostered" | "available";

/**
 * Only persistent roster designations earn a badge. Starter vs bench is a
 * weekly lineup decision that churns every Sunday, so labelling it here would
 * be noise that is stale half the time.
 */
const BADGED_SPOTS: Partial<
  Record<RosterSpot, { label: string; className: string }>
> = {
  taxi: { label: "Taxi", className: "bg-sky-500/15 text-sky-300" },
  ir: { label: "IR", className: "bg-live/15 text-live" },
};

function badgeFor(spot: RosterSpot | null) {
  const badge = spot ? BADGED_SPOTS[spot] : undefined;
  if (!badge) return null;

  return (
    <span
      className={`eyebrow shrink-0 rounded px-1.5 py-0.5 text-[9px] ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

/** Rows rendered at once; more load as the reader asks for them. */
const PAGE_SIZE = 50;

export function PlayerDirectory({ entries }: { entries: DirectoryEntry[] }) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<string | null>(null);
  const [ownership, setOwnership] = useState<Ownership>("all");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return entries.filter((entry) => {
      if (position && entry.position !== position) return false;
      if (ownership === "rostered" && !entry.team) return false;
      if (ownership === "available" && entry.team) return false;
      if (needle && !entry.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [entries, query, position, ownership]);

  // Any filter change starts the list over from the top.
  const reset = <T,>(setter: (value: T) => void) => {
    return (value: T) => {
      setter(value);
      setVisible(PAGE_SIZE);
    };
  };

  const shown = filtered.slice(0, visible);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(event) => reset(setQuery)(event.target.value)}
          placeholder="Search players"
          aria-label="Search players"
          className="w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-dim focus:border-accent focus:outline-none sm:max-w-xs"
        />

        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => reset(setPosition)(null)}
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
              onClick={() => reset(setPosition)(value)}
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
              className={`eyebrow rounded px-3 py-2 text-xs transition-colors ${
                ownership === value
                  ? "bg-accent text-accent-ink"
                  : "bg-surface text-ink-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-2 text-xs text-ink-dim">
        <span className="numerals text-ink-muted">{filtered.length}</span>{" "}
        {filtered.length === 1 ? "player" : "players"}
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-bright bg-surface/40 px-6 py-14 text-center text-ink-muted">
          No players match those filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-152 border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="eyebrow px-3 py-2 text-left text-[10px] text-ink-dim">
                  Player
                </th>
                <th className="eyebrow px-3 py-2 text-left text-[10px] text-ink-dim">
                  Owner
                </th>
                <th className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim">
                  Pts
                </th>
                <th className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim">
                  GP
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((entry) => (
                <tr
                  key={entry.playerId}
                  className="border-b border-line/60 transition-colors hover:bg-surface-2/60"
                >
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <PositionBadge position={entry.position} />
                      <span className="min-w-0">
                        <span className="block truncate text-ink">
                          {entry.name}
                          {entry.injuryStatus && (
                            <span className="ml-2 text-[10px] font-semibold text-live">
                              {entry.injuryStatus}
                            </span>
                          )}
                        </span>
                        <span className="numerals text-[11px] text-ink-dim">
                          {entry.nflTeam ?? "FA"}
                        </span>
                      </span>
                    </span>
                  </td>

                  <td className="px-3 py-2.5">
                    {entry.team ? (
                      <span className="flex items-center gap-2">
                        <Link
                          href={`/teams/${entry.team.rosterId}`}
                          className="min-w-0 truncate text-ink-muted transition-colors hover:text-accent"
                        >
                          {entry.team.teamName}
                        </Link>
                        {badgeFor(entry.spot)}
                      </span>
                    ) : (
                      <span className="eyebrow text-[10px] text-win">
                        Available
                      </span>
                    )}
                  </td>

                  <td className="numerals px-3 py-2.5 text-right text-ink">
                    {entry.points.toFixed(1)}
                  </td>
                  <td className="numerals px-3 py-2.5 text-right text-ink-dim">
                    {entry.games}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visible < filtered.length && (
        <button
          type="button"
          onClick={() => setVisible((value) => value + PAGE_SIZE)}
          className="eyebrow mt-4 w-full rounded border border-line bg-surface px-4 py-3 text-xs text-ink-muted transition-colors hover:border-line-bright hover:text-ink"
        >
          Show more · {filtered.length - visible} remaining
        </button>
      )}
    </div>
  );
}
