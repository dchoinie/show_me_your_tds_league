import type { Metadata } from "next";

import { DraftCompositionSection } from "@/components/draft-composition";
import { DraftValueSection } from "@/components/draft-value";
import { getDraftComposition, getDraftValueAnalysis } from "@/lib/sleeper";

export const metadata: Metadata = {
  title: "Draft analytics",
  description:
    "What each player cost at auction against what they have produced.",
};

export default async function DraftAnalyticsPage() {
  const [analysis, composition] = await Promise.all([
    getDraftValueAnalysis(),
    getDraftComposition(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
      <section>
        <div className="mb-5">
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
            Draft value
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-dim">
            What each player cost in the {analysis.season} auction against what
            they have actually scored, through week {analysis.throughWeek}.
          </p>
        </div>

        {analysis.available ? (
          <>
            <DraftValueSection analysis={analysis} />

            <div className="mt-8 space-y-2 text-xs text-ink-dim">
              <p>
                Covers {analysis.analysed} drafted players who have played at
                least one game. {analysis.withoutGames} more were drafted but
                have not taken the field, and are left out — a player who has
                not played says nothing about whether his price was right.
              </p>
              <p>
                Rankings are within position, among drafted players.{" "}
                <span className="text-ink-muted">QB2 → QB19</span> means a
                player was the second most expensive quarterback bought and is
                currently the nineteenth highest scoring.
              </p>
              <p>
                It is early — only a few games have been played, so a slow
                start or an injury can look like a misjudgement. Check the
                games column before blaming anyone.
              </p>
            </div>
          </>
        ) : (
          <p className="rounded-lg border border-dashed border-line-bright bg-surface/40 px-6 py-14 text-center text-ink-muted">
            Draft value analysis needs a completed auction draft and season
            stats from Sleeper. It will appear here once both are available.
          </p>
        )}
      </section>

      {composition.length > 0 && (
        <div className="mt-16 border-t border-line pt-12">
          <DraftCompositionSection groups={composition} />
        </div>
      )}
    </div>
  );
}
