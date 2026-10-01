import { expect, test } from "@playwright/test";
import { desktopIcon, openApp, settled, showDesktop, visit, win } from "./helpers";

const VIEWPORTS = [
  { name: "375 (small phone)", w: 375, h: 667 },
  { name: "390 (phone)", w: 390, h: 844 },
  { name: "768 (tablet)", w: 768, h: 1024 },
  { name: "1024 (small laptop)", w: 1024, h: 768 },
  { name: "1440 (laptop)", w: 1440, h: 900 },
  { name: "1920 (desktop)", w: 1920, h: 1080 },
];

const overflowX = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

for (const vp of VIEWPORTS) {
  test.describe(`viewport ${vp.name}`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h } });

    test(`no horizontal overflow; windows stay inside the screen`, async ({ page }) => {
      const errors = await visit(page);
      await settled(page, "welcome");
      expect(await overflowX(page)).toBeLessThanOrEqual(0);

      for (const [label, id] of [
        ["Projects", "projects"],
        ["Terminal", "terminal"],
        ["STACK.exe", "stack"],
        ["GitHub", "github"],
      ] as const) {
        await showDesktop(page); // icons can sit behind open windows on small screens
        await openApp(page, label, id);
        await settled(page, id);
        const box = await win(page, id).boundingBox();
        expect(box, `${id} has a box`).not.toBeNull();
        // the title bar must always be reachable (inside the viewport horizontally and vertically)
        expect(box!.x + box!.width).toBeGreaterThan(80);
        expect(box!.x).toBeLessThan(vp.w - 80);
        expect(box!.y).toBeGreaterThanOrEqual(-1);
        expect(box!.y).toBeLessThan(vp.h - 40);
        expect(await overflowX(page), `${id} overflow`).toBeLessThanOrEqual(0);
      }
      expect(errors).toEqual([]);
    });

    test(`project details render and the taskbar is visible`, async ({ page }) => {
      await visit(page, "/projects/scoutlens");
      const p = win(page, "project:scoutlens");
      await settled(page, "project:scoutlens");
      await expect(p.getByRole("heading", { name: "ScoutLens", level: 1 })).toBeVisible();
      await p.getByRole("tab", { name: "How it works" }).click();
      await expect(p.getByRole("figure", { name: /architecture/i })).toBeVisible();
      expect(await overflowX(page)).toBeLessThanOrEqual(0);
      const bar = page.getByRole("toolbar", { name: "Taskbar" });
      await expect(bar).toBeVisible();
      const bb = await bar.boundingBox();
      expect(Math.round(bb!.y + bb!.height)).toBe(vp.h); // pinned to the bottom edge
      await page.screenshot({ path: `test-results/viewport-${vp.w}x${vp.h}.png` });
    });

    test(`desktop icons are reachable`, async ({ page }) => {
      await visit(page);
      await settled(page, "welcome");
      await showDesktop(page);
      await expect(desktopIcon(page, "About Me")).toBeVisible();
      await expect(desktopIcon(page, "RUN MY PROJECTS.exe")).toBeVisible();
      const box = await desktopIcon(page, "Terminal").boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.w);
      expect(box!.y + box!.height).toBeLessThanOrEqual(vp.h);
    });
  });
}
