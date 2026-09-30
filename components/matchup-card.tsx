import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { TeamAvatar } from "@/components/team-avatar";
import type { MatchupSide, WeekMatchup } from "@/lib/sleeper";

function record(side: MatchupSide): string {
  const { wins, losses, ties } = side.team;
  return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
}

function Side({
  side,
  matchup,
  isWinner,
}: {
  side: MatchupSide;
  matchup: WeekMatchup;
  isWinner: boolean;
}) {
  const preview = matchup.status === "preview";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${
        isWinner ? "bg-surface-2/50" : ""
      }`}
    >
      {/* Accent rail marks the leader, so the card reads at a glance. */}
      <span
        aria-hidden="true"
        className={`-ml-4 h-10 w-1 rounded-r ${
          isWinner ? "bg-accent" : "bg-transparent"
        }`}
      />
      <TeamAvatar name={side.team.teamName} src={side.team.avatarUrl} size={32} />

      <div className="min-w-0 flex-1">
        <span
          className={`block truncate ${
            isWinner ? "font-semibold text-ink" : "text-ink-muted"
          }`}
        >
          {side.team.teamName}
        </span>
        <div className="truncate text-xs text-ink-dim">
          {side.team.managerName} · {record(side)}
        </div>
      </div>

      <div className="shrink-0 text-right">
        {preview ? (
          <>
            <div className="numerals text-2xl leading-none text-ink">
              {side.projectedPoints?.toFixed(1) ?? "—"}
            </div>
            <div className="eyebrow mt-1 text-[10px] text-ink-dim">Proj</div>
          </>
        ) : (
          <>
            <div
              className={`numerals text-2xl leading-none ${
                isWinner ? "text-accent" : "text-ink"
              }`}
            >
              {side.points.toFixed(2)}
            </div>
            {/* While a game is live, the projection is the useful context. */}
            {matchup.status === "live" && side.projectedPoints !== null && (
              <div className="mt-1 text-[10px] text-ink-dim">
                Proj {side.projectedPoints.toFixed(1)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Header note: the result for a finished game, the edge for an upcoming one. */
function Meta({ matchup }: { matchup: WeekMatchup }) {
  if (matchup.sides.length < 2) {
    return <span className="text-xs text-ink-dim">Bye</span>;
  }

  if (matchup.isTie) {
    return <span className="text-xs text-ink-muted">Tie</span>;
  }

  if (matchup.status === "preview") {
    const [first, second] = matchup.sides;
    if (first.projectedPoints === null || second.projectedPoints === null) {
      return null;
    }
    const favorite =
      first.projectedPoints >= second.projectedPoints ? first : second;
    const spread = Math.abs(first.projectedPoints - second.projectedPoints);
    if (spread < 0.05) {
      return <span className="text-xs text-ink-dim">Even</span>;
    }
    return (
      <span className="truncate text-xs text-ink-dim">
        {favorite.team.teamName} by {spread.toFixed(1)}
      </span>
    );
  }

  if (matchup.margin > 0) {
    return (
      <span className="text-xs text-ink-dim">
        {matchup.status === "live" ? "Lead" : "Margin"}{" "}
        <span className="numerals text-ink-muted">
          {matchup.margin.toFixed(2)}
        </span>
      </span>
    );
  }

  return null;
}

export function MatchupCard({
  matchup,
  week,
}: {
  matchup: WeekMatchup;
  week: number;
}) {
  return (
    <Link
      href={`/matchups/${week}/${matchup.id}`}
      className="block rounded-lg transition-colors"
    >
      <article className="overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-accent/60">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
          <StatusBadge status={matchup.status} />
          <Meta matchup={matchup} />
        </header>

        <div className="divide-y divide-line/60">
          {matchup.sides.map((side) => (
            <Side
              key={side.team.rosterId}
              side={side}
              matchup={matchup}
              isWinner={matchup.winnerRosterId === side.team.rosterId}
            />
          ))}
        </div>
      </article>
    </Link>
  );
}
