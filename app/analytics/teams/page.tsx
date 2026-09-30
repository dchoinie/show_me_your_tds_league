import type { Metadata } from "next";

import { AgeAnalysisSection } from "@/components/age-analysis";
import { getAgeAnalysis } from "@/lib/sleeper";

export const metadata: Metadata = {
  title: "Team analytics",
  description:
    "Roster age weighted by production, and where each franchise sits in its competitive window.",
};

export default async function TeamAnalyticsPage() {
  const analysis = await getAgeAnalysis();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
      <AgeAnalysisSection analysis={analysis} />
    </div>
  );
}
