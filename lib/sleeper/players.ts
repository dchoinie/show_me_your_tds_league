import { cacheLife, cacheTag } from "next/cache";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CACHE_TAGS, SLEEPER_BASE_URL } from "./config";
import { SleeperApiError } from "./http";
import type {
  Player,
  PlayerId,
  PlayerLite,
  PlayerLiteMap,
  PlayerMap,
} from "./types";

/**
 * The NFL player dictionary.
 *
 * Rosters, matchups and draft picks only contain player ids, so every page that
 * shows a player name needs this. The raw payload is ~5MB and Sleeper asks that
 * it be requested at most once a day, so it gets three layers of protection:
 *
 *   1. a module-level memo, shared by every request on this server instance;
 *   2. a JSON file on disk, so a cold start does not re-download it;
 *   3. a 24h `sleeperPlayers` cacheLife on the exported readers.
 *
 * Records are trimmed to {@link PlayerLite} before being stored, which roughly
 * halves the payload (~5MB to ~2.6MB) and keeps cache entries small.
 *
 * Server-only: this module touches the filesystem, never import it from a
 * Client Component.
 */

const PLAYERS_URL = `${SLEEPER_BASE_URL}/players/nfl`;

/** Sleeper's stated limit is one call per day. */
const PLAYER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** The download is large; give it much longer than a normal request. */
const PLAYERS_TIMEOUT_MS = 60_000;

/**
 * Where the on-disk copy lives. Defaults to the OS temp dir, which is writable
 * both locally and on serverless hosts (where only /tmp is writable).
 */
const CACHE_DIR = process.env.SLEEPER_CACHE_DIR ?? join(tmpdir(), "sleeper-cache");
const CACHE_FILE = join(CACHE_DIR, "players-nfl.json");

interface PlayerCacheFile {
  fetchedAt: number;
  players: PlayerLiteMap;
}

let memo: PlayerCacheFile | null = null;
/** Dedupes concurrent loads so a cold start issues exactly one download. */
let inflight: Promise<PlayerLiteMap> | null = null;

const isFresh = (fetchedAt: number) =>
  Date.now() - fetchedAt < PLAYER_CACHE_TTL_MS;

function toPlayerLite(player: Player): PlayerLite {
  // Team defenses have no full_name, only first/last ("Kansas City" "Chiefs").
  const name =
    player.full_name?.trim() ||
    [player.first_name, player.last_name].filter(Boolean).join(" ").trim() ||
    player.player_id;

  return {
    player_id: player.player_id,
    name,
    position: player.position ?? null,
    fantasy_positions: player.fantasy_positions ?? null,
    team: player.team ?? null,
    status: player.status ?? null,
    injury_status: player.injury_status ?? null,
    number: player.number ?? null,
    years_exp: player.years_exp ?? null,
    age: player.age ?? null,
    search_rank: player.search_rank ?? null,
    active: Boolean(player.active),
  };
}

async function readFromDisk(): Promise<PlayerCacheFile | null> {
  try {
    const raw = await readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as PlayerCacheFile;
    if (typeof parsed.fetchedAt !== "number" || !parsed.players) return null;
    return parsed;
  } catch {
    // Missing, unreadable or corrupt - treat as a cache miss.
    return null;
  }
}

async function writeToDisk(cache: PlayerCacheFile): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    // Write then rename so a crash mid-write cannot leave a partial file.
    const temp = `${CACHE_FILE}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(cache), "utf8");
    await rename(temp, CACHE_FILE);
  } catch {
    // A read-only filesystem just means we fall back to the in-memory memo.
  }
}

async function download(): Promise<PlayerLiteMap> {
  const response = await fetch(PLAYERS_URL, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(PLAYERS_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new SleeperApiError(
      `Sleeper returned ${response.status} for the player dictionary`,
      { status: response.status, url: PLAYERS_URL },
    );
  }

  const raw = (await response.json()) as PlayerMap;
  const players: PlayerLiteMap = {};
  for (const [id, player] of Object.entries(raw)) {
    if (player) players[id] = toPlayerLite(player);
  }
  return players;
}

/**
 * Resolve the trimmed player dictionary, hitting Sleeper at most once a day
 * per server instance. Not itself cached by Next - the exported readers below
 * add that layer.
 */
async function loadPlayerIndex(): Promise<PlayerLiteMap> {
  if (memo && isFresh(memo.fetchedAt)) return memo.players;
  if (inflight) return inflight;

  inflight = (async () => {
    const onDisk = await readFromDisk();
    if (onDisk && isFresh(onDisk.fetchedAt)) {
      memo = onDisk;
      return onDisk.players;
    }

    try {
      const players = await download();
      const cache: PlayerCacheFile = { fetchedAt: Date.now(), players };
      memo = cache;
      await writeToDisk(cache);
      return players;
    } catch (error) {
      // Stale data beats no data: a page showing yesterday's player metadata
      // is fine, a page that throws is not.
      const stale = memo ?? onDisk;
      if (stale) return stale.players;
      throw error;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

// ---------------------------------------------------------------------------
// Exported readers
// ---------------------------------------------------------------------------

/**
 * Look up a specific set of player ids.
 *
 * Prefer this over {@link getAllPlayers} when rendering rosters or lineups: it
 * keeps only the players you asked for in the cache entry and in the payload
 * sent to the browser.
 */
export async function getPlayers(ids: PlayerId[]): Promise<PlayerLiteMap> {
  "use cache";
  cacheLife("sleeperPlayers");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.players);

  const index = await loadPlayerIndex();
  const subset: PlayerLiteMap = {};
  for (const id of ids) {
    const player = index[id];
    if (player) subset[id] = player;
  }
  return subset;
}

export async function getPlayer(id: PlayerId): Promise<PlayerLite | null> {
  "use cache";
  cacheLife("sleeperPlayers");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.players);

  const index = await loadPlayerIndex();
  return index[id] ?? null;
}

/**
 * The whole dictionary (~11k players).
 *
 * Only use this on the server for aggregate work such as search indexes. Never
 * pass the result to a Client Component.
 */
export async function getAllPlayers(): Promise<PlayerLiteMap> {
  return loadPlayerIndex();
}

/** Name lookup for rendering lists of ids. Unknown ids map to themselves. */
export async function getPlayerNames(
  ids: PlayerId[],
): Promise<Record<PlayerId, string>> {
  "use cache";
  cacheLife("sleeperPlayers");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.players);

  const index = await loadPlayerIndex();
  const names: Record<PlayerId, string> = {};
  for (const id of ids) {
    names[id] = index[id]?.name ?? id;
  }
  return names;
}

/** Case-insensitive name search, best-known players first. */
export async function searchPlayers(
  query: string,
  limit = 25,
): Promise<PlayerLite[]> {
  "use cache";
  cacheLife("sleeperPlayers");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.players);

  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const index = await loadPlayerIndex();
  const matches = Object.values(index).filter((player) =>
    player.name.toLowerCase().includes(needle),
  );

  // search_rank is Sleeper's popularity ordering; null means "not ranked".
  matches.sort(
    (a, b) =>
      (a.search_rank ?? Number.MAX_SAFE_INTEGER) -
      (b.search_rank ?? Number.MAX_SAFE_INTEGER),
  );

  return matches.slice(0, limit);
}
