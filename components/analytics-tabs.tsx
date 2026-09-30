"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/analytics", label: "Draft" },
  { href: "/analytics/teams", label: "Team" },
  { href: "/analytics/players", label: "Player" },
] as const;

export function AnalyticsTabs() {
  const pathname = usePathname();

  return (
    <div className="border-b border-line bg-surface/40">
      <nav
        aria-label="Analytics sections"
        className="mx-auto max-w-7xl px-4 sm:px-6"
      >
        <ul className="flex gap-1">
          {TABS.map((tab) => {
            // Exact match only: /analytics must not light up on /analytics/teams.
            const active = pathname === tab.href;

            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`eyebrow -mb-px block border-b-2 px-4 py-3 text-xs transition-colors ${
                    active
                      ? "border-accent text-accent"
                      : "border-transparent text-ink-muted hover:border-line-bright hover:text-ink"
                  }`}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
