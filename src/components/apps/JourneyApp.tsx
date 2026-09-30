"use client";

import { useMemo } from "react";
import { githubSnapshot } from "@/lib/github-stats";
import { otherProjects, projects } from "@/data/projects";
import { profile } from "@/data/profile";
import { useWm } from "@/components/os/WindowManager";
import { ExtLink } from "@/components/ui";
import { githubUrl } from "@/lib/links";
import { Pane } from "./common";

interface Entry {
  sortKey: string;
  year: string;
  label: string;
  kind: "project" | "other" | "milestone";
  title: string;
  detail?: string;
  slug?: string;
  repo?: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Builds the timeline from the GitHub snapshot (real creation dates) plus a few dated milestones. */
export function buildJourney(): Entry[] {
  const entries: Entry[] = [];
  const bySlug = new Map(projects.filter((p) => p.repo).map((p) => [p.repo!, p]));
  const byOther = new Map(otherProjects.map((o) => [o.repo, o]));

  for (const r of githubSnapshot.repos) {
    if (r.fork) continue;
    const d = new Date(r.createdAt);
    const p = bySlug.get(r.name);
    const o = byOther.get(r.name);
    // repositories that are only profile/blog scaffolding are not portfolio projects
    if (!p && !o && ["uppadadhiraj", "uppadadhiraj.github.io", "Smart-Insights-of-Customer-Patters-"].includes(r.name)) continue;
    entries.push({
      sortKey: r.createdAt,
      year: String(d.getUTCFullYear()),
      label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`,
      kind: p ? "project" : "other",
      title: p?.name ?? o?.name ?? r.name,
      detail: p?.tagline ?? o?.blurb ?? r.description ?? undefined,
      slug: p?.slug,
      repo: r.name,
    });
  }

  const joined = new Date(githubSnapshot.user.createdAt);
  entries.push(
    {
      sortKey: githubSnapshot.user.createdAt,
      year: String(joined.getUTCFullYear()),
      label: `${MONTHS[joined.getUTCMonth()]} ${joined.getUTCDate()}`,
      kind: "milestone",
      title: "GitHub account created",
      detail: "From the GitHub API.",
    },
    {
      sortKey: "2023-00",
      year: "2023",
      label: "2023",
      kind: "milestone",
      title: "Started B.Tech in Computer Science & Engineering",
      detail: "Vidya Jyothi Institute of Technology, Hyderabad (2023 – 2027). Exact start date not specified.",
    },
    {
      sortKey: "2026-00",
      year: "2026",
      label: "2026",
      kind: "milestone",
      title: "GSSoC 2026 contributor",
      detail: "Selected for the AI Agent Track and Open Source Track (from my resume). Exact dates not specified.",
    },
  );
  return entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export function JourneyApp() {
  const { open } = useWm();
  const entries = useMemo(() => buildJourney(), []);
  const years = [...new Set(entries.map((e) => e.year))];
  const repoEntries = entries.filter((e) => e.kind !== "milestone");
  const first = repoEntries[0];
  const last = repoEntries[repoEntries.length - 1];

  return (
    <Pane label="Journey timeline">
      <h1 className="!mb-1 !text-[22px]">JOURNEY.exe</h1>
      <p className="!mt-0 text-[14px]">
        {repoEntries.length} repositories, placed by the date each was created on GitHub
        {first && last ? ` (${first.label} ${first.year} → ${last.label} ${last.year})` : ""}. Nothing here is dated from memory.
      </p>

      <ol className="m-0 mt-4 list-none p-0" style={{ maxWidth: "none" }}>
        {years.map((y) => (
          <li key={y} className="mb-2">
            <h2 className="!m-0 !mb-2 !font-[family-name:var(--font-mono)] !text-[20px] !font-semibold tracking-wide">{y}</h2>
            <ol className="m-0 list-none border-l-2 border-[var(--c-navy-2)] pl-5" style={{ maxWidth: "none" }}>
              {entries
                .filter((e) => e.year === y)
                .map((e) => (
                  <li key={`${e.sortKey}-${e.title}`} className="relative pb-4">
                    <span
                      aria-hidden="true"
                      className="absolute -left-[29px] top-1.5 h-3 w-3"
                      style={{
                        background: e.kind === "milestone" ? "var(--c-amber)" : e.kind === "project" ? "var(--c-navy)" : "var(--c-shadow)",
                        boxShadow: "0 0 0 2px var(--c-paper)",
                      }}
                    />
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <span className="label-px !text-[12px]">{e.label}</span>
                      {e.slug ? (
                        <button type="button" className="font-semibold underline" style={{ color: "var(--c-link)" }} onClick={() => open(`project:${e.slug}`)}>
                          {e.title}
                        </button>
                      ) : e.repo ? (
                        <ExtLink href={githubUrl(e.repo)!} className="font-semibold">
                          {e.title}
                        </ExtLink>
                      ) : (
                        <span className="font-semibold">{e.title}</span>
                      )}
                      {e.kind === "milestone" ? (
                        <span className="pill !py-0 !text-[10.5px]" data-status="HARDWARE">
                          MILESTONE
                        </span>
                      ) : null}
                    </div>
                    {e.detail ? <p className="!mb-0 !mt-0.5 text-[13.5px] text-[var(--c-ink-2)]">{e.detail}</p> : null}
                  </li>
                ))}
            </ol>
          </li>
        ))}
      </ol>

      <div className="groupbox mt-4" role="note">
        <span className="groupbox-label">Experience</span>
        <p className="!mt-0">
          I don&apos;t have formal employment to list — I&apos;m a student, and I won&apos;t dress that up. What I can point to: the projects above,
          GSSoC 2026, and Task 01 of the SkillCraft Technology internship program (the House Price Linear Regression repo, per its README).
        </p>
        <p className="!mb-0 text-[13px] text-[var(--c-ink-2)]">
          Not on this timeline: {profile.blog.name}, my blog, has its own posts at{" "}
          <ExtLink href={profile.blog.url}>{profile.blog.url.replace("https://", "")}</ExtLink>.
        </p>
      </div>
    </Pane>
  );
}
