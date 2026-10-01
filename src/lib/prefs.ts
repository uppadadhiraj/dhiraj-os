"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny localStorage-backed preference store. Every read/write is guarded:
 * storage can be blocked (private windows, cleared site data) and the UI must
 * still work with defaults.
 */
const PREFIX = "dhirajos:";
const listeners = new Set<() => void>();

export const PREF_KEYS = {
  booted: "booted", // "1" once the boot sequence has been shown/skipped
  sound: "sound", // "1" | "0"   (default off)
  crt: "crt", // "on" | "off" (default on)
  tip: "tip", // "1" once the welcome tip was dismissed
  wallpaper: "wallpaper", // "dusk" | "teal" | "blueprint" (default dusk)
} as const;

type PrefKey = (typeof PREF_KEYS)[keyof typeof PREF_KEYS];

export function readPref(key: PrefKey, fallback: string): string {
  try {
    return window.localStorage.getItem(PREFIX + key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writePref(key: PrefKey, value: string): void {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    /* storage unavailable — keep going with in-memory defaults */
  }
  memory.set(key, value);
  listeners.forEach((l) => l());
}

// in-memory mirror so toggles still work when storage throws
const memory = new Map<string, string>();

function snapshot(key: PrefKey, fallback: string): string {
  return memory.get(key) ?? readPref(key, fallback);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith(PREFIX)) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePref(key: PrefKey, fallback: string): [string, (v: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => snapshot(key, fallback),
    () => fallback,
  );
  return [value, (v: string) => writePref(key, v)];
}

export const isSoundOn = () => snapshot(PREF_KEYS.sound, "0") === "1";
