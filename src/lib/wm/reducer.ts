import type { OpenSpec, Rect, Viewport, WinState, WmAction, WmState } from "./types";

export const TASKBAR_H = 40;
export const MIN_W = 300;
export const MIN_H = 200;
/** how much of a window's title bar must stay on screen so it can always be grabbed */
export const KEEP_VISIBLE = 96;
export const DEFAULT_SIZE = { w: 760, h: 520 } as const;
/** Below this width (but above the phone layout) windows open maximised: a simplified, tablet-friendly desktop. */
export const TABLET_MAX_W = 1024;

export const desktopArea = (vp: Viewport) => ({ w: vp.w, h: Math.max(0, vp.h - TASKBAR_H) });

export function initialState(viewport: Viewport): WmState {
  return { windows: {}, order: [], viewport, seq: 0 };
}

/** Topmost window that is not minimised — the "active" window. */
export function activeId(state: WmState): string | null {
  for (let i = state.order.length - 1; i >= 0; i--) {
    const id = state.order[i];
    if (!state.windows[id]?.minimized) return id;
  }
  return null;
}

export function clampRect(r: Rect, vp: Viewport): Rect {
  const area = desktopArea(vp);
  const w = Math.max(Math.min(MIN_W, area.w), Math.min(r.w, area.w));
  const h = Math.max(Math.min(MIN_H, area.h), Math.min(r.h, area.h));
  const x = Math.min(Math.max(r.x, KEEP_VISIBLE - w), area.w - KEEP_VISIBLE);
  const y = Math.min(Math.max(r.y, 0), Math.max(0, area.h - 32));
  return { x, y, w, h };
}

const fullRect = (vp: Viewport): Rect => {
  const a = desktopArea(vp);
  return { x: 0, y: 0, w: a.w, h: a.h };
};

function initialRect(spec: OpenSpec, vp: Viewport, seq: number): Rect {
  const area = desktopArea(vp);
  const want = spec.size ?? DEFAULT_SIZE;
  const w = Math.min(want.w, Math.max(MIN_W, area.w - 24));
  const h = Math.min(want.h, Math.max(MIN_H, area.h - 24));
  // fan new windows out around the centre so stacked windows stay distinguishable
  const off = ((seq % 6) - 2) * 26;
  const x = Math.round((area.w - w) / 2 + off);
  const y = Math.round(Math.max(8, (area.h - h) / 2 + off - 10));
  return clampRect({ x, y, w, h }, vp);
}

const toFront = (order: string[], id: string): string[] => [...order.filter((x) => x !== id), id];

export function wmReducer(state: WmState, action: WmAction): WmState {
  switch (action.type) {
    case "viewport": {
      const vp = action.viewport;
      if (vp.w === state.viewport.w && vp.h === state.viewport.h && vp.mobile === state.viewport.mobile) return state;
      const windows: Record<string, WinState> = {};
      for (const [id, win] of Object.entries(state.windows)) {
        windows[id] = win.maximized
          ? { ...win, rect: fullRect(vp) }
          : { ...win, rect: clampRect(win.rect, vp), restoreRect: win.restoreRect && clampRect(win.restoreRect, vp) };
      }
      return { ...state, viewport: vp, windows };
    }

    case "open": {
      const { spec } = action;
      const existing = state.windows[spec.id];
      if (existing) {
        return {
          ...state,
          windows: {
            ...state.windows,
            [spec.id]: {
              ...existing,
              title: spec.title,
              props: spec.props ?? existing.props,
              minimized: false,
            },
          },
          order: toFront(state.order, spec.id),
        };
      }
      const seq = state.seq + 1;
      const rect = initialRect(spec, state.viewport, seq);
      const tablet = !state.viewport.mobile && state.viewport.w < TABLET_MAX_W;
      const win: WinState = {
        id: spec.id,
        appId: spec.appId,
        props: spec.props,
        title: spec.title,
        icon: spec.icon,
        rect: tablet ? fullRect(state.viewport) : rect,
        // restoring a tablet window returns to the normal cascaded size
        restoreRect: tablet ? rect : undefined,
        minimized: false,
        maximized: tablet,
        openedAt: seq,
      };
      return {
        ...state,
        seq,
        windows: { ...state.windows, [spec.id]: win },
        order: [...state.order, spec.id],
      };
    }

    case "close": {
      if (!state.windows[action.id]) return state;
      const { [action.id]: _gone, ...rest } = state.windows;
      void _gone;
      return { ...state, windows: rest, order: state.order.filter((x) => x !== action.id) };
    }

    case "closeAll":
      return { ...state, windows: {}, order: [] };

    case "minimize": {
      const w = state.windows[action.id];
      if (!w || w.minimized) return state;
      return { ...state, windows: { ...state.windows, [action.id]: { ...w, minimized: true } } };
    }

    case "minimizeAll": {
      const windows: Record<string, WinState> = {};
      for (const [id, w] of Object.entries(state.windows)) windows[id] = { ...w, minimized: true };
      return { ...state, windows };
    }

    case "restore":
    case "focus": {
      const w = state.windows[action.id];
      if (!w) return state;
      if (!w.minimized && state.order[state.order.length - 1] === action.id) return state;
      return {
        ...state,
        windows: { ...state.windows, [action.id]: { ...w, minimized: false } },
        order: toFront(state.order, action.id),
      };
    }

    case "toggleMax": {
      const w = state.windows[action.id];
      if (!w) return state;
      const next: WinState = w.maximized
        ? { ...w, maximized: false, rect: w.restoreRect ?? w.rect, restoreRect: undefined }
        : { ...w, maximized: true, restoreRect: w.rect, rect: fullRect(state.viewport) };
      return {
        ...state,
        windows: { ...state.windows, [action.id]: next },
        order: toFront(state.order, action.id),
      };
    }

    case "move": {
      const w = state.windows[action.id];
      if (!w || w.maximized) return state;
      const rect = clampRect({ ...w.rect, x: action.x, y: action.y }, state.viewport);
      if (rect.x === w.rect.x && rect.y === w.rect.y) return state;
      return { ...state, windows: { ...state.windows, [action.id]: { ...w, rect } } };
    }

    case "resize": {
      const w = state.windows[action.id];
      if (!w || w.maximized) return state;
      const rect = clampRect(action.rect, state.viewport);
      return { ...state, windows: { ...state.windows, [action.id]: { ...w, rect } } };
    }

    case "taskbar": {
      const w = state.windows[action.id];
      if (!w) return state;
      if (w.minimized) return wmReducer(state, { type: "restore", id: action.id });
      if (activeId(state) === action.id) return wmReducer(state, { type: "minimize", id: action.id });
      return wmReducer(state, { type: "focus", id: action.id });
    }

    default:
      return state;
  }
}
