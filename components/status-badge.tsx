import type { WeekStatus } from "@/lib/sleeper";

/** FINAL / LIVE / UPCOMING label, shared by the ticker and matchup cards. */
export function StatusBadge({
  status,
  size = "sm",
}: {
  status: WeekStatus;
  size?: "xs" | "sm";
}) {
  const text = size === "xs" ? "text-[10px]" : "text-[11px]";

  if (status === "live") {
    return (
      <span className={`eyebrow flex items-center gap-1.5 ${text} text-live`}>
        {/* The pulse is the only motion on an otherwise static card. */}
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-live" />
        </span>
        Live
      </span>
    );
  }

  if (status === "final") {
    return (
      <span className={`eyebrow ${text} text-ink-dim`}>Final</span>
    );
  }

  return <span className={`eyebrow ${text} text-accent-dim`}>Upcoming</span>;
}
