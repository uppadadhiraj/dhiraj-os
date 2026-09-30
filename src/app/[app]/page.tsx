import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Os } from "@/components/os/Os";
import { SeoOutline } from "@/components/SeoOutline";
import { APPS, appByPath } from "@/lib/apps-meta";
import { computeStats } from "@/lib/github-stats";

export const dynamicParams = false;

export function generateStaticParams() {
  return APPS.map((a) => ({ app: a.path }));
}

export async function generateMetadata({ params }: PageProps<"/[app]">): Promise<Metadata> {
  const { app } = await params;
  const meta = appByPath(app);
  if (!meta) return {};
  const title = meta.title.replace(/\.exe$/i, "");
  return {
    title,
    description: meta.blurb,
    alternates: { canonical: `/${meta.path}` },
    // the hidden project is an easter egg: reachable by URL, not advertised to search engines
    robots: meta.id === "hidden" ? { index: false, follow: false } : undefined,
  };
}

export default async function AppPage({ params }: PageProps<"/[app]">) {
  const { app } = await params;
  const meta = appByPath(app);
  if (!meta) notFound();
  return (
    <>
      <Os initialTarget={meta.id} stats={computeStats()} />
      <SeoOutline />
    </>
  );
}
