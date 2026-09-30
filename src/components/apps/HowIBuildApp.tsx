"use client";

import { useState } from "react";
import { workflow } from "@/data/profile";
import { Pane } from "./common";

export function HowIBuildApp() {
  const [i, setI] = useState(0);
  const cur = workflow[i];
  return (
    <Pane label="How I build">
      <h1>HOW I BUILD</h1>
      <p className="!mt-0">
        A loop, not a line. This is how I like to work — a philosophy, not a claim that every project followed every step.
      </p>

      <ol className="m-0 grid list-none grid-cols-2 gap-x-2 gap-y-3 p-0 sm:grid-cols-4" style={{ maxWidth: "none" }} aria-label="Workflow steps">
        {workflow.map((w, idx) => (
          <li key={w.step} className="relative">
            <button
              type="button"
              className="btn w-full !justify-start !py-3 text-left"
              aria-pressed={i === idx}
              aria-label={`Step ${idx + 1}: ${w.step}`}
              onClick={() => setI(idx)}
            >
              <span className="inline-grid h-6 w-6 shrink-0 place-items-center bg-[var(--c-navy)] text-[12px] text-white">{idx + 1}</span>
              {w.step}
            </button>
            {idx < workflow.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute -right-[11px] top-1/2 z-[1] hidden -translate-y-1/2 text-[16px] text-[var(--c-navy-2)] sm:block"
                style={{ display: idx === 3 ? "none" : undefined }}
              >
                ▶
              </span>
            )}
          </li>
        ))}
      </ol>
      <p aria-hidden="true" className="!my-1 text-center font-[family-name:var(--font-pixel)] text-[14px] text-[var(--c-navy-2)]">
        ↩ and back to IDEA — every limitation written down becomes the next idea ↩
      </p>

      <div className="groupbox mt-4" role="region" aria-live="polite" aria-label="Selected step">
        <span className="groupbox-label">
          {i + 1}. {cur.step}
        </span>
        <p className="!mt-0 text-[16px]">{cur.text}</p>
        {cur.evidence ? (
          <p className="!mb-0 text-[14px]">
            <b>Evidence:</b> {cur.evidence}
          </p>
        ) : null}
      </div>
    </Pane>
  );
}
