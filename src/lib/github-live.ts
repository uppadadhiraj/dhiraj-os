import type { GithubEvent, GithubRepo } from "./github-stats";

/** Shapes returned by api.github.com that we actually read. */
export interface ApiRepo {
  name: string;
  description: string | null;
  language: string | null;
  fork: boolean;
  archived: boolean;
  stargazers_count: number;
  created_at: string;
  pushed_at: string;
  html_url: string;
  homepage: string | null;
  topics?: string[];
}
export interface ApiEvent {
  id: string;
  type: string;
  repo?: { name: string };
  created_at: string;
  payload?: { ref?: string | null; ref_type?: string | null };
}

export const mapRepo = (r: ApiRepo): GithubRepo => ({
  name: r.name,
  description: r.description,
  language: r.language,
  fork: r.fork,
  archived: r.archived,
  stars: r.stargazers_count,
  createdAt: r.created_at,
  pushedAt: r.pushed_at,
  url: r.html_url,
  homepage: r.homepage || null,
  topics: r.topics ?? [],
});

export const mapEvent = (e: ApiEvent, user: string): GithubEvent => ({
  id: e.id,
  type: e.type,
  repo: e.repo?.name?.replace(`${user}/`, "") ?? "",
  createdAt: e.created_at,
  ref: e.payload?.ref ?? null,
  refType: e.payload?.ref_type ?? null,
});

export type LiveResult =
  | { ok: true; repos: GithubRepo[]; events: GithubEvent[]; fetchedAt: string }
  | { ok: false; reason: "rate-limit" | "network" | "error"; message: string };

/**
 * Unauthenticated, read-only calls to the public GitHub API. Any failure (rate limit,
 * offline, blocked) returns a typed result — the caller keeps showing the build-time snapshot.
 */
export async function fetchLive(user: string, signal?: AbortSignal): Promise<LiveResult> {
  const headers = { Accept: "application/vnd.github+json" };
  try {
    const [repoRes, evRes] = await Promise.all([
      fetch(`https://api.github.com/users/${user}/repos?per_page=100&sort=pushed`, { headers, signal }),
      fetch(`https://api.github.com/users/${user}/events/public?per_page=100`, { headers, signal }),
    ]);
    for (const res of [repoRes, evRes]) {
      if (res.status === 403 || res.status === 429) {
        return { ok: false, reason: "rate-limit", message: "GitHub's unauthenticated API rate limit was reached." };
      }
    }
    if (!repoRes.ok) return { ok: false, reason: "error", message: `GitHub returned ${repoRes.status}.` };
    const repos = ((await repoRes.json()) as ApiRepo[]).map(mapRepo);
    const events = evRes.ok ? ((await evRes.json()) as ApiEvent[]).map((e) => mapEvent(e, user)) : [];
    return { ok: true, repos, events, fetchedAt: new Date().toISOString() };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return { ok: false, reason: "network", message: "aborted" };
    return { ok: false, reason: "network", message: "Could not reach GitHub from this browser." };
  }
}

export function describeEvent(e: GithubEvent): string {
  switch (e.type) {
    case "PushEvent":
      return `Pushed to ${e.repo}${e.ref ? ` (${e.ref.replace("refs/heads/", "")})` : ""}`;
    case "CreateEvent":
      return e.refType === "repository" ? `Created repository ${e.repo}` : `Created ${e.refType ?? "ref"} ${e.ref ?? ""} in ${e.repo}`.replace(/\s+/g, " ");
    case "WatchEvent":
      return `Starred ${e.repo}`;
    case "ForkEvent":
      return `Forked ${e.repo}`;
    case "PublicEvent":
      return `Made ${e.repo} public`;
    case "PullRequestEvent":
      return `Pull request in ${e.repo}`;
    case "IssuesEvent":
      return `Issue activity in ${e.repo}`;
    default:
      return `${e.type.replace(/Event$/, "")} in ${e.repo}`;
  }
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? "" : "s"} ago`;
  const y = Math.round(mo / 12);
  return `${y} year${y === 1 ? "" : "s"} ago`;
}

export interface LangShare {
  language: string;
  count: number;
  pct: number;
}

/** Share of original (non-fork) repositories by primary language. */
export function languageBreakdown(repos: GithubRepo[]): LangShare[] {
  const own = repos.filter((r) => !r.fork && r.language);
  const counts = new Map<string, number>();
  for (const r of own) counts.set(r.language!, (counts.get(r.language!) ?? 0) + 1);
  const total = own.length || 1;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([language, count]) => ({ language, count, pct: (count / total) * 100 }));
}

/** GitHub's public language colours, with a neutral fallback. */
export const LANG_COLORS: Record<string, string> = {
  Python: "#3572A5",
  "Jupyter Notebook": "#DA5B0B",
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Java: "#b07219",
  Astro: "#ff5a03",
  HTML: "#e34c26",
  CSS: "#563d7c",
};
export const langColor = (l: string) => LANG_COLORS[l] ?? "#7d8190";
