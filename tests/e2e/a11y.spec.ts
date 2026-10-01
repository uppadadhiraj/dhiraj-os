import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { desktopIcon, openApp, openFromStart, visit, win } from "./helpers";

/**
 * Any violation fails the test (all impact levels). Axe's "incomplete" list is also checked,
 * except colour contrast: text drawn over the decorative wallpaper (an SVG behind a scanline
 * overlay) cannot be computed automatically, so contrast was reviewed by hand instead.
 */
async function serious(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]).analyze();
  const fmt = (kind: string) => (v: (typeof results.violations)[number]) =>
    `${kind} ${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`;
  return [
    ...results.violations.map(fmt("violation")),
    ...results.incomplete.filter((v) => v.id !== "color-contrast").map(fmt("needs-review")),
  ];
}

test.describe("accessibility (axe: WCAG 2.1 A/AA + best practices, all impacts)", () => {
  test("desktop with the welcome window", async ({ page }) => {
    await visit(page);
    await expect(win(page, "welcome")).toBeVisible();
    expect(await serious(page)).toEqual([]);
  });

  for (const [label, id] of [
    ["Projects", "projects"],
    ["About Me", "about"],
    ["Skills", "skills"],
    ["Contact", "contact"],
    ["Terminal", "terminal"],
    ["GitHub", "github"],
    ["Resume", "resume"],
    ["RUN MY PROJECTS.exe", "playground"],
    ["Recycle Bin", "recycle"],
  ] as const) {
    test(`${id} window`, async ({ page }) => {
      await visit(page);
      await openApp(page, label, id);
      expect(await serious(page)).toEqual([]);
    });
  }

  // not on the desktop: opened from Start -> Programs, as a visitor would
  for (const [label, id] of [
    ["STACK", "stack"],
    ["JOURNEY", "journey"],
    ["HOW I BUILD", "howibuild"],
    ["System Info", "sysinfo"],
  ] as const) {
    test(`${id} window (from Start)`, async ({ page }) => {
      await visit(page);
      await openFromStart(page, label, id);
      expect(await serious(page)).toEqual([]);
    });
  }

  test("a project window (all tabs)", async ({ page }) => {
    await visit(page, "/projects/scoutlens");
    const p = win(page, "project:scoutlens");
    await expect(p).toBeVisible();
    for (const tab of ["Overview", "How it works", "Engineering", "Run it"]) {
      await p.getByRole("tab", { name: tab }).click();
      expect(await serious(page), tab).toEqual([]);
    }
  });

  test("the hidden project window", async ({ page }) => {
    await visit(page, "/dhirajos");
    await expect(win(page, "hidden")).toBeVisible();
    expect(await serious(page)).toEqual([]);
  });

  test("the boot screen", async ({ page }) => {
    await visit(page, "/", { boot: true });
    await expect(page.locator(".boot-screen")).toBeVisible();
    expect(await serious(page)).toEqual([]);
  });

  test("the Start menu", async ({ page }) => {
    await visit(page);
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByRole("menu", { name: "Start menu" })).toBeVisible();
    expect(await serious(page)).toEqual([]);
  });

  test("the 404 page", async ({ page }) => {
    await page.goto("/nope");
    expect(await serious(page)).toEqual([]);
  });

  test("keyboard focus is always visible on interactive controls", async ({ page }) => {
    await visit(page);
    await desktopIcon(page, "Projects").focus();
    const outline = await desktopIcon(page, "Projects").evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
  });
});
