import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        {eyebrow && (
          <p className="eyebrow mb-2 text-xs text-accent">{eyebrow}</p>
        )}
        <h1 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          {title}
        </h1>
        {children && (
          <p className="mt-3 max-w-2xl text-ink-muted">{children}</p>
        )}
      </div>
    </div>
  );
}

/** Placeholder body for routes that exist so the nav has no dead links. */
export function ComingSoon({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="rounded-lg border border-dashed border-line-bright bg-surface/40 px-6 py-14 text-center">
        <p className="eyebrow text-xs text-ink-dim">Coming soon</p>
        <p className="mx-auto mt-3 max-w-md text-ink-muted">{children}</p>
      </div>
    </div>
  );
}
