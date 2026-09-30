"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { BANNER, PROMPT, complete, execute, type TermEffect, type TermLine } from "@/lib/terminal/commands";
import { useWm } from "@/components/os/WindowManager";
import { useWindowContext } from "@/components/os/Window";
import { useSiteStats } from "@/components/os/SiteContext";
import { triggerEffect } from "@/components/os/Effects";
import { cn } from "@/lib/cn";

interface Row extends TermLine {
  id: number;
  prompt?: string;
}

const KIND_CLASS: Record<NonNullable<TermLine["kind"]>, string> = {
  out: "text-[#d6e2ff]",
  err: "text-[#ff8e86]",
  dim: "text-[#7f93c7]",
  accent: "text-[#ffd23f]",
  ok: "text-[var(--c-phosphor)]",
};

const WELCOME: TermLine[] = [
  ...BANNER.map((t) => ({ text: t, kind: "accent" as const })),
  { text: "" },
  { text: "DhirajOS Terminal [Version 1.0]  —  a portfolio shell, not a real one", kind: "dim" },
  { text: "Type help to list commands. Try: neofetch, projects, open scoutlens", kind: "dim" },
  { text: "" },
];

export function TerminalApp() {
  const { open, close } = useWm();
  const { id: windowId, active } = useWindowContext();
  const stats = useSiteStats();
  const [rows, setRows] = useState<Row[]>([]);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const startedAt = useRef(0);
  const queue = useRef<Row[]>([]);
  const timer = useRef<number | null>(null);
  const reduceMotion = useRef(false);

  // Output is revealed line by line. The tick function lives in a ref so it can re-schedule itself.
  const tick = useRef<() => void>(() => {});
  useEffect(() => {
    tick.current = () => {
      const next = queue.current.shift();
      if (!next) {
        timer.current = null;
        return;
      }
      setRows((r) => [...r, next]);
      timer.current = window.setTimeout(() => tick.current(), 14);
    };
  }, []);

  const enqueue = useCallback((lines: Array<TermLine & { prompt?: string }>) => {
    const added = lines.map((l) => ({ ...l, id: ++idRef.current }));
    if (reduceMotion.current) {
      setRows((r) => [...r, ...added]);
      return;
    }
    queue.current.push(...added);
    // start on a timer (not synchronously) so an unmount/remount can cancel it cleanly
    if (timer.current === null) timer.current = window.setTimeout(() => tick.current(), 0);
  }, []);

  // initial banner (typed line by line) + focus
  useEffect(() => {
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    startedAt.current = Date.now();
    enqueue(WELCOME);
    inputRef.current?.focus();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = null;
      queue.current = [];
    };
  }, [enqueue]);

  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rows]);

  const applyEffects = (effects: TermEffect[] = []) => {
    for (const e of effects) {
      if (e.type === "open") open(e.target, e.props);
      else if (e.type === "clear") {
        queue.current = [];
        setRows([]);
      } else if (e.type === "effect") triggerEffect(e.name);
      else if (e.type === "close") close(windowId);
    }
  };

  const submit = () => {
    const input = value;
    setValue("");
    setCursor(null);
    if (input.trim()) setHistory((h) => [...h, input.trim()]);
    const result = execute(input, {
      stats,
      history: [...history, input.trim()].filter(Boolean),
      now: new Date(),
      uptimeMs: Date.now() - startedAt.current,
    });
    const isClear = result.effects?.some((e) => e.type === "clear");
    if (!isClear) enqueue([{ text: input, prompt: PROMPT }, ...result.lines]);
    applyEffects(result.effects);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!history.length) return;
      const next = cursor === null ? history.length - 1 : Math.max(0, cursor - 1);
      setCursor(next);
      setValue(history[next]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (cursor === null) return;
      const next = cursor + 1;
      if (next >= history.length) {
        setCursor(null);
        setValue("");
      } else {
        setCursor(next);
        setValue(history[next]);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      const options = complete(value);
      if (options.length === 1) {
        const parts = value.split(/\s+/);
        parts[parts.length - 1] = options[0];
        setValue(parts.join(" ") + (parts.length === 1 ? " " : ""));
      } else if (options.length > 1) {
        enqueue([{ text: value, prompt: PROMPT }, { text: options.join("   "), kind: "dim" }]);
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      queue.current = [];
      setRows([]);
    }
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-[#060a16] font-[family-name:var(--font-mono)] text-[13.5px] leading-[1.55] -outline-offset-[3px] focus-within:outline focus-within:outline-2 focus-within:outline-[#ffd23f]"
      onClick={() => {
        if (!window.getSelection()?.toString()) inputRef.current?.focus();
      }}
    >
      <div
        ref={scrollRef}
        className="scroll-retro min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3"
        role="log"
        aria-live="polite"
        aria-label="Terminal output"
        tabIndex={0}
      >
        {rows.map((r) => (
          <div key={r.id} className={cn("whitespace-pre-wrap break-words", KIND_CLASS[r.kind ?? "out"])}>
            {r.prompt ? (
              <>
                <span className="text-[var(--c-phosphor)]">{r.prompt}</span> <span className="text-white">{r.text}</span>
              </>
            ) : r.href ? (
              <a href={r.href} target={r.href.startsWith("mailto:") ? undefined : "_blank"} rel="noopener noreferrer" className="text-[#8fb4ff] underline">
                {r.text}
              </a>
            ) : (
              r.text || " "
            )}
          </div>
        ))}
        <div className="flex items-center gap-2">
          <label htmlFor="term-input" className="text-[var(--c-phosphor)]">
            {PROMPT}
          </label>
          <input
            id="term-input"
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 font-[inherit] text-white caret-[var(--c-phosphor)] outline-none"
            style={{ fontSize: "inherit" }}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            aria-label="Terminal command input"
          />
        </div>
      </div>
    </div>
  );
}
