export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WinState {
  /** unique window id — singleton apps use their app id, project windows use `project:<slug>` */
  id: string;
  appId: string;
  props?: Record<string, unknown>;
  title: string;
  icon: string;
  rect: Rect;
  /** geometry to return to when un-maximising */
  restoreRect?: Rect;
  minimized: boolean;
  maximized: boolean;
  /** monotonically increasing open order; used for stable cascading + taskbar order */
  openedAt: number;
}

export interface Viewport {
  w: number;
  h: number;
  /** phone layout: windows are full-screen panels */
  mobile: boolean;
}

export interface WmState {
  windows: Record<string, WinState>;
  /** z-order, bottom → top */
  order: string[];
  viewport: Viewport;
  seq: number;
}

export interface OpenSpec {
  id: string;
  appId: string;
  title: string;
  icon: string;
  props?: Record<string, unknown>;
  size?: { w: number; h: number };
}

export type WmAction =
  | { type: "viewport"; viewport: Viewport }
  | { type: "open"; spec: OpenSpec }
  | { type: "close"; id: string }
  | { type: "closeAll" }
  | { type: "minimize"; id: string }
  | { type: "minimizeAll" }
  | { type: "restore"; id: string }
  | { type: "toggleMax"; id: string }
  | { type: "focus"; id: string }
  | { type: "move"; id: string; x: number; y: number }
  | { type: "resize"; id: string; rect: Rect }
  | { type: "taskbar"; id: string };
