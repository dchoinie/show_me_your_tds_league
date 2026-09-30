import type { Metadata } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { Suspense } from "react";

import { ScoreTicker, ScoreTickerFallback } from "@/components/score-ticker";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Condensed display face for scores, ranks and section labels.
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Show Me Your TDs",
    template: "%s · Show Me Your TDs",
  },
  description:
    "Standings, matchups, rosters and transactions for the Show Me Your TDs dynasty fantasy football league.",
  openGraph: {
    title: "Show Me Your TDs",
    description:
      "Standings, matchups, rosters and transactions for the Show Me Your TDs dynasty fantasy football league.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-field text-ink">
        <SiteNav />
        {/*
         * The ticker reads live scores, so it streams in behind a fallback of
         * the same height. Everything else in the shell is prerendered.
         */}
        <Suspense fallback={<ScoreTickerFallback />}>
          <ScoreTicker />
        </Suspense>
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
