import type { Metadata } from "next";

import { PlayerUsageTable } from "@/components/player-usage";
import { QbAnalysisSection } from "@/components/qb-analysis";
import { SnapShareTable } from "@/components/snap-share";
import {
  getPlayerAnalytics,
  getQbAnalysis,
  getSnapAnalytics,
} from "@/lib/sleeper";

export const metadata: Metadata = {
  title: "Player analytics",
  description:
    "Usage against production for skill players, and expected against actual points for quarterbacks.",
};

export default async function PlayerAnalyticsPage() {
  const [analytics, qbs, snaps] = await Promise.all([
    getPlayerAnalytics(),
    getQbAnalysis(),
    getSnapAnalytics(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-14 px-4 py-10 sm:px-6 sm:py-12">
      <section>
        <div className="mb-5">
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
            Usage &amp; production
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-dim">
            Opportunity comes from nflverse; points are scored under this
            league&apos;s own rules. Comparing them is the point — a player well
            above his usage is riding efficiency that rarely holds, while one
            whose opportunity outruns his production is usually the better asset
            to go and get.
          </p>
        </div>

        {analytics.available ? (
          <>
            <PlayerUsageTable analytics={analytics} />

            <div className="mt-6 max-w-3xl space-y-2 text-xs text-ink-dim">
              <p>
                <span className="text-ink-muted">Usage → scoring</span> ranks
                each player within his position, twice: once by opportunity,
                once by points. <span className="text-ink-muted">WR4 → WR19</span>{" "}
                means the fourth most-used receiver in the league is the
                nineteenth highest scoring, so the volume is there and the
                production is not.
              </p>
              <p>
                Opportunity is targets for receivers and tight ends, carries
                plus targets for backs. Quarterbacks are measured differently
                below.
              </p>
              <p>
                <span className="text-ink-muted">aDOT</span> is average depth of
                target, which says what kind of receiver someone is — a 17-yard
                aDOT is a downfield role, a 6-yard one is short-area work.{" "}
                <span className="text-ink-muted">YAC</span> is the share of
                yards gained after the catch; above 60% it turns amber, because
                yards after the catch depend on broken tackles and space and
                repeat less reliably than downfield volume does.
              </p>
              <p>
                Both are blank for running backs, and for anyone under a dozen
                targets. A screen caught behind the line has negative air yards,
                which makes depth of target negative and pushes yards after the
                catch past 100% of the total — arithmetically fine,
                descriptively meaningless. Three targets do the same thing to a
                receiver, which is why the floor is on volume and not only on
                position.
              </p>
              <p>
                A buy marked{" "}
                <span className="text-ink-muted">&middot; owed</span> is the
                stronger version of the case: real downfield volume that has
                not converted yet, rather than simply targets without points.
                Measured against a median conversion ratio of{" "}
                <span className="numerals text-ink-muted">
                  {analytics.racrBaseline?.toFixed(2) ?? "—"}
                </span>{" "}
                yards per air yard among pass catchers.
              </p>
              <p>
                Covers {analytics.matched} rostered players.{" "}
                {analytics.unmatched} are not shown, almost all because they
                have no {analytics.season} stat line at all — stashed rookies
                and third-string backs.
              </p>
              <p>
                Only a few games have been played, so a player with a dozen
                targets can swing several rank positions on one touchdown. Treat
                these as directional until the sample grows.
              </p>
            </div>
          </>
        ) : (
          <p className="rounded-lg border border-dashed border-line-bright bg-surface/40 px-6 py-14 text-center text-ink-muted">
            Player usage needs the nflverse stats release, which is currently
            unavailable. Everything else on the site is unaffected.
          </p>
        )}
      </section>

      {snaps.available && (
        <section>
          <div className="mb-5">
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
              Snap share
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-ink-dim">
              The leading indicator the usage table cannot give you. Target
              share tells you what a player&apos;s role{" "}
              <span className="text-ink-muted">is</span>; snap share tells you
              where it is <span className="text-ink-muted">going</span>. A
              receiver climbing from 40% to 65% of his offense&apos;s snaps is
              about to matter, and it shows up a week or two before the targets
              follow.
            </p>
          </div>

          <SnapShareTable analytics={snaps} />

          <div className="mt-6 max-w-3xl space-y-2 text-xs text-ink-dim">
            <p>
              Free agents are included on purpose — a rising snap share on
              somebody nobody owns is the most actionable thing here. Available
              players are listed when they are playing at least 35% of their
              team&apos;s snaps; below that the number says little.
            </p>
            <p>
              <span className="text-ink-muted">Trend</span> compares the latest
              week against the average of the weeks before it, so the number
              always agrees with the right-hand end of the sparkline. Moves
              under 8 share points read as steady.
            </p>
            <p>
              Read a sharp fall alongside the injury tag before concluding
              anything about a role. A player who left a game hurt shows a
              collapsing snap share that is not a demotion — with three weeks
              played, one bad afternoon moves these numbers a long way.
            </p>
          </div>
        </section>
      )}

      <QbAnalysisSection analysis={qbs} />
    </div>
  );
}
