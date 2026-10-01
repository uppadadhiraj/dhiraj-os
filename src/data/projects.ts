import type { Project } from "./types";

/**
 * Structured project data — the single source of truth for every card, window,
 * terminal command and the Playground. Facts here were read from the repositories
 * (source, README, git history) on 2026-09-30; `verification` records what was
 * actually executed. Nothing in this file is an estimate.
 *
 * `status` is only LIVE/DEMO when a deployment has been opened and exercised.
 * `development: "unconfirmed"` means the repo carries no AI-assistance markers
 * either way; the UI then avoids claiming manual authorship.
 */
export const projects: Project[] = [
  /* ------------------------------------------------------------------ */
  {
    slug: "verascope",
    name: "Verascope",
    exe: "Verascope.exe",
    tagline:
      "Ask a codebase questions. Agents investigate bugs with cited evidence, test fixes in a Docker sandbox, and wait for your approval.",
    category: "important",
    featured: true,
    status: "LOCAL ONLY",
    development: "ai-assisted",
    devNote:
      "Vibe-coded with Claude — stated in the repo README and credited in commit trailers. The idea and motivation are mine.",
    repo: "verascope-ai",
    stack: [
      "Python",
      "FastAPI",
      "PostgreSQL",
      "SQLAlchemy",
      "ChromaDB",
      "React",
      "TypeScript",
      "Docker",
      "Ollama",
    ],
    tags: ["agents", "rag", "backend", "developer-tools", "full-stack"],
    overview:
      "Verascope turns a repository into something you can interrogate. Paste a GitHub URL or upload a ZIP and it builds a map of the codebase (languages, frameworks, entry points, API routes, tests, auth), a semantic index and a file-level import graph. On top of that sit a chat that cites the code it answers from, a rule-based security scan, and a debugging agent that must back its conclusions with evidence or answer “insufficient evidence”.",
    problem:
      "Reading an unfamiliar codebase is slow. The idea came from choosing a project to contribute to for GSSoC: understanding the code took most of the time. On a team it gets worse, because a senior engineer has to stop their own work to walk a newcomer through it.",
    solution:
      "Ask the repository instead of a person. Answers come with the source snippets they were drawn from. When you describe a bug, agents investigate with tool calls, propose a change, run the tests in an isolated Docker sandbox, and stop for your approval before any git branch or pull request is created.",
    features: [
      "Repository summary that keeps facts separate from guesses",
      "Chat over the code, with cited snippets (real tool-calling, not just retrieval)",
      "Semantic search by meaning (sentence-transformers embeddings in ChromaDB)",
      "Interactive dependency graph with search, legend and insights",
      "Rule-based security scan with suggested fixes — no LLM required",
      "Debugging agent that reports an evidence status, including INSUFFICIENT",
      "Fix pipeline: propose → test in a Docker sandbox → review → validate → human approval → branch / PR",
      "Agent history: every tool call the AI made, for transparency",
    ],
    howItWorks: [
      "Ingest: clone a GitHub URL or unpack a ZIP (path-traversal entries are rejected), scan the files, parse Python with the real AST and JS/TS/Java/C/C++ with regex parsers, then chunk and embed into ChromaDB.",
      "Summarise: detect languages, frameworks, entry points, API routes, tests and auth from what was actually parsed.",
      "Answer: the chat agent calls repository tools (search, read file, list symbols) and cites the code it read.",
      "Debug: the debugger agent investigates a bug you describe and must report an evidence status rather than guess.",
      "Fix: the fix agent writes changes into an isolated workspace, the test agent runs them in a Docker sandbox, review and validation agents check the result, and nothing is committed until you approve.",
    ],
    architecture: [
      ["React + TypeScript UI | explorer · chat · dependency graph · debug"],
      ["FastAPI | JWT auth · repositories · chat · tasks · approvals · git"],
      ["Agent orchestrator | repository · debugger · fix · test · review · validation agents"],
      ["LLM provider | Ollama · Anthropic · OpenAI", "Ingestion parsers | Python AST + regex", "Docker sandbox | isolated test runs", "Git operations | branch + PR"],
      ["PostgreSQL | SQLAlchemy + Alembic", "ChromaDB | code embeddings"],
    ],
    contribution:
      "The problem framing and the product rule — evidence over invention — are mine (README §3, “Why I built it”). The implementation was vibe-coded with Claude. The repo's docs/VERIFICATION.md records four test passes against real repositories and the bugs each one surfaced.",
    challenges: [
      {
        title: "The fix agent could save a placeholder instead of code",
        detail:
          "It sometimes wrote a file containing “# ... rest of the function remains the same ...”. create_file and modify_file now reject content matching common elision idioms.",
      },
      {
        title: "A commit could sweep in files from abandoned fix attempts",
        detail:
          "Test, validation and branch creation queried changes by task only. They are now scoped to the current workspace and de-duplicated by path before committing.",
      },
      {
        title: "Re-scanning a repository failed, then left it stuck",
        detail:
          "Old file, symbol and dependency rows were not cleared before re-inserting (unique violation), and the error path never rolled back. Rows are cleared first and every failure path rolls back before recording FAILED.",
      },
      {
        title: "A crash left jobs “in progress” forever",
        detail:
          "A FastAPI lifespan hook (core/reconcile.py, unit-tested) marks anything left mid-job by a previous process as FAILED with a specific message.",
      },
      {
        title: "Grounding helps, but a small model still embellishes",
        detail:
          "In my local run the chat attached real file citations to its answer, yet llama3.1:8b also asserted that several classes were “not defined anywhere” when they are. The README names this exact weakness; the citations are what let you catch it.",
      },
    ],
    future: [
      "Function-level call graph (today the graph shows imports between files)",
      "Tree-sitter parsing for JS/TS/Java/C/C++ instead of regex",
      "Test real GitHub PR creation end to end with a live token (not yet done, per the README)",
      "Try larger local models: with llama3.1:8b, multi-step debugging sometimes ends in “insufficient evidence”",
    ],
    facts: [
      { label: "Code", value: "≈9.4k lines Python · ≈2.9k lines TS/TSX (counted from the repo)" },
      { label: "Tests", value: "41 backend test functions in 9 files, plus a CI workflow" },
      { label: "Agents", value: "17 modules in backend/app/agents" },
      { label: "Verification log", value: "4 documented passes — 12 bugs fixed in passes 1–2" },
      { label: "Local run", value: "ScoutLens (93 files, 417 import edges) ingested from its GitHub URL in about 2 minutes (2026-10-01)" },
    ],
    screenshots: [
      {
        src: "/projects/verascope/overview.webp",
        alt: "Verascope repository overview for ScoutLens: purpose, languages, entry point, database, test framework, and Facts / Inferences / Uncertain columns",
        caption: "Overview of a real repository (ScoutLens). Facts, inferences and uncertainties are kept in separate columns.",
      },
      {
        src: "/projects/verascope/graph.webp",
        alt: "Verascope interactive dependency graph of 93 files and 417 import relationships, with test files in green",
        caption: "The import graph Verascope built for ScoutLens: 93 files, 417 import relationships.",
      },
      {
        src: "/projects/verascope/security.webp",
        alt: "Verascope security scan listing a high-severity SQL injection pattern in a test file with the matched code and a suggested fix",
        caption: "A pattern-based finding with the matched line and a suggested fix. This one is in a test file — the README lists test-code false positives as a known limitation.",
      },
      {
        src: "/projects/verascope/chat.webp",
        alt: "Verascope repository chat answering a question about the SerpApi client, with cited source files listed underneath",
        caption: "Chat with cited sources. The model's extra commentary here contains wrong “not defined” claims — answer quality depends on the local model (see Engineering).",
      },
    ],
    demo: {
      kind: "none",
      note: "Needs PostgreSQL (Docker), Ollama and a Docker sandbox, so it is not hosted. The screenshots come from a real local run.",
    },
    verification:
      "Run locally on 2026-10-01 (Python 3.11, Postgres 16 in Docker, Ollama llama3.1:8b): migrations applied, the UI registered a user, ingested a real GitHub repository (scan, embed, ready in about 2 minutes), and the overview, dependency graph, explorer and security scan worked; chat returned cited sources in about 22 s. Not exercised: the debug → fix → sandbox → PR pipeline.",
    needs: ["Docker Desktop (PostgreSQL + code sandbox)", "Ollama with llama3.1:8b", "Python 3.11/3.12 and Node 20+"],
    runLocally: [
      "git clone https://github.com/uppadadhiraj/verascope-ai.git && cd verascope-ai",
      "docker compose up -d postgres",
      "ollama pull llama3.1:8b",
      "cd backend && python -m venv .venv && .venv\\Scripts\\activate && pip install -r requirements.txt",
      "cp ../.env.example .env && alembic upgrade head && uvicorn app.main:app --port 8000",
      "cd ../frontend && npm install && cp .env.example .env && npm run dev",
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "scoutlens",
    name: "ScoutLens",
    exe: "ScoutLens.exe",
    tagline:
      "Investigate a job or internship before you invest your time — live SerpApi searches, an evidence store, and a report where every claim links to a real source.",
    category: "important",
    featured: true,
    status: "DEMO",
    development: "ai-assisted",
    devNote:
      "Designed and built with Claude Code as an AI pair-programmer — disclosed in the README and in every commit trailer.",
    repo: "ScoutLens",
    stack: ["Python", "Streamlit", "Pydantic v2", "SerpApi", "SQLite", "BeautifulSoup", "Ollama (optional)"],
    tags: ["agents", "search", "evidence", "python"],
    overview:
      "ScoutLens takes a job or internship link, and optionally a resume, and investigates it: the listing, the employer, the employer's other openings, recent news and the wider job market. It was built for the SerpApi India Hackathon 2026 and uses three SerpApi engines — Google Search, Google Jobs and Google News — each for evidence nothing else in the pipeline could supply.",
    problem:
      "A job listing is a marketing document. It doesn't say what else the company is hiring for, whether its experience requirement matches comparable roles, what recent news says, or which skills the market actually asks for. Answering that by hand means a dozen tabs, and it is easy to over-trust the first search result.",
    solution:
      "Plan an investigation, run real searches, search again where evidence is thin, cross-check important claims, and report FACT (what a source said) separately from INTERPRETATION and a neutral USER ACTION. A claim cannot exist without evidence: a finding that cites nothing fails validation.",
    features: [
      "Opportunity extraction: JSON-LD JobPosting → HTML metadata → text heuristics; robots.txt-aware, SSRF-safe fetching; manual-paste fallback",
      "Hiring signals computed from the employer's other current listings, always with the sample size shown",
      "Market skill signals from a role-title-only sample, so the query cannot inflate a percentage",
      "Personal fit from a locally parsed resume — it is never sent to a model",
      "“What you might have missed”: up to five evidence-backed findings not obvious from the listing",
      "Source tiers 1–3 and cross-check status (corroborated / single source / conflicting / insufficient)",
      "SQLite cache that saves SerpApi credits, plus saved investigation history",
      "Demo mode: recorded, SerpApi-shaped responses for a fictional company — no key or network needed",
    ],
    howItWorks: [
      "Read the listing (URL fetch with SSRF checks, or pasted text) into a typed OpportunityProfile; unknown fields stay None.",
      "Plan round-one searches. The planner spends credits adaptively: it skips the funding search for established companies and follows up only where evidence is thin.",
      "Company, hiring, news and market agents run the searches and turn results into typed models.",
      "The evidence store is the only place evidence items are created, and only from objects SerpApi actually returned.",
      "Findings and the report are generated from that evidence. An optional LLM may draft a cited overview; every sentence is validated against the store and uncited ones are dropped.",
    ],
    architecture: [
      ["Streamlit UI"],
      ["Pipeline | listing URL or pasted text · resume · preferences"],
      ["Opportunity agent | extraction", "Planner / investigator | adaptive searches"],
      ["Company agent", "Hiring agent", "News agent", "Market agent"],
      ["SerpApi client | cache · retries · error mapping"],
      ["Evidence store | tiers · citations · cross-checks"],
      ["Report | “What you might have missed”"],
    ],
    contribution:
      "The brief, the evidence rules and the “NO SOURCE = NO FACT” principle are mine; the code was designed and written with Claude Code (README “AI disclosure”). Live runs against real SerpApi data on two listings drove fixes to query wording, regional fallback and excerpt filtering.",
    challenges: [
      {
        title: "Real SerpApi responses differ from the docs",
        detail:
          "Google Jobs items often lack detected_extensions and Google News results carry no snippet. Parsers read the plain extensions list and iso_date, and drop unusable items instead of crashing.",
      },
      {
        title: "A bare brand name returns songs and login pages",
        detail:
          "Queries use “<name> company” plus a follow-up “official website” search, and low-confidence identification is flagged in the report instead of hidden.",
      },
      {
        title: "Google Jobs coverage is regional",
        detail:
          "Some locations return nothing. ScoutLens falls back to the default region, says so in the report, and skips comparisons that would be meaningless across regions.",
      },
      {
        title: "requests puts api_key in the URL, and exception text includes it",
        detail: "Every error path is redacted before anything is logged or shown.",
      },
    ],
    future: [
      "More opportunity types (university programmes, startups)",
      "Continuous monitoring and notifications for a saved opportunity",
      "A browser extension: “investigate this page”",
      "Rendered-page extraction for JavaScript-only sites",
      "Richer resume understanding (proficiency and recency)",
    ],
    facts: [
      { label: "Code", value: "≈13.3k lines of Python across 34 test files and 100+ modules" },
      { label: "Tests", value: "592 tests, all passing when re-run on 2026-09-30 — no network or API key needed" },
      { label: "Live check", value: "README: verified on two real listings on 2026-09-30" },
      { label: "Hosted demo", value: "Public-demo build (PUBLIC_DEMO=1), commit afdffe8 on branch feature/public-demo-mode, run in the browser with stlite 1.9.2" },
    ],
    screenshots: [
      { src: "/projects/scoutlens/01-home.webp", alt: "ScoutLens home screen with a URL field and a Try the demo button" },
      { src: "/projects/scoutlens/02-investigation.webp", alt: "ScoutLens investigation progress showing each real stage" },
      { src: "/projects/scoutlens/03-report-overview.webp", alt: "ScoutLens report overview with the What you might have missed findings" },
      { src: "/projects/scoutlens/04-report-company.webp", alt: "ScoutLens company tab with sourced facts and tiers" },
      { src: "/projects/scoutlens/06-report-personal-fit.webp", alt: "ScoutLens personal fit tab comparing resume skills to the listing" },
      { src: "/projects/scoutlens/07-report-evidence-method.webp", alt: "ScoutLens evidence and method tab listing every search" },
    ],
    demo: {
      kind: "embed",
      url: "/demos/scoutlens/index.html",
      note: "The real Streamlit app, running inside your browser (WebAssembly) in public-demo mode: it replays recorded responses for a fictional company. The URL and résumé inputs are hidden, nothing is stored and no API key is involved. The first load downloads the Python runtime (about 10 MB).",
    },
    verification:
      "Run locally on 2026-09-30 (Python 3.11): the full test suite passed (592 of 592; 597 with the five public-demo tests added on 2026-10-01); the demo investigation completes every stage and renders the report with the Demo-data label; no console errors and no horizontal overflow at 390 px. The hosted copy is the same code in PUBLIC_DEMO mode (branch feature/public-demo-mode) running under stlite 1.9.2; its demo investigation, report and closed History tab were checked in Chrome on 2026-10-01.",
    needs: ["Python 3.11+", "A SerpApi key for live investigations (not needed for the demo)", "Ollama or an OpenAI-compatible API is optional"],
    runLocally: [
      "git clone https://github.com/uppadadhiraj/ScoutLens.git && cd ScoutLens",
      "python -m venv .venv && .venv\\Scripts\\activate",
      "pip install -r requirements.txt",
      "streamlit run app.py",
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "scarflow",
    name: "SCARFLOW",
    exe: "SCARFLOW.exe",
    tagline:
      "Supplier corrective-action (SCAR) and 8D workflow for manufacturing quality teams — replacing Excel sheets and email threads.",
    category: "important",
    featured: true,
    status: "LOCAL ONLY",
    development: "ai-assisted",
    devNote:
      "Built with Claude Code (Claude Opus 5.5 co-author trailer in the commit; CLAUDE.md / AGENTS.md in the repo).",
    repo: "ScarFlow-AI",
    stack: ["Next.js 16", "React 19", "TypeScript", "Tailwind CSS 4", "Supabase (Postgres + RLS)", "Inngest", "Resend", "Playwright"],
    tags: ["saas", "backend", "full-stack", "security"],
    overview:
      "A quality manager issues a SCAR to a supplier. The supplier answers the eight 8D phases and uploads evidence through a secure emailed link, without creating an account. The quality manager approves each phase or asks for more information, deadlines are chased automatically, and a closed SCAR produces an audit-ready PDF.",
    problem:
      "Manufacturing quality teams commonly run corrective-action requests through spreadsheets and email: no enforced process, no reliable audit trail, and a lot of manual chasing of suppliers.",
    solution:
      "A single Next.js application with the 8D workflow built in, a token-based supplier portal that needs no account, database-enforced audit rules, and a scheduled sweep that sends reminders and escalations.",
    features: [
      "Auto-generated D1–D8 phases for every SCAR, with approve / request-more-info review per phase",
      "Supplier portal via a 256-bit magic link; only its SHA-256 hash is stored; links expire after 30 days and can be revoked",
      "Multi-tenant by design: every row is organisation-scoped and enforced by Postgres Row Level Security",
      "Audit integrity enforced by database triggers: closed SCARs are immutable, a SCAR closes only when all 8 phases are approved, valid status transitions only",
      "Evidence goes straight from the browser to a private bucket through a short-lived signed URL, validated before and after upload",
      "Daily Inngest sweep: reminders, overdue status and escalations",
      "Audit PDF generated on closure (@react-pdf/renderer + pdf-lib)",
    ],
    howItWorks: [
      "Quality managers sign in (Supabase Auth); every query runs under RLS keyed by auth_org_id().",
      "Suppliers never sign in: /supplier/scar/[token] validates the token hash server-side and uses a service-role client scoped to that one SCAR.",
      "Phase responses and evidence are stored per SCAR; reviewers cannot edit supplier responses.",
      "At 07:00 UTC each day an Inngest job applies reminders, flips overdue SCARs and escalates.",
      "Closing a SCAR locks the record and renders the audit PDF.",
    ],
    architecture: [
      ["Quality manager | session + RLS", "Supplier | magic link · no account"],
      ["Next.js App Router | Server Actions · token-hash check"],
      ["Supabase Postgres | RLS + audit triggers", "Private storage | signed upload URLs"],
      ["Inngest | daily deadline sweep", "Resend | reminder emails"],
    ],
    contribution:
      "Product scope and acceptance criteria are mine: the MVP has a written V2 backlog in the README (team invites, billing, AI assistance, scorecards, SSO). The code was written with Claude Code and exercised by the repo's Playwright suite, organised day1 → day6 to match the build plan.",
    challenges: [
      {
        title: "An unauthenticated portal can't ride on RLS",
        detail:
          "Supplier routes validate the token hash and use the service-role client with manual authorisation scoped to one SCAR, while every other path stays on RLS.",
      },
      {
        title: "Audit guarantees that survive application bugs",
        detail:
          "Immutability, valid phase transitions, forged attribution and self-promotion are blocked by database triggers, and a security spec attacks the API directly to prove it.",
      },
      {
        title: "Evidence uploads without proxying files",
        detail:
          "Files go browser → private bucket via signed upload URLs; the server checks type and size before and after upload.",
      },
    ],
    future: [
      "Team invitations (today every sign-up creates its own organisation)",
      "Supplier scorecards and analytics, custom 8D templates",
      "Stripe billing and AI assistance (deliberately deferred to V2)",
      "Deadlines are evaluated in UTC; PDFs use Helvetica (Latin-1 only) — both listed as known limitations",
    ],
    facts: [
      { label: "Code", value: "≈8.4k lines TypeScript/TSX · ≈750 lines SQL in 4 migrations" },
      { label: "Tests", value: "9 Playwright e2e specs (desktop + mobile) and 1 unit spec" },
      { label: "Stack", value: "Next.js 16 · React 19 · Tailwind 4 · shadcn/ui · Supabase" },
    ],
    demo: {
      kind: "none",
      note: "Needs a Supabase project, Resend and Inngest, so it is not hosted publicly. It runs locally with the Supabase CLI and Docker.",
    },
    verification: "Source, migrations and test specs read on 2026-09-30.",
    needs: ["Node 20.9+", "Docker Desktop (local Supabase)", "Supabase project, Resend and Inngest to deploy"],
    runLocally: [
      "git clone https://github.com/uppadadhiraj/ScarFlow-AI.git && cd ScarFlow-AI",
      "npm install && npm run db:start",
      "# create .env.development.local from `npx supabase status` (see README)",
      "npm run dev",
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "smartride",
    name: "SmartRide AI",
    exe: "SmartRide.exe",
    tagline:
      "Edge-AI rider-safety assistant for two-wheelers: a camera watches for a missing helmet, phone use and hands off the handlebar, and raises an immediate alert.",
    category: "built",
    featured: true,
    status: "HARDWARE",
    development: "unconfirmed",
    devNote: "Final-year team project (four members). Source is not published yet.",
    repo: "SmartRide-AI",
    stack: ["Python", "Raspberry Pi", "YOLOv8", "TensorFlow Lite", "OpenCV", "MediaPipe", "MPU6050"],
    tags: ["computer-vision", "edge-ai", "hardware"],
    overview:
      "SmartRide is a real-time, camera-based rider-safety assistant for two-wheelers. A camera mounted near the key slot or dashboard watches the rider while the vehicle is moving and flags unsafe behaviour — riding without a helmet, using a mobile phone, and taking both hands off the handlebar — with an immediate audio or visual alert.",
    problem:
      "Many two-wheeler accidents involve unsafe riding habits that nothing in the vehicle notices: no helmet, phone use, both hands off the bars.",
    solution:
      "Run computer vision on an affordable edge device: detect the helmet and rider behaviour from the camera feed, add motion sensing, and alert the rider right away so they can correct course.",
    features: [
      "Helmet and object detection with YOLOv8 (from my resume)",
      "Hand tracking with MediaPipe to tell whether hands are on the handlebar (from my resume)",
      "MPU6050 motion sensing feeding the same safety-alert pipeline (from my resume)",
      "Immediate audio or visual alert when a violation is detected (from the project abstract)",
    ],
    howItWorks: [
      "Camera frames are analysed on a Raspberry Pi for the helmet and the rider's hands.",
      "An MPU6050 motion sensor adds context from the bike's movement.",
      "When a violation is detected the system raises an audio or visual alert.",
      "This is the level of detail the abstract and my resume support — the code is not published, so I'm not describing internals I can't show.",
    ],
    architecture: [
      ["Camera", "MPU6050 motion sensor"],
      ["Raspberry Pi"],
      ["YOLOv8 | helmet / object detection", "MediaPipe | hand tracking"],
      ["Safety rules"],
      ["Audio / visual alert"],
    ],
    contribution:
      "Team project (four members). As stated on my resume, I implemented the YOLOv8 object and helmet detection and the MediaPipe hand tracking, and integrated MPU6050 motion sensing to trigger safety alerts through the camera–sensor pipeline.",
    future: [
      "Rider drowsiness and distraction detection (proposed in the abstract)",
      "Accident detection with onboard sensors and GPS-based emergency alerts (proposed in the abstract)",
      "Ride-safety analytics to evaluate riding behaviour over time (proposed in the abstract)",
    ],
    facts: [
      { label: "Type", value: "Final-year college project, team of four" },
      { label: "Hardware", value: "Raspberry Pi + camera + MPU6050 (per resume)" },
      { label: "Repository", value: "SmartRide-AI is currently a placeholder (README title + LICENSE only)" },
    ],
    demo: {
      kind: "none",
      note: "Hardware project: it needs the bike-mounted camera and sensor rig, so there is no cloud demo.",
    },
    verification:
      "Not executed — the repository has no source. This entry is written from the project abstract and my resume, and says so.",
    note: "The GitHub repository is a placeholder. This write-up is based on the project abstract and my resume, not on source code.",
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "rainfoghaze",
    name: "RainFogHaze",
    exe: "RainFogHaze.exe",
    tagline:
      "Haze and fog removal with OpenCV's dark-channel prior, where a local vision model (LLaVA) chooses the dehazing strength.",
    category: "built",
    featured: true,
    status: "LOCAL ONLY",
    development: "unconfirmed",
    devNote: "Repository has no AI-assistance markers; development method not yet labelled.",
    repo: "RainFogHaze-OpenCV-GenAI",
    stack: ["Python", "Django", "OpenCV", "NumPy", "Ollama", "LLaVA"],
    tags: ["computer-vision", "genai", "django"],
    overview:
      "A Django app that dehazes an uploaded photo two ways and shows them side by side: a baseline dark-channel-prior dehaze with a fixed strength, and a guided version where LLaVA (through Ollama) reads the photo and reports the fog, haze and rain level, which selects the strength.",
    problem:
      "Fog, haze and rain reduce visibility in road and outdoor footage. A single fixed correction strength over- or under-corrects depending on how bad the scene is.",
    solution:
      "Estimate how severe the weather is first, then pick the correction strength from that estimate, and let the user compare against the fixed-strength baseline.",
    features: [
      "Upload JPG/PNG (validated) and get a baseline and a guided result side by side",
      "Dark-channel-prior dehazing in OpenCV/NumPy: dark channel, atmospheric light, transmission map, scene recovery",
      "LLaVA via Ollama answers “fog level / haze level / rain present”; a rule maps the answer to a strength of 0.75, 0.85 or 0.95",
      "Sharpening pass after dehazing; CLAHE-on-LAB contrast experiment and a video-frame experiment included as scripts",
    ],
    howItWorks: [
      "The Django view validates and stores the upload, then asks LLaVA for fog, haze and rain levels.",
      "get_strength() turns the model's text into one of three constants (low 0.75, medium 0.85, high 0.95).",
      "remove_haze_param() dehazes with that strength; the baseline uses a fixed 0.8.",
      "Both results are written to media/output and rendered next to each other.",
    ],
    architecture: [
      ["Browser upload | JPG / PNG"],
      ["Django view | validate + store"],
      ["LLaVA via Ollama | fog · haze · rain level"],
      ["Strength rule | 0.75 · 0.85 · 0.95"],
      ["OpenCV dark-channel dehaze | guided vs fixed 0.8 baseline"],
      ["Side-by-side output"],
    ],
    contribution:
      "Sole committer on the repository (2 commits, 2026-02-27). What it implements: the dehazing pipeline, the LLaVA-guided strength rule and the comparison UI, as committed.",
    challenges: [
      {
        title: "What the GenAI part does and doesn't do",
        detail:
          "The vision model only chooses between three fixed strengths; it does not tune the algorithm beyond that, and the repo contains no quantitative evaluation. The guided/baseline comparison is visual.",
      },
      {
        title: "The guidance is only as good as the vision model",
        detail:
          "On the repository's own foggy sample image, llava answered “fog: low, haze: low, rain: no”, which selects the weakest strength (0.75). A small local vision model can misjudge a scene, and nothing downstream checks it.",
      },
    ],
    future: [
      "Add a README and sample images",
      "Estimate atmospheric light more robustly than the maximum of the dark channel",
      "Measure results (for example with SSIM/PSNR on a dehazing benchmark) instead of comparing by eye",
      "Handle Ollama being unavailable (the view shells out to the ollama CLI with no fallback)",
    ],
    facts: [
      { label: "Method", value: "Dark channel prior + LLaVA-selected strength" },
      { label: "History", value: "2 commits on 2026-02-27" },
      { label: "Local run", value: "llava answered in about 12 s for the sample image (2026-09-30)" },
    ],
    screenshots: [
      {
        src: "/projects/rainfoghaze/result.webp",
        alt: "RainFogHaze showing the OpenCV baseline output and the GenAI-guided output side by side, with LLaVA's fog, haze and rain answers underneath",
        caption: "Real output from a local run on the repository's sample image (2026-09-30).",
      },
    ],
    demo: {
      kind: "none",
      note: "The guided mode needs a local LLaVA model through Ollama.",
    },
    verification:
      "Run locally on 2026-09-30: the home page loads (HTTP 200); a non-image upload is rejected with a message; a JPG upload goes through LLaVA (about 12 s) and OpenCV and renders both outputs side by side.",
    needs: ["Python 3.11+", "Ollama with the llava model for guided mode"],
    runLocally: [
      "git clone https://github.com/uppadadhiraj/RainFogHaze-OpenCV-GenAI.git",
      "pip install django opencv-python numpy pillow && ollama pull llava",
      "python manage.py migrate && python manage.py runserver",
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "study-buddy",
    name: "Study Buddy",
    exe: "StudyBuddy.exe",
    tagline: "A study assistant that answers only from the PDFs you uploaded for the selected subject.",
    category: "built",
    featured: false,
    status: "LOCAL ONLY",
    development: "unconfirmed",
    devNote: "Repository has no AI-assistance markers; development method not yet labelled.",
    repo: "Study-Buddy",
    stack: ["Python", "Streamlit", "LangChain", "ChromaDB", "Ollama", "llama3.1:8b"],
    tags: ["rag", "genai", "python"],
    overview:
      "Study Buddy lets a student create subjects, upload PDF notes into each, and ask questions. Retrieval is filtered to the selected subject, so a Physics question never pulls from DBMS slides, and the model is told to answer only from the retrieved material.",
    problem:
      "Notes and slide decks pile up across subjects, and finding one answer means scrolling through all of them — while a general chatbot happily answers from outside the syllabus.",
    solution:
      "Per-subject RAG: PDFs are split into overlapping chunks, embedded locally, stored in ChromaDB with their subject as metadata, and retrieved with a metadata filter and a relevance threshold.",
    features: [
      "Create subjects; each subject has its own uploaded material",
      "PDF upload → 1,000-character chunks with 200 characters of overlap",
      "Duplicate-safe: chunk ids are subject + SHA-256 of the file + index",
      "Top-4 retrieval filtered by subject with a 0.35 relevance threshold; below it the app says it can't find the answer in the material",
      "Two answer styles: “Simple and Understandable” and “10 Marks Detailed Answer”",
      "Fully local: nomic-embed-text embeddings and llama3.1:8b generation via Ollama",
    ],
    howItWorks: [
      "Upload: PyPDFLoader reads the PDF and RecursiveCharacterTextSplitter makes 1000/200 chunks.",
      "Index: each chunk is tagged with subject, file name and file hash, embedded with nomic-embed-text and stored in ChromaDB.",
      "Retrieve: similarity search with a subject filter returns up to four chunks; anything scoring below 0.35 is discarded.",
      "Answer: a strict prompt (“answer only from the study material; do not use general knowledge; do not use another subject”) plus the chosen style goes to llama3.1:8b at temperature 0.",
    ],
    architecture: [
      ["Streamlit UI | subject selector · PDF upload · chat"],
      ["PyPDFLoader + text splitter | chunk 1000 / overlap 200"],
      ["Ollama | nomic-embed-text embeddings"],
      ["ChromaDB | chunks tagged with subject"],
      ["Similarity search | k = 4 · subject filter · score ≥ 0.35"],
      ["Ollama | llama3.1:8b · “answer only from the material”"],
    ],
    contribution:
      "Sole committer on the repository (4 commits, 2026-08-04 → 2026-08-10); the README describes the idea in the first person. What it implements: the subject-scoped retrieval design, the refusal behaviour and the Streamlit interface as committed.",
    challenges: [
      {
        title: "Keeping subjects from leaking into each other",
        detail:
          "One Chroma collection with subject metadata and a filter on every query, plus a prompt rule that forbids using another subject's material.",
      },
      {
        title: "Not answering from thin air",
        detail:
          "A similarity-score floor (0.35) turns weak matches into an explicit “couldn't find this in the study material” instead of a confident guess.",
      },
    ],
    future: [
      "Show source pages and file names with each answer",
      "Remove unused dependencies (pymongo) and stop committing uploaded PDFs and the vector store",
      "Evaluate answer quality on a fixed set of questions",
    ],
    facts: [
      { label: "Chunking", value: "1000 characters, 200 overlap" },
      { label: "Retrieval", value: "k = 4, relevance floor 0.35, filtered by subject" },
      { label: "Models", value: "nomic-embed-text + llama3.1:8b via Ollama" },
      { label: "Bundled index", value: "123 chunks of the ESS (electrical energy storage) slides in the repo's chroma_db" },
    ],
    screenshots: [
      {
        src: "/projects/study-buddy/answer.webp",
        alt: "Study Buddy answering a question about renewable energy storage from the ESS subject's slides",
        caption: "A grounded answer, from a real local run (2026-10-01).",
      },
      {
        src: "/projects/study-buddy/refusal.webp",
        alt: "Study Buddy refusing an off-topic question because it is not in the ESS study material",
        caption: "An off-topic question is refused instead of answered from general knowledge.",
      },
    ],
    demo: {
      kind: "none",
      note: "Needs Ollama for embeddings and generation, so it is not hosted. The screenshots come from a real local run.",
    },
    verification:
      "Run locally on 2026-10-01 (Python 3.11, Ollama llama3.1:8b + nomic-embed-text): an in-topic question about the ESS slides returned a grounded answer in about 4 s; an off-topic question (“Who won the 2010 football world cup?”) was refused in about 2 s with “I couldn't find this information in the ESS study material.”",
    needs: ["Python 3.11+", "Ollama with nomic-embed-text and llama3.1:8b"],
    runLocally: [
      "git clone https://github.com/uppadadhiraj/Study-Buddy.git && cd Study-Buddy",
      "pip install -r requirements.txt",
      "ollama pull nomic-embed-text && ollama pull llama3.1:8b",
      "streamlit run src/app.py",
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "fake-news-predictor",
    name: "Fake News Predictor",
    exe: "FakeNews.exe",
    tagline:
      "Paste a news-article URL; a TF-IDF + logistic-regression model trained on an Indian fake-news dataset labels it FAKE or REAL with a confidence score.",
    category: "built",
    featured: false,
    status: "DEMO",
    development: "unconfirmed",
    devNote: "Repository has no AI-assistance markers; development method not yet labelled.",
    repo: "Fake-News-Predictor",
    stack: ["Python", "scikit-learn", "TF-IDF", "Newspaper3k", "Streamlit"],
    tags: ["nlp", "ml", "python"],
    overview:
      "A Streamlit app around a scikit-learn text classifier. It downloads the article with Newspaper3k, lower-cases and strips punctuation, vectorises with a 5,000-feature TF-IDF and predicts with logistic regression, showing the predicted label and the model's top class probability.",
    problem:
      "Fact-checks take time. A first-pass classifier can flag articles whose text looks like ones already labelled fake — useful as a prompt to look closer, not as a verdict.",
    solution:
      "Train on a labelled Indian news dataset, save the model, vectoriser and label encoder as pickles, and wrap them in a URL-in, label-out web app.",
    features: [
      "URL in → article text extracted with Newspaper3k",
      "Same preprocessing as training (lower-case, strip non-word characters)",
      "TF-IDF (max 5,000 features) + logistic regression; label and confidence shown",
      "Clear errors when an article can't be downloaded or has too little text",
    ],
    howItWorks: [
      "Notebook: load news_dataset.csv, drop null rows, split 80/20 (random_state 42), encode labels, TF-IDF, fit logistic regression, pickle the artefacts.",
      "App: load the three pickles, download and parse the URL, preprocess, vectorise, predict, and show label + max probability.",
    ],
    architecture: [
      ["Streamlit UI | article URL"],
      ["Newspaper3k | download + parse"],
      ["Preprocess | lower-case · strip punctuation"],
      ["TF-IDF | 5,000 features"],
      ["Logistic regression | + label encoder"],
      ["FAKE / REAL | + confidence"],
    ],
    contribution:
      "Sole committer on the repository (12 commits, 2025-10-01 → 2025-10-02). It is also listed on my resume. What it implements: the training notebook, the saved model artefacts and the Streamlit app as committed.",
    challenges: [
      {
        title: "A 99.5% score that mostly measures the source, not the truth",
        detail:
          "The notebook prints no metric, so the saved model was re-evaluated on its own held-out split: 99.5% accuracy on 745 articles. But its strongest FAKE-class features are fact-checking vocabulary — video, boom, viral, fake, image, claim, fact. In the training split 1,327 of 2,976 articles contain “boom” (a fact-checking outlet's name) and every one is labelled FAKE, while “NEW DELHI” articles are 88% REAL. The model has learned which outlet wrote an article more than whether it is false, so treat its output as a demo signal, not a verdict.",
      },
    ],
    future: [
      "Report a held-out metric in the notebook (none is printed in the repo) next to a leakage check",
      "Evaluate on articles from outlets that are not in the training set",
      "Use a single scikit-learn Pipeline instead of three separate pickles (they were written with scikit-learn 1.6.1)",
    ],
    facts: [
      { label: "Model", value: "TF-IDF (5,000 features) + LogisticRegression" },
      { label: "Data", value: "3,729 labelled articles (1,877 FAKE, 1,852 REAL); 8 empty texts dropped" },
      { label: "Split", value: "80/20, random_state 42 → 2,976 train, 745 test" },
      { label: "Re-measured", value: "99.5% test accuracy (360/1 and 3/381 confusion), 2026-09-30 — see the leakage note below" },
      { label: "Hosted demo", value: "Paste-text copy, commit 0f34ffc on branch deploy/safe-url-fetch, run in the browser with stlite 1.9.2" },
    ],
    screenshots: [
      {
        src: "/projects/fake-news-predictor/result.webp",
        alt: "Fake News Predictor showing a REAL prediction with a confidence score for a pasted URL",
        caption: "Smoke test on a Wikipedia page (not a news article) — it still returns a label, which is part of the limitation.",
      },
    ],
    demo: {
      kind: "embed",
      url: "/demos/fake-news/index.html",
      note: "The repo's real model and app code, running inside your browser (WebAssembly). A browser can't download other sites' pages, so this copy scores text you paste (two example buttons are provided); the link-fetching version runs locally. It scores writing style, not truth — read the reliability note at the bottom of the app.",
    },
    verification:
      "Run locally on 2026-09-30 (Python 3.11, scikit-learn 1.9.1 loading the repo's 1.6.1 pickles): the app loads, returns a label and confidence for a URL, and shows readable errors for a malformed URL and an unreachable host; test-split accuracy and top features re-measured from the saved model. The hosted copy (branch deploy/safe-url-fetch, commit 0f34ffc) runs in the browser under scikit-learn 1.7.0 and gave the same labels and confidences as the local run on both example texts (FAKE 0.99, REAL 0.88), checked on 2026-10-01.",
    needs: ["Python 3.11+", "Internet access (to download the article)"],
    runLocally: [
      "git clone https://github.com/uppadadhiraj/Fake-News-Predictor.git && cd Fake-News-Predictor/App",
      "pip install streamlit newspaper3k lxml_html_clean scikit-learn pandas",
      "streamlit run app.py",
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "interview-coach",
    name: "AI Interview Coach",
    exe: "InterviewCoach.exe",
    tagline:
      "A fully local interview-prep chatbot: Streamlit + LangChain + Ollama running DeepSeek-R1:8B, with four answer styles and conversation memory.",
    category: "built",
    featured: false,
    status: "LOCAL ONLY",
    development: "unconfirmed",
    devNote: "Repository has no AI-assistance markers; development method not yet labelled.",
    repo: "AI-Interview-Coach-Ollama",
    stack: ["Python", "Streamlit", "LangChain", "Ollama", "DeepSeek-R1:8B"],
    tags: ["genai", "chatbot", "python"],
    overview:
      "A single-file Streamlit chat app that talks to DeepSeek-R1:8B through Ollama. A detailed system prompt sets the persona and interview rules, a sidebar selects the answer style (Interview Answer, Beginner Explanation, Detailed Explanation, Short Answer), and the conversation history is replayed on every turn so follow-ups like “why?” work.",
    problem:
      "Interview prep answers need different depth at different moments — a 5-line spoken answer, a beginner explanation, a deep dive — and cloud chatbots need accounts and send your questions away.",
    solution:
      "A local model behind a chat UI whose system prompt encodes the answer styles and the “follow-ups refer to the previous topic” rule. Nothing leaves the machine.",
    features: [
      "Four response styles, each with explicit length and content rules",
      "Conversation memory as LangChain Human/AI messages in Streamlit session state",
      "Runs fully locally through Ollama — no API key",
      "Coding-question rules: prefer Python, give complexity, explain the approach",
    ],
    howItWorks: [
      "The system prompt (persona, subjects, interview rules, formatting, style rules) is formatted with the selected style.",
      "Each user message is appended to the message list and the whole list is sent to ChatOllama (temperature 0.2).",
      "The reply is appended and the chat is re-rendered from the message list.",
    ],
    architecture: [
      ["Streamlit chat UI | response-style selector"],
      ["Message history | system prompt + human / AI messages"],
      ["LangChain ChatOllama"],
      ["Ollama | deepseek-r1:8b"],
    ],
    contribution:
      "Sole author on the repository (4 commits, 2025-07-25 → 2025-07-26). What it implements: the prompt design, the chat loop and the README, as committed.",
    future: [
      "Apply the selected style to a conversation already in progress (as written, the system message is created once per session)",
      "Enforce the length rules: a run in “Interview Answer” mode returned far more than the 5–8 lines the prompt asks for",
      "Add a mock-interview mode that asks the questions",
    ],
    facts: [
      { label: "Model", value: "deepseek-r1:8b via Ollama, temperature 0.2" },
      { label: "Local run", value: "about 26 s for a full interview-style answer (2026-10-01)" },
    ],
    screenshots: [
      {
        src: "/projects/interview-coach/answer.webp",
        alt: "AI Interview Coach showing a structured interview-style answer about retrieval-augmented generation",
        caption: "Real output from a local run (2026-10-01).",
      },
    ],
    demo: { kind: "none", note: "Needs a local DeepSeek-R1:8B model through Ollama, so it is not hosted. The screenshot comes from a real local run." },
    verification:
      "Run locally on 2026-10-01 (Python 3.11, Ollama deepseek-r1:8b): the app loads, and a question about retrieval-augmented generation returned a structured, formatted answer in about 26 s with no reasoning text leaking into the reply and no console errors.",
    needs: ["Python 3.11+", "Ollama with deepseek-r1:8b"],
    runLocally: [
      "git clone https://github.com/uppadadhiraj/AI-Interview-Coach-Ollama.git && cd AI-Interview-Coach-Ollama",
      "pip install -r requirements.txt && ollama pull deepseek-r1:8b",
      "streamlit run chatbot.py",
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "job-application-tracker",
    name: "Job Application Tracker",
    exe: "JobTracker.exe",
    tagline:
      "Full-stack tracker for job applications: FastAPI + SQLAlchemy + MySQL behind a Streamlit dashboard, with an end-to-end API test script.",
    category: "built",
    featured: false,
    status: "LOCAL ONLY",
    development: "unconfirmed",
    devNote: "Repository has no AI-assistance markers; development method not yet labelled.",
    repo: "Job-Application-Tracker",
    stack: ["Python", "FastAPI", "SQLAlchemy", "MySQL", "Pydantic", "Streamlit"],
    tags: ["backend", "full-stack", "api", "sql"],
    overview:
      "A three-tier app: a Streamlit UI that talks only to a FastAPI REST API, which persists applications in MySQL through SQLAlchemy. It tracks company, role, URL, location, date applied, status and notes across seven pipeline stages.",
    problem: "Applications spread across job boards and spreadsheets lose status and notes.",
    solution:
      "One relational store with validated inputs and a dashboard for filtering by stage and seeing totals.",
    features: [
      "Eight REST endpoints: health, list, get, create, update, delete, filter by status, and stats",
      "Seven statuses: Applied, Screening, Interview, Assessment, Offer, Rejected, Withdrawn (invalid values rejected with 422)",
      "Streamlit dashboard: table, filters, edit, confirmed delete, and a status-distribution chart",
      "Database settings read from environment variables; a .env.example is provided",
      "test_api.py: a 10-step end-to-end script against a running server",
    ],
    howItWorks: [
      "Streamlit sends JSON over HTTP to FastAPI; it never touches the database.",
      "Pydantic schemas validate requests; crud.py holds the SQLAlchemy queries; models.py maps the table.",
      "MySQL connection settings come from .env through python-dotenv.",
    ],
    architecture: [
      ["Streamlit UI"],
      ["FastAPI REST API | Pydantic validation"],
      ["SQLAlchemy ORM"],
      ["MySQL"],
    ],
    facts: [
      { label: "API", value: "8 endpoints" },
      { label: "Test script", value: "10 end-to-end steps against a live server" },
    ],
    demo: { kind: "none", note: "Needs a MySQL database, so it is not hosted." },
    verification:
      "Not executed by me — it needs a MySQL instance I don't have credentials for. Code, README and test script were read on 2026-09-30.",
    needs: ["Python 3.11+", "MySQL 8"],
    runLocally: [
      "git clone https://github.com/uppadadhiraj/Job-Application-Tracker.git && cd Job-Application-Tracker",
      "pip install -r requirements.txt && cp .env.example .env   # set DB_* values",
      "uvicorn backend.main:app --reload",
      "streamlit run frontend/app.py",
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "ai-analytics",
    name: "AI Analytics",
    exe: "AIAnalytics.exe",
    tagline:
      "Upload a CSV or Excel file and ask questions: a LangChain agent answers by calling 12 tools for statistics and charts, with Qwen3 running locally.",
    category: "built",
    featured: false,
    status: "LOCAL ONLY",
    development: "unconfirmed",
    devNote: "Repository has no AI-assistance markers; development method not yet labelled.",
    repo: "AI-Analytics",
    stack: ["Python", "Streamlit", "LangChain", "Pandas", "Plotly", "Ollama (qwen3:4b)"],
    tags: ["agents", "data", "genai", "python"],
    overview:
      "A tool-calling data analyst. You upload a dataset, the app shows its shape and missing values, and a LangChain agent answers questions by choosing from 12 pandas-backed tools rather than writing free-form code.",
    problem: "Non-programmers with a spreadsheet want answers and charts without writing pandas.",
    solution:
      "Constrain the model to a small, typed set of data, statistics and chart tools, and instruct it never to invent numbers.",
    features: [
      "CSV and Excel loaders; dataset info, missing-value and summary-statistics tools",
      "Sum, average, median, standard deviation and correlation tools",
      "Plotly bar, pie, histogram and line chart tools",
      "System prompt: always use the tools, never make up numerical results, use exact column names",
    ],
    howItWorks: [
      "Streamlit loads the file into a DataFrame and builds the agent over it.",
      "create_agent wires a ChatOllama (qwen3:4b, temperature 0) to the 12 tools.",
      "The agent calls tools and explains the result; chart tools return Plotly figures.",
    ],
    architecture: [
      ["Streamlit UI | upload · chat"],
      ["LangChain agent | qwen3:4b via Ollama"],
      ["Data tools", "Statistics tools", "Chart tools"],
      ["pandas DataFrame"],
    ],
    contribution:
      "Sole committer on the repository (4 commits, 2026-08-25 → 2026-08-30). What it implements: the CSV/Excel loaders, the 12 tools, the LangChain agent wiring and the Streamlit interface, as committed.",
    challenges: [
      {
        title: "Numbers come from tools, but the prose around them can drift",
        detail:
          "The average SepalLengthCm came back as 5.843333333333334, identical to pandas, because the agent called a tool instead of estimating. For a chart request the chart itself was correct, yet the 4B model's accompanying text wandered into an unrelated scikit-learn example. Tool results are trustworthy; free-form narration from a small local model is not.",
      },
    ],
    future: [
      "Add tests for the tools and a fixed evaluation question set",
      "Show only the tool result for chart requests, or constrain the narration",
      "Support multiple files / joins",
      "Show which tool calls produced each answer",
    ],
    facts: [
      { label: "Tools", value: "12 (5 data · 3 statistics · 4 chart)" },
      { label: "Local run", value: "average question answered in about 33 s; histogram in about 59 s (2026-10-01)" },
    ],
    screenshots: [
      {
        src: "/projects/ai-analytics/answer.webp",
        alt: "AI Analytics Agent with Iris.csv loaded and the answer to what the average SepalLengthCm is",
        caption: "Real output from a local run on the Iris dataset (2026-10-01); the value matches pandas.",
      },
    ],
    demo: { kind: "none", note: "Needs a local Qwen3 model through Ollama, so it is not hosted. The screenshot comes from a real local run." },
    verification:
      "Run locally on 2026-10-01 (Python 3.11, Ollama qwen3:4b, Iris.csv): the file loads, the average question returned 5.843333333333334 (matches pandas), and a histogram request rendered a real Plotly chart; no console errors.",
    needs: ["Python 3.11+", "Ollama with qwen3:4b"],
    runLocally: [
      "git clone https://github.com/uppadadhiraj/AI-Analytics.git && cd AI-Analytics",
      "pip install -r requirements.txt && ollama pull qwen3:4b",
      "streamlit run app.py",
    ],
  },
];

/** Smaller repositories shown in OTHER PROJECTS (compact cards). */
export interface OtherProject {
  slug: string;
  name: string;
  repo: string;
  blurb: string;
  stack: string[];
  status: Project["status"];
  /** a fact from the README/notebook that can be checked in the repo */
  note?: string;
  created?: string;
}

export const otherProjects: OtherProject[] = [
  {
    slug: "student-management-system",
    name: "Student Management System",
    repo: "student-management-system",
    blurb: "Add, view and delete students — a web app in plain Java (JDK HttpServer + JDBC), MySQL, HTML and CSS with no frameworks.",
    stack: ["Java", "JDBC", "MySQL", "HTML/CSS"],
    status: "LOCAL ONLY",
    note: "No frameworks by design: routing, pages and database access are all in one file.",
  },
  {
    slug: "scraper-chatbot",
    name: "Scraper Chatbot",
    repo: "Scraper-Chatbot",
    blurb: "Streamlit scraper that extracts a page's title, same-site links and text. The RAG modules (chromadb / embedding / retrieval) are empty placeholders, so there is no chatbot yet.",
    stack: ["Python", "Streamlit", "BeautifulSoup"],
    status: "EXPERIMENTAL",
    note: "Work in progress — the scraper works; the RAG layer is not implemented.",
  },
  {
    slug: "pdf-reader-ollama",
    name: "PDF Reader (Ollama)",
    repo: "PDF-Reader-Ollama-",
    blurb: "Streamlit chatbot that answers questions from an uploaded PDF using pypdf and DeepSeek-R1:8B through LangChain-Ollama.",
    stack: ["Python", "Streamlit", "LangChain", "Ollama"],
    status: "LOCAL ONLY",
  },
  {
    slug: "movie-recommendations",
    name: "Movie Recommender",
    repo: "Movie-Recommendations",
    blurb: "TMDB 5000 movie recommender: notebook builds the similarity assets, a Streamlit app serves recommendations.",
    stack: ["Python", "pandas", "scikit-learn", "Streamlit"],
    status: "LOCAL ONLY",
  },
  {
    slug: "iris-predictor",
    name: "Iris Predictor",
    repo: "Iris-Predictor",
    blurb: "Streamlit app that predicts iris species from four measurements using a pickled model and label encoder.",
    stack: ["Python", "scikit-learn", "Streamlit"],
    status: "LOCAL ONLY",
  },
  {
    slug: "house-prediction",
    name: "House Price Prediction (XGBoost)",
    repo: "House-Prediction",
    blurb: "Kaggle “House Prices” workflow: EDA, preprocessing, feature engineering and an XGBoost regressor with cross-validation.",
    stack: ["Python", "XGBoost", "pandas"],
    status: "ARCHIVED",
    note: "Notebook reports RMSE 0.1337 and R² 0.9042.",
  },
  {
    slug: "spam-ham-mail-checker",
    name: "Spam Mail Classifier",
    repo: "Spam-Ham-mail-checker",
    blurb: "Text-classification notebook on a Kaggle email-spam dataset with vectorisation and classical models.",
    stack: ["Python", "scikit-learn", "pandas"],
    status: "ARCHIVED",
    note: "Notebook prints accuracies of 0.989 and 0.986 for two models.",
  },
  {
    slug: "heart-disease-predictor",
    name: "Heart Disease Predictor",
    repo: "Heart-Disease-Predictor",
    blurb: "End-to-end ML notebook on the UCI heart-disease data: imputation, scaling, encoding, model training and evaluation.",
    stack: ["Python", "scikit-learn", "pandas"],
    status: "ARCHIVED",
  },
  {
    slug: "titanic-ship-survival",
    name: "Titanic Survival Analysis",
    repo: "Titanic_Ship_Survival",
    blurb: "EDA, feature engineering and survival prediction, ending in a YData Profiling HTML report.",
    stack: ["Python", "pandas", "seaborn", "scikit-learn"],
    status: "ARCHIVED",
  },
  {
    slug: "netflix-content-eda",
    name: "Netflix Content EDA",
    repo: "Netflix-Content-EDA",
    blurb: "Exploratory analysis of the Netflix catalogue: release year vs year added, movies vs TV shows, genres.",
    stack: ["Python", "pandas", "matplotlib"],
    status: "ARCHIVED",
  },
  {
    slug: "sct-ml-1",
    name: "House Price · Linear Regression",
    repo: "SCT_ML_1",
    blurb: "Task 01 of the SkillCraft Technology internship program: linear regression on square footage, bedrooms and bathrooms.",
    stack: ["Python", "pandas", "scikit-learn"],
    status: "ARCHIVED",
    note: "Notebook reports R² 0.658.",
  },
  {
    slug: "linear-regression-from-scratch",
    name: "Linear Regression from Scratch",
    repo: "linear-regression-from-scratch",
    blurb: "Gradient-descent linear regression derived by hand and implemented with NumPy only, with a fitted-line plot.",
    stack: ["Python", "NumPy", "matplotlib"],
    status: "ARCHIVED",
  },
  {
    slug: "logistic-regression-from-scratch",
    name: "Logistic Regression from Scratch",
    repo: "logistic-regression-from-scratch",
    blurb: "Logistic regression implemented from the formulas up and tested on the diabetes dataset.",
    stack: ["Python", "NumPy"],
    status: "ARCHIVED",
  },
  {
    slug: "genai-basics",
    name: "GenAI Basics",
    repo: "genai-basics",
    blurb: "Notebooks on calling LLMs and on prompting types.",
    stack: ["Python", "Jupyter"],
    status: "ARCHIVED",
  },
];

export const projectBySlug = (slug: string): Project | undefined => projects.find((p) => p.slug === slug);
export const featuredProjects = (): Project[] => projects.filter((p) => p.featured);
export const builtProjects = (): Project[] => projects.filter((p) => p.category === "built");
export const importantProjects = (): Project[] => projects.filter((p) => p.category === "important");
