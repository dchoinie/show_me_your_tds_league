import Link from "next/link";

import { TeamAvatar } from "@/components/team-avatar";
import type { DraftOutlook, DraftPickSlot, PlayoffSeed } from "@/lib/sleeper";

function record(seed: PlayoffSeed): string {
  const base = `${seed.wins}-${seed.losses}`;
  return seed.ties > 0 ? `${base}-${seed.ties}` : base;
}

function SeedRow({ seed }: { seed: PlayoffSeed | null }) {
  if (!seed) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-2 text-sm text-ink-dim italic">
        To be decided
      </div>
    );
  }

  return (
    <Link
      href={`/teams/${seed.team.rosterId}`}
      className="flex items-center gap-2 px-2.5 py-2 transition-colors hover:bg-surface-2/60"
    >
      <span className="numerals w-4 shrink-0 text-xs text-ink-dim">
        {seed.rank}
      </span>
      <TeamAvatar
        name={seed.team.teamName}
        src={seed.team.avatarUrl}
        size={18}
      />
      <span className="min-w-0 flex-1 truncate text-sm text-ink">
        {seed.team.teamName}
      </span>
      <span className="numerals shrink-0 text-xs text-ink-dim">
        {record(seed)}
      </span>
    </Link>
  );
}

function Matchup({
  label,
  top,
  bottom,
  note,
}: {
  label: string;
  top: PlayoffSeed | null;
  bottom: PlayoffSeed | null;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface">
      <div className="border-b border-line/60 px-2.5 py-1">
        <span className="eyebrow text-[10px] text-ink-dim">{label}</span>
      </div>
      <div className="divide-y divide-line/60">
        <SeedRow seed={top} />
        <SeedRow seed={bottom} />
      </div>
      {note && (
        <div className="border-t border-line/60 px-2.5 py-1">
          <span className="text-[10px] text-ink-dim">{note}</span>
        </div>
      )}
    </div>
  );
}

/**
 * The playoff field as a bracket rather than a table.
 *
 * Drawn as three columns without connecting lines on purpose: the semifinals
 * reseed - the top seed plays the lowest remaining survivor - so a fixed tree
 * would imply pairings that the constitution does not promise.
 */
function PlayoffBracket({ outlook }: { outlook: DraftOutlook }) {
  const seeds = outlook.seeds.filter((seed) => seed.inPlayoffs);
  const at = (rank: number) =>
    seeds.find((seed) => seed.rank === rank) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4">
        <h4 className="eyebrow text-[11px] text-ink-muted">First round</h4>
        <Matchup label="3 v 6" top={at(3)} bottom={at(6)} />
        <Matchup label="4 v 5" top={at(4)} bottom={at(5)} />
      </div>

      <div className="space-y-4">
        <h4 className="eyebrow text-[11px] text-ink-muted">Semifinals</h4>
        <Matchup
          label="1 seed"
          top={at(1)}
          bottom={null}
          note="Bye · plays lowest remaining survivor"
        />
        <Matchup
          label="2 seed"
          top={at(2)}
          bottom={null}
          note="Bye · plays the other survivor"
        />
      </div>

      <div className="space-y-4">
        <h4 className="eyebrow text-[11px] text-ink-muted">Championship</h4>
        <div className="rounded-lg border border-accent/40 bg-accent/5">
          <div className="border-b border-line/60 px-2.5 py-1">
            <span className="eyebrow text-[10px] text-accent">Final</span>
          </div>
          <div className="divide-y divide-line/60">
            <SeedRow seed={null} />
            <SeedRow seed={null} />
          </div>
        </div>
      </div>
    </div>
  );
}

function BoardCell({ pick }: { pick: DraftPickSlot | undefined }) {
  if (!pick) return <td className="border border-line/60" />;

  return (
    <td
      className={`border p-1.5 align-top ${
        pick.traded
          ? "border-accent/40 bg-accent/5"
          : "border-line/60 bg-surface"
      }`}
      title={
        pick.traded
          ? `${pick.label} — ${pick.originalTeam.teamName} traded to ${pick.owner.teamName}`
          : `${pick.label} — ${pick.originalTeam.teamName}`
      }
    >
      <span className="numerals block text-[10px] text-ink-dim">
        {pick.round}.{pick.slot}
      </span>
      {/*
       * The owner line is always rendered, empty when the pick has not moved,
       * so every box is the same height whether or not it was traded.
       */}
      <span className="mt-0.5 block h-4 truncate text-[11px] leading-4 text-accent">
        {pick.traded ? pick.owner.teamName : " "}
      </span>
    </td>
  );
}

/**
 * The rookie draft as a board: teams across the top, rounds down the side.
 *
 * The draft is linear, so a team owns one column outright. A traded pick shows
 * up as a tinted cell carrying someone else's name - the column it sits in is
 * still whose pick it originally was.
 */
function DraftBoard({ outlook }: { outlook: DraftOutlook }) {
  const rounds = Array.from({ length: outlook.rounds }, (_, i) => i + 1);
  const columns = outlook.picks
    .filter((pick) => pick.round === 1)
    .sort((a, b) => a.slot - b.slot);

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {/* table-fixed keeps all twelve columns the same width regardless of
          how long a team's name is. */}
      <table className="w-full min-w-272 table-fixed border-collapse">
        <caption className="sr-only">
          {outlook.season} rookie draft board, by team and round
        </caption>
        <thead>
          <tr>
            <th className="w-9" />
            {columns.map((column) => (
              <th
                key={column.slot}
                className="border-b border-line p-1.5 text-left align-bottom"
              >
                <Link
                  href={`/teams/${column.originalTeam.rosterId}`}
                  className="block transition-colors hover:text-accent"
                  title={column.originalTeam.teamName}
                >
                  <span className="numerals block text-[10px] text-ink-dim">
                    {String(column.slot).padStart(2, "0")}
                  </span>
                  <span className="block h-4 truncate text-[11px] leading-4 text-ink">
                    {column.originalTeam.teamName}
                  </span>
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rounds.map((round) => (
            <tr key={round}>
              <th className="eyebrow border-r border-line pr-1.5 text-right text-[10px] text-ink-dim">
                R{round}
              </th>
              {columns.map((column) => (
                <BoardCell
                  key={column.slot}
                  pick={outlook.picks.find(
                    (pick) =>
                      pick.round === round && pick.slot === column.slot,
                  )}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DraftOutlookSection({ outlook }: { outlook: DraftOutlook }) {
  const tradedCount = outlook.picks.filter((pick) => pick.traded).length;

  return (
    <section>
      <div className="mb-5">
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
          Playoffs &amp; draft
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-ink-dim">
          The bracket as it would be seeded today
          {outlook.playoffWeekStart !== null &&
            `, with the playoffs starting week ${outlook.playoffWeekStart}`}
          . Top {outlook.playoffTeams} qualify and the top two get a bye.
        </p>
      </div>

      <PlayoffBracket outlook={outlook} />

      <div className="mt-12">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-ink">
            {outlook.season} rookie draft
          </h3>
          <span className="text-xs text-ink-dim">
            <span className="numerals text-ink-muted">{tradedCount}</span> of{" "}
            <span className="numerals">{outlook.picks.length}</span> picks
            traded
          </span>
        </div>

        <DraftBoard outlook={outlook} />

        <p className="mt-3 max-w-3xl text-xs text-ink-dim">
          Order runs inverse to the current standings, so today&apos;s bottom
          team holds 1.1. A highlighted box is a pick that has changed hands,
          and names the team that owns it now. Slots 7&ndash;12 will be set by
          playoff finish rather than seeding &mdash; the champion picks last.
          {outlook.futureTrades.length > 0 && (
            <>
              {" "}
              Beyond {outlook.season}:{" "}
              {outlook.futureTrades
                .map(
                  (trade) =>
                    `${trade.season} R${trade.round} (${trade.originalTeam.teamName} → ${trade.owner.teamName})`,
                )
                .join(", ")}
              .
            </>
          )}
        </p>
      </div>
    </section>
  );
}
