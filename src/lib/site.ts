import { profile } from "@/data/profile";

/**
 * Canonical site URL. On Vercel the production domain is injected at build time;
 * set NEXT_PUBLIC_SITE_URL to override (for example once a custom domain exists).
 */
export const siteUrl: string =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const siteTitle = `${profile.displayName} — ${profile.role}`;

export const siteDescription =
  "Portfolio of Dhiraj Reddy, a computer science undergraduate in Hyderabad building AI agents, RAG apps, computer-vision tools and backend systems. Explore it as a retro desktop and run the projects.";

export const githubRepoUrl = "https://github.com/uppadadhiraj/dhiraj-os";
