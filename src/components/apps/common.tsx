"use client";

import { useState, type ReactNode } from "react";
import { PixelIcon } from "@/components/os/PixelIcon";
import { cn } from "@/lib/cn";

/** Standard scrolling content surface used by most apps. */
export function Pane({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div className="pane" role="region" aria-label={label} tabIndex={0}>
      <div className={cn("pane-inner prose-os", className)}>{children}</div>
    </div>
  );
}

export function StatusBar({ items }: { items: ReactNode[] }) {
  return (
    <div className="statusbar" role="status">
      {items.map((it, i) => (
        <span key={i} className={i === 0 ? "flex-1" : undefined}>
          {it}
        </span>
      ))}
    </div>
  );
}

/** Copy-to-clipboard button with an honest fallback when the Clipboard API is unavailable. */
export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("fail");
    }
    window.setTimeout(() => setState("idle"), 1800);
  };
  return (
    <button type="button" className={cn("btn btn-sm", className)} onClick={copy} aria-live="polite">
      <PixelIcon name="disk" size={14} />
      {state === "done" ? "Copied" : state === "fail" ? "Copy failed — select manually" : label}
    </button>
  );
}

/** Pixel monogram used where a portrait would be. No photo is implied. */
export function Monogram({ size = 96, label = "DR" }: { size?: number; label?: string }) {
  return (
    <div
      role="img"
      aria-label="Dhiraj Reddy monogram"
      className="grid shrink-0 place-items-center text-[#ffd23f]"
      style={{
        width: size,
        height: size,
        background:
          "linear-gradient(135deg, #0a1f7a 0%, #1f4fb5 100%)",
        fontFamily: "var(--font-pixel)",
        fontSize: size * 0.42,
        letterSpacing: "0.04em",
        boxShadow: "inset 2px 2px #6f8fe0, inset -2px -2px #050a30, 3px 3px 0 rgba(0,0,0,.25)",
      }}
    >
      {label}
    </div>
  );
}

export function SectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="!mb-2 !mt-6 flex items-center gap-2">
      <span aria-hidden="true" className="inline-block h-[10px] w-[10px] bg-[var(--c-amber)]" style={{ boxShadow: "inset -1px -1px #b37a00" }} />
      {children}
    </h2>
  );
}
