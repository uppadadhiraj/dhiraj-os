"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Screenshot } from "@/data/types";

/**
 * Screenshot gallery: thumbnails + an in-pane viewer with keyboard support.
 * Images are lazy-loaded and only the active one is requested at full size.
 */
export function Gallery({ shots, projectName }: { shots: Screenshot[]; projectName: string }) {
  const [idx, setIdx] = useState<number | null>(null);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const viewerRef = useRef<HTMLDivElement>(null);
  const isOpen = idx !== null;
  // move focus into the viewer once when it opens (not on every re-render)
  useEffect(() => {
    if (isOpen) viewerRef.current?.focus();
  }, [isOpen]);
  const visible = shots.filter((s) => !broken.has(s.src));
  if (visible.length === 0) return <p>No screenshots available for this project.</p>;

  const step = (d: number) => setIdx((i) => (i === null ? i : (i + d + visible.length) % visible.length));
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "Escape") {
      e.stopPropagation();
      setIdx(null);
    }
  };
  const markBroken = (src: string) => setBroken((b) => new Set(b).add(src));

  return (
    <div>
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3" style={{ maxWidth: "none" }}>
        {visible.map((s, i) => (
          <li key={s.src}>
            <button
              type="button"
              className="bevel-in block w-full p-0"
              style={{ aspectRatio: "16 / 10", overflow: "hidden", background: "#fff" }}
              onClick={() => setIdx(i)}
              aria-label={`Open screenshot ${i + 1} of ${visible.length}: ${s.alt}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.src}
                alt=""
                loading="lazy"
                decoding="async"
                onError={() => markBroken(s.src)}
                className="h-full w-full object-cover object-top"
              />
            </button>
          </li>
        ))}
      </ul>

      {idx !== null && visible[idx] && (
        <div
          role="dialog"
          aria-label={`${projectName} screenshot viewer`}
          aria-modal="true"
          tabIndex={-1}
          onKeyDown={onKey}
          ref={viewerRef}
          className="absolute inset-0 z-10 flex flex-col bg-[var(--c-face)] p-2"
        >
          <div className="flex items-center gap-2 pb-2">
            <span className="flex-1 text-[13px]">
              {idx + 1} / {visible.length} — {visible[idx].alt}
            </span>
            <button type="button" className="btn btn-sm" onClick={() => step(-1)} aria-label="Previous screenshot">
              ◀
            </button>
            <button type="button" className="btn btn-sm" onClick={() => step(1)} aria-label="Next screenshot">
              ▶
            </button>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setIdx(null)}>
              Close
            </button>
          </div>
          <div className="bevel-in min-h-0 flex-1 overflow-auto bg-white p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={visible[idx].src} alt={visible[idx].alt} decoding="async" className="mx-auto block max-w-full" />
          </div>
          {visible[idx].caption ? <p className="m-0 pt-2 text-[12.5px] text-[var(--c-ink-2)]">{visible[idx].caption}</p> : null}
        </div>
      )}
    </div>
  );
}
