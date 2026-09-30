"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { githubSnapshot, type GithubEvent, type GithubRepo } from "@/lib/github-stats";
import { describeEvent, fetchLive, languageBreakdown, langColor, timeAgo } from "@/lib/github-live";
import { projects } from "@/data/projects";
import { profile } from "@/data/profile";
import { ExtLink } from "@/components/ui";
import { useWm } from "@/components/os/WindowManager";
import { StatusBar } from "./common";

type Source = { kind: "snapshot" } | { kind: "live"; at: string } | { kind: "fallback"; reason: string };

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function GitHubApp() {
  const { open } = useWm();
  const uid = useId().replace(/:/g, "");
  const [repos, setRepos] = useState<GithubRepo[]>(githubSnapshot.repos);
  const [events, setEvents] = useState<GithubEvent[]>(githubSnapshot.events);
  const [source, setSource] = useState<Source>({ kind: "snapshot" });
  const [q, setQ] = useState("");
  const [lang, setLang] = useState("all");
  const [sort, setSort] = useState<"pushed" | "created" | "name">("pushed");
  const [showForks, setShowForks] = useState(true);
  const user = githubSnapshot.user;

  // Try a live refresh; on any failure keep the snapshot and say so.
  useEffect(() => {
    const ctrl = new AbortController();
    fetchLive(user.login, ctrl.signal).then((res) => {
      if (ctrl.signal.aborted) return;
      if (res.ok) {
        setRepos(res.repos);
        if (res.events.length) setEvents(res.events);
        setSource({ kind: "live", at: res.fetchedAt });
      } else {
        setSource({ kind: "fallback", reason: res.message });
      }
    });
    return () => ctrl.abort();
  }, [user.login]);

  const slugByRepo = useMemo(() => new Map(projects.filter((p) => p.repo).map((p) => [p.repo!, p.slug])), []);
  const langs = useMemo(() => languageBreakdown(repos), [repos]);
  const originalCount = repos.filter((r) => !r.fork).length;

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return repos
      .filter((r) => showForks || !r.fork)
      .filter((r) => lang === "all" || r.language === lang)
      .filter((r) => !needle || `${r.name} ${r.description ?? ""}`.toLowerCase().includes(needle))
      .sort((a, b) =>
        sort === "name" ? a.name.localeCompare(b.name) : (sort === "created" ? b.createdAt.localeCompare(a.createdAt) : b.pushedAt.localeCompare(a.pushedAt)),
      );
  }, [repos, q, lang, sort, showForks]);

  const [now] = useState(() => Date.now());

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="pane" style={{ flex: 1 }}>
        <div className="pane-inner prose-os">
          <div className="flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={user.avatarUrl} alt="GitHub profile picture" width={72} height={72} className="h-[72px] w-[72px] shrink-0 bg-[var(--c-paper-2)] object-cover" loading="lazy" />
            <div className="min-w-0 flex-1">
              <h1 className="!m-0 !text-[22px]">{user.name ?? user.login}</h1>
              <p className="!m-0 font-[family-name:var(--font-mono)] text-[13px] text-[var(--c-ink-2)]">@{user.login}</p>
              <p className="!mb-0 !mt-1 text-[13.5px]">
                <b>{originalCount}</b> original repos · <b>{repos.length - originalCount}</b> fork · <b>{user.followers}</b> followers · joined {new Date(user.createdAt).getUTCFullYear()}
              </p>
            </div>
            <ExtLink href={profile.github.url} variant="primary">
              Open on GitHub
            </ExtLink>
          </div>

          <h2 className="!mt-5">Languages</h2>
          <div className="bevel-in flex h-5 w-full overflow-hidden !p-0" role="img" aria-label={`Languages by repository: ${langs.map((l) => `${l.language} ${Math.round(l.pct)}%`).join(", ")}`}>
            {langs.map((l) => (
              <span key={l.language} style={{ width: `${l.pct}%`, background: langColor(l.language) }} title={`${l.language}: ${l.count} repos`} />
            ))}
          </div>
          <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[13px]" style={{ maxWidth: "none" }}>
            {langs.map((l) => (
              <li key={l.language} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block h-2.5 w-2.5" style={{ background: langColor(l.language) }} />
                {l.language} <span className="text-[var(--c-ink-2)]">{l.count}</span>
              </li>
            ))}
          </ul>
          <p className="!mt-1 text-[12px] text-[var(--c-ink-2)]">By primary language of each original repository — not by lines of code.</p>

          <h2>Recent public activity</h2>
          {events.length === 0 ? (
            <p>No recent public events available.</p>
          ) : (
            <ul className="m-0 list-none space-y-1 p-0" style={{ maxWidth: "none" }}>
              {events.slice(0, 8).map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline gap-2 text-[13.5px]">
                  <span aria-hidden="true" className="inline-block h-2 w-2 bg-[var(--c-navy-2)]" />
                  <span>{describeEvent(e)}</span>
                  <span className="text-[12px] text-[var(--c-ink-2)]">{timeAgo(e.createdAt, now)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="!mt-2 text-[12px] text-[var(--c-ink-2)]">
            GitHub&apos;s contribution graph needs authentication, so this shows public events instead (the API exposes only the most recent ones).
          </p>

          <h2>Repositories</h2>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`${uid}-q`}>Filter repositories</label>
            <input id={`${uid}-q`} type="search" className="field" style={{ width: 200 }} placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} />
            <label className="sr-only" htmlFor={`${uid}-l`}>Language</label>
            <select id={`${uid}-l`} className="field" style={{ width: 150 }} value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="all">All languages</option>
              {langs.map((l) => (
                <option key={l.language} value={l.language}>{l.language}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor={`${uid}-s`}>Sort</label>
            <select id={`${uid}-s`} className="field" style={{ width: 150 }} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="pushed">Recently pushed</option>
              <option value="created">Newest</option>
              <option value="name">Name</option>
            </select>
            <label className="flex items-center gap-1.5 text-[13px]">
              <input type="checkbox" checked={showForks} onChange={(e) => setShowForks(e.target.checked)} /> Show forks
            </label>
          </div>
          <ul className="m-0 list-none space-y-2 p-0" style={{ maxWidth: "none" }}>
            {visible.map((r) => {
              const slug = slugByRepo.get(r.name);
              return (
                <li key={r.name} className="panel p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-[family-name:var(--font-mono)] text-[14px] font-semibold">
                      {r.name}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                    {r.fork ? <span className="pill" data-status="ARCHIVED">FORK</span> : null}
                    {slug ? (
                      <button type="button" className="btn btn-sm" onClick={() => open(`project:${slug}`)}>
                        Write-up
                      </button>
                    ) : null}
                    <span className="flex-1" />
                    {r.language ? (
                      <span className="flex items-center gap-1.5 text-[12.5px]">
                        <span aria-hidden="true" className="inline-block h-2.5 w-2.5" style={{ background: langColor(r.language) }} />
                        {r.language}
                      </span>
                    ) : null}
                    <span className="text-[12px] text-[var(--c-ink-2)]">pushed {fmtDate(r.pushedAt)}</span>
                  </div>
                  {r.description ? <p className="!mb-0 !mt-1 text-[13px]">{r.description}</p> : null}
                </li>
              );
            })}
            {visible.length === 0 ? <li>No repositories match.</li> : null}
          </ul>
        </div>
      </div>
      <StatusBar
        items={[
          source.kind === "live"
            ? `Live from api.github.com · ${new Date(source.at).toLocaleTimeString()}`
            : source.kind === "fallback"
              ? `${source.reason} Showing the snapshot from ${fmtDate(githubSnapshot.generatedAt)}.`
              : `Snapshot from ${fmtDate(githubSnapshot.generatedAt)} · checking for live data…`,
          `${visible.length} repos`,
        ]}
      />
    </div>
  );
}
