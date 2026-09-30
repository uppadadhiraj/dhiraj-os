"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { APPS } from "@/lib/apps-meta";
import { profile } from "@/data/profile";
import { PixelIcon } from "./PixelIcon";
import { useWm } from "./WindowManager";

interface StartMenuProps {
  onClose: () => void;
  onRestart: () => void;
}

const MAIN_ORDER = ["projects", "playground", "about", "resume", "github", "contact", "terminal"];

export function StartMenu({ onClose, onRestart }: StartMenuProps) {
  const { open } = useWm();
  const ref = useRef<HTMLDivElement>(null);
  const [fly, setFly] = useState(false);

  // close on outside pointer-down / Escape; return focus to the Start button
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current?.contains(t) || t.closest("#start-button")) return;
      onClose();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        document.getElementById("start-button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const launch = (id: string) => {
    open(id);
    onClose();
  };

  const onArrow = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = [...(ref.current?.querySelectorAll<HTMLElement>(".start-list > .start-item, .start-fly .start-item") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next].focus();
  };

  const programs = APPS.filter((a) => a.start === "programs");

  return (
    <div
      ref={ref}
      id="start-menu"
      className="start-menu"
      role="menu"
      aria-label="Start menu"
      onKeyDown={onArrow}
    >
      <div className="start-banner" aria-hidden="true">
        <span>
          Dhiraj<b>OS</b>
        </span>
      </div>
      <div className="start-list">
        <div className="flex items-center gap-3 px-2 py-2">
          <div
            aria-hidden="true"
            className="grid h-10 w-10 shrink-0 place-items-center bg-[var(--c-navy)] font-[family-name:var(--font-pixel)] text-[20px] text-[#ffd23f]"
            style={{ boxShadow: "inset 1px 1px #6f8fe0, inset -1px -1px #050a30" }}
          >
            DR
          </div>
          <div className="min-w-0">
            <p className="m-0 truncate font-[family-name:var(--font-pixel)] text-[16px] leading-tight">{profile.displayName}</p>
            <p className="m-0 truncate text-[12px] leading-tight text-[var(--c-ink-2)]">{profile.role} · Hyderabad</p>
          </div>
        </div>
        <div className="start-sep" role="separator" />

        <div className="relative">
          <button
            type="button"
            role="menuitem"
            className="start-item"
            aria-haspopup="menu"
            aria-expanded={fly}
            // hover opens the flyout, so a click must keep it open (toggling made hover+click close it)
            onClick={() => setFly(true)}
            onMouseEnter={() => setFly(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                setFly(true);
                window.setTimeout(() => ref.current?.querySelector<HTMLElement>(".start-fly .start-item")?.focus(), 0);
              }
              if (e.key === "ArrowLeft") setFly(false);
            }}
          >
            <PixelIcon name="layers" size={24} />
            <span>Programs</span>
            <span className="arrow" aria-hidden="true">▸</span>
          </button>
          {fly && (
            <div className="start-fly" role="menu" aria-label="Programs" onMouseLeave={() => setFly(false)}>
              {programs.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="menuitem"
                  className="start-item"
                  onClick={() => launch(a.id)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft" || e.key === "Escape") {
                      e.stopPropagation();
                      setFly(false);
                      ref.current?.querySelector<HTMLElement>(".start-list .start-item[aria-haspopup]")?.focus();
                    }
                  }}
                >
                  <PixelIcon name={a.icon} size={20} />
                  <span>{a.title.replace(/\.exe$/, "")}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {MAIN_ORDER.map((id) => {
          const a = APPS.find((x) => x.id === id);
          if (!a) return null;
          return (
            <button key={id} type="button" role="menuitem" className="start-item" onMouseEnter={() => setFly(false)} onClick={() => launch(id)}>
              <PixelIcon name={a.icon} size={24} />
              <span>{a.id === "playground" ? "Project Playground" : a.title.replace(/^(.*)\.exe$/, "$1").replace("Terminal — C:\\DHIRAJ", "Terminal")}</span>
            </button>
          );
        })}

        <div className="start-sep" role="separator" />
        <button
          type="button"
          role="menuitem"
          className="start-item"
          onClick={() => {
            onClose();
            onRestart();
          }}
        >
          <PixelIcon name="power" size={24} />
          <span>Restart…</span>
        </button>
      </div>
    </div>
  );
}
