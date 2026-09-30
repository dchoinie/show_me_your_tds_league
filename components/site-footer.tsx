import { LEAGUE_ID, leagueUrl } from "@/lib/sleeper";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-ink-dim sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Show Me Your TDs — a dynasty fantasy football league.
        </p>
        {/* nflverse publishes under CC BY 4.0, which requires attribution. */}
        <p>
          Data from{" "}
          <a
            href={leagueUrl(LEAGUE_ID)}
            className="text-ink-muted underline decoration-line underline-offset-4 transition-colors hover:text-accent"
            target="_blank"
            rel="noreferrer"
          >
            Sleeper
          </a>
          . Schedule and venue data from{" "}
          <a
            href="https://github.com/nflverse/nflverse-data"
            className="text-ink-muted underline decoration-line underline-offset-4 transition-colors hover:text-accent"
            target="_blank"
            rel="noreferrer"
          >
            nflverse
          </a>
          , licensed{" "}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            className="text-ink-muted underline decoration-line underline-offset-4 transition-colors hover:text-accent"
            target="_blank"
            rel="noreferrer"
          >
            CC BY 4.0
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
