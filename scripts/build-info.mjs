#!/usr/bin/env node
/**
 * Writes src/data/build-info.json with facts about this very codebase (file/line/test
 * counts, build time, commit). Used by System Info and the hidden DhirajOS.exe project,
 * so the numbers shown there are measured, never typed in.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src/data/build-info.json");

async function walk(dir, acc = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const src = (await walk(join(ROOT, "src"))).filter((f) => /\.(ts|tsx|css)$/.test(f) && !f.endsWith("build-info.json"));
let lines = 0;
let components = 0;
let unitTests = 0;
for (const f of src) {
  const text = await readFile(f, "utf8");
  lines += text.split("\n").length;
  if (/\.tsx$/.test(f) && f.includes("components")) components++;
  if (/\.test\.ts$/.test(f)) unitTests += (text.match(/^\s*(it|test)\(/gm) ?? []).length;
}

let e2e = 0;
try {
  for (const f of (await walk(join(ROOT, "tests"))).filter((f) => f.endsWith(".spec.ts"))) {
    e2e += ((await readFile(f, "utf8")).match(/^\s*test\(/gm) ?? []).length;
  }
} catch {
  /* no e2e folder yet */
}

let commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "";
if (!commit) {
  try {
    commit = execSync("git rev-parse --short HEAD", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    commit = "";
  }
}

const info = {
  builtAt: new Date().toISOString(),
  commit: commit || null,
  sourceFiles: src.length,
  sourceLines: lines,
  components,
  unitTests,
  e2eTests: e2e,
};
await writeFile(OUT, JSON.stringify(info, null, 2) + "\n");
console.log("build-info:", info);
