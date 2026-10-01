"use client";

import { profile, exploring } from "@/data/profile";
import { projects, runnableDemos } from "@/data/projects";
import { useWm } from "@/components/os/WindowManager";
import { useSiteStats } from "@/components/os/SiteContext";
import { PixelIcon } from "@/components/os/PixelIcon";
import { Monogram, Pane } from "./common";

export function WelcomeApp() {
  const { open } = useWm();
  const stats = useSiteStats();

  return (
    <Pane label="Welcome">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Monogram size={96} />
        <div className="min-w-0">
          <p className="label-px m-0">Welcome to DhirajOS</p>
          <h1 className="!mb-1 !mt-1">{profile.displayName}</h1>
          <p className="m-0 font-[family-name:var(--font-pixel)] text-[17px] text-[var(--c-ink-2)]">
            {profile.role} · {profile.location.split(",")[0]}, India
          </p>
          <p className="!mt-3">{profile.summary}</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => open("playground")}>
          <PixelIcon name="run" size={18} /> RUN MY PROJECTS
        </button>
        <button type="button" className="btn" onClick={() => open("projects")}>
          <PixelIcon name="folder" size={18} /> Projects
        </button>
        <button type="button" className="btn" onClick={() => open("about")}>
          <PixelIcon name="about" size={18} /> About me
        </button>
        <button type="button" className="btn" onClick={() => open("terminal")}>
          <PixelIcon name="terminal" size={18} /> Terminal
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-4" role="list" aria-label="At a glance">
        {[
          { k: `${stats.originalRepos}`, v: "public repositories", sub: "counted from the GitHub API" },
          { k: `${projects.length}`, v: "projects written up", sub: "from reading the source" },
          { k: `${runnableDemos().length}`, v: "demos you can try", sub: "running in your browser" },
          { k: `${stats.languages.length}`, v: "primary languages", sub: "across those repositories" },
        ].map((s) => (
          <div key={s.v} role="listitem" className="panel p-3">
            <p className="m-0 font-[family-name:var(--font-pixel)] text-[22px] leading-tight text-[var(--c-navy)]">{s.k}</p>
            <p className="m-0 text-[13px] font-medium">{s.v}</p>
            <p className="m-0 text-[12px] text-[var(--c-ink-2)]">{s.sub}</p>
          </div>
        ))}
      </div>

      <h2 className="!mt-6">Currently exploring</h2>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0" style={{ maxWidth: "none" }}>
        {exploring.map((x) => (
          <li key={x.key}>
            <button type="button" className="btn btn-sm" title={x.blurb} onClick={() => open("projects", { tab: "featured", tag: x.key })}>
              {x.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="groupbox mt-6" role="note">
        <span className="groupbox-label">How to read this site</span>
        <ul className="!my-0">
          <li>Click any desktop icon. Drag windows by their title bars; resize from the edges.</li>
          <li>
            Every project has a status: <b>LIVE</b>, <b>DEMO</b>, <b>LOCAL ONLY</b>, <b>HARDWARE</b>, <b>EXPERIMENTAL</b> or{" "}
            <b>ARCHIVED</b>. LIVE and DEMO are only used for deployments I opened and tested.
          </li>
          <li>{profile.aiTransparency}</li>
          <li>
            Try the <b>Terminal</b> — type <code>help</code>, then <code>neofetch</code>.
          </li>
        </ul>
      </div>
    </Pane>
  );
}
