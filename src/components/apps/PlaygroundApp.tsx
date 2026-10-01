"use client";

import { projects } from "@/data/projects";
import type { Project } from "@/data/types";
import { useWm } from "@/components/os/WindowManager";
import { PixelIcon } from "@/components/os/PixelIcon";
import { DevBadge, ExtLink, StatusPill } from "@/components/ui";
import { githubUrl } from "@/lib/links";
import { Pane } from "./common";

type Mode = "live" | "preview" | "local";
const modeOf = (p: Project): Mode =>
  p.demo.kind === "embed" && p.demo.url ? "live" : p.screenshots?.length ? "preview" : "local";

const MODE_COPY: Record<Mode, { title: string; blurb: string }> = {
  live: {
    title: "Running now",
    blurb: "The actual applications, not recordings. Each card says where it runs and what the hosted copy leaves out.",
  },
  preview: { title: "Screenshots", blurb: "Not hosted: these open a screenshot viewer from real runs. Clearly not live." },
  local: { title: "Runs locally", blurb: "Needs a local model, a database or hardware. Open the write-up for the exact run commands." },
};

export function PlaygroundApp() {
  const { open } = useWm();
  const groups: Record<Mode, Project[]> = { live: [], preview: [], local: [] };
  for (const p of projects) groups[modeOf(p)].push(p);
  const liveCount = groups.live.length;

  return (
    <Pane label="Project Playground">
      <div className="flex items-start gap-3">
        <PixelIcon name="run" size={44} />
        <div>
          <h1 className="!mb-1">RUN MY PROJECTS</h1>
          <p className="!m-0 text-[16px]">
            {liveCount > 0
              ? "Some of these applications are actually running."
              : "No project is hosted publicly right now — this page says so instead of pretending."}
          </p>
          <p className="!mt-1 text-[13.5px] text-[var(--c-ink-2)]">
            Each card says exactly what you&apos;ll get: {liveCount} live, {groups.preview.length} with screenshots, {groups.local.length} that run only on a
            machine with the right setup.
          </p>
        </div>
      </div>

      {(["live", "preview", "local"] as Mode[]).map((mode) =>
        groups[mode].length === 0 ? null : (
          <section key={mode} aria-labelledby={`pg-${mode}`}>
            <h2 id={`pg-${mode}`} className="!mb-1">
              {MODE_COPY[mode].title} <span className="text-[var(--c-ink-2)]">({groups[mode].length})</span>
            </h2>
            <p className="!mt-0 text-[13.5px] text-[var(--c-ink-2)]">{MODE_COPY[mode].blurb}</p>
            <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2" style={{ maxWidth: "none" }}>
              {groups[mode].map((p) => (
                <li key={p.slug} className="panel flex flex-col gap-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="!m-0 !text-[17px]">{p.name}</h3>
                    <div className="flex flex-wrap justify-end gap-1">
                      <StatusPill status={p.status} />
                      <DevBadge development={p.development} />
                    </div>
                  </div>
                  <p className="!m-0 text-[13.5px] leading-snug">{p.demo.note}</p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    {mode === "live" && (
                      <>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => open(`demo:${p.slug}`)}>
                          <PixelIcon name="run" size={14} /> Launch
                        </button>
                        <ExtLink href={p.demo.url!} variant="button" className="btn-sm">
                          Open full app
                        </ExtLink>
                      </>
                    )}
                    {mode === "preview" && (
                      <button type="button" className="btn btn-sm" onClick={() => open(`demo:${p.slug}`)}>
                        View screenshots
                      </button>
                    )}
                    <button type="button" className="btn btn-sm" onClick={() => open(`project:${p.slug}`)}>
                      Write-up
                    </button>
                    {githubUrl(p.repo) ? (
                      <ExtLink href={githubUrl(p.repo)!} variant="button" className="btn-sm">
                        GitHub
                      </ExtLink>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </Pane>
  );
}
