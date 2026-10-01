"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import type { Development, Status } from "@/data/types";
import { PixelIcon } from "@/components/os/PixelIcon";
import { cn } from "@/lib/cn";

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={cn("pill", className)} data-status={status} title={statusHelp[status]}>
      <span className="dot" aria-hidden="true" />
      {status}
    </span>
  );
}

export const statusHelp: Record<Status, string> = {
  LIVE: "Deployed and exercised in a browser",
  DEMO: "Runs online in a limited demo mode (see the note on the project)",
  "LOCAL ONLY": "Runs locally; not hosted publicly",
  HARDWARE: "Needs physical hardware",
  EXPERIMENTAL: "Work in progress or exploratory",
  ARCHIVED: "Finished learning project, kept for reference",
};

export function DevBadge({ development }: { development: Development }) {
  if (development === "hand-built") {
    return (
      <span className="pill" data-kind="own" title="Written by me. I sometimes asked an LLM for help when I got stuck; the project is not AI-generated.">
        HAND-BUILT
      </span>
    );
  }
  if (development !== "ai-assisted") return null;
  return (
    <span className="pill" data-kind="ai" title="Built with AI coding tools; disclosed in the repository">
      <svg width="10" height="10" viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M4 0h2v3h3v2H6v1H4V5H1V3h3z M5 6h1v2h2v2H5z" fillRule="evenodd" />
      </svg>
      AI-ASSISTED
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="pill" data-kind="tag">
      {children}
    </span>
  );
}

/** A tag-styled external link (used for repositories that have no write-up window). */
export function TagLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="pill no-underline hover:bg-[#dbe6ff]" data-kind="tag">
      {children}
      <span className="sr-only"> (opens GitHub in a new tab)</span>
      <span aria-hidden="true">↗</span>
    </a>
  );
}

/** External link with a visible icon and a screen-reader hint. */
export function ExtLink({
  href,
  children,
  className,
  variant = "link",
}: {
  href: string;
  children: ReactNode;
  className?: string;
  variant?: "link" | "button" | "primary";
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(variant === "link" ? "" : cn("btn", variant === "primary" && "btn-primary"), className)}
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
      <span aria-hidden="true" style={{ display: "inline-block", marginLeft: variant === "link" ? 3 : 0, verticalAlign: "-2px" }}>
        <PixelIcon name="external" size={14} />
      </span>
    </a>
  );
}

export function Progress({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export interface TabDef {
  id: string;
  label: string;
}

/** Accessible tablist (roving tabindex, arrow/Home/End keys). Pair with <TabPanel>. */
export function Tabs({
  tabs,
  value,
  onChange,
  label,
  idBase,
}: {
  tabs: TabDef[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  idBase: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      onChange(tabs[next].id);
      refs.current[tabs[next].id]?.focus();
    }
  };
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[t.id] = el;
          }}
          type="button"
          role="tab"
          id={`${idBase}-tab-${t.id}`}
          aria-selected={value === t.id}
          aria-controls={`${idBase}-panel-${t.id}`}
          tabIndex={value === t.id ? 0 : -1}
          className="tab"
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({
  idBase,
  id,
  active,
  children,
  className,
}: {
  idBase: string;
  id: string;
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (!active) return null;
  return (
    <div role="tabpanel" id={`${idBase}-panel-${id}`} aria-labelledby={`${idBase}-tab-${id}`} tabIndex={0} className={className}>
      {children}
    </div>
  );
}

/** Retro "system dialog" body: icon + message + actions. */
export function DialogBody({
  icon,
  title,
  children,
  actions,
}: {
  icon: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 bg-[var(--c-face)] p-4">
      <div className="flex gap-4">
        <PixelIcon name={icon} size={40} />
        <div className="min-w-0 flex-1">
          <p className="m-0 font-[family-name:var(--font-pixel)] text-[17px] leading-tight text-[var(--c-ink)]">{title}</p>
          <div className="mt-2 text-[14px] leading-relaxed text-[var(--c-ink-2)]">{children}</div>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap justify-end gap-2">{actions}</div> : null}
    </div>
  );
}

export function useStableId(prefix: string): string {
  return `${prefix}-${useId().replace(/:/g, "")}`;
}
