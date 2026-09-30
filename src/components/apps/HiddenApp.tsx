"use client";

import buildInfo from "@/data/build-info.json";
import { githubRepoUrl } from "@/lib/site";
import { ArchitectureDiagram } from "@/components/diagrams/ArchitectureDiagram";
import { ExtLink, StatusPill, Tag } from "@/components/ui";
import { Pane, SectionTitle } from "./common";

const STACK = ["Next.js 16", "React 19", "TypeScript", "Tailwind CSS 4", "Vitest", "Playwright", "axe-core"];

/** The hidden project: this website. Unlocked by the Konami code, the Recycle Bin, or /dhirajos. */
export function HiddenApp() {
  return (
    <Pane label="DhirajOS.exe — hidden project">
      <p className="label-px !mb-1">Secret unlocked</p>
      <h1 className="!mt-0">DhirajOS.exe</h1>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status="LIVE" />
        <span className="pill" data-kind="ai" title="Built with an AI coding assistant">
          AI-ASSISTED
        </span>
      </div>

      <p className="text-[16px]">
        You&apos;re inside it. DhirajOS is this portfolio: a small window manager written from scratch (no UI kit, no animation library) with a
        data-driven project system behind it. The interface is retro on purpose; the engineering underneath is meant to be ordinary, typed and tested.
      </p>

      <SectionTitle>How it&apos;s built</SectionTitle>
      <ul>
        <li>
          <b>Window manager:</b> a pure reducer (open, focus, minimize, maximize, move, resize, taskbar) with its own unit tests, and a provider that
          splits state and actions so dragging one window never re-renders another&apos;s content.
        </li>
        <li>
          <b>Apps are code-split:</b> every window is a lazily loaded component; nothing downloads until you open it, and embedded applications load
          only when their window opens.
        </li>
        <li>
          <b>One source of truth:</b> projects, skills, stack links and the journey come from typed data; tests fail if a status says LIVE without a
          working URL, or a skill cites a project that doesn&apos;t exist.
        </li>
        <li>
          <b>Honest by construction:</b> GitHub counts come from an API snapshot at build time, with a live refresh that falls back gracefully when
          rate-limited.
        </li>
        <li>
          <b>Phone layout:</b> windows become full-screen panels, the desktop becomes an app launcher, and the taskbar becomes a bottom bar.
        </li>
      </ul>

      <SectionTitle>Architecture</SectionTitle>
      <div className="bevel-in !shadow-none border border-[var(--c-rule)] bg-[var(--c-paper-2)] p-3">
        <ArchitectureDiagram
          label="DhirajOS architecture"
          rows={[
            ["Typed data | projects · skills · stack · journey · GitHub snapshot"],
            ["Window manager | reducer + provider", "Shell | desktop · taskbar · Start menu · boot"],
            ["Lazy apps | about · projects · terminal · github · stack · resume …"],
            ["Next.js App Router | static pages, deep links, sitemap, metadata"],
          ]}
        />
      </div>

      <SectionTitle>Measured at build time</SectionTitle>
      <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-[14px]">
        <dt className="font-semibold">Source</dt>
        <dd className="m-0">
          {buildInfo.sourceFiles} files · {buildInfo.sourceLines.toLocaleString("en-US")} lines · {buildInfo.components} components
        </dd>
        <dt className="font-semibold">Tests</dt>
        <dd className="m-0">
          {buildInfo.unitTests} unit · {buildInfo.e2eTests} end-to-end
        </dd>
        <dt className="font-semibold">Built</dt>
        <dd className="m-0">
          {new Date(buildInfo.builtAt).toUTCString()}
          {buildInfo.commit ? ` · ${buildInfo.commit}` : ""}
        </dd>
      </dl>

      <SectionTitle>Stack</SectionTitle>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" style={{ maxWidth: "none" }}>
        {STACK.map((s) => (
          <li key={s}>
            <Tag>{s}</Tag>
          </li>
        ))}
      </ul>

      <SectionTitle>Development note</SectionTitle>
      <p className="!mt-0">
        Built with Claude Code as an AI pair-programmer, from my brief: the design direction, the honesty rules (no invented claims, labelled AI
        assistance, statuses only from tested deployments) and the content decisions are mine; the implementation was produced in collaboration and
        verified by running the tests, the production build and the site itself.
      </p>
      <p>
        <ExtLink href={githubRepoUrl} variant="button">
          Source on GitHub
        </ExtLink>
      </p>
    </Pane>
  );
}
