#!/usr/bin/env node
/**
 * Snapshots public GitHub data for the portfolio.
 *
 *   node scripts/sync-github.mjs
 *
 * Writes src/data/github.snapshot.json. The GitHub window renders this snapshot
 * instantly and then tries a live refresh in the browser; if the unauthenticated
 * API is rate limited the snapshot (with its timestamp) stays on screen.
 *
 * Set GITHUB_TOKEN to raise the rate limit. The token is only used here, at
 * build/sync time, and never reaches the browser bundle.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const USER = "uppadadhiraj";
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/data/github.snapshot.json");

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "dhiraj-os-portfolio-sync",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub ${path} -> ${res.status} ${res.statusText}`);
  return res.json();
}

const user = await gh(`/users/${USER}`);

const repos = [];
for (let page = 1; page <= 5; page++) {
  const batch = await gh(`/users/${USER}/repos?per_page=100&sort=updated&page=${page}`);
  repos.push(...batch);
  if (batch.length < 100) break;
}

let events = [];
try {
  events = await gh(`/users/${USER}/events/public?per_page=100`);
} catch (err) {
  console.warn("events unavailable:", err.message);
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  user: {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    htmlUrl: user.html_url,
    publicRepos: user.public_repos,
    followers: user.followers,
    following: user.following,
    createdAt: user.created_at,
  },
  repos: repos
    .map((r) => ({
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
    }))
    .sort((a, b) => (a.pushedAt < b.pushedAt ? 1 : -1)),
  events: events.map((e) => ({
    id: e.id,
    type: e.type,
    repo: e.repo?.name?.replace(`${USER}/`, "") ?? "",
    createdAt: e.created_at,
    ref: e.payload?.ref ?? null,
    refType: e.payload?.ref_type ?? null,
  })),
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(snapshot, null, 2) + "\n");
console.log(
  `snapshot: ${snapshot.repos.length} repos (${snapshot.repos.filter((r) => !r.fork).length} original), ` +
    `${snapshot.events.length} events -> ${OUT}`,
);
