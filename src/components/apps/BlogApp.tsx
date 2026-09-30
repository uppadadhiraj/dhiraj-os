"use client";

import { profile } from "@/data/profile";
import { EmbedFrame } from "./EmbedFrame";

/** My blog (a separate Astro site on GitHub Pages) embedded as a real, running site. */
export function BlogApp() {
  return <EmbedFrame url={profile.blog.url} title={`${profile.blog.name} — my blog`} appName={profile.blog.name} />;
}
