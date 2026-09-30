import Link from "next/link";

import { PositionBadge } from "@/components/player-row";
import { StatusBadge } from "@/components/status-badge";
import { TeamAvatar } from "@/components/team-avatar";
import type {
  LineupEntry,
  LineupSlot,
  MatchupDetail,
  MatchupSide,
} from "@/lib/sleeper";

/** Shorten the one slot label long enough to crowd a narrow middle column. */
const shortSlot = (slot: string) => slot.replace("SUPER_FLEX", "SFLEX");

function TeamHeader({
  side,
  align,
  isWinner,
  preview,
}: {
  side: MatchupSide;
  align: "left" | "right";
  isWinner: boolean;
  preview: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <TeamAvatar
        name={side.team.teamName}
        src={side.team.avatarUrl}
        size={40}
      />
      <div className="min-w-0">
        <Link
          href={`/teams/${side.team.rosterId}`}
          className="block truncate font-semibold text-ink transition-colors hover:text-accent"
        >
          {side.team.teamName}
        </Link>
        <p className="truncate text-xs text-ink-dim">
          {side.team.managerName} · {side.team.wins}-{side.team.losses}
        </p>
        <p
          className={`numerals mt-1 text-3xl ${
            isWinner ? "text-accent" : "text-ink"
          }`}
        >
          {preview
            ? (side.projectedPoints?.toFixed(1) ?? "—")
            : side.points.toFixed(2)}
        </p>
        {preview ? (
          <p className="eyebrow text-[10px] text-ink-dim">Projected</p>
        ) : (
          side.projectedPoints !== null && (
            <p className="text-[10px] text-ink-dim">
              Proj {side.projectedPoints.toFixed(1)}
            </p>
          )
        )}
      </div>
    </div>
  );
}

function PlayerCell({
  entry,
  align,
  leading,
  preview,
}: {
  entry: LineupEntry | null;
  align: "left" | "right";
  leading: boolean;
  preview: boolean;
}) {
  if (!entry || !entry.player) {
    return (
      <div
        className={`text-sm text-ink-dim italic ${
          align === "right" ? "text-right" : ""
        }`}
      >
        Empty
      </div>
    );
  }

  const value = preview
    ? (entry.projected?.toFixed(1) ?? "—")
    : entry.points.toFixed(2);

  return (
    <div className={align === "right" ? "text-right" : ""}>
      <p className="truncate text-sm text-ink">{entry.player.name}</p>
      <p
        className={`numerals text-lg ${leading ? "text-accent" : "text-ink-muted"}`}
      >
        {value}
      </p>
      {!preview && entry.projected !== null && (
        <p className="text-[10px] text-ink-dim">
          proj {entry.projected.toFixed(1)}
        </p>
      )}
      <p className="truncate text-[10px] text-ink-dim">
        {entry.player.team ?? "FA"}
        {entry.player.injury_status && (
          <span className="ml-1 text-live">{entry.player.injury_status}</span>
        )}
      </p>
    </div>
  );
}

/** The value a slot is judged on: real points, or the projection pre-kickoff. */
function slotValue(entry: LineupEntry | null, preview: boolean): number | null {
  if (!entry) return null;
  if (preview) return entry.projected;
  return entry.points;
}

function SlotRow({
  slot,
  preview,
}: {
  slot: LineupSlot;
  preview: boolean;
}) {
  const [home, away] = slot.entries;
  const homeValue = slotValue(home, preview);
  const awayValue = slotValue(away, preview);

  const homeLeads =
    homeValue !== null && awayValue !== null && homeValue > awayValue;
  const awayLeads =
    homeValue !== null && awayValue !== null && awayValue > homeValue;

  const margin =
    homeValue !== null && awayValue !== null
      ? Math.abs(homeValue - awayValue)
      : null;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 border-b border-line/60 py-3 last:border-0">
      <PlayerCell
        entry={home}
        align="left"
        leading={homeLeads}
        preview={preview}
      />

      <div className="flex w-16 flex-col items-center gap-1">
        <PositionBadge position={shortSlot(slot.slot)} />
        {margin !== null && margin > 0 && (
          <span className="numerals text-[10px] text-ink-dim">
            {margin.toFixed(1)}
          </span>
        )}
      </div>

      <PlayerCell
        entry={away}
        align="right"
        leading={awayLeads}
        preview={preview}
      />
    </div>
  );
}

export function MatchupDetailView({ detail }: { detail: MatchupDetail }) {
  const { matchup } = detail;
  const preview = matchup.status === "preview";
  const [home, away] = matchup.sides;

  // A bye has nothing to compare against.
  if (!away) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6">
        <TeamHeader side={home} align="left" isWinner={false} preview={preview} />
        <p className="mt-4 text-ink-dim">
          No opponent this week — {home.team.teamName} is on a bye.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-surface">
      <header className="border-b border-line p-4 sm:p-6">
        <div className="mb-4 flex justify-center">
          <StatusBadge status={matchup.status} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <TeamHeader
            side={home}
            align="left"
            isWinner={matchup.winnerRosterId === home.team.rosterId}
            preview={preview}
          />
          <TeamHeader
            side={away}
            align="right"
            isWinner={matchup.winnerRosterId === away.team.rosterId}
            preview={preview}
          />
        </div>
      </header>

      <div className="px-4 sm:px-6">
        {detail.slots.map((slot, index) => (
          // Slots repeat (RB, RB), so the index is what makes the key unique.
          <SlotRow key={`${slot.slot}-${index}`} slot={slot} preview={preview} />
        ))}
      </div>

      <footer className="border-t border-line px-4 py-3 text-xs text-ink-dim sm:px-6">
        {preview
          ? "Projected points, scored under this league's rules. Lineups can still change before kickoff."
          : "The centre column shows each slot's points difference."}
      </footer>
    </div>
  );
}
