import type { Metadata } from "next";

import { PageHeader } from "@/components/page-shell";
import { PlayerDirectory } from "@/components/player-directory";
import { TrendingList } from "@/components/trending-list";
import { getPlayerDirectory, getTrending } from "@/lib/sleeper";

export const metadata: Metadata = {
  title: "Players",
  description:
    "Every rostered player and the best available free agents, with who owns them.",
};

export default async function PlayersPage() {
  const [directory, adds, drops] = await Promise.all([
    getPlayerDirectory(),
    getTrending("add"),
    getTrending("drop"),
  ]);

  return (
    <>
      <PageHeader eyebrow="Database" title="Players">
        Who owns whom, and who is still out there.
      </PageHeader>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        {(adds.length > 0 || drops.length > 0) && (
          <section className="mb-12">
            <div className="mb-4">
              <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
                Trending
              </h2>
              <p className="mt-1 text-sm text-ink-dim">
                The most added and dropped players across all of Sleeper in the
                last 24 hours, with whether they are free here.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <TrendingList title="Most added" entries={adds} tone="add" />
              <TrendingList title="Most dropped" entries={drops} tone="drop" />
            </div>
          </section>
        )}

        <section>
          <div className="mb-4">
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
              Directory
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-ink-dim">
              All{" "}
              <span className="numerals text-ink-muted">
                {directory.rosteredCount}
              </span>{" "}
              rostered players, plus the{" "}
              <span className="numerals text-ink-muted">
                {directory.freeAgentCount}
              </span>{" "}
              highest scoring free agents.
              {directory.freeAgentsOmitted > 0 && (
                <>
                  {" "}
                  A further {directory.freeAgentsOmitted} free agents have
                  scored this season but are not listed — search on Sleeper for
                  the deep bench.
                </>
              )}
            </p>
          </div>

          <PlayerDirectory entries={directory.entries} />
        </section>
      </div>
    </>
  );
}
