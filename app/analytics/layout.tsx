import { AnalyticsTabs } from "@/components/analytics-tabs";
import { PageHeader } from "@/components/page-shell";

/**
 * Shared shell for the analytics tabs.
 *
 * The header and tab bar live here so switching tabs never re-renders them,
 * and so each tab only pays for its own data.
 */
export default function AnalyticsLayout({
  children,
}: LayoutProps<"/analytics">) {
  return (
    <>
      <PageHeader eyebrow="League" title="Analytics">
        Digging into the numbers behind the season.
      </PageHeader>

      <AnalyticsTabs />

      {children}
    </>
  );
}
