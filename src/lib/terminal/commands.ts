import { profile } from "@/data/profile";
import { demoSubject, otherProjects, projectBySlug, projects, runnableDemos } from "@/data/projects";
import { skillGroups } from "@/data/skills";
import { APPS, appById, appByPath } from "@/lib/apps-meta";
import type { SiteStats } from "@/lib/github-stats";

export interface TermLine {
  text: string;
  kind?: "out" | "err" | "dim" | "accent" | "ok";
  /** renders the line as a link */
  href?: string;
}

export type TermEffect =
  | { type: "open"; target: string; props?: Record<string, unknown> }
  | { type: "clear" }
  | { type: "effect"; name: "bsod" | "matrix" }
  | { type: "close" };

export interface TermResult {
  lines: TermLine[];
  effects?: TermEffect[];
}

export interface TermContext {
  stats: SiteStats;
  history: string[];
  now: Date;
  /** ms since the terminal opened */
  uptimeMs: number;
}

export const PROMPT = "C:\\DHIRAJ>";

const out = (text: string, kind: TermLine["kind"] = "out"): TermLine => ({ text, kind });
const blank = (): TermLine => out("");

const HELP: Array<[string, string]> = [
  ["help", "list commands"],
  ["about", "who I am"],
  ["projects", "list my projects (open <name> to read one)"],
  ["skills", "skills, grouped"],
  ["github", "GitHub profile and repo counts"],
  ["resume", "open the resume"],
  ["contact", "how to reach me"],
  ["whoami", "current user"],
  ["status", "system status"],
  ["neofetch", "system summary"],
  ["open <name>", "open an app or project window"],
  ["run <project>", "launch a project's live demo, if it has one"],
  ["cat <file>", "read a file (try: about.md)"],
  ["ls / dir", "list files"],
  ["history", "previous commands"],
  ["clear", "clear the screen (Ctrl+L)"],
];

const LETTERS: Record<string, string[]> = {
  D: [" ____  ", "|  _ \\ ", "| | | |", "| |_| |", "|____/ "],
  H: [" _   _ ", "| | | |", "| |_| |", "|  _  |", "|_| |_|"],
  I: [" ___ ", "|_ _|", " | | ", " | | ", "|___|"],
  R: [" ____  ", "|  _ \\ ", "| |_) |", "|  _ < ", "|_| \\_\\"],
  A: ["    _    ", "   / \\   ", "  / _ \\  ", " / ___ \\ ", "/_/   \\_\\"],
  J: ["     _ ", "    | |", " _  | |", "| |_| |", " \\___/ "],
};
export const BANNER: string[] = Array.from({ length: 5 }, (_, row) =>
  [...("DHIRAJ")].map((ch) => LETTERS[ch][row]).join(" "),
);

const FILES = ["about.md", "skills.txt", "contact.txt", "resume.pdf", "projects\\"];

const aboutLines = (): TermLine[] => [
  out(`${profile.displayName} — ${profile.role}`, "accent"),
  out(`${profile.status}, ${profile.location}.`),
  out(profile.summary),
  out(`Interested in: ${profile.interests.join(", ")}.`),
];

const skillsLines = (): TermLine[] =>
  skillGroups.flatMap((g) => [
    out(g.group, "accent"),
    out("  " + g.skills.map((s) => (s.level === "used" ? s.name : `${s.name} (familiar)`)).join(", ")),
  ]);

const contactLines = (): TermLine[] => [
  out("Let's build something.", "accent"),
  { text: `email     ${profile.email}`, kind: "out", href: `mailto:${profile.email}` },
  { text: `github    ${profile.github.url}`, kind: "out", href: profile.github.url },
  { text: `linkedin  ${profile.linkedin}`, kind: "out", href: profile.linkedin },
  { text: `blog      ${profile.blog.url}`, kind: "out", href: profile.blog.url },
];

function projectLines(slug: string): TermLine[] | null {
  const p = projectBySlug(slug);
  if (!p) return null;
  return [
    out(`${p.exe}  [${p.status}]${p.development === "ai-assisted" ? "  [AI-ASSISTED]" : ""}`, "accent"),
    out(p.tagline),
    out(`stack: ${p.stack.join(", ")}`, "dim"),
    out(p.repo ? `repo:  https://github.com/${profile.github.user}/${p.repo}` : "repo:  none published", "dim"),
    out(`type: open ${p.slug}   to open the full write-up`, "dim"),
  ];
}

/** Resolve a user-typed name to a window target, or null if it does not exist. */
export function resolveOpenTarget(name: string): string | null {
  const n = name.toLowerCase().replace(/\.exe$/, "").replace(/^\/+/, "");
  if (!n) return null;
  if (projectBySlug(n)) return `project:${n}`;
  const byName = projects.find((p) => p.name.toLowerCase().replace(/\s+/g, "") === n.replace(/\s+/g, ""));
  if (byName) return `project:${byName.slug}`;
  // a smaller repository that has a demo has no write-up window: open its demo
  if (otherProjects.some((o) => o.slug === n && o.demo)) return `demo:${n}`;
  const alias: Record<string, string> = {
    run: "playground",
    "run-my-projects": "playground",
    sysinfo: "sysinfo",
    system: "sysinfo",
    "my-computer": "sysinfo",
    mycomputer: "sysinfo",
    me: "about",
    blog: "blog",
    log: "blog",
    "how-i-build": "howibuild",
    "recycle-bin": "recycle",
  };
  if (alias[n]) return alias[n];
  if (appById(n) && n !== "hidden") return n;
  const byPath = appByPath(n);
  if (byPath && byPath.id !== "hidden") return byPath.id;
  return null;
}

export function execute(raw: string, ctx: TermContext): TermResult {
  const input = raw.trim();
  if (!input) return { lines: [] };
  const [cmdRaw, ...args] = input.split(/\s+/);
  const cmd = cmdRaw.toLowerCase();
  const rest = args.join(" ");

  // rm -rf /  (and friends) → the classic mistake
  if (/^rm\s+-[a-z]*r[a-z]*f?[a-z]*\s+(\/|\*|~|\/\*)\s*$/i.test(input) || /^del\s+\/s\s+\/q\s+c:\\?\s*$/i.test(input)) {
    return {
      lines: [out("removing /usr, /home, /portfolio …", "err")],
      effects: [{ type: "effect", name: "bsod" }],
    };
  }

  switch (cmd) {
    case "help":
    case "?": {
      const w = Math.max(...HELP.map(([c]) => c.length)) + 2;
      return {
        lines: [
          out("Commands:", "accent"),
          ...HELP.map(([c, d]) => out(`  ${c.padEnd(w)}${d}`)),
          blank(),
          out("Tip: Tab completes, ↑/↓ recalls history.", "dim"),
        ],
      };
    }

    case "about":
      return { lines: aboutLines() };

    case "projects": {
      const w = Math.max(...projects.map((p) => p.slug.length)) + 2;
      return {
        lines: [
          out(`${projects.length} projects written up (${ctx.stats.originalRepos} public repos on GitHub):`, "accent"),
          ...projects.map((p) => out(`  ${p.slug.padEnd(w)}${p.status.padEnd(13)}${p.name}`)),
          ...(args.includes("--all") || args.includes("-a")
            ? [
                blank(),
                out("Smaller repositories (run <name> opens the ones marked DEMO):", "accent"),
                ...otherProjects.map((o) => out(`  ${o.slug.padEnd(w + 12)}${o.status.padEnd(13)}${o.name}`, "dim")),
              ]
            : [out("  (projects --all lists the smaller repositories too)", "dim")]),
          blank(),
          out("open <name> opens one. Example: open scoutlens", "dim"),
        ],
      };
    }

    case "skills":
      return { lines: skillsLines() };

    case "github": {
      const langs = ctx.stats.languages.slice(0, 4).map(([l, n]) => `${l} (${n})`).join(", ");
      return {
        lines: [
          { text: profile.github.url, kind: "accent", href: profile.github.url },
          out(`${ctx.stats.originalRepos} original public repositories, ${ctx.stats.forks} fork — from the GitHub API`),
          out(`top languages by repo: ${langs}`, "dim"),
          out("open github   opens the GitHub window", "dim"),
        ],
      };
    }

    case "resume":
      return { lines: [out("Opening Resume.exe …", "ok")], effects: [{ type: "open", target: "resume" }] };

    case "contact":
      return { lines: contactLines() };

    case "clear":
    case "cls":
      return { lines: [], effects: [{ type: "clear" }] };

    case "whoami":
      return {
        lines: [out("dhiraj@portfolio", "accent"), blank(), out("AI / Software Engineering Student"), out("Hyderabad, India")],
      };

    case "status": {
      const live = runnableDemos().length;
      return {
        lines: [
          out("DhirajOS status", "accent"),
          out(`  system        online`),
          out(`  uptime        ${Math.max(1, Math.round(ctx.uptimeMs / 1000))}s in this terminal`),
          out(`  projects      ${projects.length} written up, ${live} demos you can run in the browser`),
          out(`  github        ${ctx.stats.originalRepos} public repos (snapshot ${ctx.stats.generatedAt.slice(0, 10)})`),
          out(`  sound         see the speaker in the tray`, "dim"),
        ],
      };
    }

    case "neofetch": {
      const info: Array<[string, string]> = [
        ["OS", "DhirajOS"],
        ["Role", profile.role],
        ["Location", "Hyderabad"],
        ["Languages", "Python, Java, SQL"],
        ["UI", "Streamlit"],
        ["Focus", "AI / Backend / GenAI"],
        ["Projects", `${ctx.stats.originalRepos} public repos · ${projects.length} written up`],
        ["GitHub", `github.com/${profile.github.user}`],
      ];
      return {
        lines: [
          ...BANNER.map((l) => out(l, "accent")),
          blank(),
          ...info.map(([k, v]) => out(`${(k + ":").padEnd(11)}${v}`)),
          blank(),
          out("psst… try ↑ ↑ ↓ ↓ ← → ← → B A", "dim"),
        ],
      };
    }

    case "ls":
    case "dir": {
      const all = args.includes("-a") || args.includes("-la") || args.includes("/a");
      const files = all ? [...FILES, ".secret"] : FILES;
      return { lines: [out(" Directory of C:\\DHIRAJ", "dim"), blank(), ...files.map((f) => out("  " + f))] };
    }

    case "cat":
    case "type": {
      const f = args[0]?.toLowerCase();
      if (!f) return { lines: [out("usage: cat <file>", "err")] };
      if (f === "about.md") return { lines: aboutLines() };
      if (f === "skills.txt") return { lines: skillsLines() };
      if (f === "contact.txt") return { lines: contactLines() };
      if (f === "resume.pdf") return { lines: [out("resume.pdf is a binary file. Try: resume", "err")] };
      if (f === ".secret")
        return { lines: [out("You found it.", "ok"), out("Type the Konami code — ↑ ↑ ↓ ↓ ← → ← → B A — with the desktop focused.", "accent")] };
      const slug = f.replace(/^projects[\\/]/, "").replace(/\.md$/, "");
      const pl = projectLines(slug);
      if (pl) return { lines: pl };
      return { lines: [out(`cat: ${args[0]}: No such file or directory`, "err")] };
    }

    case "open":
    case "start": {
      if (!rest) return { lines: [out("usage: open <app or project>   (try: open scoutlens, open about)", "err")] };
      const target = resolveOpenTarget(rest);
      if (!target) return { lines: [out(`404: project not found: ${rest}`, "err"), out("type projects to see what exists", "dim")] };
      return { lines: [out(`Opening ${rest} …`, "ok")], effects: [{ type: "open", target }] };
    }

    case "run": {
      if (!rest) return { lines: [out("usage: run <project>", "err")] };
      const p = demoSubject(rest.toLowerCase().replace(/\.exe$/, ""));
      if (!p) return { lines: [out(`404: project not found: ${rest}`, "err"), out("projects --all lists every name", "dim")] };
      if (p.demo.kind === "embed" && p.demo.url)
        return { lines: [out(`Launching ${p.exe} …`, "ok")], effects: [{ type: "open", target: `demo:${p.slug}` }] };
      return {
        lines: [out(`${p.name} has no hosted demo.`, "err"), out(p.demo.note, "dim"), out(`opening its write-up instead …`, "dim")],
        effects: [{ type: "open", target: `project:${p.slug}` }],
      };
    }

    case "date":
      return { lines: [out(ctx.now.toString())] };

    case "echo":
      return { lines: [out(rest)] };

    case "history":
      return { lines: ctx.history.length ? ctx.history.map((h, i) => out(`  ${String(i + 1).padStart(3)}  ${h}`)) : [out("(empty)", "dim")] };

    case "sudo":
      return { lines: [out("dhiraj is not in the sudoers file. This incident will be reported to nobody.", "err")] };

    case "matrix":
      return { lines: [out("Follow the white rabbit …", "ok")], effects: [{ type: "effect", name: "matrix" }] };

    case "bsod":
      return { lines: [out("You asked for it.", "err")], effects: [{ type: "effect", name: "bsod" }] };

    case "konami":
      return { lines: [out("↑ ↑ ↓ ↓ ← → ← → B A", "accent"), out("(press them with the desktop focused, not while typing here)", "dim")] };

    case "coffee":
      return { lines: [out("☕ brewing … 418: I'm a teapot", "ok")] };

    case "exit":
    case "quit":
      return { lines: [out("logout", "dim")], effects: [{ type: "close" }] };

    case "man":
      return { lines: [out(rest ? `No manual entry for ${rest}. Try: help` : "What manual page do you want? Try: help", "err")] };

    default:
      return { lines: [out(`'${cmdRaw}' is not recognized as a command. Type help to list commands.`, "err")] };
  }
}

const TOP_LEVEL = ["help", "about", "projects", "skills", "github", "resume", "contact", "clear", "whoami", "status", "neofetch", "open", "run", "cat", "ls", "dir", "date", "echo", "history", "exit"];

/** Tab completion: command names first, then project/app names after open/run/cat. */
export function complete(input: string): string[] {
  const parts = input.replace(/^\s+/, "").split(/\s+/);
  if (parts.length <= 1) {
    const p = (parts[0] ?? "").toLowerCase();
    return TOP_LEVEL.filter((c) => c.startsWith(p));
  }
  const cmd = parts[0].toLowerCase();
  const p = (parts[parts.length - 1] ?? "").toLowerCase();
  if (cmd === "open" || cmd === "start") {
    const names = [...projects.map((x) => x.slug), ...APPS.filter((a) => a.id !== "hidden").map((a) => a.path)];
    return [...new Set(names)].filter((n) => n.startsWith(p));
  }
  if (cmd === "run") return projects.map((x) => x.slug).filter((n) => n.startsWith(p));
  if (cmd === "cat") return [...FILES.map((f) => f.replace("\\", "")), ...projects.map((x) => x.slug)].filter((n) => n.startsWith(p));
  return [];
}
