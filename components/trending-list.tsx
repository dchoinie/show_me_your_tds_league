import Link from "next/link";

import { PositionBadge } from "@/components/player-row";
import type { TrendingEntry } from "@/lib/sleeper";

/** 5,701,885 -> 5.7M. Raw counts run to seven digits and read as noise. */
function compact(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}K`;
  return String(count);
}

export function TrendingList({
  title,
  entries,
  tone,
}: {
  title: string;
  entries: TrendingEntry[];
  tone: "add" | "drop";
}) {
  if (entries.length === 0) return null;

  return (
    <div>
      <h3 className="eyebrow mb-2 text-xs text-ink-muted">{title}</h3>
      <ul className="divide-y divide-line/60 rounded-lg border border-line bg-surface px-4">
        {entries.map((entry) => (
          <li key={entry.playerId} className="flex items-center gap-3 py-2.5">
            <PositionBadge position={entry.position} />

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-ink">
                {entry.name}
              </span>
              <span className="numerals text-[11px] text-ink-dim">
                {entry.nflTeam ?? "FA"}
              </span>
            </span>

            {/* Whether they are actually gettable here is the useful part. */}
            {entry.team ? (
              <Link
                href={`/teams/${entry.team.rosterId}`}
                className="hidden max-w-32 shrink-0 truncate text-xs text-ink-dim transition-colors hover:text-accent sm:block"
              >
                {entry.team.teamName}
              </Link>
            ) : (
              <span className="eyebrow shrink-0 text-[10px] text-win">
                Available
              </span>
            )}

            <span
              className={`numerals w-12 shrink-0 text-right text-sm ${
                tone === "add" ? "text-ink" : "text-ink-dim"
              }`}
            >
              {compact(entry.count)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
