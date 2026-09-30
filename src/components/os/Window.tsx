"use client";

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { MIN_H, MIN_W } from "@/lib/wm/reducer";
import type { WinState } from "@/lib/wm/types";
import { useWm } from "./WindowManager";
import { PixelIcon } from "./PixelIcon";
import { cn } from "@/lib/cn";

interface WindowCtxValue {
  id: string;
  active: boolean;
  mobile: boolean;
  maximized: boolean;
}
const WindowCtx = createContext<WindowCtxValue | null>(null);

/** Lets app content know about its own window (e.g. embeds pause pointer capture while inactive). */
export function useWindowContext(): WindowCtxValue {
  return useContext(WindowCtx) ?? { id: "", active: true, mobile: false, maximized: false };
}

const Glyph = ({ kind }: { kind: "min" | "max" | "restore" | "close" | "home" }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
    {kind === "min" && <rect x="2" y="8" width="6" height="2" fill="currentColor" />}
    {kind === "max" && <path fill="currentColor" d="M1 1h10v10H1z M3 4h6v5H3z" fillRule="evenodd" />}
    {kind === "restore" && (
      <>
        <path fill="currentColor" d="M4 1h7v7H9V3H4z M1 4h7v7H1z M3 6h3v3H3z" fillRule="evenodd" />
      </>
    )}
    {kind === "close" && (
      <path
        fill="currentColor"
        d="M1 1h2v1h1v1h1v1h2V3h1V2h1V1h2v2h-1v1h-1v1H8v2h1v1h1v1h1v2H9v-1H8V9H7V8H5v1H4v1H3v1H1V9h1V8h1V7h1V5H3V4H2V3H1z"
      />
    )}
    {kind === "home" && <path fill="currentColor" d="M6 1l5 5h-1v5H7V8H5v3H2V6H1z" />}
  </svg>
);

type Dir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const HANDLES: Array<{ dir: Dir; style: React.CSSProperties; cursor: string }> = [
  { dir: "n", style: { top: -3, left: 10, right: 10, height: 6 }, cursor: "ns-resize" },
  { dir: "s", style: { bottom: -3, left: 10, right: 10, height: 6 }, cursor: "ns-resize" },
  { dir: "e", style: { right: -3, top: 10, bottom: 10, width: 6 }, cursor: "ew-resize" },
  { dir: "w", style: { left: -3, top: 10, bottom: 10, width: 6 }, cursor: "ew-resize" },
  { dir: "ne", style: { top: -3, right: -3, width: 14, height: 14 }, cursor: "nesw-resize" },
  { dir: "nw", style: { top: -3, left: -3, width: 14, height: 14 }, cursor: "nwse-resize" },
  { dir: "se", style: { bottom: -3, right: -3, width: 14, height: 14 }, cursor: "nwse-resize" },
  { dir: "sw", style: { bottom: -3, left: -3, width: 14, height: 14 }, cursor: "nesw-resize" },
];

interface WindowProps {
  win: WinState;
  z: number;
  active: boolean;
  mobile: boolean;
  children: ReactNode;
}

export const Window = memo(function Window({ win, z, active, mobile, children }: WindowProps) {
  const { focus, move, resize, close, minimize, toggleMax } = useWm();
  const rootRef = useRef<HTMLDivElement>(null);
  const [animating, setAnimating] = useState(true);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const sizing = useRef<{ dir: Dir; px: number; py: number; r: WinState["rect"] } | null>(null);
  const raf = useRef(0);

  // Bring keyboard focus into a window when it becomes active, unless focus is already inside it.
  useEffect(() => {
    const el = rootRef.current;
    if (active && el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
  }, [active]);

  const onTitleDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (mobile || win.maximized || e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button")) return;
      drag.current = { px: e.clientX, py: e.clientY, x: win.rect.x, y: win.rect.y };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [mobile, win.maximized, win.rect.x, win.rect.y],
  );

  const onTitleMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d) return;
      const nx = d.x + (e.clientX - d.px);
      const ny = d.y + (e.clientY - d.py);
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => move(win.id, nx, ny));
    },
    [move, win.id],
  );

  const endDrag = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    drag.current = null;
    sizing.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const onHandleDown = (dir: Dir) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (mobile || win.maximized || e.button !== 0) return;
    e.stopPropagation();
    focus(win.id);
    sizing.current = { dir, px: e.clientX, py: e.clientY, r: win.rect };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onHandleMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = sizing.current;
    if (!s) return;
    const dx = e.clientX - s.px;
    const dy = e.clientY - s.py;
    let { x, y, w, h } = s.r;
    if (s.dir.includes("e")) w = Math.max(MIN_W, s.r.w + dx);
    if (s.dir.includes("s")) h = Math.max(MIN_H, s.r.h + dy);
    if (s.dir.includes("w")) {
      w = Math.max(MIN_W, s.r.w - dx);
      x = s.r.x + (s.r.w - w);
    }
    if (s.dir.includes("n")) {
      h = Math.max(MIN_H, s.r.h - dy);
      y = s.r.y + (s.r.h - h);
    }
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => resize(win.id, { x, y, w, h }));
  };

  const style: React.CSSProperties = mobile
    ? { zIndex: 200 + z }
    : { left: win.rect.x, top: win.rect.y, width: win.rect.w, height: win.rect.h, zIndex: 100 + z };

  return (
    <WindowCtx.Provider value={{ id: win.id, active, mobile, maximized: win.maximized }}>
      <div
        ref={rootRef}
        role="dialog"
        aria-label={win.title}
        aria-modal="false"
        tabIndex={-1}
        className={cn("win", mobile && "win--mobile")}
        style={style}
        data-win-id={win.id}
        data-active={active}
        data-min={win.minimized || (mobile && !active) ? "true" : undefined}
        data-max={win.maximized ? "true" : undefined}
        data-anim={animating ? "open" : undefined}
        onAnimationEnd={() => setAnimating(false)}
        onPointerDownCapture={() => {
          if (!active) focus(win.id);
        }}
      >
        <div
          className="win-title"
          onPointerDown={onTitleDown}
          onPointerMove={onTitleMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={() => !mobile && toggleMax(win.id)}
        >
          <PixelIcon name={win.icon} size={16} />
          <span className="win-title-text">{win.title}</span>
          <div className="win-ctls">
            <button
              type="button"
              className="win-ctl"
              aria-label={mobile ? `Home — hide ${win.title}` : `Minimize ${win.title}`}
              onClick={() => minimize(win.id)}
            >
              <Glyph kind={mobile ? "home" : "min"} />
            </button>
            {!mobile && (
              <button
                type="button"
                className="win-ctl"
                aria-label={win.maximized ? `Restore ${win.title}` : `Maximize ${win.title}`}
                onClick={() => toggleMax(win.id)}
              >
                <Glyph kind={win.maximized ? "restore" : "max"} />
              </button>
            )}
            <button type="button" className="win-ctl" aria-label={`Close ${win.title}`} onClick={() => close(win.id)}>
              <Glyph kind="close" />
            </button>
          </div>
        </div>
        <div className="win-body">{children}</div>

        {!mobile &&
          !win.maximized &&
          HANDLES.map(({ dir, style: hs, cursor }) => (
            <div
              key={dir}
              className="win-resize"
              style={{ ...hs, cursor }}
              onPointerDown={onHandleDown(dir)}
              onPointerMove={onHandleMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              aria-hidden="true"
              data-resize={dir}
            />
          ))}
      </div>
    </WindowCtx.Provider>
  );
});
