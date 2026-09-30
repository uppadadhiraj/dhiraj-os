import { APPS } from "@/lib/apps-meta";
import { profile } from "@/data/profile";
import { projects, otherProjects } from "@/data/projects";

/**
 * A real, semantic document behind the desktop: one h1, headings and links for every
 * project and section. It is what crawlers and screen-reader "browse mode" users read.
 * Links are out of the tab order so keyboard users land on the desktop first.
 */
export function SeoOutline() {
  return (
    <main className="sr-only" aria-label="Portfolio outline">
      <h1>
        {profile.displayName} — {profile.role}
      </h1>
      <p>
        {profile.summary} Based in {profile.location}. {profile.status}.
      </p>

      <h2>Featured and selected projects</h2>
      <ul>
        {projects.map((p) => (
          <li key={p.slug}>
            <a href={`/projects/${p.slug}`} tabIndex={-1}>
              {p.name}
            </a>{" "}
            — {p.tagline} Status: {p.status}. Stack: {p.stack.join(", ")}.
          </li>
        ))}
      </ul>

      <h2>Other projects</h2>
      <ul>
        {otherProjects.map((p) => (
          <li key={p.slug}>
            {p.name} — {p.blurb}
          </li>
        ))}
      </ul>

      <h2>Sections</h2>
      <ul>
        {APPS.filter((a) => a.id !== "hidden").map((a) => (
          <li key={a.id}>
            <a href={`/${a.path}`} tabIndex={-1}>
              {a.title}
            </a>{" "}
            — {a.blurb}
          </li>
        ))}
      </ul>

      <h2>Contact</h2>
      <p>
        Email {profile.email}. GitHub {profile.github.url}. LinkedIn {profile.linkedin}.
      </p>
    </main>
  );
}
