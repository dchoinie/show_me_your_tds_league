"use client";

import Image from "next/image";
import { useState } from "react";

/** First letters of the first two words, e.g. "Chalupa Batman" -> "CB". */
function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/**
 * A team's avatar, falling back to initials.
 *
 * Client-side because Sleeper avatars 404 often enough to matter - a manager
 * who never uploaded one, or a stale CDN reference - and only an `onError`
 * handler can catch that.
 */
export function TeamAvatar({
  name,
  src,
  size = 24,
}: {
  name: string;
  src: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        className="flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-display font-semibold text-ink-dim"
      >
        {initials(name)}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full bg-surface-2 object-cover"
      style={{ width: size, height: size }}
    />
  );
}
