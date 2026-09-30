#!/usr/bin/env node
/**
 * WCAG 2.x contrast check for the design system's text/background pairs
 * (axe can't evaluate text drawn over the decorative wallpaper, so the palette is verified here).
 *   node scripts/check-contrast.mjs        # exits 1 if any pair is below its threshold
 */
const hex = (h) => {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lin = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (h) => {
  const [r, g, b] = hex(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const C = { face: "#c0c0c0", paper: "#fbfaf6", paper2: "#f0eee6", ink: "#14161f", ink2: "#3c4052", link: "#0b2fb8", navy: "#0a1f7a", navy2: "#1f4fb5", white: "#ffffff", term: "#060a16", boot: "#050810" };

// [label, foreground, background, minimum ratio]
const PAIRS = [
  ["body text on paper", C.ink, C.paper, 4.5],
  ["secondary text on paper", C.ink2, C.paper, 4.5],
  ["secondary text on tag/panel paper-2", C.ink2, C.paper2, 4.5],
  ["secondary text on window face", C.ink2, C.face, 4.5],
  ["text on window face / buttons / tabs / status bar", C.ink, C.face, 4.5],
  ["links on paper", C.link, C.paper, 4.5],
  ["headings (navy) on paper", C.navy, C.paper, 4.5],
  ["active title text on gradient start", C.white, "#0a1f7a", 4.5],
  ["active title text on gradient middle", C.white, "#1f4fb5", 4.5],
  ["active title text where long titles can reach (≈75%)", C.white, "#2f63c0", 4.5],
  ["inactive title text on gradient start", "#e9e9ee", "#4a4a5a", 4.5],
  ["inactive title text on gradient end", "#e9e9ee", "#666678", 4.5],
  ["desktop icon labels on darkest wallpaper", C.white, "#0a1020", 4.5],
  ["desktop icon labels on brightest wallpaper glow", C.white, "#14245a", 4.5],
  ["hero icon label (gold) on wallpaper", "#ffe48a", "#14245a", 4.5],
  ["primary button text", C.ink, "#b8c4f0", 4.5],
  ["pill LIVE", "#0a5a28", "#d7f5e0", 4.5],
  ["pill DEMO", "#123a9a", "#dbe6ff", 4.5],
  ["pill LOCAL ONLY", "#3c4052", "#e6e6ea", 4.5],
  ["pill HARDWARE", "#7a4500", "#ffe9c2", 4.5],
  ["pill EXPERIMENTAL", "#4a2a9c", "#e9defc", 4.5],
  ["pill ARCHIVED", "#5c5c66", "#efefef", 4.5],
  ["pill AI-ASSISTED", "#0b5d66", "#d6f3f6", 4.5],
  ["pill tag", C.ink2, C.paper2, 4.5],
  ["terminal output", "#d6e2ff", C.term, 4.5],
  ["terminal dim", "#7f93c7", C.term, 4.5],
  ["terminal error", "#ff8e86", C.term, 4.5],
  ["terminal accent", "#ffd23f", C.term, 4.5],
  ["terminal ok / prompt", "#4dff88", C.term, 4.5],
  ["terminal links", "#8fb4ff", C.term, 4.5],
  ["boot text", "#4dff88", C.boot, 4.5],
  ["boot hint", "#6f86c4", C.boot, 4.5],
  ["monogram gold on navy", "#ffd23f", "#0a1f7a", 4.5],
  ["start banner text on gradient (dark end)", C.white, "#1f4fb5", 4.5],
  ["STACK branch: Python", "#2b6cb0", C.paper, 4.5],
  ["STACK branch: TypeScript", "#0f766e", C.paper, 4.5],
  ["STACK branch: Java", "#b04a06", C.paper, 4.5],
  ["STACK branch: Data", "#6d3fd1", C.paper, 4.5],
  ["STACK branch: AI runtime", "#a16207", C.paper, 4.5],
  ["STACK branch: Infra", "#475569", C.paper, 4.5],
  ["STACK node label", "#5b6074", C.paper, 4.5],
  ["focus ring (navy) on window face (needs 3:1)", C.navy, C.face, 3],
  ["focus ring (gold) on dark desktop (needs 3:1)", "#ffd23f", "#0a1020", 3],
  ["focus ring (gold) on navy title bar (needs 3:1)", "#ffd23f", "#1f4fb5", 3],
];

let failed = 0;
for (const [label, fg, bg, min] of PAIRS) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${r.toFixed(2).padStart(5)}:1 (min ${min})  ${label}  [${fg} on ${bg}]`);
}
console.log(failed ? `\n${failed} pair(s) below threshold` : "\nAll palette pairs meet their WCAG thresholds");
process.exit(failed ? 1 : 0);
