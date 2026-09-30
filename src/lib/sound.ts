"use client";

import { isSoundOn } from "./prefs";

/**
 * Original, synthesised UI sounds (WebAudio oscillators — no audio files, so
 * nothing to license). Muted by default; only plays after the visitor turns the
 * speaker on in the tray, and only in response to their own actions.
 */
type SoundName = "open" | "close" | "click" | "error" | "boot";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(c: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = "square", gain = 0.035) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + start);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  osc.connect(g).connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.02);
}

const PATTERNS: Record<SoundName, Array<[freq: number, start: number, dur: number]>> = {
  click: [[880, 0, 0.04]],
  open: [
    [523, 0, 0.07],
    [784, 0.07, 0.09],
  ],
  close: [
    [784, 0, 0.06],
    [440, 0.06, 0.09],
  ],
  error: [
    [196, 0, 0.12],
    [147, 0.12, 0.18],
  ],
  boot: [
    [392, 0, 0.12],
    [523, 0.12, 0.12],
    [659, 0.24, 0.12],
    [784, 0.36, 0.28],
  ],
};

export function playSound(name: SoundName): void {
  if (!isSoundOn()) return;
  const c = audio();
  if (!c) return;
  for (const [f, s, d] of PATTERNS[name]) tone(c, f, s, d);
}
