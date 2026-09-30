/**
 * Sleeper CDN helpers.
 *
 * Sleeper serves images from sleepercdn.com rather than through the API, and
 * the URL shapes are undocumented but stable. Everything here returns `null`
 * when there is nothing to show, so callers can fall back to initials.
 */

import type { LeagueUser, PlayerId, PlayerLite } from "./types";

const CDN = "https://sleepercdn.com";

/** Full-size account or league avatar. */
export function avatarUrl(avatarId: string | null | undefined): string | null {
  if (!avatarId) return null;
  // Custom league avatars are stored as absolute URLs.
  if (avatarId.startsWith("http")) return avatarId;
  return `${CDN}/avatars/${avatarId}`;
}

/** Smaller avatar variant; prefer this in lists and tables. */
export function avatarThumbUrl(
  avatarId: string | null | undefined,
): string | null {
  if (!avatarId) return null;
  if (avatarId.startsWith("http")) return avatarId;
  return `${CDN}/avatars/thumbs/${avatarId}`;
}

/**
 * A manager's avatar, preferring the team avatar they set inside this league
 * over their Sleeper account avatar.
 */
export function userAvatarUrl(user: LeagueUser): string | null {
  return avatarThumbUrl(user.metadata?.avatar ?? user.avatar);
}

/** Player headshot. Team defenses have no headshot; use {@link teamLogoUrl}. */
export function playerHeadshotUrl(playerId: PlayerId): string {
  return `${CDN}/content/nfl/players/${playerId}.jpg`;
}

/** NFL team logo, keyed by abbreviation ("KC", "SF"). */
export function teamLogoUrl(team: string | null | undefined): string | null {
  if (!team) return null;
  return `${CDN}/images/team_logos/nfl/${team.toLowerCase()}.png`;
}

/**
 * The right image for a roster slot: a team logo for defenses, a headshot for
 * everyone else.
 */
export function playerImageUrl(player: PlayerLite): string | null {
  if (player.position === "DEF") return teamLogoUrl(player.player_id);
  return playerHeadshotUrl(player.player_id);
}

/** Deep link to the league on Sleeper. */
export function leagueUrl(leagueId: string): string {
  return `https://sleeper.com/leagues/${leagueId}`;
}
