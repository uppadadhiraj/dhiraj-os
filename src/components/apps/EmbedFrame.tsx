"use client";

import { useEffect, useState } from "react";
import { PixelIcon } from "@/components/os/PixelIcon";
import { useWindowContext } from "@/components/os/Window";
import { ExtLink } from "@/components/ui";

const SLOW_MS = 20_000;

/**
 * Embeds a real, running application in an iframe — only when the window is opened
 * (nothing loads at page load). If the site refuses to be framed, or a free-tier host
 * is cold-starting, the visitor gets a clear fallback and an "open in a new tab" link.
 * We deliberately do not try to circumvent framing restrictions.
 */
export function EmbedFrame({ url, title, appName }: { url: string; title: string; appName: string }) {
  const [state, setState] = useState<"loading" | "loaded" | "slow">("loading");
  const [nonce, setNonce] = useState(0);
  const { active } = useWindowContext();

  useEffect(() => {
    const t = window.setTimeout(() => setState((s) => (s === "loading" ? "slow" : s)), SLOW_MS);
    return () => window.clearTimeout(t);
  }, [nonce, url]);

  const reload = () => {
    setState("loading");
    setNonce((n) => n + 1);
  };

  // `/demos/…` bundles are served by this site and run in the visitor's browser (stlite/WebAssembly)
  const inBrowser = url.startsWith("/");
  let host = inBrowser ? "Runs in your browser (WebAssembly)" : url;
  if (!inBrowser) {
    try {
      host = new URL(url).host;
    } catch {
      /* keep raw */
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 bg-[var(--c-face)] px-2 py-1.5">
        <button type="button" className="btn btn-sm" onClick={reload} aria-label={`Reload ${appName}`}>
          ↻ Reload
        </button>
        <ExtLink href={url} variant="button" className="btn-sm">
          Open full application
        </ExtLink>
        <span className="field !w-auto min-w-0 flex-1 truncate !py-[3px] !text-[12px]" aria-label="Address" role="textbox" aria-readonly="true">
          {host}
        </span>
      </div>

      <div className="bevel-in relative min-h-0 flex-1 bg-white">
        <iframe
          key={nonce}
          src={url}
          title={title}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
          referrerPolicy="no-referrer"
          allow="clipboard-write"
          onLoad={() => setState("loaded")}
          className="absolute inset-0 h-full w-full border-0 bg-white"
        />

        {/* first click on an inactive window should focus the window, not the iframe */}
        {!active && <div className="absolute inset-0 z-[2]" aria-hidden="true" />}

        {state === "loading" && (
          <div className="absolute inset-0 z-[3] grid place-items-center bg-[var(--c-face)] p-4" role="status" aria-live="polite">
            <div className="w-full max-w-[380px]">
              <p className="mb-3 font-[family-name:var(--font-pixel)] text-[16px]">Starting {appName}…</p>
              <div className="progress" aria-hidden="true">
                <div style={{ width: "100%", animation: "boot-fill 1.6s steps(12) infinite" }} />
              </div>
              <p className="mt-3 text-[12.5px] text-[var(--c-ink-2)]">
                {inBrowser
                  ? "This app runs inside your browser, so the first load downloads the Python runtime (about 10 MB) and can take up to a minute."
                  : "Free-tier hosts sleep when idle, so the first load can take up to a minute."}
              </p>
            </div>
          </div>
        )}

        {state === "slow" && (
          <div className="absolute inset-0 z-[3] grid place-items-center overflow-auto bg-[var(--c-face)] p-4" role="alert">
            <div className="dialog" style={{ width: "min(440px, 100%)" }}>
              <div className="win-title" style={{ background: "var(--title-active)", color: "#fff" }}>
                <PixelIcon name="warn" size={16} />
                <span className="win-title-text">Still waiting…</span>
              </div>
              <div className="flex flex-col gap-3 bg-[var(--c-face)] p-4 text-[14px] leading-relaxed">
                <p className="m-0">
                  {appName} hasn&apos;t responded yet. The host may be waking from sleep, or it may refuse to be shown inside another page.
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" className="btn" onClick={reload}>
                    Retry
                  </button>
                  <ExtLink href={url} variant="primary">
                    Open full application
                  </ExtLink>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
