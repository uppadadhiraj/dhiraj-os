"use client";

import { profile, exploring } from "@/data/profile";
import { useWm } from "@/components/os/WindowManager";
import { ExtLink, Tag } from "@/components/ui";
import { Monogram, Pane, SectionTitle } from "./common";

export function AboutApp() {
  const { open } = useWm();
  return (
    <Pane label="About Dhiraj Reddy">
      <div className="flex flex-col gap-5 sm:flex-row">
        {profile.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.photo.src} alt={profile.photo.alt} width={132} height={132} className="h-[132px] w-[132px] shrink-0 object-cover" />
        ) : (
          <Monogram size={132} />
        )}
        <div className="min-w-0">
          <h1 className="!mb-1">{profile.displayName}</h1>
          <p className="m-0 font-[family-name:var(--font-pixel)] text-[18px] text-[var(--c-navy-2)]">{profile.role}</p>
          <p className="m-0 text-[14px] text-[var(--c-ink-2)]">
            {profile.location} · {profile.status}
          </p>
          <p className="!mt-3 text-[16px]">“{profile.summary}”</p>
          <div className="flex flex-wrap gap-2">
            <ExtLink href={profile.github.url} variant="button">GitHub</ExtLink>
            <ExtLink href={profile.linkedin} variant="button">LinkedIn</ExtLink>
            <a className="btn" href={`mailto:${profile.email}`}>Email</a>
          </div>
        </div>
      </div>

      <SectionTitle>What I do</SectionTitle>
      <p>
        I&apos;m a fourth-year B.Tech Computer Science student at Vidya Jyothi Institute of Technology in Hyderabad. The
        projects I wrote myself are in machine learning, NLP and computer vision — text classifiers, from-scratch
        regression, a movie recommender, a dehazing pipeline in OpenCV — and chat apps on local models with Ollama and
        Streamlit. Streamlit is the one UI tool I know, and several of these you can{" "}
        <button type="button" className="underline" onClick={() => open("playground")}>try in your browser</button>.
      </p>
      <p>
        I have also used AI coding tools (mainly Claude Code) to build larger systems that I designed and directed, and
        they are labelled AI-ASSISTED: an agent that investigates a codebase and cites the lines it used (
        <button type="button" className="underline" onClick={() => open("project:verascope")}>Verascope</button>), a
        search-backed agent that refuses to state a claim without a source (
        <button type="button" className="underline" onClick={() => open("project:scoutlens")}>ScoutLens</button>), and a
        multi-tenant SaaS for supplier corrective actions (
        <button type="button" className="underline" onClick={() => open("project:scarflow")}>SCARFLOW</button>). I&apos;m
        moving toward agents, retrieval and backend engineering.
      </p>

      <SectionTitle>Currently interested in</SectionTitle>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0" style={{ maxWidth: "none" }}>
        {profile.interests.map((i) => (
          <li key={i}>
            <Tag>{i}</Tag>
          </li>
        ))}
      </ul>
      <ul className="!mt-3">
        {exploring.map((x) => (
          <li key={x.key}>
            <b>{x.label}:</b> {x.blurb}
          </li>
        ))}
      </ul>

      <SectionTitle>Education</SectionTitle>
      <ul className="m-0 list-none p-0" style={{ maxWidth: "none" }}>
        {profile.education.map((e) => (
          <li key={e.title} className="mb-2">
            <b>{e.title}</b>
            <br />
            {e.place} · {e.years}
            {e.note ? <span className="text-[var(--c-ink-2)]"> · {e.note}</span> : null}
          </li>
        ))}
      </ul>

      <SectionTitle>Open source</SectionTitle>
      {profile.highlights.map((h) => (
        <p key={h.title}>
          <b>{h.title}.</b> {h.detail}
        </p>
      ))}

      <div className="groupbox mt-6" role="note">
        <span className="groupbox-label">Working with AI tools</span>
        <p className="!my-0">{profile.aiTransparency}</p>
      </div>
    </Pane>
  );
}
