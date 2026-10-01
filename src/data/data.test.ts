import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { otherProjects, projects } from "./projects";
import { skillGroups } from "./skills";
import { stackTree } from "./stack";
import { profile } from "./profile";
import { githubSnapshot } from "@/lib/github-stats";

const allSlugs = new Set([...projects.map((p) => p.slug), ...otherProjects.map((o) => o.slug)]);
const repoNames = new Set(githubSnapshot.repos.map((r) => r.name));

describe("project data integrity (no fabricated or dangling claims)", () => {
  it("slugs are unique", () => {
    const slugs = [...projects.map((p) => p.slug), ...otherProjects.map((o) => o.slug)];
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every referenced repo really exists in the GitHub snapshot", () => {
    for (const p of projects) if (p.repo) expect(repoNames, p.slug).toContain(p.repo);
    for (const o of otherProjects) expect(repoNames, o.slug).toContain(o.repo);
  });

  it("LIVE and DEMO statuses are only used with a working embed URL", () => {
    for (const p of projects) {
      if (p.status === "LIVE" || p.status === "DEMO") {
        expect(p.demo.kind, `${p.slug} claims ${p.status}`).toBe("embed");
        expect(p.demo.url, `${p.slug} needs a URL`).toMatch(/^(https:\/\/|\/demos\/)/);
      }
    }
  });

  it("self-hosted demos (/demos/…) point at a bundle that exists in public/", () => {
    for (const p of projects)
      if (p.demo.url?.startsWith("/demos/")) {
        const file = resolve(process.cwd(), "public", p.demo.url.replace(/^\//, ""));
        expect(existsSync(file), `${p.slug}: ${p.demo.url}`).toBe(true);
        expect(existsSync(resolve(file, "..", "app")), `${p.slug}: app files`).toBe(true);
      }
  });

  it("embedded demos never point at localhost", () => {
    for (const p of projects) if (p.demo.url) expect(p.demo.url).not.toMatch(/localhost|127\.0\.0\.1/);
  });

  it("AI-assisted is only asserted with a stated reason", () => {
    for (const p of projects) if (p.development === "ai-assisted") expect(p.devNote.length, p.slug).toBeGreaterThan(30);
  });

  it("unconfirmed projects never claim manual authorship", () => {
    for (const p of projects.filter((x) => x.development === "unconfirmed")) {
      const all = JSON.stringify(p).toLowerCase();
      expect(all, p.slug).not.toMatch(/100% (coded|written|built)|hand-?written|wrote every line|entirely by me/);
    }
  });

  it("every project has the sections the brief requires", () => {
    for (const p of projects) {
      expect(p.overview.length, p.slug).toBeGreaterThan(60);
      expect(p.stack.length, p.slug).toBeGreaterThan(0);
      expect(p.verification.length, p.slug).toBeGreaterThan(10);
      expect(p.demo.note.length, p.slug).toBeGreaterThan(10);
    }
    for (const p of projects.filter((x) => x.featured)) {
      expect(p.problem && p.solution && p.features?.length && p.howItWorks?.length && p.architecture?.length, p.slug).toBeTruthy();
      expect(p.contribution, p.slug).toBeTruthy();
    }
  });

  it("every screenshot file exists and has alt text and, where it came from a real run, a caption", () => {
    for (const p of projects)
      for (const s of p.screenshots ?? []) {
        expect(existsSync(resolve(process.cwd(), "public", s.src.replace(/^\//, ""))), `${p.slug}: ${s.src}`).toBe(true);
        expect(s.alt.length, `${p.slug}: ${s.src} alt`).toBeGreaterThan(15);
      }
  });

  it("4–6 featured projects", () => {
    const n = projects.filter((p) => p.featured).length;
    expect(n).toBeGreaterThanOrEqual(4);
    expect(n).toBeLessThanOrEqual(6);
  });

  it("architecture rows are non-empty", () => {
    for (const p of projects) for (const row of p.architecture ?? []) expect(row.length, p.slug).toBeGreaterThan(0);
  });
});

describe("skills and stack reference real projects", () => {
  it("skill evidence slugs all exist", () => {
    for (const g of skillGroups) for (const s of g.skills) for (const e of s.evidence) expect(allSlugs, `${s.name} → ${e}`).toContain(e);
  });
  it("'used' skills have evidence and 'familiar' ones do not pretend to", () => {
    for (const g of skillGroups)
      for (const s of g.skills) {
        if (s.level === "used") expect(s.evidence.length, s.name).toBeGreaterThan(0);
        else expect(s.evidence.length, s.name).toBe(0);
      }
  });
  it("stack leaves only reference existing projects", () => {
    for (const b of stackTree) for (const l of b.leaves) for (const s of l.projects) expect(allSlugs, `${l.name} → ${s}`).toContain(s);
  });
});

describe("profile", () => {
  it("uses the portfolio contact email, not any account email", () => {
    expect(profile.email).toBe("iamdhirajreddy@gmail.com");
  });
  it("does not expose a phone number", () => {
    expect(JSON.stringify(profile)).not.toMatch(/\+?\d[\d\s-]{9,}/);
  });
});
