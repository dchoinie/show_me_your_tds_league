import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { getScoreStrip, type WeekMatchup } from "@/lib/sleeper";

const STRIP_HEIGHT = "h-10";

/** Reserves the ticker's height while it streams in. */
export function ScoreTickerFallback() {
  return (
    <div
      className={`${STRIP_HEIGHT} border-b border-line bg-surface`}
      aria-hidden="true"
    />
  );
}

function Chip({ matchup, week }: { matchup: WeekMatchup; week: number }) {
  const [home, away] = matchup.sides;
  if (!home) return null;

  return (
    <Link
      href={`/matchups/${week}/${matchup.id}`}
      className="flex shrink-0 items-center gap-3 border-r border-line px-4 py-1.5 transition-colors hover:bg-surface-2"
    >
      <StatusBadge status={matchup.status} size="xs" />
      <span className="flex items-center gap-2 whitespace-nowrap text-sm">
        <span
          className={
            matchup.winnerRosterId === home.team.rosterId
              ? "font-semibold text-ink"
              : "text-ink-muted"
          }
        >
          {home.team.teamName}
        </span>
        {matchup.status === "preview" ? (
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
              matchup.winnerRosterId === away.team.rosterId
                ? "font-semibold text-ink"
                : "text-ink-muted"
            }
          >
            {away.team.teamName}
          </span>
        )}
      </span>
    </Link>
  );
}

export async function ScoreTicker() {
  const { week, matchups } = await getScoreStrip();

  if (matchups.length === 0) return <ScoreTickerFallback />;

  return (
    <div
      className={`ticker ${STRIP_HEIGHT} relative flex items-center overflow-hidden border-b border-line bg-surface`}
    >
      <span className="eyebrow z-10 flex h-full shrink-0 items-center bg-accent px-3 text-[10px] text-accent-ink">
        Week {week}
      </span>

      {/*
       * Two identical copies of the chip list sit side by side; the track
       * translates -50% so the loop is seamless. The clone is hidden under
       * reduced motion, where the strip becomes a plain scroll area.
       */}
      <div className="ticker-track flex w-max items-center">
        {matchups.map((matchup) => (
          <Chip key={matchup.id} matchup={matchup} week={week} />
        ))}
        <div className="flex items-center" data-ticker-clone="true" aria-hidden>
          {matchups.map((matchup) => (
            <Chip key={`clone-${matchup.id}`} matchup={matchup} week={week} />
          ))}
        </div>
      </div>
    </div>
  );
}
