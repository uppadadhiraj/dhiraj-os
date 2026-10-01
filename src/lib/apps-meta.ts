import type { OpenSpec } from "@/lib/wm/types";
import type { Project } from "@/data/types";
import { demoSubject, projectBySlug } from "@/data/projects";

/** Pure metadata for every desktop application. Components are mapped in components/os/app-components.tsx. */
export interface AppMeta {
  id: string;
  title: string;
  icon: string;
  size: { w: number; h: number };
  /** URL segment for deep links: /about, /terminal … */
  path: string;
  /** shown on the desktop when present */
  desktop?: { label: string; hero?: boolean };
  /** where it appears in the Start menu */
  start?: "main" | "programs";
  blurb: string;
  /** extra props passed to the app component */
  props?: Record<string, unknown>;
}

export const APPS: AppMeta[] = [
  // The desktop shows only what a visitor needs first (the order here is the icon order); everything else is in Start → Programs.
  { id: "playground", title: "RUN MY PROJECTS.exe", icon: "run", size: { w: 940, h: 640 }, path: "playground", desktop: { label: "RUN MY PROJECTS.exe", hero: true }, start: "main", blurb: "Project Playground — try the demos" },
  { id: "projects", title: "Projects.exe", icon: "folder", size: { w: 980, h: 660 }, path: "projects", desktop: { label: "Projects" }, start: "main", blurb: "Featured, built and important projects", props: { tab: "featured" } },
  { id: "about", title: "About Me.exe", icon: "about", size: { w: 840, h: 580 }, path: "about", desktop: { label: "About Me" }, start: "main", blurb: "Who I am and what I build" },
  { id: "skills", title: "Skills.exe", icon: "chip", size: { w: 860, h: 600 }, path: "skills", desktop: { label: "Skills" }, start: "programs", blurb: "Skills, with the projects that prove them" },
  { id: "resume", title: "Resume.exe", icon: "doc", size: { w: 840, h: 640 }, path: "resume", desktop: { label: "Resume" }, start: "main", blurb: "View or download my resume" },
  { id: "github", title: "GitHub.exe", icon: "branch", size: { w: 960, h: 660 }, path: "github", desktop: { label: "GitHub" }, start: "main", blurb: "Repositories, languages and recent activity" },
  { id: "contact", title: "Contact.exe", icon: "mail", size: { w: 580, h: 500 }, path: "contact", desktop: { label: "Contact" }, start: "main", blurb: "Email, GitHub, LinkedIn" },
  { id: "terminal", title: "Terminal — C:\\DHIRAJ", icon: "terminal", size: { w: 760, h: 500 }, path: "terminal", desktop: { label: "Terminal" }, start: "main", blurb: "A portfolio terminal: try help, neofetch" },
  { id: "sysinfo", title: "System Info", icon: "computer", size: { w: 640, h: 540 }, path: "system", start: "programs", blurb: "System information and what I'm exploring" },
  { id: "blog", title: "DHIRAJ.LOG", icon: "notepad", size: { w: 1000, h: 680 }, path: "blog", start: "programs", blurb: "My blog, embedded" },
  { id: "stack", title: "STACK.exe", icon: "layers", size: { w: 940, h: 620 }, path: "stack", start: "programs", blurb: "How my technologies relate" },
  { id: "journey", title: "JOURNEY.exe", icon: "timeline", size: { w: 780, h: 620 }, path: "journey", start: "programs", blurb: "Timeline of projects and milestones" },
  { id: "howibuild", title: "HOW I BUILD.exe", icon: "gear", size: { w: 780, h: 580 }, path: "how-i-build", start: "programs", blurb: "My build workflow" },
  { id: "welcome", title: "Welcome.exe", icon: "welcome", size: { w: 720, h: 600 }, path: "welcome", start: "programs", blurb: "Start here" },
  { id: "built", title: "Built Projects.exe", icon: "folder", size: { w: 980, h: 660 }, path: "built", start: "programs", blurb: "Projects I engineered", props: { tab: "built" } },
  { id: "important", title: "Important Projects.exe", icon: "folder", size: { w: 980, h: 660 }, path: "important", start: "programs", blurb: "Projects that matter to me, including AI-assisted ones", props: { tab: "important" } },
  { id: "recycle", title: "Recycle Bin", icon: "bin", size: { w: 560, h: 420 }, path: "recycle-bin", desktop: { label: "Recycle Bin" }, blurb: "Nothing to see here. Probably." },
  { id: "hidden", title: "DhirajOS.exe", icon: "lock", size: { w: 780, h: 580 }, path: "dhirajos", blurb: "Hidden project: this portfolio" },
];

export const appById = (id: string): AppMeta | undefined => APPS.find((a) => a.id === id);
export const appByPath = (path: string): AppMeta | undefined => APPS.find((a) => a.path === path);

export const DESKTOP_APPS = APPS.filter((a) => a.desktop);
/** "hidden" is an easter egg: reachable by URL and by the Konami code / terminal, never listed. */
export const PUBLIC_PATHS = APPS.filter((a) => a.id !== "hidden").map((a) => a.path);

export function appSpec(id: string, propsOverride?: Record<string, unknown>): OpenSpec | null {
  const a = appById(id);
  if (!a) return null;
  return {
    id: a.id,
    appId: a.id,
    title: a.title,
    icon: a.icon,
    size: a.size,
    props: propsOverride ?? a.props,
  };
}

export const projectIcon = (p: Project): string => {
  if (p.status === "HARDWARE") return "chip";
  if (p.tags.includes("computer-vision")) return "computer";
  if (p.tags.includes("agents")) return "rocket";
  return "folder";
};

export function projectSpec(slug: string): OpenSpec | null {
  const p = projectBySlug(slug);
  if (!p) return null;
  return {
    id: `project:${p.slug}`,
    appId: "project",
    title: p.exe,
    icon: projectIcon(p),
    size: { w: 920, h: 660 },
    props: { slug: p.slug },
  };
}

export function demoSpec(slug: string): OpenSpec | null {
  const p = demoSubject(slug);
  if (!p) return null;
  return {
    id: `demo:${p.slug}`,
    appId: "demo",
    title: `${p.exe} — ${p.demo.kind === "embed" ? "running" : "preview"}`,
    icon: "run",
    size: { w: 1000, h: 700 },
    props: { slug: p.slug },
  };
}

/** Resolve any "open this" request (terminal `open about`, deep links, buttons) into a window spec. */
export function resolveSpec(target: string): OpenSpec | null {
  if (target.startsWith("project:")) return projectSpec(target.slice(8));
  if (target.startsWith("demo:")) return demoSpec(target.slice(5));
  return appSpec(target);
}
