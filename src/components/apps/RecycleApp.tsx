"use client";

import { useState } from "react";
import { useWm } from "@/components/os/WindowManager";
import { PixelIcon } from "@/components/os/PixelIcon";
import { Pane } from "./common";

const ITEMS = [
  { id: "pw", icon: "lock", name: "passwords.txt", note: "Nice try. There is nothing in here but this sentence." },
  { id: "readme", icon: "doc", name: "README_final_v2.md", note: "A README is a letter to your future self." },
  { id: "secret", icon: "lock", name: "definitely_not_a_project.exe", note: "" },
] as const;

/** Easter egg: one of the "deleted" files restores a hidden project. */
export function RecycleApp() {
  const { open } = useWm();
  const [sel, setSel] = useState<(typeof ITEMS)[number]["id"] | null>(null);
  const item = ITEMS.find((i) => i.id === sel);
  return (
    <Pane label="Recycle Bin">
      <h1 className="!text-[22px]">Recycle Bin</h1>
      <p className="!mt-0 text-[14px] text-[var(--c-ink-2)]">3 items. Select one to inspect it.</p>
      <ul className="m-0 list-none p-0" style={{ maxWidth: "none" }}>
        {ITEMS.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              className="flex w-full items-center gap-3 border border-transparent px-2 py-1.5 text-left hover:bg-[var(--c-paper-2)] focus-visible:border-[var(--c-navy)]"
              aria-pressed={sel === i.id}
              onClick={() => setSel(i.id)}
              style={sel === i.id ? { background: "var(--c-navy)", color: "#fff" } : undefined}
            >
              <PixelIcon name={i.icon} size={24} />
              <span className="font-[family-name:var(--font-mono)] text-[13.5px]">{i.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {item && (
        <div className="groupbox mt-5" role="region" aria-live="polite">
          <span className="groupbox-label">{item.name}</span>
          {item.id === "secret" ? (
            <>
              <p className="!mt-0">This one is an executable. It is a real project, and it is this website.</p>
              <button type="button" className="btn btn-primary" onClick={() => open("hidden")}>
                Restore and run
              </button>
            </>
          ) : (
            <p className="!my-0">{item.note}</p>
          )}
        </div>
      )}
    </Pane>
  );
}
