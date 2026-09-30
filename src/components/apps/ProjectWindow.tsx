"use client";

import { useId, useMemo, useState } from "react";
import { projectBySlug } from "@/data/projects";
import { githubSnapshot } from "@/lib/github-stats";
import { githubUrl } from "@/lib/links";
import { useWm } from "@/components/os/WindowManager";
import { PixelIcon } from "@/components/os/PixelIcon";
import { ArchitectureDiagram } from "@/components/diagrams/ArchitectureDiagram";
import { DevBadge, ExtLink, StatusPill, TabPanel, Tabs, Tag, statusHelp } from "@/components/ui";
import { projectIcon } from "@/lib/apps-meta";
import type { AppProps } from "@/components/os/app-components";
import { CopyButton, SectionTitle } from "./common";
import { Gallery } from "./Gallery";

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";

export function ProjectWindow({ slug }: AppProps) {
  const p = slug ? projectBySlug(slug) : undefined;
  const { open } = useWm();
  const base = useId().replace(/:/g, "");
  const [tab, setTab] = useState("overview");

  const repo = useMemo(() => githubSnapshot.repos.find((r) => r.name === p?.repo), [p?.repo]);

  if (!p) {
    return (
      <div className="pane">
        <div className="pane-inner prose-os">
          <h1>404: project not found</h1>
          <p>There is no project called “{slug}”. Try the Projects window.</p>
          <button type="button" className="btn btn-primary" onClick={() => open("projects")}>
            Open Projects
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    ...(p.howItWorks || p.architecture ? [{ id: "how", label: "How it works" }] : []),
    { id: "eng", label: "Engineering" },
    ...(p.screenshots?.length ? [{ id: "shots", label: `Screenshots (${p.screenshots.length})` }] : []),
    { id: "run", label: "Run it" },
  ];
  const gh = githubUrl(p.repo);
  const hasEmbed = p.demo.kind === "embed" && !!p.demo.url;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 bg-[var(--c-face)] px-3 py-2">
        <PixelIcon name={projectIcon(p)} size={36} />
        <div className="min-w-0 flex-1">
          <h1 className="m-0 font-[family-name:var(--font-pixel)] text-[22px] leading-tight text-[var(--c-ink)]">{p.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <StatusPill status={p.status} />
            <DevBadge development={p.development} />
            <span className="label-px !text-[11.5px]">{p.category === "built" ? "Built project" : "Important project"}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasEmbed ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => open(`demo:${p.slug}`)}>
              <PixelIcon name="run" size={14} /> Live Demo
            </button>
          ) : null}
          {gh ? (
            <ExtLink href={gh} variant="button" className="btn-sm">
              {p.note ? "GitHub (placeholder repo)" : "GitHub"}
            </ExtLink>
          ) : null}
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} label={`${p.name} sections`} idBase={base} />

      <div className="pane" style={{ flex: 1 }}>
        <div className="pane-inner prose-os">
          {p.note ? (
            <div className="groupbox !mt-0 mb-4" role="note">
              <span className="groupbox-label">Heads up</span>
              <p className="!my-0">{p.note}</p>
            </div>
          ) : null}

          <TabPanel idBase={base} id="overview" active={tab === "overview"}>
            <p className="!mt-0 text-[16px]">{p.overview}</p>

            {p.problem || p.solution ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {p.problem ? (
                  <section>
                    <SectionTitle>Problem</SectionTitle>
                    <p className="!mt-0">{p.problem}</p>
                  </section>
                ) : null}
                {p.solution ? (
                  <section>
                    <SectionTitle>Solution</SectionTitle>
                    <p className="!mt-0">{p.solution}</p>
                  </section>
                ) : null}
              </div>
            ) : null}

            {p.features?.length ? (
              <>
                <SectionTitle>Features</SectionTitle>
                <ul>
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </>
            ) : null}

            <SectionTitle>Technologies</SectionTitle>
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" style={{ maxWidth: "none" }}>
              {p.stack.map((s) => (
                <li key={s}>
                  <Tag>{s}</Tag>
                </li>
              ))}
            </ul>

            <SectionTitle>At a glance</SectionTitle>
            <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-[14px]">
              <dt className="font-semibold">Status</dt>
              <dd className="m-0">
                {p.status} — {statusHelp[p.status]}
              </dd>
              <dt className="font-semibold">Development</dt>
              <dd className="m-0">{p.devNote}</dd>
              {repo ? (
                <>
                  <dt className="font-semibold">Repository</dt>
                  <dd className="m-0">
                    created {fmt(repo.createdAt)} · last push {fmt(repo.pushedAt)}
                    <span className="text-[var(--c-ink-2)]"> (GitHub API)</span>
                  </dd>
                </>
              ) : null}
              {p.facts?.map((f) => (
                <FactRow key={f.label} label={f.label} value={f.value} />
              ))}
              <dt className="font-semibold">Verified</dt>
              <dd className="m-0">{p.verification}</dd>
            </dl>
          </TabPanel>

          <TabPanel idBase={base} id="how" active={tab === "how"}>
            {p.howItWorks ? (
              <>
                <SectionTitle>How it works</SectionTitle>
                <ol className="!mt-0">
                  {p.howItWorks.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </>
            ) : null}
            {p.architecture ? (
              <>
                <SectionTitle>Architecture</SectionTitle>
                <div className="bevel-in !shadow-none border border-[var(--c-rule)] bg-[var(--c-paper-2)] p-3">
                  <ArchitectureDiagram rows={p.architecture} label={`${p.name} architecture`} />
                </div>
              </>
            ) : null}
          </TabPanel>

          <TabPanel idBase={base} id="eng" active={tab === "eng"}>
            {p.contribution ? (
              <>
                <SectionTitle>My contribution</SectionTitle>
                <p className="!mt-0">{p.contribution}</p>
              </>
            ) : null}
            <div className="groupbox" role="note">
              <span className="groupbox-label">Development</span>
              <p className="!my-0 flex flex-wrap items-center gap-2">
                <DevBadge development={p.development} />
                <span>{p.devNote}</span>
              </p>
            </div>
            {p.challenges?.length ? (
              <>
                <SectionTitle>Technical challenges</SectionTitle>
                <ul className="m-0 list-none space-y-3 p-0" style={{ maxWidth: "none" }}>
                  {p.challenges.map((c) => (
                    <li key={c.title} className="panel p-3">
                      <p className="!m-0 font-semibold">{c.title}</p>
                      <p className="!mb-0 !mt-1 text-[14px]">{c.detail}</p>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {p.future?.length ? (
              <>
                <SectionTitle>Future improvements</SectionTitle>
                <ul>
                  {p.future.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </TabPanel>

          <TabPanel idBase={base} id="shots" active={tab === "shots"}>
            {p.screenshots?.length ? <Gallery shots={p.screenshots} projectName={p.name} /> : null}
          </TabPanel>

          <TabPanel idBase={base} id="run" active={tab === "run"}>
            <SectionTitle>Live demo</SectionTitle>
            <p className="!mt-0">{p.demo.note}</p>
            {hasEmbed ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" onClick={() => open(`demo:${p.slug}`)}>
                  <PixelIcon name="run" size={16} /> Launch {p.exe}
                </button>
                <ExtLink href={p.demo.url!} variant="button">
                  Open full application
                </ExtLink>
              </div>
            ) : null}
            {p.needs?.length ? (
              <>
                <SectionTitle>What it needs</SectionTitle>
                <ul>
                  {p.needs.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {p.runLocally?.length ? (
              <>
                <SectionTitle>Run it locally</SectionTitle>
                <pre className="m-0 overflow-x-auto bg-[#0a1020] p-3 font-[family-name:var(--font-mono)] text-[12.5px] leading-relaxed text-[#b8f5cf]">
                  {p.runLocally.join("\n")}
                </pre>
                <div className="mt-2">
                  <CopyButton text={p.runLocally.join("\n")} label="Copy commands" />
                </div>
              </>
            ) : null}
          </TabPanel>
        </div>
      </div>
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-semibold">{label}</dt>
      <dd className="m-0">{value}</dd>
    </>
  );
}
