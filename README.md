# DhirajOS — Dhiraj Reddy's portfolio

A personal developer portfolio that behaves like a retro desktop operating system: draggable, resizable
windows, a taskbar and Start menu, a working terminal, and projects you can open, read and (where they are
actually hosted) run. The look is an original Windows 95/98-inspired design (no vendor artwork or branding);
the engineering underneath is modern, typed and tested.

**Live site:** <https://dhiraj-os-rho.vercel.app> · **Blog:** <https://uppadadhiraj.github.io/>

## The idea

> An engineer's personal operating system.

Every section is an "application" in a window. The portfolio is also a statement about how I work, so it follows
three rules:

1. **Nothing is invented.** Projects were written up from reading the source; counts come from the GitHub API;
   the repository list, dates and language mix are data, not copy.
2. **Statuses are earned.** A project is `LIVE` or `DEMO` only if a deployment was opened and exercised
   (a unit test fails if a status claims otherwise). Everything else says `LOCAL ONLY`, `HARDWARE`,
   `EXPERIMENTAL` or `ARCHIVED`.
3. **AI assistance is labelled.** ScoutLens, SCARFLOW and Verascope were built with AI coding tools and say
   `AI-ASSISTED` (their repositories disclose it too). Every other project is `HAND-BUILT` by the owner's account,
   with the caveat — stated on each one — that an LLM was sometimes asked for help when stuck. This site itself was
   built with Claude Code from the owner's brief; the owner's own UI tool is Streamlit.

## Features

- Window manager: open, close, minimize, maximize/restore, focus and z-order, drag, 8-way resize, taskbar state,
  keyboard access. Phones get full-screen panels, an app-launcher home screen and a bottom bar.
- Boot sequence (skippable, remembered in `localStorage`, no flash for returning visitors).
- Apps: Welcome, About Me, Projects (Featured / Built / Important / Other), per-project windows with
  overview, architecture diagram, engineering notes, screenshots and run instructions, **RUN MY PROJECTS.exe**
  (live demos in embedded windows), Skills (with evidence), STACK.exe (technology ↔ project map),
  JOURNEY.exe (timeline from GitHub dates), HOW I BUILD.exe, GitHub (live API with snapshot fallback),
  Resume (HTML + PDF), Contact, Terminal, System Info, DHIRAJ.LOG (blog embed).
- Terminal commands: `help about projects skills github resume contact clear whoami status neofetch` plus
  `open`, `run`, `cat`, `ls`, `history`, and a few surprises.
- Easter eggs: Konami code, `rm -rf /` blue screen, Recycle Bin, a hidden project.
- SEO: metadata, Open Graph/Twitter card, JSON-LD, sitemap, robots, favicon, deep links
  (`/projects/<slug>`, `/about`, …), a `404.EXE` page and a retro error boundary.
- Privacy-friendly: no analytics, no cookies; `localStorage` only stores the boot flag and two preferences.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Vitest · Playwright · axe-core.
No UI kit, no animation library; fonts are Pixelify Sans (labels), IBM Plex Sans (text) and JetBrains Mono (code),
self-hosted through `next/font`.

## Project layout

```
src/
  app/               routes: /, /[app], /projects/[slug], /resume/print, 404, error boundaries, sitemap, robots
  components/
    os/              Os shell, Window, WindowManager, Desktop, Taskbar, StartMenu, BootScreen, dialogs, effects
    apps/            one lazy-loaded component per application window
    ui/ diagrams/    shared primitives, architecture diagram
  data/              typed source of truth: projects, profile, skills, stack, resume, GitHub snapshot
  lib/               window-manager reducer, terminal engine, GitHub helpers, prefs, sound
scripts/             sync-github, build-info, make-assets (icons/OG/PDF), check-contrast
tests/e2e/           Playwright specs (desktop + phone profile) and axe accessibility checks
```

### Updating content

Everything a visitor reads lives in `src/data/`. To add a project, add an object to `src/data/projects.ts`
(see `src/data/types.ts` for the shape). Unit tests reject dangling repo names, unverified `LIVE`/`DEMO`
statuses and missing write-up sections. Refresh GitHub data with `npm run sync:github`.

## Develop

```bash
npm install
npm run dev            # http://localhost:3000
```

## Quality gates

```bash
npm run lint           # ESLint (Next + React Compiler rules)
npm run typecheck      # next typegen && tsc --noEmit
npm run contrast       # WCAG contrast check of the palette
npm test               # Vitest: window-manager reducer, terminal engine, data integrity, GitHub helpers
npm run build          # production build
npm run test:e2e       # Playwright against a running build (desktop, phone, axe accessibility)
npm run check          # lint + typecheck + contrast + unit tests + build
```

`npm run test:e2e` starts `next start` itself (port 3100) if nothing is running; run `npm run build` first.
To test a deployment: `BASE_URL=https://your-site npm run test:e2e`.

Regenerate generated assets with `node scripts/make-assets.mjs all` (favicon, Open Graph card, résumé PDF; the PDF
step needs a running server, `BASE_URL` defaults to `http://localhost:3100`).

## Deploy

The site is a static Next.js app and deploys to Vercel with no environment variables:

```bash
npx vercel --prod
```

`VERCEL_PROJECT_PRODUCTION_URL` (set by Vercel) is used for canonical URLs, the sitemap and Open Graph tags;
set `NEXT_PUBLIC_SITE_URL` to override it (for example once a custom domain exists).

After a deploy, check the live site:

```bash
node scripts/check-demos.mjs                                   # demo URLs, framing headers, every bundle file is served
BASE_URL=https://dhiraj-os-rho.vercel.app npx playwright test  # full suite, including the embedded demos
```

### Hosted demos (`public/demos/`)

Ten projects run in the visitor's browser. They are Streamlit apps packaged with
[stlite](https://github.com/whitphx/stlite) — Streamlit on WebAssembly — and served as static files from this site, so
there is no server, no free-tier sleep and nothing paid. (Hugging Face's free tier has no Streamlit/Docker option.)

| Demo | What it is | Source |
| --- | --- | --- |
| `/demos/scoutlens/` | The real app in `PUBLIC_DEMO` mode: recorded responses for a fictional company, nothing stored, no API key | ScoutLens, branch `feature/public-demo-mode` |
| `/demos/fake-news/` | The real model and app; scores pasted text (a browser cannot fetch other sites' pages) | Fake-News-Predictor, branch `deploy/safe-url-fetch` |
| `/demos/iris/` | The repository's real app, unmodified | Iris-Predictor |
| `/demos/movie/` | The repository's real `app.py`, unmodified; its two pickle files are regenerated from the notebook (`demos-src/movie/generate.py` verifies identical recommendations) | Movie-Recommendations |
| `/demos/heart/`, `titanic/`, `house-price/`, `netflix/` | Interactive Streamlit pages **written with Claude Code** around a notebook's pipeline | Heart-Disease-Predictor, Titanic_Ship_Survival, SCT_ML_1, Netflix-Content-EDA |
| `/demos/linear-regression/`, `logistic-regression/` | The owner's from-scratch classes copied unchanged into an interactive page written with Claude Code | linear-/logistic-regression-from-scratch |

Pages written for this site live in `demos-src/` and say so in an on-page banner. Rebuild any bundle with
`python scripts/make_stlite.py <name>` (or `all`); it reads the owner's repositories from `DEMO_REPOS`. Each bundle is an
`index.html` plus the app's files under `app/`. The Python runtime (about 10 MB, cached by the browser) is loaded from the
jsDelivr CDN when a demo window is opened; nothing loads at page load. After changing a demo, rebuild, update the notes in
`src/data/projects.ts`, redeploy and rerun the two checks above.

Two stlite quirks the demos work around: scikit-learn's array indexing trips over stlite's stub `pyarrow` (a small shim in
`demos-src/_common/demo_common.py`), and an extension-less dotfile cannot be served by every static host.

Projects that need a local LLM (Ollama), a database or hardware are not hosted; they say `LOCAL ONLY` / `HARDWARE` and show
screenshots from real local runs.

## Notes on honesty and privacy

- The résumé is generated from the same data as the site. It deliberately omits a phone number.
- Embedded apps are loaded only when their window is opened. If a host refuses to be framed, the window offers
  "Open full application" instead of trying to work around it. The in-browser demos are same-origin, so they are
  framed with the sandbox attributes in `EmbedFrame`. The apps themselves send nothing to a server (pasted text is
  scored in the browser; ScoutLens's public mode keeps nothing and makes no search or LLM calls), but the visitor's
  browser does download the runtime and Python packages from public CDNs (jsDelivr, the Pyodide/PyPI mirrors), which
  can see the visitor's IP address like any CDN request.
- No photo is shown unless one is deliberately configured (`photo` in `src/data/profile.ts`); the UI falls back
  to a monogram.

## License

MIT — see `LICENSE`. Project write-ups describe other repositories that carry their own licences.
