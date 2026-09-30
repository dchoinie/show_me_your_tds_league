import Link from "next/link";

import { TeamAvatar } from "@/components/team-avatar";
import type {
  AgeAnalysis,
  AgeBand,
  TeamAgeProfile,
  Window,
} from "@/lib/sleeper";

const WINDOW_LABELS: Record<Window, string> = {
  ascend: "Ascending",
  contend: "Contending",
  retool: "Retooling",
  stuck: "Stuck",
};

const WINDOW_BLURBS: Record<Window, string> = {
  ascend: "Young and winning — the best place to be.",
  contend: "Veteran and winning. The window is open now.",
  retool: "Young and losing, which is the point of a rebuild.",
  stuck: "Veteran and losing — the hardest spot to escape.",
};

const WINDOW_STYLES: Record<Window, string> = {
  ascend: "bg-win/15 text-win",
  contend: "bg-accent/15 text-accent",
  retool: "bg-sky-500/15 text-sky-300",
  stuck: "bg-live/15 text-live",
};

const ORDER: Window[] = ["ascend", "contend", "retool", "stuck"];

/**
 * One hue stepped light to dark across the bands.
 *
 * Age is an ordered scale, not three unrelated categories, so it takes a
 * sequential ramp rather than a categorical palette.
 */
const BAND_FILLS: Record<string, string> = {
  young: "bg-accent",
  prime: "bg-accent/55",
  old: "bg-accent/25",
};

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Share of a team's points by age band, as one stacked bar. */
function PointsBar({ bands }: { bands: AgeBand[] }) {
  const total = bands.reduce((sum, band) => sum + band.pointsShare, 0);
  if (total <= 0) {
    return <div className="h-2.5 rounded-r-full bg-surface-2" />;
  }

  return (
    <div className="flex h-2.5 overflow-hidden rounded-r-full bg-surface-2">
      {bands.map((band) => (
        <span
          key={band.key}
          className={BAND_FILLS[band.key] ?? "bg-accent/25"}
          style={{ width: pct(band.pointsShare) }}
          title={`${band.label}: ${band.points} pts from ${band.players} players (${pct(band.pointsShare)})`}
        />
      ))}
    </div>
  );
}

function Legend({ bands }: { bands: AgeBand[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
      {bands.map((band) => (
        <li key={band.key} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`h-2 w-3 rounded-sm ${BAND_FILLS[band.key] ?? "bg-accent/25"}`}
          />
          <span className="text-ink-muted">{band.label}</span>
          <span className="numerals text-ink-dim">
            {pct(band.pointsShare)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Whether a team's scoring skews older or younger than its roster. */
function DeltaTag({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-ink-dim">—</span>;
  }

  // Under half a year either way is noise, not a pattern.
  if (Math.abs(delta) < 0.5) {
    return (
      <span
        className="text-ink-dim"
        title="Scoring age matches the roster's age"
      >
        even
      </span>
    );
  }

  const youthCarrying = delta < 0;

  return (
    <span
      className={`numerals ${youthCarrying ? "text-win" : "text-accent"}`}
      title={
        youthCarrying
          ? "Scoring is younger than the roster — the youth is already producing"
          : "Scoring is older than the roster — the veterans are carrying it"
      }
    >
      {delta > 0 ? "+" : ""}
      {delta.toFixed(1)}
    </span>
  );
}

function ProductionTable({ analysis }: { analysis: AgeAnalysis }) {
  // Youngest-scoring first: the teams whose points come from their kids.
  const rows = [...analysis.teams].sort(
    (a, b) => (b.youthShare ?? 0) - (a.youthShare ?? 0),
  );

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-216 border-collapse text-sm">
        <caption className="sr-only">
          Share of each team&apos;s points by player age band
        </caption>
        <thead>
          <tr className="border-b border-line">
            <th className="eyebrow px-3 py-2 text-left text-[10px] text-ink-dim">
              Team
            </th>
            <th className="eyebrow px-3 py-2 text-left text-[10px] text-ink-dim">
              Points by age
            </th>
            <th
              className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim"
              title="Share of the team's points scored by players under 25"
            >
              U25 pts
            </th>
            <th
              className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim"
              title="Plain average age of everyone on the roster"
            >
              Roster
            </th>
            <th
              className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim"
              title="Average age weighted by points scored"
            >
              Scoring
            </th>
            <th
              className="eyebrow px-3 py-2 text-right text-[10px] text-ink-dim"
              title="Scoring age minus roster age"
            >
              Skew
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((team) => (
            <tr
              key={team.team.rosterId}
              className="border-b border-line/60 transition-colors hover:bg-surface-2/60"
            >
              <td className="px-3 py-3">
                <Link
                  href={`/teams/${team.team.rosterId}`}
                  className="flex items-center gap-2 transition-colors hover:text-accent"
                >
                  <TeamAvatar
                    name={team.team.teamName}
                    src={team.team.avatarUrl}
                    size={20}
                  />
                  <span className="max-w-44 truncate text-ink">
                    {team.team.teamName}
                  </span>
                </Link>
              </td>
              <td className="w-[38%] px-3 py-3">
                <PointsBar bands={team.bands} />
              </td>
              <td className="numerals px-3 py-3 text-right text-ink">
                {team.youthShare === null ? "—" : pct(team.youthShare)}
              </td>
              <td className="numerals px-3 py-3 text-right text-ink-muted">
                {team.rosterAge?.toFixed(1) ?? "—"}
              </td>
              <td className="numerals px-3 py-3 text-right text-ink-muted">
                {team.productionAge?.toFixed(1) ?? "—"}
              </td>
              <td className="px-3 py-3 text-right">
                <DeltaTag delta={team.ageDelta} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeamCard({ team }: { team: TeamAgeProfile }) {
  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <header className="flex items-start gap-3">
        <TeamAvatar
          name={team.team.teamName}
          src={team.team.avatarUrl}
          size={32}
        />
        <div className="min-w-0 flex-1">
          <Link
            href={`/teams/${team.team.rosterId}`}
            className="block truncate text-sm font-semibold text-ink transition-colors hover:text-accent"
          >
            {team.team.teamName}
          </Link>
          <p className="numerals text-[11px] text-ink-dim">
            #{team.rank} · {(team.winPct * 100).toFixed(0)}% wins
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="numerals text-2xl text-ink">
            {team.productionAge?.toFixed(1) ?? "—"}
          </p>
          <p className="eyebrow text-[9px] text-ink-dim">Scoring age</p>
        </div>
      </header>

      <div className="mt-3">
        <PointsBar bands={team.bands} />
        <p className="numerals mt-1 flex justify-between text-[10px] text-ink-dim">
          {team.bands.map((band) => (
            <span key={band.key}>
              {band.players}p · {pct(band.pointsShare)}
            </span>
          ))}
        </p>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line/60 pt-2 text-[11px]">
        {team.byPosition.map((entry) => (
          <div key={entry.position} className="flex gap-1">
            <dt className="text-ink-dim">{entry.position}</dt>
            <dd className="numerals text-ink-muted">{entry.age}</dd>
          </div>
        ))}
        <div className="ml-auto flex gap-1">
          <dt className="text-ink-dim">Taxi-eligible</dt>
          <dd className="numerals text-ink-muted">{team.taxiEligible}</dd>
        </div>
      </dl>
    </article>
  );
}

export function AgeAnalysisSection({ analysis }: { analysis: AgeAnalysis }) {
  const { teams, medianAge, leagueBands } = analysis;
  if (teams.length === 0) return null;

  return (
    <div className="space-y-14">
      <section>
        <div className="mb-4">
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
            Where the points come from
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-dim">
            Every team&apos;s season points split by the age of who scored
            them. Bands follow how production actually curves — ascending under
            25, prime through 28, declining after.
          </p>
        </div>

        <div className="mb-4 rounded-lg border border-line bg-surface px-4 py-3">
          <p className="eyebrow mb-2 text-[10px] text-ink-dim">
            League baseline
          </p>
          <PointsBar bands={leagueBands} />
          <div className="mt-2">
            <Legend bands={leagueBands} />
          </div>
        </div>

        <ProductionTable analysis={analysis} />

        <div className="mt-4 max-w-3xl space-y-2 text-xs text-ink-dim">
          <p>
            <span className="text-ink-muted">Skew</span> is scoring age minus
            roster age, and it is the part a single average hides. A{" "}
            <span className="text-win">negative</span> figure means the young
            players are already producing — the roster is younger where it
            counts. A <span className="text-accent">positive</span> one means
            the veterans are carrying the scoring and the youth has yet to
            arrive, which is a very different position to be in with the same
            average age.
          </p>
          <p>
            Compare each team&apos;s split against the league baseline above
            rather than reading the percentages cold — a 30% share from under-25s
            means something different in a young league than an old one.
          </p>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
            Competitive window
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-dim">
            Scoring age set against record splits the league four ways.
            {medianAge !== null && (
              <>
                {" "}
                League median scoring age is{" "}
                <span className="numerals text-ink-muted">
                  {medianAge.toFixed(1)}
                </span>
                .
              </>
            )}
          </p>
        </div>

        <div className="space-y-8">
          {ORDER.map((window) => {
            const group = teams.filter((team) => team.window === window);
            if (group.length === 0) return null;

            return (
              <div key={window}>
                <h3 className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span
                    className={`eyebrow rounded px-2 py-1 text-[10px] ${WINDOW_STYLES[window]}`}
                  >
                    {WINDOW_LABELS[window]}
                  </span>
                  <span className="text-xs text-ink-dim">
                    {WINDOW_BLURBS[window]}
                  </span>
                </h3>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {group
                    .sort((a, b) => a.rank - b.rank)
                    .map((team) => (
                      <TeamCard key={team.team.rosterId} team={team} />
                    ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-6 max-w-3xl text-xs text-ink-dim">
          Taxi-eligible counts players with three or fewer years of experience,
          the constitution&apos;s threshold. Position rows are plain average
          age. Card bands read as players · share of points.
        </p>
      </section>
    </div>
  );
}
