import snapshot from "@/data/github.snapshot.json";

export interface GithubRepo {
  name: string;
  description: string | null;
  language: string | null;
  fork: boolean;
  archived: boolean;
  stars: number;
  createdAt: string;
  pushedAt: string;
  url: string;
  homepage: string | null;
  topics: string[];
}

export interface GithubEvent {
  id: string;
  type: string;
  repo: string;
  createdAt: string;
  ref: string | null;
  refType: string | null;
}

export interface GithubSnapshot {
  generatedAt: string;
  user: {
    login: string;
    name: string | null;
    avatarUrl: string;
    htmlUrl: string;
    publicRepos: number;
    followers: number;
    following: number;
    createdAt: string;
  };
  repos: GithubRepo[];
  events: GithubEvent[];
}

export const githubSnapshot = snapshot as GithubSnapshot;

export interface SiteStats {
  publicRepos: number;
  originalRepos: number;
  forks: number;
  languages: Array<[string, number]>;
  generatedAt: string;
  accountCreated: string;
}

/** Counts derived from the GitHub snapshot — nothing is typed in by hand. */
export function computeStats(s: GithubSnapshot = githubSnapshot): SiteStats {
  const original = s.repos.filter((r) => !r.fork);
  const counts = new Map<string, number>();
  for (const r of original) if (r.language) counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
  return {
    publicRepos: s.user.publicRepos,
    originalRepos: original.length,
    forks: s.repos.length - original.length,
    languages: [...counts.entries()].sort((a, b) => b[1] - a[1]),
    generatedAt: s.generatedAt,
    accountCreated: s.user.createdAt,
  };
}
