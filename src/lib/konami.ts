"use client";

import { useEffect } from "react";

const SEQUENCE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

/** Calls `onMatch` when the classic Konami code is typed (ignores typing inside inputs). */
export function useKonami(onMatch: () => void) {
  useEffect(() => {
    let i = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === SEQUENCE[i]) {
        i += 1;
        if (i === SEQUENCE.length) {
          i = 0;
          onMatch();
        }
      } else {
        i = key === SEQUENCE[0] ? 1 : 0;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onMatch]);
}
