import type { PlayerLite } from "@/lib/sleeper";

/** Position tints, so a roster scans by shape rather than by reading. */
const POSITION_STYLES: Record<string, string> = {
  QB: "bg-rose-500/15 text-rose-300",
  RB: "bg-emerald-500/15 text-emerald-300",
  WR: "bg-sky-500/15 text-sky-300",
  TE: "bg-amber-500/15 text-amber-300",
  K: "bg-violet-500/15 text-violet-300",
  DEF: "bg-slate-500/20 text-slate-300",
};

/** Statuses worth surfacing on a roster row; everything else is noise. */
const INJURY_STYLES: Record<string, string> = {
  Out: "text-live",
  IR: "text-live",
  Doubtful: "text-live",
  Questionable: "text-accent",
  Sus: "text-accent",
  PUP: "text-accent",
  NA: "text-ink-dim",
};

export function PositionBadge({ position }: { position: string | null }) {
  const label = position ?? "—";
  return (
    <span
      className={`eyebrow flex h-6 w-10 shrink-0 items-center justify-center rounded text-[10px] ${
        POSITION_STYLES[label] ?? "bg-surface-2 text-ink-dim"
      }`}
    >
      {label}
    </span>
  );
}

export function PlayerRow({
  player,
  slot,
}: {
  player: PlayerLite | null;
  /** Lineup slot label. Omit for bench, taxi and IR lists. */
  slot?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      {slot && (
        <span className="eyebrow w-16 shrink-0 text-[10px] text-ink-dim">
          {slot.replace("SUPER_FLEX", "SFLEX")}
        </span>
      )}

      {player ? (
        <>
          <PositionBadge position={player.position} />
          <span className="min-w-0 flex-1 truncate text-ink">
            {player.name}
            {player.injury_status && (
              <span
                className={`ml-2 text-[10px] font-semibold ${
                  INJURY_STYLES[player.injury_status] ?? "text-ink-dim"
                }`}
              >
                {player.injury_status}
              </span>
            )}
          </span>
          <span className="numerals shrink-0 text-xs text-ink-dim">
            {player.team ?? "FA"}
          </span>
        </>
      ) : (
        <>
          <PositionBadge position={null} />
          <span className="flex-1 text-ink-dim italic">Empty</span>
        </>
      )}
    </div>
  );
}

/** A titled group of players: bench, taxi squad or IR. */
export function PlayerGroup({
  title,
  players,
  emptyLabel,
  limit,
}: {
  title: string;
  players: PlayerLite[];
  emptyLabel: string;
  /** Shows "x of y" when the league caps this group. */
  limit?: number;
}) {
  return (
    <section>
      <h3 className="eyebrow mb-1 flex items-baseline justify-between text-xs text-ink-muted">
        {title}
        <span className="numerals text-[11px] text-ink-dim">
          {limit ? `${players.length}/${limit}` : players.length}
        </span>
      </h3>
      {players.length === 0 ? (
        <p className="py-3 text-sm text-ink-dim">{emptyLabel}</p>
      ) : (
        <div className="divide-y divide-line/60">
          {players.map((player) => (
            <PlayerRow key={player.player_id} player={player} />
          ))}
        </div>
      )}
    </section>
  );
}
