"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { stackTree, type StackBranch } from "@/data/stack";
import { otherProjects, projectBySlug } from "@/data/projects";
import { useWm } from "@/components/os/WindowManager";
import { ExtLink } from "@/components/ui";
import { githubUrl } from "@/lib/links";
import { Pane } from "./common";

const TONE: Record<StackBranch["tone"], string> = {
  python: "#2b6cb0",
  web: "#0f766e",
  java: "#b04a06",
  data: "#6d3fd1",
  ai: "#a16207",
  infra: "#475569",
};

const nameOf = (slug: string) => projectBySlug(slug)?.name ?? otherProjects.find((o) => o.slug === slug)?.name ?? slug;

interface LeftNode {
  key: string;
  name: string;
  branch: string;
  tone: StackBranch["tone"];
  y: number;
  projects: string[];
}
interface Sel {
  kind: "tech" | "project";
  key: string;
}

const W = 880;
const LEFT_X = 70;
const LEFT_W = 190;
const RIGHT_X = 620;
const RIGHT_W = 230;
const ROW = 24;

export function StackApp() {
  const { open } = useWm();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [view, setView] = useState<"auto" | "map" | "tree">("auto");
  const [sel, setSel] = useState<Sel | null>(null);
  const [hover, setHover] = useState<Sel | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const effective = view === "auto" ? (width >= 820 ? "map" : "tree") : view;

  // ---- layout for the map ----
  const { left, right, edges, branchLabels, height } = useMemo(() => {
    const left: LeftNode[] = [];
    const branchLabels: Array<{ name: string; tone: StackBranch["tone"]; y: number }> = [];
    let y = 14;
    for (const b of stackTree) {
      branchLabels.push({ name: b.name, tone: b.tone, y: y + 10 });
      y += 22;
      for (const l of b.leaves) {
        left.push({ key: `${b.name}/${l.name}`, name: l.name, branch: b.name, tone: b.tone, y, projects: l.projects });
        y += ROW;
      }
      y += 8;
    }
    const counts = new Map<string, number>();
    for (const n of left) for (const p of n.projects) counts.set(p, (counts.get(p) ?? 0) + 1);
    const slugs = [...counts.keys()].sort((a, b) => (counts.get(b)! - counts.get(a)!) || nameOf(a).localeCompare(nameOf(b)));
    const height = Math.max(y + 8, slugs.length * 30 + 40);
    const step = slugs.length > 1 ? (height - 50) / (slugs.length - 1) : 0;
    const right = slugs.map((slug, i) => ({ slug, name: nameOf(slug), y: 24 + i * step }));
    const edges = left.flatMap((n) => n.projects.map((p) => ({ from: n, slug: p })));
    return { left, right, edges, branchLabels, height };
  }, []);

  const active = hover ?? sel;
  const rightY = (slug: string) => right.find((r) => r.slug === slug)?.y ?? 0;

  const edgeState = (e: (typeof edges)[number]): "on" | "off" | "idle" => {
    if (!active) return "idle";
    if (active.kind === "tech") return e.from.key === active.key ? "on" : "off";
    return e.slug === active.key ? "on" : "off";
  };
  const techLit = (n: LeftNode) =>
    !active ||
    (active.kind === "tech" ? active.key === n.key : n.projects.includes(active.key));
  const projLit = (slug: string) =>
    !active ||
    (active.kind === "project"
      ? active.key === slug
      : left.find((n) => n.key === active.key)?.projects.includes(slug) ?? false);

  const toggle = (s: Sel) => setSel((cur) => (cur && cur.kind === s.kind && cur.key === s.key ? null : s));

  const detail = useMemo(() => {
    if (!sel) return null;
    if (sel.kind === "tech") {
      const n = left.find((x) => x.key === sel.key);
      return n ? { title: `${n.branch} → ${n.name}`, slugs: n.projects } : null;
    }
    const techs = left.filter((n) => n.projects.includes(sel.key)).map((n) => n.name);
    return { title: `${nameOf(sel.key)} uses`, slugs: [sel.key], techs };
  }, [sel, left]);

  return (
    <Pane label="Technology stack">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="!mb-0 !text-[22px]">STACK.exe</h1>
          <p className="!m-0 text-[13.5px] text-[var(--c-ink-2)]">
            How the technologies relate and which of my projects use each one. Every link is drawn from project data.
          </p>
        </div>
        <div role="group" aria-label="View" className="flex gap-1">
          <button type="button" className="btn btn-sm" aria-pressed={effective === "map"} onClick={() => setView("map")}>
            Map
          </button>
          <button type="button" className="btn btn-sm" aria-pressed={effective === "tree"} onClick={() => setView("tree")}>
            Tree
          </button>
        </div>
      </div>

      <div ref={wrapRef} className="mt-3">
        {effective === "map" ? (
          <div className="bevel-in scroll-retro overflow-x-auto !bg-[var(--c-paper)] p-2">
            <svg
              width={W}
              height={height}
              viewBox={`0 0 ${W} ${height}`}
              role="group"
              aria-label="Technology-to-project map. Use the Tree view for a plain list."
              style={{ display: "block", margin: "0 auto" }}
            >
              <text x={LEFT_X} y={10} fontSize="11" fill="#5b6074" style={{ fontFamily: "var(--ff-pixel)", letterSpacing: "0.08em" }}>
                TECHNOLOGY
              </text>
              <text x={RIGHT_X} y={10} fontSize="11" fill="#5b6074" style={{ fontFamily: "var(--ff-pixel)", letterSpacing: "0.08em" }}>
                PROJECT
              </text>

              {/* connections */}
              <g fill="none">
                {edges.map((e) => {
                  const st = edgeState(e);
                  const x1 = LEFT_X + LEFT_W;
                  const y1 = e.from.y + 10;
                  const x2 = RIGHT_X;
                  const y2 = rightY(e.slug) + 10;
                  const mx = (x1 + x2) / 2;
                  return (
                    <path
                      key={`${e.from.key}>${e.slug}`}
                      d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`}
                      stroke={TONE[e.from.tone]}
                      strokeWidth={st === "on" ? 2.2 : 1.2}
                      opacity={st === "on" ? 0.95 : st === "off" ? 0.06 : 0.3}
                    />
                  );
                })}
              </g>

              {/* branch labels */}
              {branchLabels.map((b) => (
                <text key={b.name} x={LEFT_X - 58} y={b.y} fontSize="13" fill={TONE[b.tone]} style={{ fontFamily: "var(--ff-pixel)", fontWeight: 600 }}>
                  {b.name}
                </text>
              ))}

              {/* technologies */}
              {left.map((n) => {
                const lit = techLit(n);
                const isSel = sel?.kind === "tech" && sel.key === n.key;
                return (
                  <g
                    key={n.key}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSel}
                    aria-label={`${n.branch}: ${n.name}. Used in ${n.projects.length} project${n.projects.length === 1 ? "" : "s"}.`}
                    style={{ cursor: "pointer", outline: "none" }}
                    opacity={lit ? 1 : 0.35}
                    onClick={() => toggle({ kind: "tech", key: n.key })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle({ kind: "tech", key: n.key });
                      }
                    }}
                    onMouseEnter={() => setHover({ kind: "tech", key: n.key })}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover({ kind: "tech", key: n.key })}
                    onBlur={() => setHover(null)}
                  >
                    <rect x={LEFT_X} y={n.y} width={LEFT_W} height={20} fill={isSel ? TONE[n.tone] : "#fff"} stroke={TONE[n.tone]} strokeWidth={isSel ? 2 : 1} />
                    <rect x={LEFT_X} y={n.y} width={5} height={20} fill={TONE[n.tone]} />
                    <text x={LEFT_X + 12} y={n.y + 14} fontSize="12" fill={isSel ? "#fff" : "#14161f"} style={{ fontFamily: "var(--ff-mono)" }}>
                      {n.name}
                    </text>
                    <text x={LEFT_X + LEFT_W - 8} y={n.y + 14} fontSize="11" textAnchor="end" fill={isSel ? "#fff" : "#5b6074"} style={{ fontFamily: "var(--ff-mono)" }}>
                      {n.projects.length}
                    </text>
                  </g>
                );
              })}

              {/* projects */}
              {right.map((r) => {
                const lit = projLit(r.slug);
                const isSel = sel?.kind === "project" && sel.key === r.slug;
                return (
                  <g
                    key={r.slug}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSel}
                    aria-label={`Project ${r.name}`}
                    style={{ cursor: "pointer", outline: "none" }}
                    opacity={lit ? 1 : 0.35}
                    onClick={() => toggle({ kind: "project", key: r.slug })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle({ kind: "project", key: r.slug });
                      }
                    }}
                    onMouseEnter={() => setHover({ kind: "project", key: r.slug })}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover({ kind: "project", key: r.slug })}
                    onBlur={() => setHover(null)}
                  >
                    <rect x={RIGHT_X} y={r.y} width={RIGHT_W} height={20} fill={isSel ? "#0a1f7a" : "#fff"} stroke="#0a1f7a" strokeWidth={isSel ? 2 : 1} />
                    <text x={RIGHT_X + 10} y={r.y + 14} fontSize="12" fill={isSel ? "#fff" : "#14161f"} style={{ fontFamily: "var(--ff-body)" }}>
                      {r.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {stackTree.map((b) => (
              <section key={b.name} aria-label={b.name}>
                <h2 className="!m-0 !text-[16px]" style={{ color: TONE[b.tone] }}>
                  {b.name}
                </h2>
                <ul className="m-0 list-none p-0" style={{ maxWidth: "none" }}>
                  {b.leaves.map((l, i) => (
                    <li key={l.name} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-0.5 font-[family-name:var(--font-mono)] text-[13px]">
                      <span aria-hidden="true" className="text-[var(--c-ink-2)]">
                        {i === b.leaves.length - 1 ? " └──" : " ├──"}
                      </span>
                      <span className="min-w-[120px] font-semibold">{l.name}</span>
                      {l.projects.map((s) =>
                        projectBySlug(s) ? (
                          <button key={s} type="button" className="pill cursor-pointer hover:bg-[#dbe6ff]" data-kind="tag" onClick={() => open(`project:${s}`)}>
                            {nameOf(s)}
                          </button>
                        ) : (
                          <span key={s} className="pill" data-kind="tag">
                            {nameOf(s)}
                          </span>
                        ),
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {effective === "map" && (
        <div className="groupbox mt-4" role="region" aria-live="polite" aria-label="Selection details">
          <span className="groupbox-label">{detail ? "Selected" : "How to read this"}</span>
          {detail ? (
            <div>
              <p className="!mt-0 font-semibold">{detail.title}</p>
              {"techs" in detail && detail.techs ? <p className="!my-1 text-[13.5px]">{detail.techs.join(" · ")}</p> : null}
              <div className="flex flex-wrap gap-2">
                {detail.slugs.map((s) => {
                  const p = projectBySlug(s);
                  if (p)
                    return (
                      <button key={s} type="button" className="btn btn-sm" onClick={() => open(`project:${s}`)}>
                        Open {p.name}
                      </button>
                    );
                  const o = otherProjects.find((x) => x.slug === s);
                  return o ? (
                    <ExtLink key={s} href={githubUrl(o.repo)!} variant="button" className="btn-sm">
                      {o.name} on GitHub
                    </ExtLink>
                  ) : null;
                })}
              </div>
            </div>
          ) : (
            <p className="!my-0 text-[14px]">
              Click (or press Enter on) a technology to light up the projects that use it, or click a project to see what it uses. The number on each
              technology is how many projects use it.
            </p>
          )}
        </div>
      )}
    </Pane>
  );
}
