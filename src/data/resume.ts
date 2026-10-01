import { profile } from "./profile";

/**
 * The résumé content. It is generated from the same verified facts as the rest of the
 * site and from the owner's own résumé; nothing is added that the repositories or the
 * owner's résumé do not support. Phone number and street address are intentionally left out.
 */
export const resume = {
  name: profile.name,
  headline: `${profile.role} · B.Tech Computer Science, 2027`,
  contact: [
    profile.location,
    profile.email,
    `github.com/${profile.github.user}`,
    "linkedin.com/in/venkata-dhiraj-reddy-uppada-277bb828a",
  ],
  summary:
    "Computer Science undergraduate with hands-on experience building AI/ML and LLM-based applications in Python. Interested in AI engineering, software development and data/ML roles focused on building practical applications: agents that cite evidence, retrieval-based assistants, computer vision and backend systems.",
  education: [
    { title: "B.Tech, Computer Science & Engineering", place: "Vidya Jyothi Institute of Technology, Hyderabad", years: "2023 – 2027" },
    { title: "Intermediate (MPC)", place: "Resonance Junior College, Hyderabad", years: "2021 – 2023" },
  ],
  skills: [
    { label: "Languages", items: "Python, Java, SQL, C" },
    { label: "AI / ML", items: "Machine learning, NLP, RAG, AI agents, computer vision, scikit-learn, LangChain, Ollama, OpenCV" },
    { label: "Backend", items: "FastAPI, Django, SQLAlchemy, REST API design" },
    { label: "Frontend", items: "Streamlit" },
    { label: "Data", items: "PostgreSQL, MySQL, SQLite, ChromaDB, pandas, NumPy" },
    { label: "Tools", items: "Git & GitHub, Docker, Playwright, pytest, Claude Code (AI-assisted development)" },
  ],
  projects: [
    {
      name: "Verascope — AI repository intelligence & debugging platform",
      meta: "FastAPI · PostgreSQL · ChromaDB · React · Docker · Ollama · AI-assisted (vibe-coded with Claude)",
      bullets: [
        "Answers questions about a codebase with cited snippets; a debugging agent must report an evidence status or “insufficient evidence”.",
        "Fixes are tested in an isolated Docker sandbox and need human approval before any branch or PR; docs/VERIFICATION.md logs four test passes against real repositories.",
      ],
    },
    {
      name: "ScoutLens — opportunity-investigation agent",
      meta: "Python · Streamlit · Pydantic · SerpApi · SQLite · SerpApi India Hackathon 2026 · built with Claude Code",
      bullets: [
        "Investigates a job or internship with Google Search, Jobs and News results; every finding must cite retrieved evidence (“NO SOURCE = NO FACT”).",
        "592 automated tests pass without network access; live-checked against two real listings.",
      ],
    },
    {
      name: "SCARFLOW — supplier corrective-action (SCAR / 8D) workflow",
      meta: "Next.js 16 · TypeScript · Supabase (Postgres + RLS) · Inngest · Playwright · built with Claude Code",
      bullets: [
        "Multi-tenant SaaS: hashed magic-link supplier portal without accounts, audit rules enforced by database triggers, daily deadline sweep.",
        "Playwright suite covering the full workflow on desktop and mobile plus direct-API security attacks.",
      ],
    },
    {
      name: "SmartRide AI — two-wheeler rider-safety assistant (team of four)",
      meta: "Python · Raspberry Pi · YOLOv8 · MediaPipe · OpenCV · MPU6050",
      bullets: [
        "Implemented YOLOv8 object/helmet detection and MediaPipe hand tracking for real-time monitoring.",
        "Integrated MPU6050 motion sensing to trigger safety alerts through the camera–sensor pipeline.",
      ],
    },
    {
      name: "Fake News Predictor",
      meta: "Python · scikit-learn · TF-IDF · Streamlit",
      bullets: [
        "Text classifier (TF-IDF + logistic regression) trained on an Indian fake-news dataset of 3,729 labelled articles.",
        "Streamlit app that downloads an article from its URL and returns a FAKE/REAL label with a confidence score.",
      ],
    },
  ],
  openSource: "GirlScript Summer of Code 2026 — selected as a contributor for the AI Agent Track and Open Source Track.",
  note: "Generated from the same data as the portfolio at dhiraj-os. Phone number omitted on purpose — please use email.",
};
