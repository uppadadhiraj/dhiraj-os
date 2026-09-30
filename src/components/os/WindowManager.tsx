"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { activeId as selectActive, initialState, wmReducer } from "@/lib/wm/reducer";
import type { Rect, WmState } from "@/lib/wm/types";
import { resolveSpec } from "@/lib/apps-meta";
import { playSound } from "@/lib/sound";

export const MOBILE_MAX = 767;

interface WmActions {
  /** open (or focus) an app by id, `project:<slug>` or `demo:<slug>` */
  open: (target: string, props?: Record<string, unknown>) => boolean;
  close: (id: string) => void;
  closeAll: () => void;
  minimize: (id: string) => void;
  minimizeAll: () => void;
  restore: (id: string) => void;
  toggleMax: (id: string) => void;
  focus: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  resize: (id: string, rect: Rect) => void;
  taskbar: (id: string) => void;
}

const StateCtx = createContext<WmState | null>(null);
const ActionsCtx = createContext<WmActions | null>(null);

/** Real viewport on the client; a sensible default during server rendering (no windows exist then). */
const measureViewport = () =>
  typeof window === "undefined"
    ? { w: 1280, h: 800, mobile: false }
    : { w: window.innerWidth, h: window.innerHeight, mobile: window.innerWidth <= MOBILE_MAX };

export function WindowManagerProvider({ children }: { children: ReactNode }) {
  // measured up front so the first window opened on mount is placed for the real screen size
  const [state, dispatch] = useReducer(wmReducer, undefined, () => initialState(measureViewport()));
  // keep a ref so `open` can tell "already open" without being re-created on every change
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      dispatch({
        type: "viewport",
        viewport: {
          w: window.innerWidth,
          h: window.innerHeight,
          mobile: window.innerWidth <= MOBILE_MAX,
        },
      });
    };
    const onResize = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const open = useCallback((target: string, props?: Record<string, unknown>) => {
    const spec = resolveSpec(target);
    if (!spec) return false;
    if (props) spec.props = { ...spec.props, ...props };
    const already = !!stateRef.current.windows[spec.id];
    dispatch({ type: "open", spec });
    playSound(already ? "click" : "open");
    return true;
  }, []);

  const actions = useMemo<WmActions>(
    () => ({
      open,
      close: (id) => {
        dispatch({ type: "close", id });
        playSound("close");
      },
      closeAll: () => dispatch({ type: "closeAll" }),
      minimize: (id) => dispatch({ type: "minimize", id }),
      minimizeAll: () => dispatch({ type: "minimizeAll" }),
      restore: (id) => dispatch({ type: "restore", id }),
      toggleMax: (id) => dispatch({ type: "toggleMax", id }),
      focus: (id) => dispatch({ type: "focus", id }),
      move: (id, x, y) => dispatch({ type: "move", id, x, y }),
      resize: (id, rect) => dispatch({ type: "resize", id, rect }),
      taskbar: (id) => dispatch({ type: "taskbar", id }),
    }),
    [open],
  );

  return (
    <ActionsCtx.Provider value={actions}>
      <StateCtx.Provider value={state}>{children}</StateCtx.Provider>
    </ActionsCtx.Provider>
  );
}

export function useWmState(): WmState {
  const s = useContext(StateCtx);
  if (!s) throw new Error("useWmState must be used inside <WindowManagerProvider>");
  return s;
}

export function useWm(): WmActions {
  const a = useContext(ActionsCtx);
  if (!a) throw new Error("useWm must be used inside <WindowManagerProvider>");
  return a;
}

export function useActiveId(): string | null {
  return selectActive(useWmState());
}
