/**
 * Skills are grouped, and each one says where it was actually used.
 * level "used"      → appears in at least one public project (evidence lists the slugs).
 * level "familiar"  → something I know, listed on my resume or stated by me, with no public project yet.
 */
export interface Skill {
  name: string;
  level: "used" | "familiar";
  evidence: string[];
}
export interface SkillGroup {
  group: string;
  skills: Skill[];
}

const used = (name: string, ...evidence: string[]): Skill => ({ name, level: "used", evidence });
const familiar = (name: string): Skill => ({ name, level: "familiar", evidence: [] });

export const skillGroups: SkillGroup[] = [
  {
    group: "Languages",
    skills: [
      used("Python", "verascope", "scoutlens", "study-buddy", "fake-news-predictor", "ai-analytics"),
      used("Java", "student-management-system"),
      used("SQL", "job-application-tracker", "scarflow", "verascope"),
      familiar("C"),
    ],
  },
  {
    group: "AI / ML",
    skills: [
      used("Machine Learning", "fake-news-predictor", "house-prediction"),
      used("NLP", "fake-news-predictor", "spam-ham-mail-checker"),
      used("Computer Vision", "rainfoghaze", "smartride"),
      used("Generative AI", "interview-coach", "study-buddy", "scoutlens"),
      used("RAG", "study-buddy", "verascope"),
      used("AI Agents", "verascope", "scoutlens", "ai-analytics"),
      familiar("PydanticAI"),
    ],
  },
  {
    group: "Backend",
    skills: [
      used("FastAPI", "verascope", "job-application-tracker"),
      used("Django", "rainfoghaze"),
      used("SQLAlchemy", "verascope", "job-application-tracker"),
      used("REST API design", "verascope", "job-application-tracker"),
      familiar("Spring Boot"),
      familiar("Flask"),
    ],
  },
  {
    group: "Frontend",
    skills: [used("Streamlit", "study-buddy", "fake-news-predictor", "interview-coach", "ai-analytics", "iris-predictor", "movie-recommendations")],
  },
  {
    group: "Data",
    skills: [
      used("PostgreSQL", "verascope", "scarflow"),
      used("MySQL", "job-application-tracker", "student-management-system"),
      used("SQLite", "scoutlens"),
      used("ChromaDB", "study-buddy", "verascope"),
      used("pandas / NumPy / Matplotlib", "ai-analytics", "house-prediction"),
      familiar("MongoDB"),
      familiar("Power BI"),
    ],
  },
  {
    group: "Tools",
    skills: [
      used("Docker", "verascope"),
      used("Git & GitHub", "study-buddy", "fake-news-predictor", "interview-coach"),
      used("Claude Code (AI-assisted development)", "verascope", "scoutlens", "scarflow"),
      used("Ollama", "study-buddy", "interview-coach", "ai-analytics", "verascope"),
      used("LangChain", "study-buddy", "interview-coach", "ai-analytics"),
      used("Playwright / pytest", "scarflow", "scoutlens", "verascope"),
    ],
  },
];

export const skillCount = () => skillGroups.reduce((n, g) => n + g.skills.length, 0);
