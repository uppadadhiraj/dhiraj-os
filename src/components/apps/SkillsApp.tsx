"use client";

import { skillGroups } from "@/data/skills";
import { otherProjects, projectBySlug } from "@/data/projects";
import { useWm } from "@/components/os/WindowManager";
import { TagLink } from "@/components/ui";
import { githubUrl } from "@/lib/links";
import { Pane } from "./common";

/** id-safe version of a group name ("AI / ML" → "ai-ml") for aria-labelledby */
const idSafe = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function Evidence({ slug }: { slug: string }) {
  const { open } = useWm();
  const p = projectBySlug(slug);
  if (p) {
    return (
      <button type="button" className="pill cursor-pointer hover:bg-[#dbe6ff]" data-kind="tag" onClick={() => open(`project:${p.slug}`)} title={`Open ${p.name}`}>
        {p.name}
      </button>
    );
  }
  const o = otherProjects.find((x) => x.slug === slug);
  if (!o) return null;
  return <TagLink href={githubUrl(o.repo)!}>{o.name}</TagLink>;
}

export function SkillsApp() {
  return (
    <Pane label="Skills">
      <h1>Skills</h1>
      <p className="!mt-0">
        Grouped by what they&apos;re for. <b>Used</b> means it appears in a public project — click a project to see where.{" "}
        <b>Familiar</b> means I know it but have no public project showing it yet.
      </p>
      <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
        {skillGroups.map((g) => (
          <section key={g.group} className="groupbox" aria-labelledby={`sk-${idSafe(g.group)}`}>
            <h2 id={`sk-${idSafe(g.group)}`} className="groupbox-label !m-0 !text-[13px]">
              {g.group}
            </h2>
            <ul className="m-0 list-none space-y-2.5 p-0" style={{ maxWidth: "none" }}>
              {g.skills.map((s) => (
                <li key={s.name} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.name}</span>
                    <span
                      className="pill !py-0 !text-[10.5px]"
                      data-status={s.level === "used" ? "LIVE" : "ARCHIVED"}
                      title={s.level === "used" ? "Appears in a public project" : "Known, but no public project yet"}
                    >
                      {s.level === "used" ? "USED" : "FAMILIAR"}
                    </span>
                  </div>
                  {s.evidence.length > 0 && (
                    <ul className="m-0 flex list-none flex-wrap gap-1 p-0" style={{ maxWidth: "none" }} aria-label={`${s.name} is used in`}>
                      {s.evidence.map((e) => (
                        <li key={e}>
                          <Evidence slug={e} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Pane>
  );
}
