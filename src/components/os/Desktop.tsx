"use client";

import { useRef, type KeyboardEvent, type MouseEvent } from "react";
import { DESKTOP_APPS } from "@/lib/apps-meta";
import { exploring } from "@/data/profile";
import { PixelIcon } from "./PixelIcon";
import { Wallpaper } from "./Wallpaper";
import { useWm } from "./WindowManager";
import { useSiteStats } from "./SiteContext";

export function Desktop() {
  const { open } = useWm();
  const gridRef = useRef<HTMLElement>(null);
  const stats = useSiteStats();

  const onIconClick = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    // let modified clicks open the real URL in a new tab; plain clicks open a window
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    open(id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const keys = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const icons = [...(gridRef.current?.querySelectorAll<HTMLElement>("a.desk-icon") ?? [])];
    const i = icons.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    const perCol = Math.max(1, Math.floor((window.innerHeight - 40 - 24) / 104));
    let n = i;
    if (e.key === "ArrowDown") n = i + 1;
    if (e.key === "ArrowUp") n = i - 1;
    if (e.key === "ArrowRight") n = i + perCol;
    if (e.key === "ArrowLeft") n = i - perCol;
    if (e.key === "Home") n = 0;
    if (e.key === "End") n = icons.length - 1;
    icons[Math.min(icons.length - 1, Math.max(0, n))]?.focus();
  };

  return (
    <div className="absolute inset-0" id="desktop">
      <Wallpaper />
      <nav ref={gridRef} className="desk-icons" aria-label="Desktop applications" onKeyDown={onKeyDown}>
        {DESKTOP_APPS.map((app) => (
          <a
            key={app.id}
            href={`/${app.path}`}
            className="desk-icon"
            data-hero={app.desktop?.hero ? "true" : undefined}
            onClick={onIconClick(app.id)}
            title={app.blurb}
          >
            <PixelIcon name={app.icon} size={48} className="desk-icon-art" />
            <span className="desk-icon-label">{app.desktop?.label}</span>
          </a>
        ))}
      </nav>

      <aside className="now-building" aria-label="What I'm building">
        <div className="win-title" style={{ background: "var(--title-inactive)", height: 22, fontSize: 13 }}>
          <PixelIcon name="gear" size={14} />
          <span className="win-title-text">NOW BUILDING</span>
        </div>
        <div className="p-2">
          <p className="m-0 mb-2 text-[12px] leading-snug text-[var(--c-ink-2)]">
            Currently exploring — each opens the matching projects.
          </p>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {exploring.map((x) => (
              <li key={x.key}>
                <button type="button" className="btn btn-sm" onClick={() => open("projects", { tab: "featured", tag: x.key })}>
                  {x.label}
                </button>
              </li>
            ))}
          </ul>
          <p className="m-0 mt-2 text-[11.5px] text-[var(--c-ink-2)]">
            {stats.originalRepos} public repos on GitHub
          </p>
        </div>
      </aside>
    </div>
  );
}
