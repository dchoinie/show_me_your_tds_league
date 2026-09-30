"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import type { TickerGame, TickerPayload } from "@/lib/sleeper";

/**
 * Matches the ticker cache's 30s window. Polling faster would just re-read
 * the same cached response.
 */
const POLL_MS = 30_000;

function Chip({ game, week }: { game: TickerGame; week: number }) {
  const [home, away] = game.sides;
  if (!home) return null;

  return (
    <Link
      href={`/matchups/${week}/${game.id}`}
      className="flex shrink-0 items-center gap-3 border-r border-line px-4 py-1.5 transition-colors hover:bg-surface-2"
    >
      <StatusBadge status={game.status} size="xs" />
      <span className="flex items-center gap-2 whitespace-nowrap text-sm">
        <span
          className={
            game.winnerRosterId === home.rosterId
              ? "font-semibold text-ink"
              : "text-ink-muted"
          }
        >
          {home.teamName}
        </span>
        {game.status === "preview" ? (
          <span className="text-ink-dim">vs</span>
        ) : (
          <span className="numerals text-ink">
            {home.points.toFixed(2)}
            <span className="px-1 text-ink-dim">–</span>
            {away ? away.points.toFixed(2) : "—"}
          </span>
        )}
        {away && (
          <span
            className={
              game.winnerRosterId === away.rosterId
                ? "font-semibold text-ink"
                : "text-ink-muted"
            }
          >
            {away.teamName}
          </span>
        )}
      </span>
    </Link>
  );
}

/**
 * The header ticker.
 *
 * Server-rendered from `initial` for the first paint, then refreshed in place
 * so scores move without a navigation. Updating the chips' text does not
 * restart the marquee: the track element itself is never remounted.
 */
export function ScoreTickerStrip({ initial }: { initial: TickerPayload }) {
  const [payload, setPayload] = useState(initial);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/score-strip", { cache: "no-store" });
      if (!res.ok) return;
      setPayload(await res.json());
    } catch {
      // Leave the last good scores on screen.
    }
  }, []);

  useEffect(() => {
    const run = () => {
      // Skip tabs nobody is looking at.
      if (document.visibilityState === "visible") void poll();
    };

    const interval = setInterval(run, POLL_MS);
    const onVisible = () => run();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  const { week, games } = payload;
  if (games.length === 0) return null;

  return (
    <>
      <span className="eyebrow z-10 flex h-full shrink-0 items-center bg-accent px-3 text-[10px] text-accent-ink">
        Week {week}
      </span>

      {/*
       * Two identical copies of the chip list sit side by side; the track
       * translates -50% so the loop is seamless. The clone is hidden under
       * reduced motion, where the strip becomes a plain scroll area.
       */}
      <div className="ticker-track flex w-max items-center">
        {games.map((game) => (
          <Chip key={game.id} game={game} week={week} />
        ))}
        <div className="flex items-center" data-ticker-clone="true" aria-hidden>
          {games.map((game) => (
            <Chip key={`clone-${game.id}`} game={game} week={week} />
          ))}
        </div>
      </div>
    </>
  );
}
