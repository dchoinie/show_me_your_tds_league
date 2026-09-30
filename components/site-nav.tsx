"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/standings", label: "Standings" },
  { href: "/matchups", label: "Matchups" },
  { href: "/teams", label: "Teams" },
  { href: "/players", label: "Players" },
  { href: "/draft", label: "Draft" },
  { href: "/transactions", label: "Transactions" },
  { href: "/analytics", label: "Analytics" },
  { href: "/rules", label: "Rules" },
] as const;

function NavLink({
  href,
  label,
  active,
  onNavigate,
  className,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate?: () => void;
  className: string;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`eyebrow block rounded transition-colors ${className} ${
        active
          ? "bg-surface-2 text-accent"
          : "text-ink-muted hover:bg-surface hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-field/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex shrink-0 items-baseline gap-2 transition-opacity hover:opacity-80"
        >
          <span className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
            SHOW ME YOUR
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-accent sm:text-2xl">
            TDs
          </span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {LINKS.map((link) => (
              <li key={link.href}>
                <NavLink
                  href={link.href}
                  label={link.label}
                  active={isActive(link.href)}
                  className="px-3 py-2 text-xs"
                />
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="ml-auto rounded p-2 text-ink-muted transition-colors hover:bg-surface hover:text-ink lg:hidden"
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-t border-line bg-field lg:hidden"
        >
          <ul className="mx-auto max-w-7xl px-4 py-2 sm:px-6">
            {LINKS.map((link) => (
              <li key={link.href}>
                <NavLink
                  href={link.href}
                  label={link.label}
                  active={isActive(link.href)}
                  // Navigating away should dismiss the drawer.
                  onNavigate={() => setOpen(false)}
                  className="px-3 py-3 text-sm"
                />
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
