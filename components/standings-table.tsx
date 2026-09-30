import Link from "next/link";

import { TeamAvatar } from "@/components/team-avatar";
import type { StandingsRow } from "@/lib/sleeper";

function record(team: StandingsRow): string {
  const base = `${team.wins}-${team.losses}`;
  return team.ties > 0 ? `${base}-${team.ties}` : base;
}

/**
 * League standings.
 *
 * `playoffTeams` draws the cut line beneath that many rows, which is the most
 * informative thing a mid-season standings table can show.
 */
export function StandingsTable({
  rows,
  playoffTeams,
}: {
  rows: StandingsRow[];
  playoffTeams: number | null;
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">League standings</caption>
      <thead>
        <tr className="border-b border-line text-left">
          <th scope="col" className="eyebrow w-8 py-2 text-[10px] text-ink-dim">
            <span className="sr-only">Rank</span>#
          </th>
          <th scope="col" className="eyebrow py-2 text-[10px] text-ink-dim">
            Team
          </th>
          <th
            scope="col"
            className="eyebrow py-2 text-right text-[10px] text-ink-dim"
          >
            Rec
          </th>
          <th
            scope="col"
            className="eyebrow py-2 text-right text-[10px] text-ink-dim"
          >
            PF
          </th>
          <th
            scope="col"
            className="eyebrow hidden py-2 text-right text-[10px] text-ink-dim sm:table-cell"
          >
            PA
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((team, index) => {
          // The line sits under the last team currently holding a playoff spot.
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
              <td className="numerals py-2.5 text-ink-dim">{team.rank}</td>
              <td className="py-2.5">
                <Link
                  href={`/teams/${team.rosterId}`}
                  className="flex items-center gap-2.5 transition-colors hover:text-accent"
                >
                  <TeamAvatar name={team.teamName} src={team.avatarUrl} />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink">
                      {team.teamName}
                    </div>
                    {/*
                     * Only worth showing when the team name is a nickname; if
                     * they match it is just the same string twice.
                     */}
                    {team.teamName !== team.managerName && (
                      <div className="truncate text-xs text-ink-dim">
                        {team.managerName}
                      </div>
                    )}
                  </div>
                </Link>
              </td>
              <td className="numerals py-2.5 text-right text-ink">
                {record(team)}
              </td>
              <td className="numerals py-2.5 text-right text-ink-muted">
                {team.pointsFor.toFixed(2)}
              </td>
              <td className="numerals hidden py-2.5 text-right text-ink-dim sm:table-cell">
                {team.pointsAgainst.toFixed(2)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
