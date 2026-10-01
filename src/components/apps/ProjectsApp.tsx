"use client";

import { useId, useMemo, useState } from "react";
import { otherProjects, projects } from "@/data/projects";
import { exploring } from "@/data/profile";
import { ExtLink, StatusPill, TabPanel, Tabs, Tag } from "@/components/ui";
import { useWm } from "@/components/os/WindowManager";
import { PixelIcon } from "@/components/os/PixelIcon";
import { githubUrl } from "@/lib/links";
import type { AppProps } from "@/components/os/app-components";
import { ProjectCard } from "./ProjectCard";
import { StatusBar } from "./common";

const TABS = [
  { id: "featured", label: "Featured" },
  { id: "built", label: "Built" },
  { id: "important", label: "Important" },
  { id: "other", label: "Other" },
];

const INTRO: Record<string, string> = {
  featured: "The strongest projects, each written up from reading its source.",
  built:
    "Projects I wrote myself (HAND-BUILT). I sometimes asked an LLM for help when I got stuck, but none of them is AI-generated.",
  important:
    "The larger projects, built with AI coding tools (mainly Claude Code) and always labelled AI-ASSISTED. I designed them and directed the AI; I don't claim to have hand-written the code.",
  other: "Smaller repositories, coursework and learning projects — all hand-built. Where one can run in your browser, it has a Try it button.",
};

export function ProjectsApp({ tab, tag }: AppProps) {
  const { open } = useWm();
  const base = useId().replace(/:/g, "");
  const [active, setActive] = useState(TABS.some((t) => t.id === tab) ? (tab as string) : "featured");
  const [tagFilter, setTagFilter] = useState<string | undefined>(tag);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return projects
      .filter((p) => (active === "featured" ? p.featured : active === "other" ? false : p.category === active))
      .filter((p) => !tagFilter || p.tags.includes(tagFilter))
      .filter(
        (p) =>
          !needle ||
          [p.name, p.tagline, ...p.stack, ...p.tags].join(" ").toLowerCase().includes(needle),
      );
  }, [active, tagFilter, q]);

  const others = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return otherProjects.filter((o) => !needle || [o.name, o.blurb, ...o.stack].join(" ").toLowerCase().includes(needle));
  }, [q]);

  const tagLabel = exploring.find((x) => x.key === tagFilter)?.label ?? tagFilter;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs tabs={TABS} value={active} onChange={setActive} label="Project categories" idBase={base} />
      <div className="pane" style={{ flex: 1 }}>
        <div className="pane-inner prose-os">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="!m-0 min-w-[200px] flex-1 text-[14px] text-[var(--c-ink-2)]">{INTRO[active]}</p>
            <label className="sr-only" htmlFor={`${base}-q`}>
              Search projects
            </label>
            <input
              id={`${base}-q`}
              type="search"
              className="field"
              style={{ width: 220 }}
              placeholder="Search projects…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {tagFilter && active !== "other" ? (
            <p className="!mt-0 flex items-center gap-2 text-[13px]">
              Filtered by <Tag>{tagLabel}</Tag>
              <button type="button" className="btn btn-sm" onClick={() => setTagFilter(undefined)}>
                Clear filter
              </button>
            </p>
          ) : null}

          <TabPanel idBase={base} id={active} active>
            {active === "other" ? (
              <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2" style={{ maxWidth: "none" }}>
                {others.map((o) => (
                  <li key={o.slug} className="panel flex flex-col gap-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="!m-0 !text-[16px]">{o.name}</h3>
                      <StatusPill status={o.status} />
                    </div>
                    <p className="!m-0 text-[13.5px] leading-snug">{o.blurb}</p>
                    {o.note ? <p className="!m-0 text-[12.5px] text-[var(--c-ink-2)]">{o.note}</p> : null}
                    {o.demo ? <p className="!m-0 text-[12.5px] text-[var(--c-ink-2)]">{o.demo.note}</p> : null}
                    <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
                      {o.stack.map((s) => (
                        <Tag key={s}>{s}</Tag>
                      ))}
                      <span className="flex-1" />
                      {o.demo?.kind === "embed" ? (
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => open(`demo:${o.slug}`)} aria-label={`Try ${o.name}`}>
                          <PixelIcon name="run" size={14} /> Try it
                        </button>
                      ) : null}
                      <ExtLink href={githubUrl(o.repo)!} variant="button" className="btn-sm">
                        GitHub
                      </ExtLink>
                    </div>
                  </li>
                ))}
                {others.length === 0 ? <li>No projects match “{q}”.</li> : null}
              </ul>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {list.map((p) => (
                    <ProjectCard key={p.slug} project={p} />
                  ))}
                </div>
                {list.length === 0 ? (
                  <p className="flex items-center gap-2">
                    <PixelIcon name="info" size={20} /> No projects match this filter.
                  </p>
                ) : null}
              </>
            )}
          </TabPanel>
        </div>
      </div>
      <StatusBar
        items={[
          active === "other" ? `${others.length} repositories` : `${list.length} project${list.length === 1 ? "" : "s"}`,
          "Click Open Project for the full write-up",
        ]}
      />
    </div>
  );
}
