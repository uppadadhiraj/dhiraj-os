/**
 * Everything here comes from information Dhiraj supplied, his resume, his
 * README files or the GitHub API. Nothing is invented: there is no employment
 * history to list, so none is shown.
 */
export const profile = {
  name: "Venkata Dhiraj Reddy Uppada",
  displayName: "Dhiraj Reddy",
  role: "AI / Software Engineer",
  status: "4th-year B.Tech Computer Science undergraduate",
  location: "Hyderabad, Telangana, India",
  summary:
    "Computer Science undergraduate building practical AI systems, backend applications and developer tools.",
  /**
   * Optional portrait. Left empty on purpose: a photo is only shown when one is deliberately
   * supplied (put the file in /public and set { src, alt }). The UI falls back to a monogram.
   */
  photo: null as null | { src: string; alt: string },
  email: "iamdhirajreddy@gmail.com",
  github: { user: "uppadadhiraj", url: "https://github.com/uppadadhiraj" },
  // The URL comes from the resume. LinkedIn rate-limits automated checks, so it could not be fetched to verify.
  linkedin: "https://www.linkedin.com/in/venkata-dhiraj-reddy-uppada-277bb828a/",
  blog: { name: "DHIRAJ.LOG", url: "https://uppadadhiraj.github.io/" },
  interests: [
    "AI Engineering",
    "Backend Engineering",
    "Generative AI",
    "AI Agents",
    "Machine Learning",
    "Computer Vision",
  ],
  education: [
    {
      title: "B.Tech, Computer Science & Engineering",
      place: "Vidya Jyothi Institute of Technology, Hyderabad",
      years: "2023 – 2027",
      note: "Currently in the fourth year.",
    },
    {
      title: "Intermediate (MPC)",
      place: "Resonance Junior College, Hyderabad",
      years: "2021 – 2023",
      note: undefined as string | undefined,
    },
  ],
  highlights: [
    {
      title: "GSSoC 2026 contributor",
      detail:
        "Selected as a contributor for the AI Agent Track and Open Source Track at GirlScript Summer of Code 2026 (from my resume).",
    },
  ],
  aiTransparency:
    "I use AI coding tools — mainly Claude Code — on several projects. Those are labelled AI-ASSISTED, and I only apply a label I can back with evidence from the repository (README disclosures, commit trailers).",
} as const;

/** "What I'm building": areas of exploration, each tied to real repositories via project tags. */
export const exploring = [
  { key: "agents", label: "AI Agents", blurb: "Tool-calling agents that must cite evidence: Verascope, ScoutLens, AI Analytics." },
  { key: "backend", label: "Backend Systems", blurb: "FastAPI, Postgres/RLS, job scheduling and audit-safe workflows." },
  { key: "rag", label: "RAG", blurb: "Subject-scoped retrieval in Study Buddy and code retrieval in Verascope." },
  { key: "computer-vision", label: "Computer Vision", blurb: "Dark-channel dehazing with LLaVA guidance; YOLOv8 + MediaPipe on the edge." },
  { key: "developer-tools", label: "Developer Tools", blurb: "Understanding and fixing code: Verascope's repo map, debugger and sandboxed fixes." },
] as const;

/** The personal workflow — a philosophy, not a claim about every project. */
export const workflow: ReadonlyArray<{ step: string; text: string; evidence?: string }> = [
  {
    step: "IDEA",
    text: "Start from a real annoyance: a slow onboarding, a messy spreadsheet, a listing that hides things.",
    evidence: "Verascope began with the time I lost understanding a GSSoC project's code.",
  },
  {
    step: "RESEARCH",
    text: "Read the docs and real API responses before designing around them.",
    evidence: "ScoutLens: real SerpApi responses differed from the documented examples, so the parsers were reworked around what the API actually returns.",
  },
  { step: "PROTOTYPE", text: "Build the smallest thing that can be wrong in an interesting way." },
  { step: "BUILD", text: "Typed models, small modules, one source of truth for data." },
  {
    step: "TEST",
    text: "Run it against real inputs, not just the happy path.",
    evidence: "ScoutLens: 592 tests. SCARFLOW: Playwright specs on desktop and mobile. Verascope: backend tests and a CI workflow.",
  },
  {
    step: "DEBUG",
    text: "Keep a log of what broke and why.",
    evidence: "Verascope's docs/VERIFICATION.md records the bugs each test pass found and how they were fixed.",
  },
  { step: "DEPLOY", text: "Host only what can be hosted honestly; label the rest LOCAL ONLY." },
  {
    step: "ITERATE",
    text: "Write the limitations down, then fix the top one.",
    evidence: "Every project page on this site lists limitations and what I'd improve next.",
  },
];

export type Profile = typeof profile;
