"use client";

import { useSyncExternalStore } from "react";
import { exploring, profile } from "@/data/profile";
import { projects } from "@/data/projects";
import { skillGroups } from "@/data/skills";
import buildInfo from "@/data/build-info.json";
import { PREF_KEYS, usePref } from "@/lib/prefs";
import { useWm, useWmState } from "@/components/os/WindowManager";
import { useSiteStats } from "@/components/os/SiteContext";
import { PixelIcon } from "@/components/os/PixelIcon";
import { Pane } from "./common";

const subscribeReduce = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <dt className="font-semibold">{k}</dt>
      <dd className="m-0">{v}</dd>
    </>
  );
}

export function SystemInfoApp() {
  const { open } = useWm();
  const { viewport } = useWmState();
  const stats = useSiteStats();
  const [sound, setSound] = usePref(PREF_KEYS.sound, "0");
  const [crt, setCrt] = usePref(PREF_KEYS.crt, "on");
  const reduced = useSyncExternalStore(
    subscribeReduce,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  const env = skillGroups
    .flatMap((g) => g.skills)
    .filter((s) => s.level === "used" && ["Python", "Java", "FastAPI", "React", "Docker", "Ollama", "PostgreSQL", "TypeScript"].includes(s.name))
    .map((s) => s.name);

  return (
    <Pane label="System information">
      <div className="flex items-start gap-3">
        <PixelIcon name="computer" size={48} />
        <div>
          <h1 className="!mb-0 !text-[22px]">DHIRAJ SYSTEM INFORMATION</h1>
          <p className="!mt-0 text-[13px] text-[var(--c-ink-2)]">DhirajOS — a portfolio that behaves like an operating system.</p>
        </div>
      </div>

      <section className="groupbox" aria-labelledby="si-dev">
        <h2 id="si-dev" className="groupbox-label !m-0 !text-[13px]">Developer</h2>
        <dl className="m-0 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-[14px]">
          <Row k="Name" v={profile.displayName} />
          <Row k="Role" v={profile.role} />
          <Row k="Status" v={profile.status} />
          <Row k="Location" v={profile.location} />
          <Row k="Focus" v="AI Engineering · Backend Development · Generative AI · Machine Learning" />
          <Row k="Environment" v={env.join(" · ")} />
        </dl>
      </section>

      <section className="groupbox" aria-labelledby="si-os">
        <h2 id="si-os" className="groupbox-label !m-0 !text-[13px]">This system (measured at build time)</h2>
        <dl className="m-0 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-[14px]">
          <Row k="Stack" v="Next.js 16 · React 19 · TypeScript · Tailwind CSS 4" />
          <Row k="Source" v={`${buildInfo.sourceFiles} files · ${buildInfo.sourceLines.toLocaleString("en-US")} lines · ${buildInfo.components} components`} />
          <Row k="Tests" v={`${buildInfo.unitTests} unit · ${buildInfo.e2eTests} end-to-end`} />
          <Row k="Built" v={`${new Date(buildInfo.builtAt).toUTCString()}${buildInfo.commit ? ` · ${buildInfo.commit}` : ""}`} />
          <Row k="Projects" v={`${projects.length} written up · ${stats.originalRepos} public repos (${stats.forks} fork excluded)`} />
          <Row k="GitHub data" v={`snapshot ${new Date(stats.generatedAt).toISOString().slice(0, 10)}`} />
        </dl>
      </section>

      <section className="groupbox" aria-labelledby="si-display">
        <h2 id="si-display" className="groupbox-label !m-0 !text-[13px]">Display &amp; sound</h2>
        <div className="flex flex-col gap-2 text-[14px]">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={crt === "on"} onChange={(e) => setCrt(e.target.checked ? "on" : "off")} />
            CRT scanlines on the desktop wallpaper
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={sound === "1"} onChange={(e) => setSound(e.target.checked ? "1" : "0")} />
            UI sounds (muted by default, synthesised in your browser)
          </label>
          <p className="!m-0 text-[13px] text-[var(--c-ink-2)]">
            Viewport {viewport.w}×{viewport.h} · {viewport.mobile ? "phone layout (full-screen panels)" : "desktop layout (draggable windows)"} · reduced motion:{" "}
            {reduced ? "on — animations are disabled" : "off"}
          </p>
        </div>
      </section>

      <section className="groupbox" aria-labelledby="si-build">
        <h2 id="si-build" className="groupbox-label !m-0 !text-[13px]">What I&apos;m building</h2>
        <ul className="m-0 list-none space-y-2 p-0" style={{ maxWidth: "none" }}>
          {exploring.map((x) => (
            <li key={x.key} className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-sm" onClick={() => open("projects", { tab: "featured", tag: x.key })}>
                {x.label}
              </button>
              <span className="text-[13px] text-[var(--c-ink-2)]">{x.blurb}</span>
            </li>
          ))}
        </ul>
      </section>
    </Pane>
  );
}
