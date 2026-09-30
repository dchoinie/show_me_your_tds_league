import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { Markdown } from "@/components/markdown";
import { PageHeader } from "@/components/page-shell";
import {
  getLeagueRules,
  getLeagueSummary,
  type ScoringGroup,
} from "@/lib/sleeper";

export const metadata: Metadata = {
  title: "Rules",
  description:
    "Scoring, roster limits, waivers and the full league constitution.",
};

/**
 * The constitution lives in the repo so it can be edited as plain Markdown.
 *
 * Cached because Cache Components treats any uncached read as a dynamic hole,
 * which would stop the whole page prerendering. `max` is the honest lifetime:
 * the file only changes on deploy, and cache keys already include the build.
 */
async function readConstitution(): Promise<string | null> {
  "use cache";
  cacheLife("max");

  try {
    return await readFile(
      join(process.cwd(), "content", "constitution.md"),
      "utf8",
    );
  } catch {
    return null;
  }
}

function Fact({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <dt className="eyebrow text-[10px] text-ink-dim">{label}</dt>
      <dd className="numerals mt-1 text-2xl text-ink">{value}</dd>
      {hint && <p className="mt-1 text-xs text-ink-dim">{hint}</p>}
    </div>
  );
}

function ScoringTable({ group }: { group: ScoringGroup }) {
  return (
    <div
      className={`rounded-lg border border-line bg-surface p-4 ${
        group.applies ? "" : "opacity-60"
      }`}
    >
      <h3 className="eyebrow flex items-baseline justify-between gap-2 text-xs text-ink-muted">
        {group.title}
        {!group.applies && (
          <span className="text-[10px] text-ink-dim normal-case">
            no starting slot
          </span>
        )}
      </h3>

      <dl className="mt-2">
        {group.rules.map((rule) => (
          <div
            key={rule.key}
            className="flex items-baseline justify-between gap-4 border-b border-line/60 py-1.5 last:border-0"
          >
            <dt className="min-w-0 text-sm text-ink-muted">{rule.label}</dt>
            <dd
              className={`numerals shrink-0 text-sm ${
                rule.value < 0 ? "text-live" : "text-ink"
              }`}
            >
              {rule.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function RulesPage() {
  const [rules, summary, constitution] = await Promise.all([
    getLeagueRules(),
    getLeagueSummary(),
    readConstitution(),
  ]);

  return (
    <>
      <PageHeader eyebrow="League" title="Rules">
        The Sleeper league settings, plus the league constitution.
      </PageHeader>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <section>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
            At a glance
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Fact
              label="Format"
              value={summary.formatLabels[0] ?? "—"}
              hint={summary.formatLabels.slice(1).join(" · ") || undefined}
            />
            <Fact label="Teams" value={summary.teamCount} />
            <Fact
              label="Roster"
              value={rules.totalRoster}
              hint={[
                `${rules.startersTotal} starters`,
                `${rules.benchSlots} bench`,
                // Leagues without a taxi squad should not read "0 taxi".
                rules.taxiSlots > 0 ? `${rules.taxiSlots} taxi` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
            <Fact
              label="Waivers"
              value={`$${rules.faabBudget}`}
              hint={rules.waiverType}
            />
            {rules.tradeDeadlineWeek !== null && (
              <Fact
                label="Trade deadline"
                value={`Week ${rules.tradeDeadlineWeek}`}
              />
            )}
            {rules.playoffTeams !== null &&
              rules.playoffWeekStart !== null && (
                <Fact
                  label="Playoffs"
                  value={`${rules.playoffTeams} teams`}
                  hint={`Start week ${rules.playoffWeekStart}`}
                />
              )}
          </dl>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
            Roster &amp; lineup
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-surface p-4">
              <h3 className="eyebrow text-xs text-ink-muted">
                Starting lineup
              </h3>
              <dl className="mt-2">
                {rules.startingSlots.map((entry) => (
                  <div
                    key={entry.slot}
                    className="flex items-baseline justify-between gap-4 border-b border-line/60 py-1.5 last:border-0"
                  >
                    <dt className="text-sm text-ink-muted">{entry.label}</dt>
                    <dd className="numerals text-sm text-ink">
                      {entry.count}
                    </dd>
                  </div>
                ))}
                <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-line pt-2">
                  <dt className="eyebrow text-[10px] text-ink-dim">Total</dt>
                  <dd className="numerals text-sm text-accent">
                    {rules.startersTotal}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-line bg-surface p-4">
              <h3 className="eyebrow text-xs text-ink-muted">Reserves</h3>
              <dl className="mt-2">
                <div className="flex items-baseline justify-between gap-4 border-b border-line/60 py-1.5">
                  <dt className="text-sm text-ink-muted">Bench</dt>
                  <dd className="numerals text-sm text-ink">
                    {rules.benchSlots}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-b border-line/60 py-1.5">
                  <dt className="text-sm text-ink-muted">
                    Taxi squad
                    {rules.taxiYears !== null && (
                      <span className="block text-xs text-ink-dim">
                        {rules.taxiYears} or fewer years of experience
                      </span>
                    )}
                  </dt>
                  <dd className="numerals text-sm text-ink">
                    {rules.taxiSlots}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-1.5">
                  <dt className="text-sm text-ink-muted">Injured reserve</dt>
                  <dd className="numerals text-sm text-ink">
                    {rules.reserveSlots}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
            Scoring
          </h2>
          <p className="mt-2 text-sm text-ink-dim">
            Every value Sleeper scores for this league. Groups with no starting
            slot are configured but never apply.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {rules.scoring.map((group) => (
              <ScoringTable key={group.title} group={group} />
            ))}
          </div>
        </section>

        <section className="mt-16 border-t border-line pt-12">
          {constitution ? (
            <Markdown>{constitution}</Markdown>
          ) : (
            <p className="rounded-lg border border-dashed border-line-bright bg-surface/40 px-6 py-14 text-center text-ink-muted">
              The constitution could not be loaded.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
