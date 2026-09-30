import { PositionBadge } from "@/components/player-row";
import type { CompositionTier, PositionComposition } from "@/lib/sleeper";

const POSITION_NAMES: Record<string, string> = {
  QB: "Quarterbacks",
  RB: "Running backs",
  WR: "Wide receivers",
  TE: "Tight ends",
  K: "Kickers",
  DEF: "Team defenses",
};

function TierGroup({ tier }: { tier: CompositionTier }) {
  return (
    <div>
      <h4 className="eyebrow mb-2 flex items-baseline gap-2 text-[11px] text-ink-muted">
        <span className="numerals">{tier.label}</span>
        <span className="h-px flex-1 bg-line" />
        <span className="numerals text-ink-dim">{tier.count}</span>
      </h4>

      {/*
       * CSS columns rather than a grid: the rows are short and uneven in
       * number, and columns flow them into balanced stacks without leaving a
       * ragged last row. `break-inside-avoid` keeps a player from splitting
       * across a column boundary.
       */}
      <ul className="columns-1 gap-x-6 sm:columns-2 xl:columns-3">
        {tier.players.map((player) => (
          <li
            key={player.playerId}
            className="flex break-inside-avoid items-baseline gap-2 py-1 text-sm"
            title={
              player.team ? `Drafted by ${player.team.teamName}` : undefined
            }
          >
            <span className="numerals w-9 shrink-0 text-xs text-accent">
              ${player.price}
            </span>
            {/*
             * The name sizes to its content rather than filling the column,
             * so the NFL team sits right beside it instead of being pushed to
             * the far edge. It still shrinks and truncates when space is tight.
             */}
            <span className="min-w-0 truncate text-ink">
              {player.playerName}
            </span>
            <span className="numerals shrink-0 text-[11px] text-ink-dim">
              {player.nflTeam ?? "FA"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PositionBlock({ group }: { group: PositionComposition }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4 sm:p-5">
      <header className="mb-4 flex items-center gap-3 border-b border-line pb-3">
        <PositionBadge position={group.position} />
        <h3 className="font-display text-xl font-bold tracking-tight text-ink">
          {POSITION_NAMES[group.position] ?? group.position}
        </h3>
        <span className="ml-auto text-xs text-ink-dim">
          <span className="numerals text-ink-muted">{group.total}</span> drafted
        </span>
      </header>

      <div className="space-y-5">
        {group.tiers.map((tier) => (
          <TierGroup key={tier.label} tier={tier} />
        ))}
      </div>
    </section>
  );
}

export function DraftCompositionSection({
  groups,
}: {
  groups: PositionComposition[];
}) {
  if (groups.length === 0) return null;

  return (
    <section>
      <div className="mb-5">
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
          Who went at what price
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-ink-dim">
          Every drafted player, by position and price band. Hover a name to see
          which team bought them.
        </p>
      </div>

      <div className="space-y-6">
        {groups.map((group) => (
          <PositionBlock key={group.position} group={group} />
        ))}
      </div>
    </section>
  );
}
