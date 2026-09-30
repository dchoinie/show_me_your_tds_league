import { SLEEPER_BASE_URL } from "./config";

/** Thrown when Sleeper answers with a non-2xx status or unreadable body. */
export class SleeperApiError extends Error {
  readonly status: number | null;
  readonly url: string;

  constructor(
    message: string,
    options: { status?: number | null; url: string; cause?: unknown },
  ) {
    super(message, { cause: options.cause });
    this.name = "SleeperApiError";
    this.status = options.status ?? null;
    this.url = options.url;
  }
}

export interface SleeperFetchOptions {
  /**
   * Override the base URL. Needed for the handful of Sleeper endpoints that
   * sit outside `/v1`, such as the NFL schedule.
   */
  baseUrl?: string;
  /** Abort a single attempt after this many ms. Default 10s. */
  timeoutMs?: number;
  /** Extra attempts after the first on 429/5xx/network errors. Default 2. */
  retries?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;

/** Statuses worth trying again: rate limit, gateway and origin hiccups. */
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function backoffMs(attempt: number): number {
  // 300ms, 900ms, 2.7s ... plus jitter so parallel week fetches desynchronize.
  return 300 * 3 ** attempt + Math.random() * 200;
}

function retryAfterMs(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds * 1000 : null;
}

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * GET a Sleeper endpoint and parse the JSON body.
 *
 * Call this from inside a `use cache` scope (see ./api) rather than directly
 * from a component, so the cacheLife profile decides how often Sleeper is hit.
 *
 * @param path Path below the v1 base URL, e.g. `/league/123/rosters`.
 */
export async function sleeperFetch<T>(
  path: string,
  options: SleeperFetchOptions = {},
): Promise<T> {
  const {
    baseUrl = SLEEPER_BASE_URL,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
  } = options;
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(backoffMs(attempt - 1));

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      // Network failure or timeout. Retry unless this was the last attempt.
      lastError = new SleeperApiError(`Request to ${url} failed`, {
        url,
        cause,
      });
      continue;
    }

    if (RETRYABLE_STATUSES.has(response.status) && attempt < retries) {
      lastError = new SleeperApiError(
        `Sleeper returned ${response.status} for ${url}`,
        { status: response.status, url },
      );
      const wait = retryAfterMs(response);
      if (wait !== null) await sleep(wait);
      continue;
    }

    if (!response.ok) {
      throw new SleeperApiError(
        `Sleeper returned ${response.status} ${response.statusText} for ${url}`,
        { status: response.status, url },
      );
    }

    try {
      return (await response.json()) as T;
    } catch (cause) {
      throw new SleeperApiError(`Could not parse JSON from ${url}`, {
        status: response.status,
        url,
        cause,
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new SleeperApiError(`Request to ${url} failed`, { url });
}

/**
 * Same as {@link sleeperFetch}, but turns a 404 into `null`.
 *
 * Useful for resources that legitimately may not exist yet, such as a playoff
 * bracket before the postseason.
 */
export async function sleeperFetchOptional<T>(
  path: string,
  options: SleeperFetchOptions = {},
): Promise<T | null> {
  try {
    return await sleeperFetch<T>(path, options);
  } catch (error) {
    if (error instanceof SleeperApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Fetch a list endpoint, normalizing Sleeper's empty responses.
 *
 * Sleeper answers `null` (HTTP 200) rather than `[]` for things like a week
 * with no transactions, and 404s some endpoints before the season starts.
 */
export async function sleeperFetchList<T>(
  path: string,
  options: SleeperFetchOptions = {},
): Promise<T[]> {
  const data = await sleeperFetchOptional<T[] | null>(path, options);
  return Array.isArray(data) ? data : [];
}
