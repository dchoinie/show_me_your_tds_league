import Link from "next/link";

import { DraftYearTabs } from "@/components/draft-year-tabs";
import { TeamAvatar } from "@/components/team-avatar";
import type {
  DraftOutlook,
  DraftPickSlot,
  DraftYear,
  PlayoffSeed,
} from "@/lib/sleeper";

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

const boxClasses = (traded: boolean) =>
  `border p-1.5 align-top ${
    traded ? "border-accent/40 bg-accent/5" : "border-line/60 bg-surface"
  }`;

/**
 * Only next year's order can be projected, so later years name a pick by its
 * round alone - a slot number there would promise an order that isn't set.
 */
const pickName = (pick: DraftPickSlot, projected: boolean) =>
  projected ? `${pick.round}.${pick.slot}` : `R${pick.round}`;

const boxTitle = (pick: DraftPickSlot, projected: boolean) => {
  const name = projected ? pick.label : `Round ${pick.round}`;
  return pick.traded
    ? `${name} — ${pick.originalTeam.teamName} traded to ${pick.owner.teamName}`
    : `${name} — ${pick.originalTeam.teamName}`;
};

/**
 * A pick's label and, when it has moved, who owns it now.
 *
 * The owner line always renders - holding a non-breaking space when the pick
 * has not been traded - so every box is the same height either way.
 */
function PickBody({
  pick,
  projected,
}: {
  pick: DraftPickSlot;
  projected: boolean;
}) {
  return (
    <>
      <span className="numerals block text-[10px] text-ink-dim">
        {pickName(pick, projected)}
      </span>
      <span className="mt-0.5 block h-4 truncate text-[11px] leading-4 text-accent">
        {pick.traded ? pick.owner.teamName : " "}
      </span>
    </>
  );
}

function BoardCell({
  pick,
  projected,
}: {
  pick: DraftPickSlot | undefined;
  projected: boolean;
}) {
  if (!pick) return <td className="border border-line/60" />;

  return (
    <td className={boxClasses(pick.traded)} title={boxTitle(pick, projected)}>
      <PickBody pick={pick} projected={projected} />
    </td>
  );
}

/**
 * Below xl, twelve columns cannot fit any phone - so the board turns instead
 * of shrinking: one card per team, with that team's four picks across it.
 * Same data, same cells, orientation chosen to suit the viewport.
 */
function DraftBoardStacked({ draft }: { draft: DraftYear }) {
  const columns = draft.picks
    .filter((pick) => pick.round === 1)
    .sort((a, b) => a.slot - b.slot);

  return (
    <ul className="space-y-2 xl:hidden">
      {columns.map((column) => {
        const picks = draft.picks
          .filter((pick) => pick.slot === column.slot)
          .sort((a, b) => a.round - b.round);

        return (
          <li
            key={column.slot}
            className="rounded-lg border border-line bg-surface p-3"
          >
            <Link
              href={`/teams/${column.originalTeam.rosterId}`}
              className="mb-2 flex items-center gap-2 transition-colors hover:text-accent"
            >
              {draft.projected && (
                <span className="numerals text-[11px] text-ink-dim">
                  {String(column.slot).padStart(2, "0")}
                </span>
              )}
              <TeamAvatar
                name={column.originalTeam.teamName}
                src={column.originalTeam.avatarUrl}
                size={18}
              />
              <span className="min-w-0 truncate text-sm text-ink">
                {column.originalTeam.teamName}
              </span>
            </Link>

            <div className="grid grid-cols-4 gap-1.5">
              {picks.map((pick) => (
                <div
                  key={pick.round}
                  className={`rounded ${boxClasses(pick.traded)}`}
                  title={boxTitle(pick, draft.projected)}
                >
                  <PickBody pick={pick} projected={draft.projected} />
                </div>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The rookie draft as a board: teams across the top, rounds down the side.
 *
 * The draft is linear, so a team owns one column outright. A traded pick shows
 * up as a tinted cell carrying someone else's name - the column it sits in is
 * still whose pick it originally was.
 */
function DraftBoard({ draft, rounds }: { draft: DraftYear; rounds: number }) {
  const roundList = Array.from({ length: rounds }, (_, i) => i + 1);
  const columns = draft.picks
    .filter((pick) => pick.round === 1)
    .sort((a, b) => a.slot - b.slot);

  return (
    // Twelve across only from xl up, where the space genuinely exists - no
    // forced min-width, so neither layout ever scrolls sideways.
    <div className="hidden xl:block">
      {/* table-fixed keeps all twelve columns the same width regardless of
          how long a team's name is. */}
      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">
          {draft.season} rookie draft board, by team and round
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
                  {draft.projected && (
                    <span className="numerals block text-[10px] text-ink-dim">
                      {String(column.slot).padStart(2, "0")}
                    </span>
                  )}
                  <span className="block h-4 truncate text-[11px] leading-4 text-ink">
                    {column.originalTeam.teamName}
                  </span>
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roundList.map((round) => (
            <tr key={round}>
              <th className="eyebrow border-r border-line pr-1.5 text-right text-[10px] text-ink-dim">
                R{round}
              </th>
              {columns.map((column) => (
                <BoardCell
                  key={column.slot}
                  projected={draft.projected}
                  pick={draft.picks.find(
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

function DraftPanel({ draft, rounds }: { draft: DraftYear; rounds: number }) {
  const tradedCount = draft.picks.filter((pick) => pick.traded).length;

  return (
    <>
      <p className="mb-3 text-xs text-ink-dim">
        <span className="numerals text-ink-muted">{tradedCount}</span> of{" "}
        <span className="numerals">{draft.picks.length}</span> {draft.season}{" "}
        picks traded
      </p>

      <DraftBoard draft={draft} rounds={rounds} />
      <DraftBoardStacked draft={draft} />

      <p className="mt-3 max-w-3xl text-xs text-ink-dim">
        {draft.projected ? (
          <>
            Order runs inverse to the current standings, so today&apos;s
            bottom team holds 1.1. A highlighted box is a pick that has changed
            hands, and names the team that owns it now. Slots 7&ndash;12 will
            be set by playoff finish rather than seeding &mdash; the champion
            picks last.
          </>
        ) : (
          <>
            The {draft.season} order won&apos;t be set until the season before
            it ends, so picks are grouped by the team they originally belonged
            to. A highlighted box is a pick that has changed hands, and names
            the team that owns it now.
          </>
        )}
      </p>
    </>
  );
}

export function DraftOutlookSection({ outlook }: { outlook: DraftOutlook }) {
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
        <h3 className="mb-3 font-display text-lg font-semibold text-ink">
          Rookie drafts
        </h3>

        <DraftYearTabs
          seasons={outlook.drafts.map((draft) => draft.season)}
          panels={outlook.drafts.map((draft) => (
            <DraftPanel
              key={draft.season}
              draft={draft}
              rounds={outlook.rounds}
            />
          ))}
        />
      </div>
    </section>
  );
}
