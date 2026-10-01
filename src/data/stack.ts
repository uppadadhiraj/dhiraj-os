/**
 * STACK.exe — how the technologies relate and which projects use each one.
 * Every leaf lists the project slugs that really use it (see data/projects.ts).
 */
export interface StackLeaf {
  name: string;
  projects: string[];
}
export interface StackBranch {
  name: string;
  /** css colour token key used by the graph */
  tone: "python" | "java" | "web" | "data" | "ai" | "infra";
  leaves: StackLeaf[];
}

export const stackTree: StackBranch[] = [
  {
    name: "Python",
    tone: "python",
    leaves: [
      { name: "FastAPI", projects: ["verascope", "job-application-tracker"] },
      { name: "Django", projects: ["rainfoghaze"] },
      { name: "Streamlit", projects: ["scoutlens", "study-buddy", "fake-news-predictor", "interview-coach", "ai-analytics", "job-application-tracker"] },
      { name: "LangChain", projects: ["study-buddy", "interview-coach", "ai-analytics"] },
      { name: "Pydantic", projects: ["scoutlens", "verascope", "job-application-tracker"] },
      { name: "OpenCV", projects: ["rainfoghaze"] },
      { name: "scikit-learn", projects: ["fake-news-predictor"] },
      { name: "pandas", projects: ["ai-analytics"] },
    ],
  },
  {
    name: "TS / JS (AI-assisted)",
    tone: "web",
    leaves: [
      { name: "React", projects: ["verascope", "scarflow"] },
      { name: "Next.js", projects: ["scarflow"] },
      { name: "Tailwind CSS", projects: ["verascope", "scarflow"] },
      { name: "Playwright", projects: ["scarflow"] },
    ],
  },
  {
    name: "Java",
    tone: "java",
    leaves: [{ name: "JDBC + HttpServer", projects: ["student-management-system"] }],
  },
  {
    name: "Data",
    tone: "data",
    leaves: [
      { name: "PostgreSQL", projects: ["verascope", "scarflow"] },
      { name: "MySQL", projects: ["job-application-tracker", "student-management-system"] },
      { name: "SQLite", projects: ["scoutlens"] },
      { name: "ChromaDB", projects: ["verascope", "study-buddy"] },
    ],
  },
  {
    name: "AI runtime",
    tone: "ai",
    leaves: [
      { name: "Ollama", projects: ["verascope", "study-buddy", "interview-coach", "ai-analytics", "rainfoghaze", "scoutlens"] },
      { name: "LLaVA", projects: ["rainfoghaze"] },
      { name: "SerpApi", projects: ["scoutlens"] },
      { name: "YOLOv8 · MediaPipe", projects: ["smartride"] },
    ],
  },
  {
    name: "Infra",
    tone: "infra",
    leaves: [
      { name: "Docker", projects: ["verascope"] },
      { name: "Supabase", projects: ["scarflow"] },
      { name: "Inngest", projects: ["scarflow"] },
    ],
  },
];
