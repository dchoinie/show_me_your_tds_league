import type { Metadata } from "next";

import { DraftRecapSection } from "@/components/draft-recap";
import { PageHeader } from "@/components/page-shell";
import { getDraftRecap } from "@/lib/sleeper";

export const metadata: Metadata = {
  title: "Draft",
  description:
    "The complete draft recap: every pick, what it cost and who bought it.",
};

export default async function DraftPage() {
  const recap = await getDraftRecap();

  return (
    <>
      <PageHeader
        eyebrow={recap ? `${recap.season} · ${recap.type}` : "League"}
        title="Draft"
      >
        {recap?.isAuction
          ? "The inaugural auction — every player bought, what they cost and who paid."
          : "Every pick of the rookie draft."}
      </PageHeader>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        {recap ? (
          <DraftRecapSection recap={recap} />
        ) : (
          <p className="rounded-lg border border-dashed border-line-bright bg-surface/40 px-6 py-14 text-center text-ink-muted">
            No draft has been held yet.
          </p>
        )}
      </div>
    </>
  );
}
