// Dev helper: renders a contact sheet of the pixel icons to a PNG for visual QA.
//   node scripts/render-icons.mjs <out.png>
import { ICONS, PALETTE } from "../src/components/os/icon-data.ts";
import { chromium } from "@playwright/test";

const out = process.argv[2] ?? "icons.png";
const svg = (rects, s) =>
  `<svg viewBox="0 0 16 16" width="${s}" height="${s}" shape-rendering="crispEdges">${rects
    .map(([x, y, w, h, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${PALETTE[c]}"/>`)
    .join("")}</svg>`;
const cells = Object.entries(ICONS)
  .map(
    ([name, r]) =>
      `<div class="c"><div class="dk">${svg(r, 64)}</div><div class="lt">${svg(r, 32)}${svg(r, 16)}</div><span>${name}</span></div>`,
  )
  .join("");
const html = `<body style="margin:0;background:#222;font:12px monospace;color:#ddd"><style>
.g{display:grid;grid-template-columns:repeat(6,150px);gap:8px;padding:10px}
.c{background:#333;padding:8px;text-align:center}.dk{background:#0a1020;padding:6px}.lt{background:#c0c0c0;padding:6px;display:flex;gap:8px;justify-content:center;align-items:center}
</style><div class="g">${cells}</div></body>`;
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ viewport: { width: 960, height: 760 }, deviceScaleFactor: 1 });
await p.setContent(html);
await p.screenshot({ path: out, fullPage: true });
await b.close();
console.log("wrote", out);
