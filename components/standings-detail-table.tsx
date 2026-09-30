import Link from "next/link";
import type { ReactNode } from "react";

import { TeamAvatar } from "@/components/team-avatar";
import type { PlayedOutcome, StandingsDetailRow } from "@/lib/sleeper";

const FORM_STYLES: Record<PlayedOutcome, string> = {
  win: "bg-win/20 text-win",
  loss: "bg-live/20 text-live",
  tie: "bg-surface-2 text-ink-muted",
};

const FORM_LABELS: Record<PlayedOutcome, string> = {
  win: "W",
  loss: "L",
  tie: "T",
};

/** Sports convention drops the leading zero: .750, not 0.750. */
function pct(value: number): string {
  return value.toFixed(3).replace(/^0/, "");
}

function Th({
  children,
  align = "right",
  title,
}: {
  children: ReactNode;
  align?: "left" | "right";
  title?: string;
}) {
  return (
    <th
      scope="col"
      title={title}
      className={`eyebrow whitespace-nowrap px-3 py-2 text-[10px] text-ink-dim ${
        align === "left" ? "text-left" : "text-right"
      }`}
    >
      {children}
    </th>
  );
}

export function StandingsDetailTable({
  rows,
  playoffTeams,
}: {
  rows: StandingsDetailRow[];
  playoffTeams: number | null;
}) {
  return (
    // Stats tables are wide by nature; scrolling beats dropping columns.
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-216 border-collapse text-sm">
        <caption className="sr-only">Detailed league standings</caption>
        <thead>
          <tr className="border-b border-line">
            <Th align="left">#</Th>
            <Th align="left">Team</Th>
            <Th>Rec</Th>
            <Th title="Win percentage">Pct</Th>
            <Th title="Points for">PF</Th>
            <Th title="Points against">PA</Th>
            <Th title="Points for minus points against">Diff</Th>
            <Th title="Points per game">PPG</Th>
            <Th title="Share of potential points actually started">Eff</Th>
            <Th title="Record against every team, every week">All-play</Th>
            <Th>Streak</Th>
            <Th align="left">Last 5</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((team, index) => {
            const onCutLine =
              playoffTeams !== null &&
              index + 1 === playoffTeams &&
              rows.length > playoffTeams;

            return (
              <tr
                key={team.rosterId}
                className={`border-b transition-colors hover:bg-surface-2/60 ${
                  onCutLine ? "border-accent/50" : "border-line/60"
                }`}
              >
                <td className="numerals px-3 py-3 text-ink-dim">{team.rank}</td>

                <td className="px-3 py-3">
                  <Link
                    href={`/teams/${team.rosterId}`}
                    className="flex items-center gap-2.5 transition-colors hover:text-accent"
                  >
                    <TeamAvatar name={team.teamName} src={team.avatarUrl} />
                    <span className="min-w-0">
                      <span className="block max-w-56 truncate font-medium text-ink">
                        {team.teamName}
                      </span>
                      {team.teamName !== team.managerName && (
                        <span className="block truncate text-xs text-ink-dim">
                          {team.managerName}
                        </span>
                      )}
                    </span>
                  </Link>
                </td>

                <td className="numerals px-3 py-3 text-right text-ink">
                  {team.wins}-{team.losses}
                  {team.ties > 0 ? `-${team.ties}` : ""}
                </td>
                <td className="numerals px-3 py-3 text-right text-ink-muted">
                  {pct(team.winPct)}
                </td>
                <td className="numerals px-3 py-3 text-right text-ink">
                  {team.pointsFor.toFixed(2)}
                </td>
                <td className="numerals px-3 py-3 text-right text-ink-muted">
                  {team.pointsAgainst.toFixed(2)}
                </td>
                <td
                  className={`numerals px-3 py-3 text-right ${
                    team.pointsDiff > 0
                      ? "text-win"
                      : team.pointsDiff < 0
                        ? "text-live"
                        : "text-ink-muted"
                  }`}
                >
                  {team.pointsDiff > 0 ? "+" : ""}
                  {team.pointsDiff.toFixed(2)}
                </td>
                <td className="numerals px-3 py-3 text-right text-ink-muted">
                  {team.pointsPerGame.toFixed(2)}
                </td>
                <td className="numerals px-3 py-3 text-right text-ink-muted">
                  {team.efficiency === null
                    ? "—"
                    : `${(team.efficiency * 100).toFixed(1)}%`}
                </td>
                <td className="numerals px-3 py-3 text-right text-ink-muted">
                  {team.allPlayWins}-{team.allPlayLosses}
                  {team.allPlayTies > 0 ? `-${team.allPlayTies}` : ""}
                </td>
                <td className="numerals px-3 py-3 text-right">
                  {team.streak === null ? (
                    <span className="text-ink-dim">—</span>
                  ) : (
                    <span
                      className={
                        team.streak.outcome === "win"
                          ? "text-win"
                          : team.streak.outcome === "loss"
                            ? "text-live"
                            : "text-ink-muted"
                      }
                    >
                      {FORM_LABELS[team.streak.outcome]}
                      {team.streak.length}
                    </span>
                  )}
                </td>

                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    {team.form.length === 0 ? (
                      <span className="text-ink-dim">—</span>
                    ) : (
                      team.form.map((outcome, position) => (
                        <span
                          key={position}
                          className={`numerals flex h-5 w-5 items-center justify-center rounded text-[10px] ${FORM_STYLES[outcome]}`}
                        >
                          {FORM_LABELS[outcome]}
                        </span>
                      ))
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
