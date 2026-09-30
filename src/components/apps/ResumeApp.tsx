"use client";

import { PixelIcon } from "@/components/os/PixelIcon";
import { ResumeView } from "./ResumeView";

export const RESUME_PDF = "/Dhiraj_Reddy_Resume.pdf";

export function ResumeApp() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 bg-[var(--c-face)] px-2 py-1.5">
        <a className="btn btn-primary btn-sm" href={RESUME_PDF} download="Dhiraj_Reddy_Resume.pdf">
          <PixelIcon name="disk" size={14} /> Download PDF
        </a>
        <a className="btn btn-sm" href={RESUME_PDF} target="_blank" rel="noopener noreferrer">
          <PixelIcon name="external" size={14} /> Open PDF<span className="sr-only"> (opens in a new tab)</span>
        </a>
        <a className="btn btn-sm" href="/resume/print" target="_blank" rel="noopener noreferrer">
          Print view<span className="sr-only"> (opens in a new tab)</span>
        </a>
        <span className="text-[12px] text-[var(--c-ink-2)]">Generated from the same data as this site.</span>
      </div>
      <div className="pane" style={{ flex: 1, background: "#7d8190" }} role="region" aria-label="Résumé preview" tabIndex={0}>
        <div className="mx-auto my-3 max-w-[760px]" style={{ boxShadow: "4px 5px 0 rgba(0,0,0,.35)" }}>
          <ResumeView />
        </div>
      </div>
    </div>
  );
}
