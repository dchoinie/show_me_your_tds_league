import { redirect } from "next/navigation";

import { getCurrentWeek } from "@/lib/sleeper";

/**
 * `/matchups` has no content of its own - it sends you to the current week so
 * every week has exactly one canonical URL under `/matchups/[week]`.
 */
export default async function MatchupsPage() {
  redirect(`/matchups/${await getCurrentWeek()}`);
}
