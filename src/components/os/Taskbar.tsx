"use client";

import { useEffect, useState } from "react";
import { PixelIcon } from "./PixelIcon";
import { useActiveId, useWm, useWmState } from "./WindowManager";
import { PREF_KEYS, usePref } from "@/lib/prefs";
import { playSound } from "@/lib/sound";

function Clock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () =>
      setNow(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = window.setInterval(tick, 20_000);
    return () => window.clearInterval(id);
  }, []);
  // empty on the server and first client render so markup always matches
  return (
    <span title="Current time" suppressHydrationWarning>
      {now || "     "}
    </span>
  );
}

interface TaskbarProps {
  startOpen: boolean;
  onToggleStart: () => void;
}

export function Taskbar({ startOpen, onToggleStart }: TaskbarProps) {
  const state = useWmState();
  const activeId = useActiveId();
  const { taskbar, minimizeAll, open } = useWm();
  const [sound, setSound] = usePref(PREF_KEYS.sound, "0");

  const wins = Object.values(state.windows).sort((a, b) => a.openedAt - b.openedAt);

  return (
    <div className="taskbar" role="toolbar" aria-label="Taskbar">
      <button
        type="button"
        id="start-button"
        className="btn start-btn"
        aria-haspopup="menu"
        aria-expanded={startOpen}
        onClick={onToggleStart}
        data-pressed={startOpen}
      >
        <PixelIcon name="chip" size={20} />
        <span>Start</span>
      </button>

      <span className="task-sep" aria-hidden="true" />

      <div className="hidden items-center gap-1 sm:flex" role="group" aria-label="Quick launch">
        <button type="button" className="tray-btn" aria-label="Show desktop" title="Show desktop" onClick={minimizeAll}>
          <PixelIcon name="computer" size={20} />
        </button>
        <button type="button" className="tray-btn" aria-label="Open Projects" title="Projects" onClick={() => open("projects")}>
          <PixelIcon name="folder" size={20} />
        </button>
        <button type="button" className="tray-btn" aria-label="Open Terminal" title="Terminal" onClick={() => open("terminal")}>
          <PixelIcon name="terminal" size={20} />
        </button>
      </div>

      <span className="task-sep hidden sm:block" aria-hidden="true" />

      <div className="scroll-retro flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" role="group" aria-label="Open windows">
        {wins.map((w) => (
          <button
            key={w.id}
            type="button"
            className="task-btn"
            aria-pressed={activeId === w.id}
            data-min={w.minimized ? "true" : undefined}
            onClick={() => taskbar(w.id)}
            title={w.title + (w.minimized ? " (minimized)" : "")}
          >
            <PixelIcon name={w.icon} size={16} />
            <span>{w.title}</span>
          </button>
        ))}
      </div>

      <div className="tray" role="group" aria-label="System tray">
        <button
          type="button"
          className="tray-btn"
          aria-pressed={sound === "1"}
          aria-label={sound === "1" ? "Sound on — click to mute" : "Sound off — click to enable UI sounds"}
          title={sound === "1" ? "Sound on" : "Sound off"}
          onClick={() => {
            const next = sound === "1" ? "0" : "1";
            setSound(next);
            if (next === "1") window.setTimeout(() => playSound("open"), 0);
          }}
        >
          <PixelIcon name={sound === "1" ? "speaker" : "speakerOff"} size={18} />
        </button>
        <Clock />
      </div>
    </div>
  );
}
