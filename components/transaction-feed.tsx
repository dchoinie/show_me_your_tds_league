"use client";

import { useMemo, useState } from "react";

import { TransactionItem } from "@/components/transaction-item";
import type { ActivityItem } from "@/lib/sleeper";

type Filter = "all" | ActivityItem["type"];

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "trade", label: "Trades" },
  { key: "waiver", label: "Waivers" },
  { key: "free_agent", label: "Free agents" },
];

/**
 * The season's transactions, grouped by week, with type filters.
 *
 * Filtering happens in the browser rather than through the URL: the whole
 * season is a few hundred small records, so switching is instant and every
 * page stays statically prerendered.
 */
export function TransactionFeed({ items }: { items: ActivityItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const tally: Record<string, number> = { all: items.length };
    for (const item of items) {
      tally[item.type] = (tally[item.type] ?? 0) + 1;
    }
    return tally;
  }, [items]);

  const weeks = useMemo(() => {
    const visible =
      filter === "all" ? items : items.filter((item) => item.type === filter);

    const byWeek = new Map<number, ActivityItem[]>();
    for (const item of visible) {
      const list = byWeek.get(item.week) ?? [];
      list.push(item);
      byWeek.set(item.week, list);
    }

    // Newest week first, matching the newest-first ordering within each week.
    return [...byWeek.entries()].sort((a, b) => b[0] - a[0]);
  }, [items, filter]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ key, label }) => {
          const count = counts[key] ?? 0;
          const isActive = filter === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={isActive}
              disabled={count === 0}
              className={`eyebrow rounded px-3 py-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                isActive
                  ? "bg-accent text-accent-ink"
                  : "bg-surface text-ink-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {label}
              <span className="numerals ml-2 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {weeks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-bright bg-surface/40 px-6 py-14 text-center text-ink-muted">
          No transactions of this type yet.
        </p>
      ) : (
        weeks.map(([week, weekItems]) => (
          <section key={week}>
            <h2 className="eyebrow mb-3 flex items-baseline gap-3 text-xs text-ink-muted">
              Week {week}
              <span className="h-px flex-1 bg-line" />
              <span className="numerals text-[11px] text-ink-dim">
                {weekItems.length}
              </span>
            </h2>
            <div className="space-y-3">
              {weekItems.map((item) => (
                <TransactionItem key={item.id} item={item} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
