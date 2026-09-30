#!/usr/bin/env node
/**
 * Generates static assets from the same sources the site uses:
 *   node scripts/make-assets.mjs icons     -> src/app/icon.svg, src/app/apple-icon.png
 *   node scripts/make-assets.mjs og        -> public/og.png            (1200x630 social card)
 *   node scripts/make-assets.mjs pdf       -> public/Dhiraj_Reddy_Resume.pdf (needs BASE_URL, default http://localhost:3100)
 *   node scripts/make-assets.mjs all
 * Uses the installed Chrome through Playwright, so nothing is downloaded.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { ICONS, PALETTE } from "../src/components/os/icon-data.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const what = process.argv[2] ?? "all";
const BASE = process.env.BASE_URL ?? "http://localhost:3100";

const svgIcon = (name, size, extra = "") =>
  `<svg viewBox="0 0 16 16" width="${size}" height="${size}" shape-rendering="crispEdges" ${extra}>${ICONS[name]
    .map(([x, y, w, h, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${PALETTE[c]}"/>`)
    .join("")}</svg>`;

const browser = await chromium.launch({ channel: "chrome" });

if (what === "icons" || what === "all") {
  // favicon: the pixel monitor on the desktop colour
  const rects = ICONS.computer.map(([x, y, w, h, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${PALETTE[c]}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect width="16" height="16" fill="#0a1020"/>${rects}</svg>\n`;
  await writeFile(resolve(ROOT, "src/app/icon.svg"), svg);
  const p = await browser.newPage({ viewport: { width: 180, height: 180 } });
  await p.setContent(
    `<body style="margin:0;background:#0a1020;display:grid;place-items:center;height:180px">${svgIcon("computer", 144, 'style="image-rendering:pixelated"')}</body>`,
  );
  await p.screenshot({ path: resolve(ROOT, "src/app/apple-icon.png") });

  // favicon.ico: 16 + 32 px PNG frames wrapped in an ICO container
  const frames = [];
  for (const s of [16, 32]) {
    const fp = await browser.newPage({ viewport: { width: s, height: s } });
    // transparent page + an in-SVG dark square => an RGBA PNG (Next's ICO decoder requires alpha)
    await fp.setContent(
      `<body style="margin:0;background:transparent"><svg viewBox="0 0 16 16" width="${s}" height="${s}" shape-rendering="crispEdges" style="display:block"><rect width="16" height="16" fill="#0a1020" fill-opacity="0.99"/>${ICONS.computer
        .map(([x, y, w, h, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${PALETTE[c]}"/>`)
        .join("")}</svg></body>`,
    );
    frames.push({ s, png: await fp.screenshot({ type: "png", omitBackground: true }) });
    await fp.close();
  }
  const header = Buffer.alloc(6 + 16 * frames.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach((f, i) => {
    const o = 6 + i * 16;
    header.writeUInt8(f.s, o);
    header.writeUInt8(f.s, o + 1);
    header.writeUInt8(0, o + 2);
    header.writeUInt8(0, o + 3);
    header.writeUInt16LE(1, o + 4);
    header.writeUInt16LE(32, o + 6);
    header.writeUInt32LE(f.png.length, o + 8);
    header.writeUInt32LE(offset, o + 12);
    offset += f.png.length;
  });
  await writeFile(resolve(ROOT, "src/app/favicon.ico"), Buffer.concat([header, ...frames.map((f) => f.png)]));
  console.log("icons written (icon.svg, apple-icon.png, favicon.ico)");
}

if (what === "og" || what === "all") {
  const p = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const tags = ["AI agents", "RAG", "Computer vision", "Backend"];
  const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;600&family=Pixelify+Sans:wght@400..700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box}
  body{margin:0;width:1200px;height:630px;position:relative;overflow:hidden;background:#0a1020;font-family:'IBM Plex Sans',sans-serif;color:#14161f}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(122,162,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(122,162,255,.07) 1px,transparent 1px);background-size:40px 40px}
  .glow{position:absolute;inset:0;background:radial-gradient(800px 500px at 82% 70%,rgba(43,89,217,.35),transparent 60%),radial-gradient(600px 400px at 10% 0%,rgba(14,42,58,.9),transparent 60%)}
  .win{position:absolute;left:90px;top:70px;width:780px;background:#c0c0c0;padding:4px;box-shadow:inset -1px -1px #000,inset 1px 1px #dfdfdf,inset -2px -2px #808080,inset 2px 2px #fff,12px 14px 0 rgba(0,0,0,.35)}
  .tb{height:40px;display:flex;align-items:center;gap:12px;padding:0 10px;background:linear-gradient(90deg,#0a1f7a,#1f4fb5 60%,#4f8fe0);color:#fff;font:600 22px 'Pixelify Sans'}
  .ctl{margin-left:auto;display:flex;gap:4px}.ctl i{display:block;width:30px;height:26px;background:#c0c0c0;box-shadow:inset -1px -1px #000,inset 1px 1px #fff,inset -2px -2px #808080}
  .body{margin-top:4px;background:#fbfaf6;padding:38px 44px 36px;box-shadow:inset 1px 1px #808080,inset -1px -1px #fff,inset 2px 2px #000}
  h1{margin:0;font:600 104px/1 'Pixelify Sans';color:#0a1f7a;letter-spacing:.01em}
  .role{margin:14px 0 0;font:500 40px 'Pixelify Sans';color:#1f4fb5}
  .tags{display:flex;gap:10px;margin-top:30px}.tags span{font:500 22px 'JetBrains Mono';padding:6px 14px;background:#f0eee6;border:2px solid #cfccbf;color:#3c4052}
  .foot{margin-top:28px;font:400 24px 'IBM Plex Sans';color:#3c4052}
  .task{position:absolute;left:0;right:0;bottom:0;height:62px;background:#c0c0c0;box-shadow:inset 0 2px #fff;display:flex;align-items:center;padding:0 10px;gap:14px}
  .start{display:flex;align-items:center;gap:10px;height:44px;padding:0 18px;font:700 24px 'Pixelify Sans';background:#c0c0c0;box-shadow:inset -1px -1px #000,inset 1px 1px #fff,inset -2px -2px #808080}
  .tb2{height:44px;display:flex;align-items:center;gap:10px;padding:0 18px;width:260px;font:600 22px 'Pixelify Sans';background:repeating-conic-gradient(#c0c0c0 0 25%,#f4f4f4 0 50%) 0 0/2px 2px;box-shadow:inset 1px 1px #000,inset -1px -1px #fff}
  .icons{position:absolute;right:70px;top:84px;display:grid;gap:26px;justify-items:center}
  .icons div{display:grid;justify-items:center;gap:8px;color:#fff;font:500 20px 'Pixelify Sans';text-shadow:2px 2px 0 #000}
  .brand{position:absolute;right:66px;bottom:96px;font:600 34px 'Pixelify Sans';letter-spacing:.14em;color:#dbe6ff}.brand b{color:#ffd23f;font-weight:600}
</style></head><body>
<div class="grid"></div><div class="glow"></div>
<div class="icons">
  <div>${svgIcon("run", 84)}RUN MY PROJECTS</div>
  <div>${svgIcon("folder", 84)}Projects</div>
  <div>${svgIcon("terminal", 84)}Terminal</div>
</div>
<div class="win">
  <div class="tb">${svgIcon("welcome", 28)}<span>Welcome.exe</span><div class="ctl"><i></i><i></i><i></i></div></div>
  <div class="body">
    <h1>Dhiraj Reddy</h1>
    <p class="role">AI / Software Engineer</p>
    <div class="tags">${tags.map((t) => `<span>${t}</span>`).join("")}</div>
    <p class="foot">Hyderabad, India · a portfolio you can run</p>
  </div>
</div>
<div class="brand">DHIRAJ<b>OS</b></div>
<div class="task"><div class="start">${svgIcon("chip", 30)}Start</div><div class="tb2">${svgIcon("welcome", 24)}Welcome.exe</div></div>
</body></html>`;
  await p.setContent(html, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  await mkdir(resolve(ROOT, "public"), { recursive: true });
  await p.screenshot({ path: resolve(ROOT, "public/og.png") });
  console.log("og.png written");
}

if (what === "pdf" || what === "all") {
  const p = await browser.newPage();
  await p.goto(`${BASE}/resume/print`, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.emulateMedia({ media: "print" });
  await mkdir(resolve(ROOT, "public"), { recursive: true });
  await p.pdf({ path: resolve(ROOT, "public/Dhiraj_Reddy_Resume.pdf"), format: "A4", printBackground: true, preferCSSPageSize: true });
  console.log("resume pdf written from", BASE);
}

await browser.close();
