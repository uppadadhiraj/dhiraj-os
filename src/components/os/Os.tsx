"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SiteStats } from "@/lib/github-stats";
import { PREF_KEYS, usePref } from "@/lib/prefs";
import { useKonami } from "@/lib/konami";
import { projects, otherProjects } from "@/data/projects";
import { WindowManagerProvider, useWm } from "./WindowManager";
import { SiteStatsProvider } from "./SiteContext";
import { DialogHost, useDialog } from "./DialogHost";
import { Desktop } from "./Desktop";
import { WindowLayer } from "./WindowLayer";
import { Taskbar } from "./Taskbar";
import { StartMenu } from "./StartMenu";
import { BootScreen } from "./BootScreen";
import { Bsod, EFFECT_EVENT, MatrixRain, type EffectName } from "./Effects";

interface OsProps {
  /** window to open on load: an app id, `project:<slug>` or `demo:<slug>` (deep links) */
  initialTarget?: string;
  stats: SiteStats;
}

export function Os({ initialTarget, stats }: OsProps) {
  return (
    <SiteStatsProvider stats={stats}>
      <WindowManagerProvider>
        <DialogHost>
          <OsShell initialTarget={initialTarget} />
        </DialogHost>
      </WindowManagerProvider>
    </SiteStatsProvider>
  );
}

function OsShell({ initialTarget }: { initialTarget?: string }) {
  const { open, closeAll } = useWm();
  const showDialog = useDialog();
  const [booted, setBooted] = usePref(PREF_KEYS.booted, "0");
  const [crt] = usePref(PREF_KEYS.crt, "on");
  const [rebooting, setRebooting] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [effect, setEffect] = useState<EffectName | null>(null);
  const openedInitial = useRef(false);

  const showBoot = booted !== "1" || rebooting;

  // While the boot screen plays, fetch the first window's code so it appears instantly afterwards.
  useEffect(() => {
    const prefetch = () => {
      void import("@/components/apps/WelcomeApp");
      if (initialTarget?.startsWith("project:")) void import("@/components/apps/ProjectWindow");
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(prefetch);
    else window.setTimeout(prefetch, 200);
  }, [initialTarget]);

  // Open the first window straight away (behind the boot overlay for first-time visitors) so it is
  // already painted when the boot screen ends — this keeps Largest Contentful Paint early.
  useEffect(() => {
    if (openedInitial.current) return;
    openedInitial.current = true;
    if (!open(initialTarget ?? "welcome")) open("welcome");
  }, [rebooting, initialTarget, open]);

  // Easter eggs are triggered from the terminal through a window event.
  useEffect(() => {
    const onEffect = (e: Event) => setEffect((e as CustomEvent<EffectName>).detail);
    window.addEventListener(EFFECT_EVENT, onEffect);
    return () => window.removeEventListener(EFFECT_EVENT, onEffect);
  }, []);

  useKonami(
    useCallback(() => {
      setEffect("matrix");
      open("hidden");
    }, [open]),
  );

  const closeEffect = useCallback(() => setEffect(null), []);
  const closeStart = useCallback(() => setStartOpen(false), []);
  const finishBoot = useCallback(() => {
    setBooted("1");
    setRebooting(false);
  }, [setBooted]);

  // /?start=1 (from the 404 page) opens the Start menu on arrival
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("start")) {
      const t = window.setTimeout(() => setStartOpen(true), 0);
      return () => window.clearTimeout(t);
    }
  }, []);

  const restart = useCallback(() => {
    showDialog({
      title: "Restart DhirajOS",
      icon: "power",
      heading: "Restart the portfolio?",
      message: "This closes every window and replays the boot sequence.",
      buttons: [
        {
          label: "Restart",
          primary: true,
          onClick: () => {
            closeAll();
            openedInitial.current = false;
            setRebooting(true);
          },
        },
        { label: "Cancel" },
      ],
    });
  }, [closeAll, showDialog]);

  return (
    <div className="os-root" role="region" aria-label="DhirajOS desktop" data-crt={crt} data-testid="os-root">
      <Desktop />
      <div className="m-status" aria-hidden="true">
        <span>
          DHIRAJ<span style={{ color: "#ffd23f" }}>OS</span>
        </span>
        <span>{projects.length + otherProjects.length} projects</span>
      </div>
      <WindowLayer />
      <Taskbar startOpen={startOpen} onToggleStart={() => setStartOpen((v) => !v)} />
      {startOpen && <StartMenu onClose={closeStart} onRestart={restart} />}

      <BootScreenGate show={showBoot} onDone={finishBoot} />

      {effect === "bsod" && <Bsod onClose={closeEffect} />}
      {effect === "matrix" && <MatrixRain onClose={closeEffect} />}
    </div>
  );
}

/** The boot overlay is always in the server HTML (so the desktop never flashes); it is removed/skipped on the client. */
function BootScreenGate({ show, onDone }: { show: boolean; onDone: () => void }) {
  if (!show) return null;
  return <BootScreen onDone={onDone} projectCount={projects.length + otherProjects.length} />;
}
