"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

function Arrow({
  href,
  label,
  direction,
}: {
  href: string | null;
  label: string;
  direction: "prev" | "next";
}) {
  const glyph = (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={direction === "prev" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );

  // At the first or last week there is nowhere to go, so render a disabled
  // control rather than a link that reloads the same page.
  if (!href) {
    return (
      <span
        aria-disabled="true"
        className="rounded border border-line p-2 text-ink-dim opacity-40"
      >
        <span className="sr-only">{label}</span>
        {glyph}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className="rounded border border-line p-2 text-ink-muted transition-colors hover:border-line-bright hover:text-ink"
    >
      {glyph}
    </Link>
  );
}

/**
 * Week navigation for the matchups page.
 *
 * Client-side only so the selected week can be scrolled into view: by week 14
 * the active chip sits off the right edge of a phone screen, and landing on a
 * strip with no visible selection reads as broken.
 */
export function WeekPicker({
  week,
  lastWeek,
  currentWeek,
  playoffWeekStart,
  basePath,
}: {
  week: number;
  lastWeek: number;
  currentWeek: number;
  playoffWeekStart: number | null;
  basePath: string;
}) {
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [week]);

  const weeks = Array.from({ length: lastWeek }, (_, index) => index + 1);

  return (
    <nav aria-label="Select week" className="flex items-center gap-2">
      <Arrow
        href={week > 1 ? `${basePath}/${week - 1}` : null}
        label="Previous week"
        direction="prev"
      />

      <ul className="flex flex-1 items-center gap-1 overflow-x-auto">
        {weeks.map((value) => {
          const isActive = value === week;
          const isPlayoff =
            playoffWeekStart !== null && value >= playoffWeekStart;
          const isFuture = value > currentWeek;
          const startsPlayoffs =
            playoffWeekStart !== null && value === playoffWeekStart;

          return (
            <li key={value} className="flex shrink-0 items-center">
              {/* Visual break between the regular season and the playoffs. */}
              {startsPlayoffs && value > 1 && (
                <span
                  aria-hidden="true"
                  className="mx-2 h-5 w-px shrink-0 bg-line-bright"
                />
              )}
              <Link
                ref={isActive ? activeRef : undefined}
                href={`${basePath}/${value}`}
                aria-current={isActive ? "page" : undefined}
                title={isPlayoff ? `Week ${value} · Playoffs` : `Week ${value}`}
                className={`numerals flex h-9 w-9 items-center justify-center rounded text-sm transition-colors ${
                  isActive
                    ? "bg-accent text-accent-ink"
                    : value === currentWeek
                      ? "border border-accent/60 text-accent"
                      : isFuture
                        ? "text-ink-dim hover:bg-surface-2 hover:text-ink-muted"
                        : "text-ink-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {value}
              </Link>
            </li>
          );
        })}
      </ul>

      <Arrow
        href={week < lastWeek ? `${basePath}/${week + 1}` : null}
        label="Next week"
        direction="next"
      />
    </nav>
  );
}
