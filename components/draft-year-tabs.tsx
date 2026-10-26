"use client";

import { useState, type ReactNode } from "react";

/**
 * Switches between rookie draft boards by season.
 *
 * The boards themselves are rendered on the server and passed in as panels;
 * this only decides which one is visible.
 */
export function DraftYearTabs({
  seasons,
  panels,
}: {
  seasons: string[];
  panels: ReactNode[];
}) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div
        role="tablist"
        aria-label="Draft season"
        className="mb-4 inline-flex rounded-lg border border-line bg-surface p-0.5"
      >
        {seasons.map((season, index) => (
          <button
            key={season}
            type="button"
            role="tab"
            aria-selected={index === active}
            onClick={() => setActive(index)}
            className={`numerals rounded-md px-3 py-1 text-xs transition-colors ${
              index === active
                ? "bg-accent/10 text-accent"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {season}
          </button>
        ))}
      </div>

      {panels.map((panel, index) => (
        <div key={seasons[index]} role="tabpanel" hidden={index !== active}>
          {panel}
        </div>
      ))}
    </div>
  );
}
