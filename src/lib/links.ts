import { profile } from "@/data/profile";

/** GitHub URL for a repository name under the owner account (null when a project has no public repo). */
export const githubUrl = (repo: string | null | undefined): string | null =>
  repo ? `${profile.github.url}/${repo}` : null;
