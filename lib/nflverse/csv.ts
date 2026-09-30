/**
 * Minimal CSV reader for nflverse's published files.
 *
 * Written rather than pulled in as a dependency because the need is narrow,
 * but it does handle quoted fields properly: these files carry commas inside
 * quotes (a kicker's `fg_made_list` is a quoted, comma-separated list), and a
 * naive `split(",")` silently shifts every column after it.
 */

export interface CsvTable {
  header: string[];
  rows: string[][];
  /** Column index by name, or -1. */
  index: (column: string) => number;
}

export function parseCsv(text: string): CsvTable {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      // A doubled quote inside a quoted field is a literal quote.
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const header = (rows.shift() ?? []).map((name) => name.trim());
  const positions = new Map(header.map((name, i) => [name, i]));

  return {
    header,
    rows,
    index: (column) => positions.get(column) ?? -1,
  };
}

/** Fetch and parse, returning null rather than throwing on any failure. */
export async function fetchCsv(
  url: string,
  timeoutMs = 45_000,
): Promise<CsvTable | null> {
  try {
    const response = await fetch(url, {
      headers: { accept: "text/csv" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    return parseCsv(await response.text());
  } catch {
    return null;
  }
}

export const NFLVERSE_RELEASE =
  "https://github.com/nflverse/nflverse-data/releases/download";

/** Blank and "NA" both mean missing in these files. */
export function num(value: string | undefined): number | null {
  if (value === undefined || value === "" || value === "NA") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
