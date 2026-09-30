"use client";

import { useEffect } from "react";
import { PixelIcon } from "@/components/os/PixelIcon";
import { profile } from "@/data/profile";

/** Route-level error boundary. Visitors get a retro SYSTEM ERROR dialog, never a stack trace. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="os-root">
      <main className="absolute inset-0 grid place-items-center p-4">
        <div className="dialog" style={{ width: "min(480px, 100%)" }} role="alertdialog" aria-labelledby="err-title">
          <div className="win-title" style={{ background: "var(--title-active)", color: "#fff" }}>
            <PixelIcon name="error" size={16} />
            <span className="win-title-text">SYSTEM ERROR</span>
          </div>
          <div className="flex flex-col gap-4 bg-[var(--c-face)] p-4">
            <div className="flex gap-4">
              <PixelIcon name="error" size={44} />
              <div>
                <h1 id="err-title" className="m-0 font-[family-name:var(--font-pixel)] text-[20px] leading-tight text-[var(--c-ink)]">
                  Application failed to load
                </h1>
                <p className="mb-0 mt-2 text-[14px] leading-relaxed text-[var(--c-ink-2)]">
                  Possible causes: a flaky network, a stale cache, or a bug on my side. Retrying usually works.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="btn btn-primary" onClick={() => retry()}>
                Retry
              </button>
              <a className="btn" href={profile.github.url} target="_blank" rel="noopener noreferrer">
                Open GitHub
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
