import type { Metadata } from "next";

import { PlayerUsageTable } from "@/components/player-usage";
import { QbAnalysisSection } from "@/components/qb-analysis";
import { getPlayerAnalytics, getQbAnalysis } from "@/lib/sleeper";

export const metadata: Metadata = {
  title: "Player analytics",
  description:
    "Usage against production for skill players, and expected against actual points for quarterbacks.",
};

export default async function PlayerAnalyticsPage() {
  const [analytics, qbs] = await Promise.all([
    getPlayerAnalytics(),
    getQbAnalysis(),
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

      <QbAnalysisSection analysis={qbs} />
    </div>
  );
}
