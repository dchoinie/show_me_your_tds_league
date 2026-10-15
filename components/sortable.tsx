"use client";

import { useState } from "react";

export type SortDirection = "asc" | "desc";

export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

type SortValue = number | string | null | undefined;

/**
 * Rows ordered by one column.
 *
 * Missing values sink to the bottom in either direction - a player with no
 * aDOT is not the shallowest target, he just has no reading. The sort is
 * stable, so rows tied on the column keep whatever order they arrived in.
 */
export function sortRows<T>(
  rows: readonly T[],
  value: (row: T) => SortValue,
  direction: SortDirection,
): T[] {
  const sign = direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    if (typeof x === "string" || typeof y === "string") {
      return sign * String(x).localeCompare(String(y));
    }
    return sign * (x - y);
  });
}

/**
 * Click-to-sort state for a table.
 *
 * A new column starts in its natural direction - descending for numbers,
 * where the biggest figure is usually the interesting one, ascending for
 * names - and a second click flips it.
 */
export function useSort<K extends string>(initial: SortState<K> | null = null) {
  const [sort, setSort] = useState<SortState<K> | null>(initial);

  const toggle = (key: K, firstDirection: SortDirection) =>
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === "desc" ? "asc" : "desc" }
        : { key, direction: firstDirection },
    );

  return [sort, toggle] as const;
}

export function SortHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  align = "right",
  firstDirection = align === "left" ? "asc" : "desc",
  title,
}: {
  label: string;
  sortKey: K;
  sort: SortState<K> | null;
  onSort: (key: K, firstDirection: SortDirection) => void;
  align?: "left" | "right";
  /** Direction on first click; defaults to A-Z for text, high-low for numbers. */
  firstDirection?: SortDirection;
  title?: string;
}) {
  const active = sort?.key === sortKey;
  const direction = active ? sort.direction : null;

  return (
    <th
      aria-sort={
        direction === "asc"
          ? "ascending"
          : direction === "desc"
            ? "descending"
            : "none"
      }
      title={title}
      className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey, firstDirection)}
        className={`group eyebrow inline-flex cursor-pointer items-center gap-1 text-[10px] transition-colors hover:text-ink ${
          align === "right" ? "flex-row-reverse" : ""
        } ${active ? "text-ink" : "text-ink-dim"}`}
      >
        <span>{label}</span>
        {/* The arrow sits on the inside edge so labels stay flush with their numbers. */}
        <span
          aria-hidden="true"
          className={`w-2 text-[8px] ${
            active ? "text-accent" : "opacity-0 group-hover:opacity-60"
          }`}
        >
          {direction === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}
