"use client";

import { memo, useMemo } from "react";
import { activeId as selectActive } from "@/lib/wm/reducer";
import type { WinState } from "@/lib/wm/types";
import { useWmState } from "./WindowManager";
import { Window } from "./Window";
import { APP_COMPONENTS } from "./app-components";
import { AppErrorBoundary } from "./AppFrame";

interface ItemProps {
  win: WinState;
  z: number;
  active: boolean;
  mobile: boolean;
}

/**
 * One window. The app element is memoised on identity-stable inputs so dragging or
 * resizing a window (which only changes `win.rect`) never re-renders its content.
 */
const WindowItem = memo(function WindowItem({ win, z, active, mobile }: ItemProps) {
  const Comp = APP_COMPONENTS[win.appId];
  const { appId, props, title } = win;
  // remount an app when it is re-opened with different props (e.g. Projects filtered by a new tag)
  const propsKey = JSON.stringify(props ?? {});
  const content = useMemo(
    () => (
      <AppErrorBoundary label={title}>
        {Comp ? <Comp key={propsKey} {...(props ?? {})} /> : <p className="p-4">Unknown application “{appId}”.</p>}
      </AppErrorBoundary>
    ),
    [Comp, props, propsKey, title, appId],
  );
  return (
    <Window win={win} z={z} active={active} mobile={mobile}>
      {content}
    </Window>
  );
});

export function WindowLayer() {
  const state = useWmState();
  const active = selectActive(state);
  return (
    <>
      {state.order.map((id, i) => {
        const win = state.windows[id];
        return win ? <WindowItem key={id} win={win} z={i} active={id === active} mobile={state.viewport.mobile} /> : null;
      })}
    </>
  );
}
