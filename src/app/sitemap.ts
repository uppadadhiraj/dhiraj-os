import type { MetadataRoute } from "next";
import { APPS } from "@/lib/apps-meta";
import { projects } from "@/data/projects";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: siteUrl, lastModified: now, changeFrequency: "monthly", priority: 1 },
    // the hidden easter-egg app is intentionally not advertised
    ...APPS.filter((a) => a.id !== "hidden").map((a) => ({
      url: `${siteUrl}/${a.path}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: a.id === "projects" || a.id === "about" ? 0.9 : 0.6,
    })),
    ...projects.map((p) => ({
      url: `${siteUrl}/projects/${p.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: p.featured ? 0.8 : 0.6,
    })),
  ];
}
