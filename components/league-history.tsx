import type { ReactNode } from "react";

import { TeamAvatar } from "@/components/team-avatar";
import type {
  AllTimeRow,
  HistoryManager,
  LeagueHistory,
  SeasonResult,
} from "@/lib/sleeper";

function Manager({ manager }: { manager: HistoryManager | null }) {
  if (!manager) return <span className="text-ink-dim">—</span>;

  return (
    <span className="flex min-w-0 items-center gap-2">
      <TeamAvatar name={manager.teamName} src={manager.avatarUrl} size={20} />
      <span className="min-w-0 truncate text-ink">{manager.teamName}</span>
    </span>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`eyebrow whitespace-nowrap px-3 py-2 text-[10px] text-ink-dim ${
        align === "left" ? "text-left" : "text-right"
      }`}
    >
      {children}
    </th>
  );
}

function SeasonRow({ season }: { season: SeasonResult }) {
  return (
    <tr className="border-b border-line/60">
      <td className="px-3 py-3">
        <span className="numerals text-ink">{season.season}</span>
        {season.inProgress && (
          <span className="eyebrow mt-0.5 block text-[10px] text-accent">
            Wk {season.throughWeek}
          </span>
        )}
      </td>

      <td className="px-3 py-3">
        <span className="flex items-center gap-2">
          {/* A trophy only once the title is actually won. */}
          <span aria-hidden="true" className="shrink-0">
            {season.inProgress ? (
              <span className="eyebrow text-[10px] text-ink-dim">Leads</span>
            ) : (
              "🏆"
            )}
          </span>
          <Manager manager={season.champion ?? season.leader} />
        </span>
      </td>

      <td className="numerals px-3 py-3 text-right text-ink-muted">
        {season.leaderRecord ?? "—"}
      </td>

      <td className="px-3 py-3">
        <Manager manager={season.runnerUp} />
      </td>

      <td className="px-3 py-3">
        <span className="flex items-baseline gap-2">
          <Manager manager={season.topScorer} />
          {season.topScorerPoints !== null && (
            <span className="numerals shrink-0 text-xs text-ink-dim">
              {season.topScorerPoints.toFixed(0)}
            </span>
          )}
        </span>
      </td>
    </tr>
  );
}

function AllTimeRowView({ row }: { row: AllTimeRow }) {
  return (
    <tr className="border-b border-line/60 transition-colors hover:bg-surface-2/60">
      <td className="px-3 py-3">
        <Manager manager={row.manager} />
      </td>
      <td className="numerals px-3 py-3 text-right">
        {row.titles > 0 ? (
          <span className="text-accent">{"🏆".repeat(row.titles)}</span>
        ) : (
          <span className="text-ink-dim">—</span>
        )}
      </td>
      <td className="numerals px-3 py-3 text-right text-ink-muted">
        {row.seasons}
      </td>
      <td className="numerals px-3 py-3 text-right text-ink">
        {row.wins}-{row.losses}
        {row.ties > 0 ? `-${row.ties}` : ""}
      </td>
      <td className="numerals px-3 py-3 text-right text-ink-muted">
        {row.pointsFor.toFixed(1)}
      </td>
      <td className="numerals px-3 py-3 text-right text-ink-muted">
        {row.bestFinish === null ? "—" : `#${row.bestFinish}`}
      </td>
    </tr>
  );
}

export function LeagueHistorySection({
  history,
}: {
  history: LeagueHistory;
}) {
  const { seasons, allTime, hasCompletedSeason } = history;
  const live = seasons.find((season) => season.inProgress);

  return (
    <section>
      <div className="mb-5">
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
          League History
        </h2>
        {!hasCompletedSeason && live && (
          <p className="mt-1 text-sm text-ink-dim">
            {live.season} is the league&apos;s first season — these are the
            standings through week {live.throughWeek}, and they become the
            first line of the record book once it is done.
          </p>
        )}
      </div>

      <div className="space-y-10">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-152 border-collapse text-sm">
            <caption className="sr-only">Champions by season</caption>
            <thead>
              <tr className="border-b border-line">
                <Th>Season</Th>
                <Th>Champion</Th>
                <Th align="right">Record</Th>
                <Th>Runner-up</Th>
                <Th>Most points</Th>
              </tr>
            </thead>
            <tbody>
              {seasons.map((season) => (
                <SeasonRow key={season.leagueId} season={season} />
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="eyebrow mb-2 text-xs text-ink-muted">All time</h3>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-152 border-collapse text-sm">
              <caption className="sr-only">All-time records</caption>
              <thead>
                <tr className="border-b border-line">
                  <Th>Manager</Th>
                  <Th align="right">Titles</Th>
                  <Th align="right">Seasons</Th>
                  <Th align="right">Record</Th>
                  <Th align="right">Points</Th>
                  <Th align="right">Best</Th>
                </tr>
              </thead>
              <tbody>
                {allTime.map((row) => (
                  <AllTimeRowView key={row.manager.ownerId} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
