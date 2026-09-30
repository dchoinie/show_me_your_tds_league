import { ScoreTickerStrip } from "@/components/score-ticker-strip";
import { getTickerPayload } from "@/lib/sleeper";

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

/**
 * Server shell for the header ticker.
 *
 * Fetches the first payload so the strip is populated on first paint, then
 * hands off to a client component that refreshes it in place - otherwise the
 * scores would sit frozen for anyone who leaves a page open on a Sunday.
 */
export async function ScoreTicker() {
  const payload = await getTickerPayload();

  if (payload.games.length === 0) return <ScoreTickerFallback />;

  return (
    <div
      className={`ticker ${STRIP_HEIGHT} relative flex items-center overflow-hidden border-b border-line bg-surface`}
    >
      <ScoreTickerStrip initial={payload} />
    </div>
  );
}
