"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TeamAvatar } from "@/components/team-avatar";
import type { GameStarter, GameTracker, TeamRef } from "@/lib/sleeper";

/** Sleeper's own scoring lags the play by 30-90s; faster polling gains nothing. */
const POLL_MS = 30_000;

type Points = Record<string, number>;

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

function relative(from: number | null): string {
  if (from === null) return "";
  const seconds = Math.max(0, Math.round((Date.now() - from) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

function StarterRow({
  starter,
  points,
  delta,
  selected,
  dimmed,
  onSelect,
}: {
  starter: GameStarter;
  points: number | undefined;
  delta: number | undefined;
  selected: boolean;
  dimmed: boolean;
  onSelect: (rosterId: number) => void;
}) {
  return (
    <li
      className={`flex items-center gap-3 border-b border-line/60 py-2.5 last:border-0 transition-opacity ${
        dimmed ? "opacity-30" : ""
      }`}
    >
      <span className="numerals w-7 shrink-0 text-[11px] text-ink-dim">
        {starter.position ?? "—"}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm ${selected ? "font-semibold text-accent" : "text-ink"}`}
        >
          {shortName(starter.name)}
        </span>
        <span className="numerals text-[11px] text-ink-dim">
          {starter.nflTeam ?? "FA"}
        </span>
      </span>

      <button
        type="button"
        onClick={() => onSelect(starter.fantasyTeam.rosterId)}
        className={`max-w-28 shrink-0 truncate text-[11px] transition-colors ${
          selected ? "text-accent" : "text-ink-dim hover:text-ink-muted"
        }`}
      >
        {starter.fantasyTeam.teamName}
      </button>

      <span className="w-20 shrink-0 text-right">
        <span
          className={`numerals text-lg ${selected ? "text-accent" : "text-ink"}`}
        >
          {points === undefined ? "—" : points.toFixed(2)}
        </span>
        {/* Deltas come free from diffing consecutive polls. */}
        {delta !== undefined && delta > 0 && (
          <span className="numerals block text-[11px] text-win">
            +{delta.toFixed(2)}
          </span>
        )}
      </span>
    </li>
  );
}

export function GameTrackerView({ game }: { game: GameTracker }) {
  const [points, setPoints] = useState<Points>({});
  const [deltas, setDeltas] = useState<Points>({});
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [, setTick] = useState(0);

  const previous = useRef<Points>({});

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/live/${game.week}`, { cache: "no-store" });
      if (!res.ok) {
        setFailed(true);
        return;
      }
      const data: { points: Points; updatedAt: number } = await res.json();

      const changed: Points = {};
      for (const [id, value] of Object.entries(data.points)) {
        const before = previous.current[id];
        if (before !== undefined && value > before) changed[id] = value - before;
      }

      previous.current = data.points;
      setPoints(data.points);
      // Keep the last non-zero delta visible until that player scores again.
      setDeltas((current) => ({ ...current, ...changed }));
      setUpdatedAt(data.updatedAt);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [game.week]);

  useEffect(() => {
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      void poll();
    };

    // Scheduled rather than called straight from the effect body, so every
    // state update happens in a callback instead of during the effect.
    const first = setTimeout(run, 0);

    const interval = setInterval(() => {
      // No point polling a tab nobody is looking at.
      if (document.visibilityState === "visible") run();
    }, POLL_MS);

    // Catch up immediately when someone comes back to the tab.
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  // Re-render once a second so the "updated Ns ago" label stays honest.
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const teams = useMemo(() => {
    const seen = new Map<number, TeamRef>();
    for (const starter of game.starters) {
      seen.set(starter.fantasyTeam.rosterId, starter.fantasyTeam);
    }
    return [...seen.values()].sort((a, b) =>
      a.teamName.localeCompare(b.teamName),
    );
  }, [game.starters]);

  const ordered = useMemo(() => {
    const scored = game.starters.some(
      (starter) => (points[starter.playerId] ?? 0) > 0,
    );
    if (!scored) return game.starters;

    return [...game.starters].sort(
      (a, b) => (points[b.playerId] ?? 0) - (points[a.playerId] ?? 0),
    );
  }, [game.starters, points]);

  const toggle = (rosterId: number) =>
    setSelectedTeam((current) => (current === rosterId ? null : rosterId));

  return (
    <div>
      {teams.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          <span className="eyebrow mr-1 text-[10px] text-ink-dim">
            Spot a team
          </span>
          {teams.map((team) => {
            const active = team.rosterId === selectedTeam;
            return (
              <button
                key={team.rosterId}
                type="button"
                onClick={() => toggle(team.rosterId)}
                aria-pressed={active}
                className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors ${
                  active
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-line text-ink-muted hover:border-line-bright hover:text-ink"
                }`}
              >
                <TeamAvatar
                  name={team.teamName}
                  src={team.avatarUrl}
                  size={16}
                />
                <span className="max-w-28 truncate">{team.teamName}</span>
              </button>
            );
          })}
          {selectedTeam !== null && (
            <button
              type="button"
              onClick={() => setSelectedTeam(null)}
              className="eyebrow rounded-full px-2 py-1 text-[10px] text-ink-dim transition-colors hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <ul className="rounded-lg border border-line bg-surface px-4">
        {ordered.map((starter) => (
          <StarterRow
            key={starter.playerId}
            starter={starter}
            points={points[starter.playerId]}
            delta={deltas[starter.playerId]}
            selected={starter.fantasyTeam.rosterId === selectedTeam}
            dimmed={
              selectedTeam !== null &&
              starter.fantasyTeam.rosterId !== selectedTeam
            }
            onSelect={toggle}
          />
        ))}
      </ul>

      <p className="mt-3 text-xs text-ink-dim">
        {failed
          ? "Couldn't reach Sleeper — showing the last good numbers."
          : updatedAt === null
            ? "Loading scores…"
            : `Updated ${relative(updatedAt)} · refreshes every ${POLL_MS / 1000}s`}
      </p>
    </div>
  );
}
