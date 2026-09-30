import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-shell";
import { TeamAvatar } from "@/components/team-avatar";
import { getLeagueSummary, getStandings } from "@/lib/sleeper";

export const metadata: Metadata = {
  title: "Teams",
  description: "All twelve franchises, their managers and their rosters.",
};

export default async function TeamsPage() {
  const [standings, summary] = await Promise.all([
    getStandings(),
    getLeagueSummary(),
  ]);

  return (
    <>
      <PageHeader eyebrow="League" title="Teams">
        All {summary.teamCount} franchises, ordered by current standing.
      </PageHeader>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {standings.map((team) => {
            const inPlayoffs =
              summary.playoffTeams !== null && team.rank <= summary.playoffTeams;

            return (
              <li key={team.rosterId}>
                <Link
                  href={`/teams/${team.rosterId}`}
                  className="flex h-full items-start gap-4 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-bright"
                >
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <span className="numerals text-2xl text-ink-dim">
                      {team.rank}
                    </span>
                    {/* Marks the current playoff field at a glance. */}
                    {inPlayoffs && (
                      <span
                        className="h-1 w-5 rounded bg-accent"
                        title="In playoff position"
                      />
                    )}
                  </div>

                  <TeamAvatar
                    name={team.teamName}
                    src={team.avatarUrl}
                    size={44}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">
                      {team.teamName}
                    </p>
                    <p className="truncate text-sm text-ink-dim">
                      {team.managerName}
                    </p>

                    <dl className="mt-3 flex gap-4 text-xs">
                      <div>
                        <dt className="eyebrow text-[10px] text-ink-dim">
                          Rec
                        </dt>
                        <dd className="numerals text-ink">
                          {team.wins}-{team.losses}
                          {team.ties > 0 ? `-${team.ties}` : ""}
                        </dd>
                      </div>
                      <div>
                        <dt className="eyebrow text-[10px] text-ink-dim">PF</dt>
                        <dd className="numerals text-ink">
                          {team.pointsFor.toFixed(1)}
                        </dd>
                      </div>
                      <div>
                        <dt className="eyebrow text-[10px] text-ink-dim">PA</dt>
                        <dd className="numerals text-ink-muted">
                          {team.pointsAgainst.toFixed(1)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
