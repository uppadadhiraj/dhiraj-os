"use client";

import { useEffect, useRef } from "react";

export type EffectName = "bsod" | "matrix";
export const EFFECT_EVENT = "dhirajos:effect";

export function triggerEffect(name: EffectName) {
  window.dispatchEvent(new CustomEvent<EffectName>(EFFECT_EVENT, { detail: name }));
}

/**
 * Dismiss on any key. The listener is armed after a short delay so the very keystroke that
 * triggered the effect (e.g. Enter in the terminal) cannot dismiss it in the same event.
 */
function useDismiss(onClose: () => void) {
  useEffect(() => {
    let armed = false;
    const t = window.setTimeout(() => {
      armed = true;
    }, 350);
    const key = () => {
      if (armed) onClose();
    };
    window.addEventListener("keydown", key);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);
}

export function Bsod({ onClose }: { onClose: () => void }) {
  useDismiss(onClose);
  return (
    <div
      role="alertdialog"
      aria-label="Blue screen easter egg. Press any key or click to return to the desktop."
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 30000,
        background: "#0000aa",
        color: "#fff",
        fontFamily: "var(--font-mono)",
        fontSize: "clamp(12px, 2.6vw, 16px)",
        lineHeight: 1.65,
        padding: "clamp(20px, 6vw, 64px)",
        cursor: "pointer",
        overflow: "auto",
      }}
    >
      <p style={{ margin: "0 0 28px" }}>
        <span style={{ background: "#c0c0c0", color: "#0000aa", padding: "0 10px" }}> DHIRAJ OS </span>
      </p>
      <p style={{ margin: "0 0 18px", maxWidth: "70ch" }}>
        Exception NullPortfolioError: <b>rm -rf /</b> was not a good idea.
        <br />
        The current session will be terminated.
      </p>
      <p style={{ margin: "0 0 6px" }}>*  Press any key, or click, to return to the desktop.</p>
      <p style={{ margin: "0 0 28px" }}>*  Nothing was deleted. This is a joke and your files are safe.</p>
      <p style={{ margin: 0 }}>STOP 0x0000DEAD (unresolved merge conflict in life.exe) <span className="caret" /></p>
    </div>
  );
}

const GLYPHS = "01{}[]()<>=/;:+-*#$@ABCDEFabcdef";

export function MatrixRain({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useDismiss(onClose);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (reduce) {
      const t = window.setTimeout(onClose, 1800);
      return () => window.clearTimeout(t);
    }
    const size = 16;
    let cols = 0;
    let drops: number[] = [];
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      cols = Math.ceil(canvas.width / size);
      drops = Array.from({ length: cols }, () => Math.random() * -40);
    };
    resize();
    window.addEventListener("resize", resize);
    let raf = 0;
    let last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 55) return;
      last = t;
      ctx.fillStyle = "rgba(2, 8, 4, 0.14)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${size}px ${getComputedStyle(document.body).getPropertyValue("--font-mono") || "monospace"}`;
      for (let i = 0; i < cols; i++) {
        const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        ctx.fillStyle = Math.random() > 0.96 ? "#eafff0" : "#27e36b";
        ctx.fillText(ch, i * size, drops[i] * size);
        if (drops[i] * size > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 1;
      }
    };
    raf = requestAnimationFrame(draw);
    const stop = window.setTimeout(onClose, 9000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(stop);
      window.removeEventListener("resize", resize);
    };
  }, [onClose]);

  return (
    <div
      role="alertdialog"
      aria-label="Matrix effect easter egg. Press any key or click to exit."
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 30000, background: "#020804", cursor: "pointer" }}
    >
      <canvas ref={ref} aria-hidden="true" style={{ display: "block", width: "100%", height: "100%" }} />
      <p
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 28,
          textAlign: "center",
          color: "#7dffa8",
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          textShadow: "0 0 6px #000",
        }}
      >
        wake up, recruiter… (click or press any key)
      </p>
    </div>
  );
}
