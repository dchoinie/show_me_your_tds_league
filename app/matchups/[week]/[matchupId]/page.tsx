import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MatchupDetailView } from "@/components/matchup-detail";
import { PageHeader } from "@/components/page-shell";
import {
  getLeagueSummary,
  getMatchupDetail,
  getWeekMatchups,
} from "@/lib/sleeper";

export async function generateStaticParams() {
  const { lastWeek } = await getLeagueSummary();
  const weeks = Array.from({ length: lastWeek }, (_, index) => index + 1);

  const perWeek = await Promise.all(
    weeks.map(async (week) => {
      const matchups = await getWeekMatchups(week);
      return matchups.map((matchup) => ({
        week: String(week),
        matchupId: matchup.id,
      }));
    }),
  );

  return perWeek.flat();
}

export async function generateMetadata({
  params,
}: PageProps<"/matchups/[week]/[matchupId]">): Promise<Metadata> {
  const { week, matchupId } = await params;
  const detail = await getMatchupDetail(Number(week), matchupId);

  if (!detail) return { title: `Week ${week} matchup` };

  const names = detail.matchup.sides
    .map((side) => side.team.teamName)
    .join(" vs ");

  return {
    title: `${names} · Week ${week}`,
    description: `Lineups, scores and projections for ${names} in week ${week}.`,
  };
}

export default async function MatchupDetailPage({
  params,
}: PageProps<"/matchups/[week]/[matchupId]">) {
  const { week: rawWeek, matchupId } = await params;
  const week = Number(rawWeek);
  if (!Number.isInteger(week)) notFound();

  const detail = await getMatchupDetail(week, matchupId);
  if (!detail) notFound();

  const title = detail.matchup.sides
    .map((side) => side.team.teamName)
    .join(" vs ");

  return (
    <>
      <PageHeader eyebrow={`Week ${week}`} title={title} />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <Link
          href={`/matchups/${week}`}
          className="eyebrow mb-4 inline-block text-xs text-ink-dim transition-colors hover:text-accent"
        >
          ← Week {week} matchups
        </Link>

        <MatchupDetailView detail={detail} />
      </div>
    </>
  );
}
