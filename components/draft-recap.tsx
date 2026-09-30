import Link from "next/link";

import { PositionBadge } from "@/components/player-row";
import { TeamAvatar } from "@/components/team-avatar";
import type {
  DraftPickView,
  DraftRecap,
  DraftTeamSummary,
  PositionSpend,
} from "@/lib/sleeper";

function PickRow({
  pick,
  isAuction,
  showTeam,
}: {
  pick: DraftPickView;
  isAuction: boolean;
  showTeam?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-line/60 py-2 last:border-0">
      <span className="numerals w-10 shrink-0 text-xs text-ink-dim">
        {isAuction ? `$${pick.amount ?? 0}` : `${pick.round}.${pick.pickNo}`}
      </span>

      <PositionBadge position={pick.position} />

      <span className="min-w-0 flex-1 truncate text-sm text-ink">
        {pick.playerName}
      </span>

      {showTeam && pick.team && (
        <Link
          href={`/teams/${pick.team.rosterId}`}
          className="hidden min-w-0 max-w-40 shrink-0 truncate text-xs text-ink-dim transition-colors hover:text-accent sm:block"
        >
          {pick.team.teamName}
        </Link>
      )}

      <span className="numerals w-8 shrink-0 text-right text-xs text-ink-dim">
        {pick.nflTeam ?? "FA"}
      </span>
    </div>
  );
}

function TopBuys({ picks }: { picks: DraftPickView[] }) {
  if (picks.length === 0) return null;

  return (
    <div>
      <h3 className="eyebrow mb-2 text-xs text-ink-muted">Biggest buys</h3>
      <div className="rounded-lg border border-line bg-surface px-4">
        {picks.map((pick) => (
          <PickRow key={pick.pickNo} pick={pick} isAuction showTeam />
        ))}
      </div>
    </div>
  );
}

/**
 * Where the money went by position.
 *
 * One measure across a handful of positions, so it is a single hue with the
 * label carrying identity - and each bar is a share of the same total, which
 * the track makes readable.
 */
function PositionSpending({
  rows,
  totalSpent,
}: {
  rows: PositionSpend[];
  totalSpent: number;
}) {
  if (rows.length === 0 || totalSpent <= 0) return null;

  const ceiling = Math.max(...rows.map((row) => row.amount));

  return (
    <div>
      <h3 className="eyebrow mb-2 text-xs text-ink-muted">Spend by position</h3>
      <ul className="space-y-3 rounded-lg border border-line bg-surface p-4">
        {rows.map((row) => (
          <li key={row.position}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex items-baseline gap-2">
                <span className="text-ink">{row.position}</span>
                <span className="text-xs text-ink-dim">
                  {row.count} {row.count === 1 ? "player" : "players"}
                </span>
              </span>
              <span className="numerals text-ink">
                ${row.amount}
                <span className="ml-2 text-xs text-ink-dim">
                  {(row.share * 100).toFixed(0)}%
                </span>
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-r-full bg-accent/15">
              <div
                className="h-2 rounded-r-full bg-accent"
                style={{ width: `${(row.amount / ceiling) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TeamBlock({
  summary,
  isAuction,
  budget,
}: {
  summary: DraftTeamSummary;
  isAuction: boolean;
  budget: number | null;
}) {
  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <header className="flex items-start gap-3 border-b border-line pb-3">
        <TeamAvatar
          name={summary.team.teamName}
          src={summary.team.avatarUrl}
          size={36}
        />
        <div className="min-w-0 flex-1">
          <Link
            href={`/teams/${summary.team.rosterId}`}
            className="block truncate font-semibold text-ink transition-colors hover:text-accent"
          >
            {summary.team.teamName}
          </Link>
          <p className="truncate text-xs text-ink-dim">
            {summary.team.managerName}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="numerals text-lg text-ink">
            {isAuction ? `$${summary.spent}` : summary.picks.length}
            {isAuction && budget !== null && (
              <span className="text-xs text-ink-dim">/{budget}</span>
            )}
          </p>
          {isAuction && summary.minimumBids > 0 && (
            <p className="text-[10px] text-ink-dim">
              {summary.minimumBids} at $1
            </p>
          )}
        </div>
      </header>

      <div className="mt-1">
        {summary.picks.map((pick) => (
          <PickRow key={pick.pickNo} pick={pick} isAuction={isAuction} />
        ))}
      </div>
    </article>
  );
}

export function DraftRecapSection({ recap }: { recap: DraftRecap }) {
  const { isAuction, budget } = recap;

  return (
    <div className="space-y-10">
      <dl className="flex flex-wrap gap-x-10 gap-y-6">
        <div>
          <dt className="eyebrow text-[10px] text-ink-dim">Format</dt>
          <dd className="numerals text-2xl text-ink capitalize">
            {recap.type}
          </dd>
        </div>
        <div>
          <dt className="eyebrow text-[10px] text-ink-dim">Rounds</dt>
          <dd className="numerals text-2xl text-ink">{recap.rounds}</dd>
        </div>
        <div>
          <dt className="eyebrow text-[10px] text-ink-dim">Picks</dt>
          <dd className="numerals text-2xl text-ink">{recap.picks.length}</dd>
        </div>
        {isAuction && budget !== null && (
          <div>
            <dt className="eyebrow text-[10px] text-ink-dim">Budget</dt>
            <dd className="numerals text-2xl text-ink">${budget}</dd>
            <p className="text-[10px] text-ink-dim">per team</p>
          </div>
        )}
        {isAuction && (
          <div>
            <dt className="eyebrow text-[10px] text-ink-dim">Total spent</dt>
            <dd className="numerals text-2xl text-accent">
              ${recap.totalSpent}
            </dd>
          </div>
        )}
      </dl>

      {isAuction && (
        <div className="grid gap-6 lg:grid-cols-2">
          <TopBuys picks={recap.topBuys} />
          <PositionSpending
            rows={recap.byPosition}
            totalSpent={recap.totalSpent}
          />
        </div>
      )}

      <div>
        <h3 className="eyebrow mb-3 text-xs text-ink-muted">
          Every pick, by team
        </h3>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {recap.byTeam.map((summary) => (
            <TeamBlock
              key={summary.team.rosterId}
              summary={summary}
              isAuction={isAuction}
              budget={budget}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
