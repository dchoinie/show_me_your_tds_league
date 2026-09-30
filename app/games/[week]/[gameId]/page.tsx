import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GameTrackerView } from "@/components/game-tracker";
import { PageHeader } from "@/components/page-shell";
import {
  getGameTracker,
  getLeagueSummary,
  getWeekPreview,
} from "@/lib/sleeper";

/**
 * Every NFL game of the season.
 *
 * Needed for more than speed: reading `params` on a route with no static
 * params is a dynamic access, which under Cache Components stops the route
 * prerendering at all. Enumerating them here keeps this page consistent with
 * the other dynamic routes. The live scores still arrive client-side.
 */
export async function generateStaticParams() {
  const { lastWeek } = await getLeagueSummary();
  const weeks = Array.from({ length: lastWeek }, (_, index) => index + 1);

  const perWeek = await Promise.all(
    weeks.map(async (week) => {
      const preview = await getWeekPreview(week);
      if (!preview) return [];

      return preview.slates.flatMap((slate) =>
        slate.games.map((game) => ({
          week: String(week),
          gameId: game.gameId,
        })),
      );
    }),
  );

  return perWeek.flat();
}

export async function generateMetadata({
  params,
}: PageProps<"/games/[week]/[gameId]">): Promise<Metadata> {
  const { week, gameId } = await params;
  const game = await getGameTracker(Number(week), gameId);

  if (!game) return { title: "Game" };

  return {
    title: `${game.away} @ ${game.home} · Week ${game.week}`,
    description: `Live fantasy points for every league starter in ${game.away} at ${game.home}.`,
  };
}

function whenLabel(game: { daysAway: number; status: string }): string {
  if (game.status === "complete") return "Final";
  if (game.daysAway < 0) return "In progress";
  if (game.daysAway === 0) return "Today";
  if (game.daysAway === 1) return "Tomorrow";
  return `In ${game.daysAway} days`;
}

export default async function GamePage({
  params,
}: PageProps<"/games/[week]/[gameId]">) {
  const { week: rawWeek, gameId } = await params;
  const week = Number(rawWeek);
  if (!Number.isInteger(week)) notFound();

  const game = await getGameTracker(week, gameId);
  if (!game) notFound();

  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
  }).format(new Date(`${game.date}T12:00:00Z`));

  // Kickoff is rendered in US Eastern, the timezone the NFL schedules in, and
  // labelled as such so nobody reads it as their own local time.
  const kickoff = game.facts?.kickoff
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(game.facts.kickoff))
    : null;

  const spread = game.facts?.spreadLine;
  const line =
    spread === null || spread === undefined
      ? null
      : spread === 0
        ? "Pick'em"
        : spread < 0
          ? `${game.home} ${spread}`
          : `${game.away} -${spread}`;

  const detail = [
    kickoff ? `${kickoff} ET` : null,
    game.facts?.stadium || null,
    game.facts?.location === "Neutral" ? "Neutral site" : null,
    game.facts?.divisionGame ? "Division game" : null,
    line,
    game.facts?.totalLine != null ? `O/U ${game.facts.totalLine}` : null,
  ].filter(Boolean) as string[];

  return (
    <>
      <PageHeader
        eyebrow={`Week ${game.week} · ${game.weekday} ${date}`}
        title={`${game.away} @ ${game.home}`}
      >
        {game.starters.length === 0
          ? "No league starters are playing in this game."
          : `${game.starters.length} league starters are in this game. Scores update automatically.`}
      </PageHeader>

      {detail.length > 0 && (
        <div className="border-b border-line bg-surface/40">
          <div className="mx-auto flex max-w-3xl flex-wrap gap-x-3 gap-y-1 px-4 py-3 text-xs text-ink-dim sm:px-6">
            {detail.map((item, index) => (
              <span key={item} className="flex gap-3">
                {index > 0 && <span aria-hidden="true">·</span>}
                <span>{item}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-5 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="eyebrow text-xs text-ink-dim transition-colors hover:text-accent"
          >
            ← Week {game.week}
          </Link>
          <span className="eyebrow text-[10px] text-ink-dim">
            {whenLabel(game)}
          </span>
        </div>

        {game.starters.length > 0 ? (
          <GameTrackerView game={game} />
        ) : (
          <p className="rounded-lg border border-dashed border-line-bright bg-surface/40 px-6 py-14 text-center text-ink-muted">
            Nobody in the league is starting a player from {game.away} or{" "}
            {game.home} this week.
          </p>
        )}

        <p className="mt-6 text-xs text-ink-dim">
          Fantasy points come from Sleeper, scored under this league&apos;s
          rules. Sleeper updates scoring around a minute behind the play.
        </p>
      </div>
    </>
  );
}
