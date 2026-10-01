import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { openApp, settled, visit, win } from "./helpers";

/**
 * The two hosted demos are the projects' real Streamlit apps running in the visitor's browser (stlite / WebAssembly),
 * served from /demos/. The first run downloads the Python runtime from a CDN, so these tests need internet access
 * and are given a generous timeout.
 */
test.describe.configure({ timeout: 240_000 });

async function launch(page: Page, projectName: string, slug: string): Promise<FrameLocator> {
  await visit(page);
  await openApp(page, "RUN MY PROJECTS.exe", "playground");
  const card = win(page, "playground").locator("li", { hasText: projectName });
  await expect(card.getByText("DEMO", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Launch" }).click();
  await settled(page, `demo:${slug}`);
  return win(page, `demo:${slug}`).frameLocator("iframe");
}

test.describe("hosted demos run the real apps in the browser", () => {
  test("ScoutLens: demo investigation completes and the report renders; history stays closed", async ({ page }) => {
    const app = await launch(page, "ScoutLens", "scoutlens");
    await expect(app.getByText("Public demo.")).toBeVisible({ timeout: 180_000 });
    // public mode must not offer URL or résumé inputs
    await expect(app.getByRole("textbox")).toHaveCount(0);
    await app.getByRole("button", { name: "Try the demo" }).click();
    await expect(app.getByText("Correlating evidence")).toBeVisible({ timeout: 120_000 });
    await app.getByText("Report", { exact: true }).first().click();
    await expect(app.getByText(/What you might have missed/i).first()).toBeVisible({ timeout: 60_000 });
    await expect(app.getByText(/demo data/i).first()).toBeVisible();
    await app.getByText("History", { exact: true }).first().click();
    await expect(app.getByText(/History is turned off/)).toBeVisible();
  });

  test("Fake News Predictor: example texts give the same labels as the local run, and short text is refused", async ({ page }) => {
    const app = await launch(page, "Fake News Predictor", "fake-news-predictor");
    await expect(app.getByRole("heading", { name: "Indian News Fake News Detector" })).toBeVisible({ timeout: 180_000 });
    await expect(app.getByText(/runs entirely inside your browser/)).toBeVisible();

    const area = app.getByRole("textbox", { name: "Paste the article text" });
    const cases: [string, RegExp, string][] = [
      ["A fact-check style paragraph", /^A viral video shared/, "Prediction: FAKE (Confidence: 0.99)"],
      ["A news-report style paragraph", /^NEW DELHI: A final decision/, "Prediction: REAL (Confidence: 0.88)"],
    ];
    for (const [label, startsWith, expected] of cases) {
      await app.getByRole("button", { name: label }).click();
      await expect(area).toHaveValue(startsWith, { timeout: 60_000 });
      await app.getByRole("button", { name: "Check text" }).click();
      await expect(app.getByText(expected)).toBeVisible({ timeout: 60_000 });
    }

    await area.fill("too short");
    await app.getByRole("button", { name: "Check text" }).click();
    await expect(app.getByText(/Not enough text to score/)).toBeVisible({ timeout: 60_000 });
  });

  test("the window offers the same app full-size in a new tab", async ({ page }) => {
    await launch(page, "Fake News Predictor", "fake-news-predictor");
    const w = win(page, "demo:fake-news-predictor");
    await expect(w.getByText("Runs in your browser (WebAssembly)")).toBeVisible();
    await expect(w.getByRole("link", { name: /Open full application/ })).toHaveAttribute("href", "/demos/fake-news/index.html");
  });
});
