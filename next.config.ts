import type { NextConfig } from "next";

const DAY = 60 * 60 * 24;

const nextConfig: NextConfig = {
  // Pin the workspace root; otherwise Turbopack walks up and finds an
  // unrelated lockfile in the home directory.
  turbopack: { root: import.meta.dirname },

  // The rules page reads content/constitution.md at render time. File tracing
  // cannot see through a runtime path join, so include it explicitly or the
  // constitution goes missing once deployed.
  outputFileTracingIncludes: {
    "/rules": ["./content/**"],
  },

  images: {
    // Sleeper serves every avatar, headshot and team logo from this host.
    remotePatterns: [{ protocol: "https", hostname: "sleepercdn.com" }],
  },

  // Opt in to the Next.js 16 Cache Components model. Every Sleeper read in
  // lib/sleeper is a `use cache` function with an explicit cacheLife profile,
  // so nothing hits Sleeper on a per-request basis.
  cacheComponents: true,

  cacheLife: {
    // Scores that move while games are being played.
    sleeperLive: {
      stale: 30,
      revalidate: 60,
      expire: 60 * 10,
    },
    // The live game tracker. Sleeper's own scoring lands 30-90s behind the
    // play, so polling faster than this returns identical bytes.
    sleeperGameday: {
      stale: 15,
      revalidate: 30,
      expire: 60 * 10,
    },
    // League config, users, standings. Changes a few times a week.
    sleeperLeague: {
      stale: 60 * 5,
      revalidate: 60 * 15,
      expire: DAY,
    },
    // Roster membership. Changes the moment anyone adds, drops or trades, and
    // people check immediately after making a move - so this is kept close to
    // live rather than sharing the league-settings clock.
    sleeperRoster: {
      stale: 30,
      revalidate: 60,
      expire: 60 * 10,
    },
    // Finished weeks, drafts, traded picks. Effectively immutable once written.
    sleeperHistory: {
      stale: 60 * 60,
      revalidate: DAY,
      expire: DAY * 30,
    },
    // nflverse game metadata. Their pipeline rebuilds a handful of times a
    // day, so checking more often than this just re-downloads the same file.
    nflverseData: {
      stale: 60 * 60,
      revalidate: 60 * 60 * 6,
      expire: DAY * 2,
    },
    // The ~5MB player dictionary. Sleeper asks for at most one call per day.
    sleeperPlayers: {
      stale: 60 * 60 * 12,
      revalidate: DAY,
      expire: DAY * 7,
    },
  },
};

export default nextConfig;
