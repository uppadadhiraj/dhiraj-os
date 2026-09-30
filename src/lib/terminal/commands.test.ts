import { describe, expect, it } from "vitest";
import { BANNER, complete, execute, resolveOpenTarget, type TermContext } from "./commands";
import { projects } from "@/data/projects";
import { computeStats } from "@/lib/github-stats";

const ctx = (over: Partial<TermContext> = {}): TermContext => ({
  stats: computeStats(),
  history: [],
  now: new Date("2026-09-30T12:00:00Z"),
  uptimeMs: 5000,
  ...over,
});
const text = (input: string, c = ctx()) =>
  execute(input, c)
    .lines.map((l) => l.text)
    .join("\n");

describe("terminal commands", () => {
  it("help lists every command the brief asks for", () => {
    const t = text("help");
    for (const c of ["help", "about", "projects", "skills", "github", "resume", "contact", "clear", "whoami", "status", "neofetch"]) {
      expect(t).toContain(c);
    }
  });

  it("whoami matches the brief's wording", () => {
    expect(text("whoami")).toContain("dhiraj@portfolio");
    expect(text("whoami")).toContain("AI / Software Engineering Student");
    expect(text("whoami")).toContain("Hyderabad, India");
  });

  it("neofetch computes the project count from GitHub data instead of inventing it", () => {
    const stats = computeStats();
    const t = text("neofetch");
    expect(t).toContain(`${stats.originalRepos} public repos`);
    expect(t).toContain("OS:");
    expect(t).toContain("DhirajOS");
    expect(BANNER).toHaveLength(5);
  });

  it("projects lists every written-up project and its status", () => {
    const t = text("projects");
    for (const p of projects) {
      expect(t).toContain(p.slug);
      expect(t).toContain(p.status);
    }
  });

  it("open resolves slugs, apps and names; unknown names get a 404", () => {
    expect(resolveOpenTarget("scoutlens")).toBe("project:scoutlens");
    expect(resolveOpenTarget("ScoutLens.exe")).toBe("project:scoutlens");
    expect(resolveOpenTarget("about")).toBe("about");
    expect(resolveOpenTarget("run")).toBe("playground");
    expect(resolveOpenTarget("nothing")).toBeNull();
    expect(text("open nothing")).toContain("404: project not found");
    expect(execute("open scoutlens", ctx()).effects).toEqual([{ type: "open", target: "project:scoutlens" }]);
  });

  it("the hidden app cannot be opened by name", () => {
    expect(resolveOpenTarget("hidden")).toBeNull();
    expect(resolveOpenTarget("dhirajos")).toBeNull();
  });

  it("run only launches projects that really have an embed", () => {
    const r = execute("run verascope", ctx());
    expect(r.effects?.[0]).toEqual({ type: "open", target: "project:verascope" }); // falls back to the write-up
    expect(r.lines.map((l) => l.text).join("\n")).toContain("no hosted demo");
  });

  it("rm -rf / triggers the blue screen easter egg", () => {
    expect(execute("rm -rf /", ctx()).effects).toEqual([{ type: "effect", name: "bsod" }]);
    expect(execute("sudo rm -rf /", ctx()).effects).toBeUndefined(); // sudo is refused first
  });

  it("hidden file only shows with -a, and cat reveals the hint", () => {
    expect(text("ls")).not.toContain(".secret");
    expect(text("ls -a")).toContain(".secret");
    expect(text("cat .secret")).toContain("Konami");
  });

  it("clear and exit produce effects; unknown commands explain themselves", () => {
    expect(execute("clear", ctx()).effects).toEqual([{ type: "clear" }]);
    expect(execute("exit", ctx()).effects).toEqual([{ type: "close" }]);
    expect(text("frobnicate")).toContain("is not recognized");
  });

  it("empty input does nothing", () => {
    expect(execute("   ", ctx()).lines).toEqual([]);
  });

  it("tab completion covers commands and project names", () => {
    expect(complete("ne")).toEqual(["neofetch"]);
    expect(complete("open sc")).toContain("scoutlens");
    expect(complete("run ver")).toEqual(["verascope"]);
  });

  it("history echoes previous commands", () => {
    expect(text("history", ctx({ history: ["help", "about"] }))).toMatch(/1\s+help[\s\S]*2\s+about/);
  });
});
