"use client";

/**
 * Sleeper is a free API with no uptime guarantee, and it is the only data
 * source on the site. When it fails the page should say so and offer a retry
 * rather than showing a blank shell.
 */
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
      <div className="rounded-lg border border-line bg-surface px-6 py-14 text-center">
        <p className="eyebrow text-xs text-live">Something went wrong</p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">
          Couldn&apos;t load league data
        </h1>
        <p className="mx-auto mt-3 max-w-md text-ink-muted">
          Sleeper may be temporarily unavailable. Try again in a moment.
        </p>
        <button
          type="button"
          onClick={reset}
          className="eyebrow mt-8 rounded bg-accent px-5 py-2.5 text-xs text-accent-ink transition-opacity hover:opacity-90"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
