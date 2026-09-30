import Link from "next/link";

import { PositionBadge } from "@/components/player-row";
import { TeamAvatar } from "@/components/team-avatar";
import type {
  ActivityItem,
  ActivityPick,
  TeamRef,
  TransactionMove,
} from "@/lib/sleeper";

const TYPE_LABELS: Record<ActivityItem["type"], string> = {
  trade: "Trade",
  waiver: "Waiver",
  free_agent: "Free agent",
  commissioner: "Commissioner",
};

const TYPE_STYLES: Record<ActivityItem["type"], string> = {
  trade: "bg-accent/15 text-accent",
  waiver: "bg-sky-500/15 text-sky-300",
  free_agent: "bg-emerald-500/15 text-emerald-300",
  commissioner: "bg-slate-500/20 text-slate-300",
};

/** 1st, 2nd, 3rd, 4th - rookie drafts are four rounds. */
function ordinal(round: number): string {
  const suffix =
    round % 10 === 1 && round % 100 !== 11
      ? "st"
      : round % 10 === 2 && round % 100 !== 12
        ? "nd"
        : round % 10 === 3 && round % 100 !== 13
          ? "rd"
          : "th";
  return `${round}${suffix}`;
}

function TeamLink({ team }: { team: TeamRef }) {
  return (
    <Link
      href={`/teams/${team.rosterId}`}
      className="flex min-w-0 items-center gap-2 transition-colors hover:text-accent"
    >
      <TeamAvatar name={team.teamName} src={team.avatarUrl} size={20} />
      <span className="truncate font-medium text-ink">{team.teamName}</span>
    </Link>
  );
}

function PlayerChip({ move }: { move: TransactionMove }) {
  return (
    <span className="flex items-center gap-2 py-1">
      <PositionBadge position={move.position} />
      <span className="min-w-0 truncate text-ink">{move.playerName}</span>
      <span className="numerals shrink-0 text-xs text-ink-dim">
        {move.nflTeam ?? "FA"}
      </span>
    </span>
  );
}

function PickChip({ pick }: { pick: ActivityPick }) {
  return (
    <span className="flex items-center gap-2 py-1 text-sm">
      <span className="eyebrow flex h-6 w-10 shrink-0 items-center justify-center rounded bg-surface-2 text-[10px] text-ink-muted">
        Pick
      </span>
      <span className="truncate text-ink">
        {pick.season} {ordinal(pick.round)}
        {/* In dynasty, whose pick it was tells you what it is worth. */}
        {pick.originalTeam && (
          <span className="text-ink-dim">
            {" "}
            (from {pick.originalTeam.teamName})
          </span>
        )}
      </span>
    </span>
  );
}

function Trade({ item }: { item: ActivityItem }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {item.tradeSides.map((side) => (
        <div key={side.team.rosterId} className="rounded border border-line p-3">
          <TeamLink team={side.team} />
          <p className="eyebrow mt-2 text-[10px] text-ink-dim">Receives</p>
          <div className="mt-1">
            {side.players.map((move) => (
              <PlayerChip key={move.playerId} move={move} />
            ))}
            {side.picks.map((pick, index) => (
              <PickChip key={`${pick.season}-${pick.round}-${index}`} pick={pick} />
            ))}
            {side.faab > 0 && (
              <span className="flex items-center gap-2 py-1 text-sm">
                <span className="eyebrow flex h-6 w-10 shrink-0 items-center justify-center rounded bg-emerald-500/15 text-[10px] text-emerald-300">
                  FAAB
                </span>
                <span className="numerals text-ink">${side.faab}</span>
              </span>
            )}
            {side.players.length === 0 &&
              side.picks.length === 0 &&
              side.faab === 0 && (
                <p className="py-1 text-sm text-ink-dim italic">Nothing</p>
              )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AddDrop({ item }: { item: ActivityItem }) {
  return (
    <div className="space-y-3">
      {item.adds.length > 0 && (
        <div>
          <p className="eyebrow text-[10px] text-win">Added</p>
          <div className="mt-1">
            {item.adds.map((move) => (
              <PlayerChip key={move.playerId} move={move} />
            ))}
          </div>
        </div>
      )}
      {item.drops.length > 0 && (
        <div>
          <p className="eyebrow text-[10px] text-ink-dim">Dropped</p>
          <div className="mt-1">
            {item.drops.map((move) => (
              <PlayerChip key={move.playerId} move={move} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TransactionItem({ item }: { item: ActivityItem }) {
  const isTrade = item.type === "trade";

  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className={`eyebrow rounded px-2 py-1 text-[10px] ${TYPE_STYLES[item.type]}`}
        >
          {TYPE_LABELS[item.type]}
        </span>

        {!isTrade && item.teams[0] && <TeamLink team={item.teams[0]} />}

        <span className="ml-auto flex items-center gap-3 text-xs text-ink-dim">
          {item.waiverBid !== null && (
            <span className="numerals text-accent">${item.waiverBid}</span>
          )}
          <span>Week {item.week}</span>
        </span>
      </header>

      {isTrade ? <Trade item={item} /> : <AddDrop item={item} />}
    </article>
  );
}
