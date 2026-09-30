"use client";

import { useMemo, useState } from "react";

import { TeamAvatar } from "@/components/team-avatar";
import type {
  GameStarter,
  PreviewGame,
  TeamRef,
  WeekPreview,
  WeekSlate,
} from "@/lib/sleeper";

/**
 * When a slate is, in words.
 *
 * Day-granular on purpose: Sleeper's schedule carries dates but no kickoff
 * times, so anything finer would be invented.
 */
function whenLabel(slate: WeekSlate): string {
  if (slate.complete) return "Final";
  if (slate.daysAway < 0) return "In progress";
  if (slate.daysAway === 0) return "Today";
  if (slate.daysAway === 1) return "Tomorrow";
  return `In ${slate.daysAway} days`;
}

function shortDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

/** "George Pickens" -> "G. Pickens", so rows stay on one line in a grid cell. */
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

function StarterRow({
  starter,
  selected,
  dimmed,
  onSelect,
}: {
  starter: GameStarter;
  selected: boolean;
  dimmed: boolean;
  onSelect: (rosterId: number) => void;
}) {
  return (
    <li
      className={`flex items-baseline gap-2 text-xs transition-opacity ${
        dimmed ? "opacity-30" : ""
      }`}
    >
      {/* Position as plain text: the label carries identity, not a color. */}
      <span className="numerals w-6 shrink-0 text-[10px] text-ink-dim">
        {starter.position ?? "—"}
      </span>
      <span
        className={`min-w-0 truncate ${selected ? "font-semibold text-accent" : "text-ink"}`}
      >
        {shortName(starter.name)}
      </span>
      <button
        type="button"
        onClick={() => onSelect(starter.fantasyTeam.rosterId)}
        className={`ml-auto max-w-24 shrink-0 truncate text-[11px] transition-colors ${
          selected ? "text-accent" : "text-ink-dim hover:text-ink-muted"
        }`}
      >
        {starter.fantasyTeam.teamName}
      </button>
    </li>
  );
}

function GameCard({
  game,
  selectedTeam,
  onSelect,
}: {
  game: PreviewGame;
  selectedTeam: number | null;
  onSelect: (rosterId: number) => void;
}) {
  const involved =
    selectedTeam !== null &&
    game.starters.some(
      (starter) => starter.fantasyTeam.rosterId === selectedTeam,
    );

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 transition-colors ${
        involved
          ? "border-accent/60 bg-surface-2/60"
          : selectedTeam !== null
            ? "border-line/50 bg-surface-2/10"
            : "border-line bg-surface-2/30"
      }`}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-line/60 pb-1.5">
        <span className="numerals text-sm text-ink">
          {game.away}
          <span className="px-1 text-ink-dim">@</span>
          {game.home}
        </span>
        {game.starters.length > 0 && (
          <span className="numerals text-[11px] text-ink-dim">
            {game.starters.length}
          </span>
        )}
      </div>

      {game.starters.length === 0 ? (
        <p className="py-1 text-[11px] text-ink-dim italic">No starters</p>
      ) : (
        <ul className="space-y-1">
          {game.starters.map((starter) => (
            <StarterRow
              key={starter.playerId}
              starter={starter}
              selected={starter.fantasyTeam.rosterId === selectedTeam}
              dimmed={
                selectedTeam !== null &&
                starter.fantasyTeam.rosterId !== selectedTeam
              }
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Slate({
  slate,
  selectedTeam,
  onSelect,
}: {
  slate: WeekSlate;
  selectedTeam: number | null;
  onSelect: (rosterId: number) => void;
}) {
  const upcoming = !slate.complete && slate.daysAway >= 0;

  return (
    <section className="mt-6 first:mt-0">
      <h3 className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="eyebrow text-xs text-ink-muted">
          {slate.weekday} {shortDate(slate.date)}
        </span>
        <span
          className={`eyebrow text-[10px] ${
            upcoming && slate.daysAway <= 1 ? "text-accent" : "text-ink-dim"
          }`}
        >
          {whenLabel(slate)}
        </span>
        <span className="text-[11px] text-ink-dim">
          {slate.games.length} {slate.games.length === 1 ? "game" : "games"} ·{" "}
          <span className="numerals">{slate.starterCount}</span> starters
        </span>
      </h3>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {slate.games.map((game) => (
          <GameCard
            key={game.gameId}
            game={game}
            selectedTeam={selectedTeam}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

export function WeekPreviewSection({
  preview,
  leagueMatchups,
  weeksToPlayoffs,
}: {
  preview: WeekPreview;
  leagueMatchups: number;
  weeksToPlayoffs: number | null;
}) {
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);

  /**
   * Twelve teams is far past the number of hues anyone can tell apart, so
   * spotting a team works by highlight rather than by colour: pick one and
   * their players light up across every game while the rest recede.
   */
  const teams = useMemo(() => {
    const seen = new Map<number, TeamRef>();
    for (const slate of preview.slates) {
      for (const game of slate.games) {
        for (const starter of game.starters) {
          seen.set(starter.fantasyTeam.rosterId, starter.fantasyTeam);
        }
      }
    }
    return [...seen.values()].sort((a, b) =>
      a.teamName.localeCompare(b.teamName),
    );
  }, [preview]);

  const toggle = (rosterId: number) =>
    setSelectedTeam((current) => (current === rosterId ? null : rosterId));

  const next = preview.slates.find(
    (slate) => !slate.complete && slate.daysAway >= 0,
  );

  return (
    <div className="mt-8">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="eyebrow text-xs text-accent">Week {preview.week}</h2>
        <span className="text-sm text-ink-dim">
          {preview.totalGames} NFL games
          {next && (
            <>
              {" · next kickoff "}
              <span className="text-ink-muted">
                {next.weekday}
                {next.daysAway === 0
                  ? " (today)"
                  : next.daysAway === 1
                    ? " (tomorrow)"
                    : ""}
              </span>
            </>
          )}
        </span>
      </div>

      {teams.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          <span className="eyebrow mr-1 text-[10px] text-ink-dim">
            Spot a team
          </span>
          {teams.map((team) => {
            const active = team.rosterId === selectedTeam;
            return (
              <button
                key={team.rosterId}
                type="button"
                onClick={() => toggle(team.rosterId)}
                aria-pressed={active}
                className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors ${
                  active
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-line text-ink-muted hover:border-line-bright hover:text-ink"
                }`}
              >
                <TeamAvatar
                  name={team.teamName}
                  src={team.avatarUrl}
                  size={16}
                />
                <span className="max-w-32 truncate">{team.teamName}</span>
              </button>
            );
          })}
          {selectedTeam !== null && (
            <button
              type="button"
              onClick={() => setSelectedTeam(null)}
              className="eyebrow rounded-full px-2 py-1 text-[10px] text-ink-dim transition-colors hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {preview.slates.map((slate) => (
        <Slate
          key={slate.date}
          slate={slate}
          selectedTeam={selectedTeam}
          onSelect={toggle}
        />
      ))}

      <p className="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-dim">
        <span>
          <span className="numerals text-ink-muted">{leagueMatchups}</span>{" "}
          league matchups
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {preview.byeTeams.length === 0
            ? "No teams on bye"
            : `${preview.byeTeams.length} on bye: ${preview.byeTeams.join(", ")}`}
        </span>
        {preview.startersOnBye.length > 0 && (
          <>
            <span aria-hidden="true">·</span>
            {/* A started player with no game is a lineup left unset. */}
            <span className="text-live">
              <span className="numerals">{preview.startersOnBye.length}</span>{" "}
              {preview.startersOnBye.length === 1 ? "starter" : "starters"} with
              no game
            </span>
          </>
        )}
        {weeksToPlayoffs !== null && weeksToPlayoffs > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span>
              <span className="numerals text-ink-muted">
                {weeksToPlayoffs}
              </span>{" "}
              {weeksToPlayoffs === 1 ? "week" : "weeks"} to playoffs
            </span>
          </>
        )}
      </p>
    </div>
  );
}
