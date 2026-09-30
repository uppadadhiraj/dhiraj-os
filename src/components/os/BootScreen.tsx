"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { playSound } from "@/lib/sound";

const subscribeReduce = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

interface BootScreenProps {
  onDone: () => void;
  /** number of project entries, shown in the "Loading projects…" line */
  projectCount: number;
}

const STEP_MS = 280;

/**
 * A short, skippable boot sequence (~2 s). Click, any key or the Skip button ends it
 * immediately; returning visitors never see it (see the inline script in layout.tsx).
 */
export function BootScreen({ onDone, projectCount }: BootScreenProps) {
  const lines = [
    "DHIRAJ BIOS v1.0 — original firmware, no real hardware was harmed",
    "Initializing DhirajOS...",
    `Loading projects... ${projectCount} entries`,
    "Loading AI modules... agents · rag · vision",
    "Loading developer profile... OK",
    "Starting portfolio...",
  ];
  const [step, setStep] = useState(1);
  const reduce = useSyncExternalStore(
    subscribeReduce,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  // with reduced motion everything is shown at once (no typing animation)
  const shown = reduce ? lines.length : step;
  const done = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const finish = () => {
      if (done.current) return;
      done.current = true;
      onDoneRef.current();
    };
    if (reduce) {
      const t = window.setTimeout(finish, 700);
      return () => window.clearTimeout(t);
    }
    playSound("boot");
    const timers: number[] = [];
    for (let i = 1; i < 6; i++) timers.push(window.setTimeout(() => setStep(i + 1), i * STEP_MS));
    timers.push(window.setTimeout(finish, 6 * STEP_MS + 350));
    const skip = () => finish();
    window.addEventListener("keydown", skip);
    return () => {
      timers.forEach(window.clearTimeout);
      window.removeEventListener("keydown", skip);
    };
  }, [reduce]);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDoneRef.current();
  };

  const pct = Math.round((shown / lines.length) * 100);

  return (
    <div
      className="boot-screen"
      role="status"
      aria-label="Starting DhirajOS"
      onClick={finish}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 20000,
        background: "#050810",
        color: "var(--c-phosphor)",
        fontFamily: "var(--font-mono)",
        fontSize: "clamp(12px, 2.4vw, 15px)",
        lineHeight: 1.7,
        display: "grid",
        placeItems: "center",
        padding: 24,
        cursor: "pointer",
      }}
    >
      <div style={{ width: "min(640px, 100%)" }}>
        <p
          aria-hidden="true"
          style={{
            margin: "0 0 20px",
            fontFamily: "var(--font-pixel)",
            fontSize: "clamp(34px, 9vw, 58px)",
            letterSpacing: "0.12em",
            color: "#dbe6ff",
            lineHeight: 1,
          }}
        >
          DHIRAJ<span style={{ color: "#ffd23f" }}>OS</span>
        </p>
        <div aria-hidden="true" style={{ minHeight: lines.length * 26 }}>
          {lines.slice(0, shown).map((l, i) => (
            <div key={i} style={{ opacity: i === shown - 1 ? 1 : 0.72 }}>
              {i > 0 ? "> " : ""}
              {l}
              {i === shown - 1 && <span className="caret" style={{ marginLeft: 4 }} />}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 22 }}>
          <div className="progress" aria-hidden="true" style={{ background: "#0d1326", boxShadow: "inset 0 0 0 1px #2a3766" }}>
            <div style={{ width: `${pct}%`, background: "repeating-linear-gradient(90deg, #4f8fe0 0 10px, transparent 10px 12px)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, gap: 12 }}>
            <span style={{ color: "#6f86c4", fontSize: "0.85em" }}>click or press any key to skip</span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                finish();
              }}
              autoFocus
            >
              Skip ⏎
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
