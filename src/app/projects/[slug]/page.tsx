import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Os } from "@/components/os/Os";
import { SeoOutline } from "@/components/SeoOutline";
import { projectBySlug, projects } from "@/data/projects";
import { computeStats } from "@/lib/github-stats";

export const dynamicParams = false;

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = projectBySlug(slug);
  if (!p) return {};
  return {
    title: p.name,
    description: p.tagline,
    alternates: { canonical: `/projects/${p.slug}` },
    openGraph: { title: `${p.name} — Dhiraj Reddy`, description: p.tagline, url: `/projects/${p.slug}` },
  };
}

export default async function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  if (!projectBySlug(slug)) notFound();
  return (
    <>
      <Os initialTarget={`project:${slug}`} stats={computeStats()} />
      <SeoOutline />
    </>
  );
}
