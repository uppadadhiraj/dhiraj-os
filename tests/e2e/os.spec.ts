import { expect, test } from "@playwright/test";
import { closeAll, desktopIcon, dragBy, openApp, openFromStart, settled, visit, win } from "./helpers";

test.describe("boot sequence", () => {
  test("first visit shows a skippable boot screen, returning visit skips it", async ({ page }) => {
    await visit(page, "/", { boot: true });
    await expect(page.locator(".boot-screen")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator(".boot-screen")).toHaveCount(0);
    await expect(win(page, "welcome")).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("dhirajos:booted"))).toBe("1");

    await page.reload();
    await expect(win(page, "welcome")).toBeVisible();
    await expect(page.locator(".boot-screen")).toBeHidden();
  });

  test("boot can be skipped by clicking and completes on its own", async ({ page }) => {
    await visit(page, "/", { boot: true });
    const boot = page.locator(".boot-screen");
    // On a slow browser start the sequence may already have finished by itself; either way it must end.
    await boot.click({ position: { x: 20, y: 20 }, timeout: 3000 }).catch(() => undefined);
    await expect(boot).toHaveCount(0);
    await expect(win(page, "welcome")).toBeVisible();
  });
});

test.describe("desktop and window manager", () => {
  test("desktop shows a short list of icons (the rest live in Start → Programs) and the taskbar", async ({ page }) => {
    const errors = await visit(page);
    const labels = ["RUN MY PROJECTS.exe", "Projects", "About Me", "Skills", "Resume", "GitHub", "Contact", "My Blog", "Terminal"];
    for (const label of labels) await expect(desktopIcon(page, label)).toBeVisible();
    await expect(page.locator("nav[aria-label='Desktop applications'] a.desk-icon")).toHaveCount(labels.length);
    for (const gone of ["Recycle Bin", "My Computer", "STACK.exe", "JOURNEY.exe", "HOW I BUILD.exe"]) await expect(desktopIcon(page, gone)).toHaveCount(0);
    await expect(page.getByRole("toolbar", { name: "Taskbar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("windows can be dragged", async ({ page }) => {
    await visit(page);
    const w = win(page, "welcome");
    await settled(page, "welcome");
    const t = await w.locator(".win-title").boundingBox();
    const before = await w.boundingBox();
    await dragBy(page, { x: t!.x + 120, y: t!.y + 12 }, 180, 90);
    const after = await w.boundingBox();
    expect(Math.round(after!.x - before!.x)).toBeGreaterThan(150);
    expect(Math.round(after!.y - before!.y)).toBeGreaterThan(60);
  });

  test("windows can be resized from the corner", async ({ page }) => {
    await visit(page);
    const w = win(page, "welcome");
    await settled(page, "welcome"); // the open animation scales the window; measure only once it has finished
    const before = await w.boundingBox();
    const h = await w.locator("[data-resize='se']").boundingBox();
    await dragBy(page, { x: h!.x + 6, y: h!.y + 6 }, 90, 70);
    const after = await w.boundingBox();
    expect(after!.width).toBeGreaterThan(before!.width + 60);
    expect(after!.height).toBeGreaterThan(before!.height + 40);
  });

  test("maximize fills the desktop and restore brings the old size back", async ({ page }) => {
    await visit(page);
    const w = win(page, "welcome");
    await settled(page, "welcome");
    const before = await w.boundingBox();
    await w.getByRole("button", { name: /^Maximize/ }).click();
    const max = await w.boundingBox();
    const vp = page.viewportSize()!;
    expect(Math.round(max!.width)).toBe(vp.width);
    expect(Math.round(max!.height)).toBe(vp.height - 40);
    await w.getByRole("button", { name: /^Restore/ }).click();
    const back = await w.boundingBox();
    expect(Math.round(back!.width)).toBe(Math.round(before!.width));
  });

  test("minimize hides the window and the taskbar button restores it", async ({ page }) => {
    await visit(page);
    const w = win(page, "welcome");
    await w.getByRole("button", { name: /^Minimize/ }).click();
    await expect(w).toBeHidden();
    const tb = page.getByRole("group", { name: "Open windows" }).getByRole("button", { name: /Welcome/ });
    await expect(tb).toBeVisible();
    await tb.click();
    await expect(w).toBeVisible();
  });

  test("close removes the window and its taskbar button", async ({ page }) => {
    await visit(page);
    await win(page, "welcome").getByRole("button", { name: /^Close/ }).click();
    await expect(win(page, "welcome")).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Open windows" }).getByRole("button")).toHaveCount(0);
  });

  test("clicking a window brings it to the front", async ({ page }) => {
    await visit(page);
    await openApp(page, "About Me", "about");
    const z = async (id: string) => Number(await win(page, id).evaluate((el) => getComputedStyle(el).zIndex));
    // welcome was opened first; about is on top
    expect(await z("about")).toBeGreaterThan(await z("welcome"));
    // drag about away so welcome is reachable, then click welcome's title bar
    const t = await win(page, "about").locator(".win-title").boundingBox();
    await dragBy(page, { x: t!.x + 150, y: t!.y + 12 }, 420, 160);
    await win(page, "welcome").locator(".win-title").click({ position: { x: 60, y: 10 } });
    expect(await z("welcome")).toBeGreaterThan(await z("about"));
    await expect(win(page, "welcome")).toHaveAttribute("data-active", "true");
    await expect(win(page, "about")).toHaveAttribute("data-active", "false");
  });

  test("Start menu opens, launches apps, and closes with Escape", async ({ page }) => {
    await visit(page);
    await closeAll(page);
    await page.getByRole("button", { name: "Start" }).click();
    const menu = page.getByRole("menu", { name: "Start menu" });
    await expect(menu).toBeVisible();
    await expect(menu.getByText("Dhiraj Reddy")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await page.getByRole("button", { name: "Start" }).click();
    await menu.getByRole("menuitem", { name: "Project Playground" }).click();
    await expect(win(page, "playground")).toBeVisible();
    await expect(menu).toBeHidden();
    // Programs flyout
    await page.getByRole("button", { name: "Start" }).click();
    await menu.getByRole("menuitem", { name: "Programs" }).click();
    await page.getByRole("menu", { name: "Programs" }).getByRole("menuitem", { name: "STACK" }).click();
    await expect(win(page, "stack")).toBeVisible();
  });

  test("keyboard: desktop icons are reachable and open with Enter", async ({ page }) => {
    await visit(page);
    await closeAll(page);
    await desktopIcon(page, "RUN MY PROJECTS.exe").focus();
    await page.keyboard.press("ArrowDown");
    await expect(desktopIcon(page, "Projects")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(win(page, "projects")).toBeVisible();
  });

  test("wallpaper defaults to the dusk scene, can be changed in System Info, and is remembered", async ({ page }) => {
    await visit(page);
    const wallpaper = page.locator(".wallpaper");
    await expect(wallpaper).toHaveAttribute("data-wallpaper", "dusk");
    await openFromStart(page, "System Info", "sysinfo");
    await win(page, "sysinfo").getByRole("radio", { name: "Classic teal" }).check();
    await expect(wallpaper).toHaveAttribute("data-wallpaper", "teal");
    await page.reload();
    await expect(page.locator(".wallpaper")).toHaveAttribute("data-wallpaper", "teal");
  });

  test("sound toggle is muted by default and toggles", async ({ page }) => {
    await visit(page);
    const btn = page.getByRole("button", { name: /Sound (off|on)/ });
    await expect(btn).toHaveAttribute("aria-pressed", "false");
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("terminal", () => {
  test("runs the commands from the brief", async ({ page }) => {
    const errors = await visit(page);
    await openApp(page, "Terminal", "terminal");
    const input = page.getByLabel("Terminal command input");
    const log = page.getByRole("log", { name: "Terminal output" });

    await input.fill("whoami");
    await input.press("Enter");
    await expect(log).toContainText("dhiraj@portfolio");
    await expect(log).toContainText("AI / Software Engineering Student");

    await input.fill("neofetch");
    await input.press("Enter");
    await expect(log).toContainText("OS:");
    await expect(log).toContainText("DhirajOS");
    await expect(log).toContainText("27 public repos");

    await input.fill("help");
    await input.press("Enter");
    await expect(log).toContainText("neofetch");

    await input.fill("open nothing");
    await input.press("Enter");
    await expect(log).toContainText("404: project not found");

    await input.fill("clear");
    await input.press("Enter");
    await expect(log).not.toContainText("dhiraj@portfolio");
    expect(errors).toEqual([]);
  });

  test("tab completes, arrow keys recall history, and `open` launches a project window", async ({ page }) => {
    await visit(page);
    await openApp(page, "Terminal", "terminal");
    const input = page.getByLabel("Terminal command input");
    await input.fill("neo");
    await input.press("Tab");
    await expect(input).toHaveValue("neofetch ");
    await input.fill("whoami");
    await input.press("Enter");
    await input.press("ArrowUp");
    await expect(input).toHaveValue("whoami");
    await input.fill("open scout");
    await input.press("Tab");
    await expect(input).toHaveValue("open scoutlens");
    await input.press("Enter");
    await expect(win(page, "project:scoutlens")).toBeVisible();
  });
});

test.describe("projects", () => {
  test("hub has Featured/Built/Important/Other and opens a project window with all sections", async ({ page }) => {
    const errors = await visit(page);
    await openApp(page, "Projects", "projects");
    const hub = win(page, "projects");
    for (const tab of ["Featured", "Built", "Important", "Other"]) await expect(hub.getByRole("tab", { name: tab })).toBeVisible();
    await expect(hub.getByRole("heading", { name: "Verascope" })).toBeVisible();
    await hub.getByRole("tab", { name: "Other" }).click();
    await expect(hub.getByText("Student Management System")).toBeVisible();
    await hub.getByRole("tab", { name: "Featured" }).click();

    await hub.locator("article", { hasText: "ScoutLens" }).getByRole("button", { name: "Open Project" }).click();
    const p = win(page, "project:scoutlens");
    await expect(p).toBeVisible();
    await expect(p.getByRole("heading", { name: "ScoutLens", level: 1 })).toBeVisible();
    await expect(p.getByText("AI-ASSISTED").first()).toBeVisible();
    await expect(p.getByText("Problem")).toBeVisible();

    await p.getByRole("tab", { name: "How it works" }).click();
    await expect(p.getByText("Architecture")).toBeVisible();
    await expect(p.getByRole("figure", { name: /architecture/i })).toBeVisible();

    await p.getByRole("tab", { name: "Engineering" }).click();
    await expect(p.getByText("Technical challenges")).toBeVisible();
    await expect(p.getByText("Future improvements")).toBeVisible();

    await p.getByRole("tab", { name: /Screenshots/ }).click();
    await expect(p.locator("img").first()).toBeVisible();

    await p.getByRole("tab", { name: "Run it" }).click();
    await expect(p.getByRole("button", { name: "Copy commands" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the 'Now building' chips filter the hub by tag", async ({ page }) => {
    await visit(page);
    await closeAll(page);
    await page.locator(".now-building").getByRole("button", { name: "RAG" }).click();
    const hub = win(page, "projects");
    await expect(hub.getByText("Filtered by")).toBeVisible();
    await expect(hub.getByRole("heading", { name: "Verascope" })).toBeVisible();
    await expect(hub.getByRole("heading", { name: "SmartRide AI" })).toHaveCount(0);
  });

  test("honest statuses: SmartRide is HARDWARE and labelled as a placeholder repo", async ({ page }) => {
    await visit(page, "/projects/smartride");
    const p = win(page, "project:smartride");
    await expect(p).toBeVisible();
    await expect(p.getByText("HARDWARE").first()).toBeVisible();
    await expect(p.getByText(/placeholder/i).first()).toBeVisible();
  });
});

test.describe("other apps", () => {
  test("Playground explains exactly what is live", async ({ page }) => {
    await visit(page);
    await openApp(page, "RUN MY PROJECTS.exe", "playground");
    const p = win(page, "playground");
    await expect(p.getByRole("heading", { name: "RUN MY PROJECTS" })).toBeVisible();
    await expect(p.getByText(/actually running|No project is hosted publicly/)).toBeVisible();
  });

  test("STACK map highlights connections on selection", async ({ page }) => {
    await visit(page);
    await openFromStart(page, "STACK", "stack");
    const s = win(page, "stack");
    await s.getByRole("button", { name: /FastAPI.*Used in 2 projects/ }).click();
    await expect(s.getByText("Python → FastAPI")).toBeVisible();
    await expect(s.getByRole("button", { name: "Open Verascope" })).toBeVisible();
    await s.getByRole("button", { name: "Tree" }).click();
    await expect(s.getByRole("heading", { name: "Python" })).toBeVisible();
  });

  test("GitHub window lists repositories and falls back gracefully when the API is unreachable", async ({ page }) => {
    await page.route("https://api.github.com/**", (r) => r.fulfill({ status: 403, body: "{}" }));
    await visit(page);
    await openApp(page, "GitHub", "github");
    const g = win(page, "github");
    await expect(g.getByText(/rate limit/i)).toBeVisible();
    await expect(g.getByText("Snapshot from")).toBeVisible();
    await expect(g.getByRole("link", { name: /ScoutLens/ }).first()).toBeVisible();
    await g.getByLabel("Filter repositories").fill("verascope");
    await expect(g.getByRole("link", { name: /verascope-ai/ })).toBeVisible();
    await expect(g.getByRole("link", { name: /Iris-Predictor/ })).toHaveCount(0);
  });

  test("Resume offers a PDF and the PDF exists", async ({ page, request }) => {
    await visit(page);
    await openApp(page, "Resume", "resume");
    const r = win(page, "resume");
    await expect(r.getByRole("heading", { name: "Venkata Dhiraj Reddy Uppada" })).toBeVisible();
    const href = await r.getByRole("link", { name: /Download PDF/ }).getAttribute("href");
    expect(href).toBe("/Dhiraj_Reddy_Resume.pdf");
    const res = await request.get(href!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("pdf");
    // privacy: the résumé view must not expose a phone number
    await expect(r).not.toContainText(/\+?\d{2}[\s-]?\d{5}[\s-]?\d{5}/);
  });

  test("Contact shows the intentional public details and a copy button", async ({ page }) => {
    await visit(page);
    await openApp(page, "Contact", "contact");
    const c = win(page, "contact");
    await expect(c.getByRole("link", { name: "iamdhirajreddy@gmail.com" })).toHaveAttribute("href", "mailto:iamdhirajreddy@gmail.com");
    await expect(c.getByRole("link", { name: /github.com\/uppadadhiraj/ })).toHaveAttribute("href", "https://github.com/uppadadhiraj");
    await expect(c.getByRole("button", { name: "Copy address" })).toBeVisible();
  });

  test("Journey is built from GitHub dates and does not invent employment", async ({ page }) => {
    await visit(page);
    await openFromStart(page, "JOURNEY", "journey");
    const j = win(page, "journey");
    await expect(j.getByText("GitHub account created")).toBeVisible();
    await expect(j.getByText(/don.t have formal employment/)).toBeVisible();
  });

  test("Blog window embeds the real blog in a sandboxed iframe", async ({ page }) => {
    await visit(page);
    await openApp(page, "My Blog", "blog");
    const frame = win(page, "blog").locator("iframe");
    await expect(frame).toHaveAttribute("src", "https://uppadadhiraj.github.io/");
    await expect(frame).toHaveAttribute("sandbox", /allow-scripts/);
    await expect(frame).not.toHaveAttribute("sandbox", /allow-top-navigation/);
  });
});

test.describe("easter eggs and error states", () => {
  test("Konami code unlocks the matrix effect and the hidden project", async ({ page }) => {
    await visit(page);
    await closeAll(page);
    await page.locator("#desktop").click({ position: { x: 600, y: 500 } });
    for (const k of ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"]) await page.keyboard.press(k);
    await expect(page.getByRole("alertdialog", { name: /Matrix effect/ })).toBeVisible();
    await page.waitForTimeout(450); // overlays ignore keys for 350 ms so the triggering keystroke can't dismiss them
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog", { name: /Matrix effect/ })).toHaveCount(0);
    await expect(win(page, "hidden")).toBeVisible();
    await expect(win(page, "hidden").getByRole("heading", { name: "DhirajOS.exe" })).toBeVisible();
  });

  test("rm -rf / shows the developer-joke blue screen and recovers", async ({ page }) => {
    await visit(page);
    await openApp(page, "Terminal", "terminal");
    const input = page.getByLabel("Terminal command input");
    await input.fill("rm -rf /");
    await input.press("Enter");
    const bsod = page.getByRole("alertdialog", { name: /Blue screen/ });
    await expect(bsod).toBeVisible();
    await expect(bsod).toContainText("This is a joke and your files are safe");
    await page.waitForTimeout(450);
    await page.keyboard.press("Space");
    await expect(bsod).toHaveCount(0);
    await expect(win(page, "terminal")).toBeVisible();
  });

  test("Recycle Bin restores the hidden project", async ({ page }) => {
    await visit(page, "/recycle-bin"); // no desktop icon any more; the easter egg is reached by URL or `open recycle-bin`
    await win(page, "recycle").getByRole("button", { name: /definitely_not_a_project/ }).click();
    await win(page, "recycle").getByRole("button", { name: "Restore and run" }).click();
    await expect(win(page, "hidden")).toBeVisible();
  });

  test("unknown URLs render the 404.EXE page with a way home", async ({ page }) => {
    const res = await page.goto("/definitely-not-a-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Application not found" })).toBeVisible();
    await page.getByRole("link", { name: "Return to Desktop" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("unknown project slugs are 404s too", async ({ page }) => {
    const res = await page.goto("/projects/not-a-project");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Application not found" })).toBeVisible();
  });

  test("Start menu link on the 404 page opens the desktop with the menu", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("dhirajos:booted", "1"));
    await page.goto("/nope");
    await page.getByRole("link", { name: "Open Start Menu" }).click();
    await expect(page.getByRole("menu", { name: "Start menu" })).toBeVisible();
  });
});

test.describe("deep links and SEO", () => {
  test("/projects/scoutlens opens that project directly", async ({ page }) => {
    await visit(page, "/projects/scoutlens");
    await expect(win(page, "project:scoutlens")).toBeVisible();
    await expect(page).toHaveTitle(/ScoutLens/);
  });

  test("/about, /terminal and /resume open their windows", async ({ page }) => {
    for (const [path, id] of [["/about", "about"], ["/terminal", "terminal"], ["/resume", "resume"]] as const) {
      await visit(page, path);
      await expect(win(page, id)).toBeVisible();
    }
  });

  test("home page metadata, structured data, sitemap and robots", async ({ page, request }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Dhiraj Reddy — AI / Software Engineer");
    await expect(page.locator("meta[name='description']")).toHaveAttribute("content", /Dhiraj Reddy/);
    await expect(page.locator("meta[property='og:image']")).toHaveAttribute("content", /og\.png/);
    await expect(page.locator("meta[name='twitter:card']")).toHaveAttribute("content", "summary_large_image");
    await expect(page.locator("link[rel='canonical']")).toHaveCount(1);
    const ld = await page.locator("script[type='application/ld+json']").first().textContent();
    expect(JSON.parse(ld!)).toMatchObject({ "@type": "Person", alternateName: "Dhiraj Reddy" });
    await expect(page.getByRole("heading", { level: 1, name: /Dhiraj Reddy — AI \/ Software Engineer/ })).toBeAttached();

    const sm = await request.get("/sitemap.xml");
    expect(sm.status()).toBe(200);
    expect(await sm.text()).toContain("/projects/scoutlens");
    const rb = await request.get("/robots.txt");
    expect(await rb.text()).toMatch(/Sitemap:/);
    expect((await request.get("/og.png")).status()).toBe(200);
  });

  test("the hidden project is not advertised in the sitemap", async ({ request }) => {
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain("dhirajos");
  });
});

test.describe("mobile @mobile", () => {
  test("desktop becomes a launcher and windows become full-screen panels @mobile", async ({ page }) => {
    const errors = await visit(page);
    // the welcome window opens full-screen; hide it to see the launcher
    const w = win(page, "welcome");
    await settled(page, "welcome");
    const vp = page.viewportSize()!;
    const box = await w.boundingBox();
    expect(Math.round(box!.width)).toBeGreaterThanOrEqual(vp.width - 6);
    await w.getByRole("button", { name: /^Home/ }).click();
    await expect(w).toBeHidden();

    const icon = desktopIcon(page, "About Me");
    await expect(icon).toBeVisible();
    await icon.tap();
    const about = win(page, "about");
    await expect(about).toBeVisible();
    await expect(about.getByRole("button", { name: /^Maximize/ })).toHaveCount(0);

    // no horizontal scrolling
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // bottom bar switches between open apps
    const bar = page.getByRole("group", { name: "Open windows" });
    await bar.getByRole("button", { name: /Welcome/ }).tap();
    await expect(w).toBeVisible();
    await expect(about).toBeHidden();
    expect(errors).toEqual([]);
  });

  test("project details are usable on a phone @mobile", async ({ page }) => {
    await visit(page, "/projects/verascope");
    const p = win(page, "project:verascope");
    await expect(p).toBeVisible();
    await p.getByRole("tab", { name: "How it works" }).tap();
    await expect(p.getByRole("figure", { name: /architecture/i })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("Start menu spans the bottom bar on a phone @mobile", async ({ page }) => {
    await visit(page);
    await page.getByRole("button", { name: "Start" }).tap();
    const menu = page.getByRole("menu", { name: "Start menu" });
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    expect(box!.width).toBeGreaterThan(page.viewportSize()!.width - 12);
  });
});
