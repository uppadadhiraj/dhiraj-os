"use client";

import { profile } from "@/data/profile";
import { useWm } from "@/components/os/WindowManager";
import { PixelIcon } from "@/components/os/PixelIcon";
import { ExtLink } from "@/components/ui";
import { CopyButton, Pane } from "./common";

export function ContactApp() {
  const { open } = useWm();
  const rows: Array<{ icon: string; label: string; node: React.ReactNode }> = [
    {
      icon: "mail",
      label: "Email",
      node: (
        <span className="flex flex-wrap items-center gap-2">
          <a href={`mailto:${profile.email}`}>{profile.email}</a>
          <CopyButton text={profile.email} label="Copy address" />
        </span>
      ),
    },
    {
      icon: "branch",
      label: "GitHub",
      node: <ExtLink href={profile.github.url}>github.com/{profile.github.user}</ExtLink>,
    },
    {
      icon: "about",
      label: "LinkedIn",
      node: <ExtLink href={profile.linkedin}>linkedin.com/in/venkata-dhiraj-reddy-uppada</ExtLink>,
    },
    {
      icon: "notepad",
      label: "Blog",
      node: (
        <span className="flex flex-wrap items-center gap-2">
          <ExtLink href={profile.blog.url}>{profile.blog.name}</ExtLink>
          <button type="button" className="btn btn-sm" onClick={() => open("blog")}>
            Open inside DhirajOS
          </button>
        </span>
      ),
    },
    {
      icon: "doc",
      label: "Resume",
      node: (
        <button type="button" className="btn btn-sm" onClick={() => open("resume")}>
          Open Resume.exe
        </button>
      ),
    },
  ];

  return (
    <Pane label="Contact">
      <div className="flex items-start gap-3">
        <PixelIcon name="mail" size={44} />
        <div>
          <h1 className="!mb-1">Let&apos;s build something.</h1>
          <p className="!m-0">
            Open to conversations about AI engineering, software development and data/ML roles, and to interesting problems
            in agents, retrieval and backend systems.
          </p>
        </div>
      </div>

      <dl className="m-0 mt-5 grid grid-cols-1 gap-y-3 sm:grid-cols-[110px_1fr] sm:gap-x-4">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="flex items-center gap-2 font-[family-name:var(--font-pixel)] text-[15px]">
              <PixelIcon name={r.icon} size={18} />
              {r.label}
            </dt>
            <dd className="m-0 break-words">{r.node}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-6 text-[13px] text-[var(--c-ink-2)]">
        Based in {profile.location}. I only list contact details I&apos;ve intentionally made public.
      </p>
    </Pane>
  );
}
