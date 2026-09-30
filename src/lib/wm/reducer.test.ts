import { describe, expect, it } from "vitest";
import { activeId, desktopArea, initialState, wmReducer, TASKBAR_H, KEEP_VISIBLE } from "./reducer";
import type { OpenSpec, Viewport, WmState } from "./types";

const VP: Viewport = { w: 1440, h: 900, mobile: false };
const spec = (id: string, extra: Partial<OpenSpec> = {}): OpenSpec => ({
  id,
  appId: id,
  title: `${id}.exe`,
  icon: "folder",
  ...extra,
});
const open = (s: WmState, id: string, extra?: Partial<OpenSpec>) => wmReducer(s, { type: "open", spec: spec(id, extra) });

describe("window manager reducer", () => {
  it("opens a window inside the desktop area (above the taskbar)", () => {
    const s = open(initialState(VP), "about", { size: { w: 760, h: 520 } });
    const w = s.windows.about;
    const area = desktopArea(VP);
    expect(w.rect.x).toBeGreaterThanOrEqual(0);
    expect(w.rect.y).toBeGreaterThanOrEqual(0);
    expect(w.rect.y + w.rect.h).toBeLessThanOrEqual(area.h);
    expect(area.h).toBe(VP.h - TASKBAR_H);
    expect(activeId(s)).toBe("about");
  });

  it("shrinks oversized windows to fit small viewports", () => {
    const small: Viewport = { w: 500, h: 400, mobile: false };
    const s = open(initialState(small), "big", { size: { w: 1200, h: 900 } });
    expect(s.windows.big.rect.w).toBeLessThanOrEqual(500);
    expect(s.windows.big.rect.h).toBeLessThanOrEqual(400 - TASKBAR_H);
  });

  it("re-opening an existing id restores and raises it instead of duplicating", () => {
    let s = open(initialState(VP), "a");
    s = open(s, "b");
    s = wmReducer(s, { type: "minimize", id: "a" });
    s = open(s, "a");
    expect(Object.keys(s.windows)).toHaveLength(2);
    expect(s.windows.a.minimized).toBe(false);
    expect(s.order).toEqual(["b", "a"]);
    expect(activeId(s)).toBe("a");
  });

  it("focus brings a window to the front and keeps z-order stable for the rest", () => {
    let s = open(open(open(initialState(VP), "a"), "b"), "c");
    s = wmReducer(s, { type: "focus", id: "a" });
    expect(s.order).toEqual(["b", "c", "a"]);
  });

  it("minimise hands activity to the next window below", () => {
    let s = open(open(initialState(VP), "a"), "b");
    s = wmReducer(s, { type: "minimize", id: "b" });
    expect(activeId(s)).toBe("a");
    s = wmReducer(s, { type: "minimize", id: "a" });
    expect(activeId(s)).toBeNull();
  });

  it("taskbar click: focus → minimise (when active) → restore (when minimised)", () => {
    let s = open(open(initialState(VP), "a"), "b");
    s = wmReducer(s, { type: "taskbar", id: "a" }); // a is behind → focus
    expect(activeId(s)).toBe("a");
    s = wmReducer(s, { type: "taskbar", id: "a" }); // a active → minimise
    expect(s.windows.a.minimized).toBe(true);
    expect(activeId(s)).toBe("b");
    s = wmReducer(s, { type: "taskbar", id: "a" }); // minimised → restore
    expect(s.windows.a.minimized).toBe(false);
    expect(activeId(s)).toBe("a");
  });

  it("maximise fills the desktop area and restore returns the original geometry", () => {
    let s = open(initialState(VP), "a");
    const before = s.windows.a.rect;
    s = wmReducer(s, { type: "toggleMax", id: "a" });
    expect(s.windows.a.maximized).toBe(true);
    expect(s.windows.a.rect).toEqual({ x: 0, y: 0, ...desktopArea(VP) });
    s = wmReducer(s, { type: "toggleMax", id: "a" });
    expect(s.windows.a.maximized).toBe(false);
    expect(s.windows.a.rect).toEqual(before);
  });

  it("does not let a window be dragged fully off-screen", () => {
    let s = open(initialState(VP), "a");
    s = wmReducer(s, { type: "move", id: "a", x: 99999, y: 99999 });
    const area = desktopArea(VP);
    expect(s.windows.a.rect.x).toBeLessThanOrEqual(area.w - KEEP_VISIBLE);
    expect(s.windows.a.rect.y).toBeLessThan(area.h);
    s = wmReducer(s, { type: "move", id: "a", x: -99999, y: -50 });
    expect(s.windows.a.rect.y).toBe(0);
    expect(s.windows.a.rect.x + s.windows.a.rect.w).toBeGreaterThanOrEqual(KEEP_VISIBLE);
  });

  it("ignores move/resize while maximised", () => {
    let s = open(initialState(VP), "a");
    s = wmReducer(s, { type: "toggleMax", id: "a" });
    const rect = s.windows.a.rect;
    s = wmReducer(s, { type: "move", id: "a", x: 10, y: 10 });
    s = wmReducer(s, { type: "resize", id: "a", rect: { x: 0, y: 0, w: 400, h: 300 } });
    expect(s.windows.a.rect).toEqual(rect);
  });

  it("enforces a minimum size on resize", () => {
    let s = open(initialState(VP), "a");
    s = wmReducer(s, { type: "resize", id: "a", rect: { x: 100, y: 100, w: 20, h: 20 } });
    expect(s.windows.a.rect.w).toBeGreaterThanOrEqual(300);
    expect(s.windows.a.rect.h).toBeGreaterThanOrEqual(200);
  });

  it("viewport changes re-clamp windows and keep maximised ones full-size", () => {
    let s = open(open(initialState(VP), "a"), "b", { size: { w: 900, h: 600 } });
    s = wmReducer(s, { type: "toggleMax", id: "a" });
    const small: Viewport = { w: 640, h: 480, mobile: false };
    s = wmReducer(s, { type: "viewport", viewport: small });
    expect(s.windows.a.rect).toEqual({ x: 0, y: 0, ...desktopArea(small) });
    expect(s.windows.b.rect.w).toBeLessThanOrEqual(640);
    expect(s.windows.b.rect.h).toBeLessThanOrEqual(480 - TASKBAR_H);
  });

  it("close removes the window from state and z-order", () => {
    let s = open(open(initialState(VP), "a"), "b");
    s = wmReducer(s, { type: "close", id: "a" });
    expect(s.windows.a).toBeUndefined();
    expect(s.order).toEqual(["b"]);
    expect(wmReducer(s, { type: "close", id: "nope" })).toBe(s);
  });

  it("fans new windows out so they are not stacked exactly on top of each other", () => {
    let s = initialState(VP);
    for (const id of ["a", "b", "c", "d"]) s = open(s, id, { size: { w: 600, h: 400 } });
    const positions = new Set(Object.values(s.windows).map((w) => `${w.rect.x},${w.rect.y}`));
    expect(positions.size).toBe(4);
  });
});
