# Show Me Your TDs

A site for one Sleeper fantasy football league —
[Show Me Your TDs](https://sleeper.com/leagues/1371322798881910784) (12 teams,
superflex, taxi squad, auction draft).

Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS v4.

## Getting started

```bash
npm run dev
```

## Data

All league data comes from Sleeper's free, read-only, unauthenticated API
(`https://api.sleeper.app/v1`). Nothing is written back to Sleeper.

The data layer lives in [lib/sleeper/](lib/sleeper/):

| File | Role |
| --- | --- |
| [config.ts](lib/sleeper/config.ts) | League id, cache tags, constants |
| [types.ts](lib/sleeper/types.ts) | Response types for every endpoint |
| [http.ts](lib/sleeper/http.ts) | `fetch` wrapper: timeouts, retries, `SleeperApiError` |
| [api.ts](lib/sleeper/api.ts) | One cached reader per Sleeper endpoint |
| [players.ts](lib/sleeper/players.ts) | The ~5MB player dictionary, fetched at most once a day |
| [queries.ts](lib/sleeper/queries.ts) | Joined, page-ready views |
| [urls.ts](lib/sleeper/urls.ts) | `sleepercdn.com` avatar, headshot and logo URLs |

Import from the barrel in Server Components:

```tsx
import { getStandings, getCurrentWeekMatchups } from "@/lib/sleeper";

export default async function Page() {
  const standings = await getStandings();
  const { week, matchups } = await getCurrentWeekMatchups();
  // ...
}
```

`queries.ts` is usually what a page wants — it joins rosters to managers,
matchups to teams, and transactions to player names:

- `getTeams()` / `getStandings()` — records, points for/against, potential points
- `getWeekMatchups(week)` / `getCurrentWeekMatchups()` — games paired up with scores
- `getRecentActivity(limit)` — trades, waivers and adds/drops with player names
- `getLeagueSummary()` — league config, current week, starting slots, playoff state

Drop to `api.ts` for raw endpoint access (`getLeague`, `getRosters`,
`getLeagueUsers`, `getMatchups`, `getTransactions`, `getTradedPicks`,
`getWinnersBracket`, `getLosersBracket`, `getLeagueDrafts`, `getDraftPicks`,
`getNflState`, `getUser`, `getUserLeagues`, `getLeagueHistory`).

These modules read the filesystem and are server-only. Client Components should
receive the data as props.

### Caching

[Cache Components](https://nextjs.org/docs/app/getting-started/caching) is
enabled, and every reader is a `use cache` function with an explicit lifetime,
so pages can call them freely without generating Sleeper traffic. Profiles are
defined in [next.config.ts](next.config.ts):

| Profile | Revalidate | Used for |
| --- | --- | --- |
| `sleeperLive` | 1 min | In-progress week: scores, current matchups, activity |
| `sleeperLeague` | 15 min | League settings, rosters, users, standings |
| `sleeperHistory` | 1 day | Completed weeks, drafts, traded picks |
| `sleeperPlayers` | 1 day | The player dictionary |

`getMatchups` and `getTransactions` pick `sleeperLive` or `sleeperHistory`
automatically depending on whether the requested week has finished.

The player dictionary gets extra protection because Sleeper asks that it be
requested no more than once a day: a module-level memo, a JSON file on disk
(`$TMPDIR/sleeper-cache/`, or `SLEEPER_CACHE_DIR`), and the 24h cache profile.
Prefer `getPlayers(ids)` over `getAllPlayers()` so only the players you render
end up in the cache entry.

To refresh sooner than a profile allows, set `REVALIDATE_SECRET` and POST to
[app/api/revalidate](app/api/revalidate/route.ts):

```bash
curl -X POST localhost:3000/api/revalidate \
  -H "authorization: Bearer $REVALIDATE_SECRET" \
  -H "content-type: application/json" \
  -d '{"tags":["sleeper"]}'
```

Tags are built by `CACHE_TAGS` in [config.ts](lib/sleeper/config.ts), so you can
bust one slice (`sleeper:rosters:<leagueId>`) or everything (`sleeper`). Without
`REVALIDATE_SECRET` set, the route returns 503 so nobody can force traffic to
Sleeper.

## Environment

See [.env.example](.env.example). `SLEEPER_LEAGUE_ID` is optional — it defaults
to this league.
