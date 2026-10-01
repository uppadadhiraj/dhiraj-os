"use client";

import { demoSubject } from "@/data/projects";
import { useWm } from "@/components/os/WindowManager";
import type { AppProps } from "@/components/os/app-components";
import { Gallery } from "./Gallery";
import { EmbedFrame } from "./EmbedFrame";
import { Pane } from "./common";

/** The window behind "Live Demo" / "Launch": a real embed, or an honest preview. */
export function DemoWindow({ slug }: AppProps) {
  const p = slug ? demoSubject(slug) : undefined;
  const { open } = useWm();

  if (!p) {
    return (
      <Pane>
        <h1>404: demo not found</h1>
        <p>There is no demo called “{slug}”.</p>
      </Pane>
    );
  }

  if (p.demo.kind === "embed" && p.demo.url) {
    return <EmbedFrame url={p.demo.url} title={`${p.name} — running application`} appName={p.exe} />;
  }

  return (
    <Pane label={`${p.name} preview`}>
      <h1 className="!text-[22px]">{p.name}: not hosted</h1>
      <p>{p.demo.note}</p>
      {p.screenshots?.length ? (
        <>
          <p className="label-px">Screenshots — not a live app</p>
          <Gallery shots={p.screenshots} projectName={p.name} />
        </>
      ) : null}
      {p.hasWriteup ? (
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn btn-primary" onClick={() => open(`project:${p.slug}`)}>
            Open the write-up
          </button>
        </div>
      ) : null}
    </Pane>
  );
}
