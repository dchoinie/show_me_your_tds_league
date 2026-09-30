import type { Metadata } from "next";

import { FaabMeters } from "@/components/faab-meters";
import { PageHeader } from "@/components/page-shell";
import { TransactionFeed } from "@/components/transaction-feed";
import {
  getActivity,
  getFaabBudgets,
  getLeagueSummary,
} from "@/lib/sleeper";

export const metadata: Metadata = {
  title: "Transactions",
  description:
    "Every trade, waiver claim and free agent move of the season, with FAAB bids and traded picks.",
};

export default async function TransactionsPage() {
  const [items, summary, faab] = await Promise.all([
    getActivity(),
    getLeagueSummary(),
    getFaabBudgets(),
  ]);

  const trades = items.filter((item) => item.type === "trade").length;
  // Taken from roster totals rather than summing bids, so this agrees with the
  // meters below it.
  const faabSpent = faab.rows.reduce((total, row) => total + row.spent, 0);

  const deadline = summary.league.settings.trade_deadline ?? null;
  const deadlinePassed =
    deadline !== null && summary.currentWeek > deadline;

  return (
    <>
      <PageHeader eyebrow="Activity" title="Transactions">
        Every completed move of the {summary.league.season} season — trades,
        waiver claims and free agent pickups.
      </PageHeader>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <dl className="mb-10 flex flex-wrap gap-x-12 gap-y-6">
          <div>
            <dt className="eyebrow text-[10px] text-ink-dim">Total moves</dt>
            <dd className="numerals text-3xl text-ink">{items.length}</dd>
          </div>
          <div>
            <dt className="eyebrow text-[10px] text-ink-dim">Trades</dt>
            <dd className="numerals text-3xl text-ink">{trades}</dd>
          </div>
          <div>
            <dt className="eyebrow text-[10px] text-ink-dim">FAAB spent</dt>
            <dd className="numerals text-3xl text-ink">${faabSpent}</dd>
          </div>
          {deadline !== null && (
            <div>
              <dt className="eyebrow text-[10px] text-ink-dim">
                Trade deadline
              </dt>
              <dd
                className={`numerals text-3xl ${
                  deadlinePassed ? "text-ink-dim" : "text-accent"
                }`}
              >
                Wk {deadline}
              </dd>
            </div>
          )}
        </dl>

        <div className="mb-12 border-y border-line py-10">
          <FaabMeters state={faab} />
        </div>

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-bright bg-surface/40 px-6 py-14 text-center text-ink-muted">
            No transactions yet this season.
          </p>
        ) : (
          <TransactionFeed items={items} />
        )}
      </div>
    </>
  );
}
