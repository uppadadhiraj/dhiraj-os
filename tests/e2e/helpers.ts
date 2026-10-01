import { expect, type Page } from "@playwright/test";

/** Skip the boot sequence (as a returning visitor) and collect console/page errors. */
export async function visit(page: Page, path = "/", opts: { boot?: boolean } = {}) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  if (!opts.boot) await page.addInitScript(() => localStorage.setItem("dhirajos:booted", "1"));
  await page.goto(path);
  // the first window opens right after hydration; wait for it so tests never race the initial open
  if (!opts.boot) await expect(page.locator("[data-win-id]").first()).toBeVisible();
  return errors;
}

export const win = (page: Page, id: string) => page.locator(`[data-win-id='${id}']`);

/** Wait for a window's 140 ms open animation to finish (bounding boxes include the scale transform). */
export async function settled(page: Page, id: string) {
  await expect(win(page, id)).toBeVisible();
  await expect(win(page, id)).not.toHaveAttribute("data-anim", "open");
}

export const desktopIcon = (page: Page, label: string) =>
  page.locator("nav[aria-label='Desktop applications']").getByRole("link", { name: label, exact: true });

/** Open an app from its desktop icon and wait for its window. */
export async function openApp(page: Page, label: string, id: string) {
  await desktopIcon(page, label).click();
  await expect(win(page, id)).toBeVisible();
}

/** Minimise everything so the desktop icons are reachable (taskbar button on laptops, Home buttons on phones). */
export async function showDesktop(page: Page) {
  const show = page.getByRole("button", { name: "Show desktop" });
  if (await show.isVisible()) {
    await show.click();
  } else {
    for (const w of await page.locator("[data-win-id]").all()) {
      const home = w.getByRole("button", { name: /^(Home|Minimize)/ });
      if (await home.isVisible()) await home.click();
    }
  }
}

export async function closeAll(page: Page) {
  for (const w of await page.locator("[data-win-id]").all()) {
    await w.getByRole("button", { name: /^Close/ }).click();
  }
  await expect(page.locator("[data-win-id]")).toHaveCount(0);
}

export async function dragBy(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 10 });
  await page.mouse.up();
}
