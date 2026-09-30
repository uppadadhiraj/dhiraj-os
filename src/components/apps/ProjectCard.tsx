"use client";

import type { Project } from "@/data/types";
import { useWm } from "@/components/os/WindowManager";
import { PixelIcon } from "@/components/os/PixelIcon";
import { DevBadge, ExtLink, StatusPill, Tag } from "@/components/ui";
import { projectIcon } from "@/lib/apps-meta";
import { githubUrl } from "@/lib/links";

export function ProjectCard({ project: p }: { project: Project }) {
  const { open } = useWm();
  const hasLive = p.demo.kind === "embed" && !!p.demo.url;
  const gh = githubUrl(p.repo);
  return (
    <article className="panel flex min-w-0 flex-col gap-3 p-3" aria-labelledby={`pc-${p.slug}`}>
      <header className="flex items-start gap-3">
        <PixelIcon name={projectIcon(p)} size={32} />
        <div className="min-w-0 flex-1">
          <h3 id={`pc-${p.slug}`} className="!m-0 !text-[18px] leading-tight">
            {p.name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <StatusPill status={p.status} />
            <DevBadge development={p.development} />
            <span className="label-px !text-[11.5px]">{p.category === "built" ? "Built" : "Important"}</span>
          </div>
        </div>
      </header>
      <p className="!m-0 text-[14px] leading-snug text-[var(--c-ink)]">{p.tagline}</p>
      <ul className="m-0 flex list-none flex-wrap gap-1 p-0" style={{ maxWidth: "none" }} aria-label="Tech stack">
        {p.stack.slice(0, 6).map((s) => (
          <li key={s}>
            <Tag>{s}</Tag>
          </li>
        ))}
        {p.stack.length > 6 ? (
          <li>
            <Tag>+{p.stack.length - 6}</Tag>
          </li>
        ) : null}
      </ul>
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => open(`project:${p.slug}`)}>
          Open Project
        </button>
        {hasLive ? (
          <button type="button" className="btn btn-sm" onClick={() => open(`demo:${p.slug}`)}>
            <PixelIcon name="run" size={14} /> Live Demo
          </button>
        ) : null}
        {gh ? (
          <ExtLink href={gh} variant="button" className="btn-sm">
            GitHub
          </ExtLink>
        ) : null}
      </div>
    </article>
  );
}
