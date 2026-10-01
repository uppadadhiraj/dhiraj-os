#!/usr/bin/env node
/**
 * Verifies every project that claims a live/embedded demo (src/data/projects.ts):
 *   - the URL answers with HTTP 200 (free-tier hosts may need a minute to wake, so it retries)
 *   - the response does not forbid framing (X-Frame-Options DENY/SAMEORIGIN, CSP frame-ancestors 'none'/'self')
 * Also checks the blog embed. Exits 1 if anything fails.
 *   node scripts/check-demos.mjs
 */
import { projects } from "../src/data/projects.ts";

// self-hosted demos (/demos/…) are resolved against the deployed site; SITE_URL overrides it
const SITE = (process.env.SITE_URL ?? "https://dhiraj-os-rho.vercel.app").replace(/\/$/, "");
const abs = (u) => (u.startsWith("/") ? SITE + u : u);

const targets = [
  ...projects
    .filter((p) => p.demo.kind === "embed" && p.demo.url)
    .map((p) => ({ name: p.name, url: abs(p.demo.url), status: p.status, sameOrigin: p.demo.url.startsWith("/") })),
  // the in-browser demos load the Streamlit-in-WebAssembly runtime from this CDN
  { name: "stlite runtime (CDN)", url: "https://cdn.jsdelivr.net/npm/@stlite/browser@1.9.2/build/stlite.js", status: "dependency", noFrame: true },
  { name: "DHIRAJ.LOG (blog embed)", url: "https://uppadadhiraj.github.io/", status: "embed" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe(url) {
  let last = "";
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const t0 = Date.now();
      const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(60_000), headers: { "User-Agent": "dhiraj-os-demo-check" } });
      const xfo = res.headers.get("x-frame-options");
      const csp = res.headers.get("content-security-policy") ?? "";
      const fa = /frame-ancestors\s+([^;]+)/i.exec(csp)?.[1]?.trim();
      return { ok: res.status === 200, code: res.status, ms: Date.now() - t0, xfo, frameAncestors: fa, attempt };
    } catch (e) {
      last = String(e).slice(0, 80);
      await sleep(10_000);
    }
  }
  return { ok: false, code: 0, error: last };
}

/** Every file an in-browser demo lists in its index.html must be served (a missing .py/.pkl only fails once the app starts). */
async function checkBundle(indexUrl) {
  const html = await (await fetch(indexUrl, { signal: AbortSignal.timeout(30_000) })).text();
  const files = [...html.matchAll(/"url":\s*"\.\/(app\/[^"]+)"/g)].map((m) => m[1]);
  const base = indexUrl.replace(/[^/]*$/, "");
  const missing = [];
  for (let i = 0; i < files.length; i += 8) {
    await Promise.all(
      files.slice(i, i + 8).map(async (f) => {
        const res = await fetch(base + f, { signal: AbortSignal.timeout(30_000) }).catch(() => null);
        if (!res || res.status !== 200) missing.push(`${f} (${res?.status ?? "no response"})`);
      }),
    );
  }
  return { count: files.length, missing };
}

let failed = 0;
for (const t of targets) {
  const r = await probe(t.url);
  // same-origin embeds may be framed by this site, so SAMEORIGIN / 'self' is fine for them
  const framingBlocked =
    !t.noFrame &&
    (t.sameOrigin
      ? (r.xfo && /deny/i.test(r.xfo)) || (r.frameAncestors && /'none'/i.test(r.frameAncestors))
      : (r.xfo && /deny|sameorigin/i.test(r.xfo)) || (r.frameAncestors && /'none'|^'self'$/i.test(r.frameAncestors)));
  let bundle = null;
  if (t.sameOrigin && r.ok) bundle = await checkBundle(t.url).catch((e) => ({ count: 0, missing: [String(e).slice(0, 80)] }));
  const bundleBad = bundle && (bundle.count === 0 || bundle.missing.length > 0);
  const ok = r.ok && !framingBlocked && !bundleBad;
  if (!ok) failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${t.name.padEnd(28)} [${t.status}]  ${t.url}\n      http ${r.code}${r.ms ? ` in ${r.ms} ms` : ""}` +
      `${r.xfo ? ` · X-Frame-Options: ${r.xfo}` : ""}${r.frameAncestors ? ` · frame-ancestors ${r.frameAncestors}` : ""}${framingBlocked ? "  <- FRAMING BLOCKED" : ""}${r.error ? ` · ${r.error}` : ""}` +
      `${bundle ? ` · ${bundle.count} app files listed, ${bundle.missing.length ? `MISSING: ${bundle.missing.join(", ")}` : "all served"}` : ""}`,
  );
}
console.log(failed ? `\n${failed} demo check(s) failed` : "\nAll demo URLs respond and allow embedding");
// set the exit code instead of calling process.exit(): avoids a libuv assertion on Windows with live fetch timers
process.exitCode = failed ? 1 : 0;
