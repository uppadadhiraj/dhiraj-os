"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SiteStats } from "@/lib/github-stats";

const StatsCtx = createContext<SiteStats | null>(null);

/** Build-time GitHub-derived counts, passed down from the server page. */
export function SiteStatsProvider({ stats, children }: { stats: SiteStats; children: ReactNode }) {
  return <StatsCtx.Provider value={stats}>{children}</StatsCtx.Provider>;
}

export function useSiteStats(): SiteStats {
  const s = useContext(StatsCtx);
  if (!s) throw new Error("useSiteStats must be used inside <SiteStatsProvider>");
  return s;
}
