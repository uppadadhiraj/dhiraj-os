import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { openApp, settled, visit, win } from "./helpers";

/**
 * The two hosted demos are the projects' real Streamlit apps running in the visitor's browser (stlite / WebAssembly),
 * served from /demos/. The first run downloads the Python runtime from a CDN, so these tests need internet access
 * and are given a generous timeout.
 */
// Each demo downloads and starts a Python runtime, which is CPU-bound: with several workers loading at once one can
// run past its timeout, so a single retry is allowed (a demo that is really broken fails twice).
test.describe.configure({ timeout: 240_000, retries: 1 });

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

/**
 * The smaller repositories' demos. Each is opened from the Projects window's "Other" tab (Try it), then one real
 * interaction is checked against values the notebooks themselves produce.
 */
async function tryIt(page: Page, name: string, slug: string): Promise<FrameLocator> {
  await visit(page);
  await openApp(page, "Projects", "projects");
  await win(page, "projects").getByRole("tab", { name: "Other" }).click();
  await win(page, "projects").getByRole("button", { name: `Try ${name}` }).click();
  await settled(page, `demo:${slug}`);
  return win(page, `demo:${slug}`).frameLocator("iframe");
}

test.describe("notebook and small-app demos", () => {
  test("Iris Predictor: the repo's own app answers (grid cell, read through the accessible table)", async ({ page }) => {
    const app = await tryIt(page, "Iris Predictor", "iris-predictor");
    await expect(app.getByRole("heading", { name: "Iris type" })).toBeVisible({ timeout: 180_000 });
    for (const [label, value] of [["SepalLengthCm :", "5.1"], ["SepalWidthCm :", "3.5"], ["PetalLengthCm :", "1.4"], ["PetalWidthCm :", "0.2"]]) {
      await app.getByLabel(label).fill(value);
      await app.getByLabel(label).press("Enter");
      await page.waitForTimeout(600);
    }
    await page.waitForTimeout(1000);
    await app.getByRole("button", { name: "Predict" }).click();
    await expect(app.locator("[data-testid=stDataFrame] [role=gridcell]").first()).toHaveText("Iris-setosa", { timeout: 60_000 });
  });

  test("Movie Recommender: Batman gives the five titles the notebook printed", async ({ page }) => {
    const app = await tryIt(page, "Movie Recommender", "movie-recommendations");
    await expect(app.getByRole("heading", { name: "Movie Recommender" })).toBeVisible({ timeout: 180_000 });
    const box = app.getByRole("combobox").first();
    await box.click();
    await box.fill("Batman");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(800);
    await app.getByRole("button", { name: "Recommend Movie" }).click();
    for (const title of ["Batman & Robin", "The Dark Knight Rises", "Batman Begins", "Batman Returns"]) {
      await expect(app.getByText(title, { exact: true })).toBeVisible({ timeout: 60_000 });
    }
  });

  test("Heart Disease Predictor: trains in the browser, predicts, and states its own accuracy", async ({ page }) => {
    const app = await tryIt(page, "Heart Disease Predictor", "heart-disease-predictor");
    await expect(app.getByRole("heading", { name: "Heart Disease Predictor" })).toBeVisible({ timeout: 180_000 });
    await expect(app.getByText(/The notebook is mine; this Streamlit page was written with Claude Code/)).toBeVisible();
    await app.getByRole("button", { name: "Predict" }).click();
    await expect(app.getByText(/Predicted class 0: no heart disease/)).toBeVisible({ timeout: 60_000 });
    await app.getByText("How good is this model?").click();
    await expect(app.getByText(/56\.5%/)).toBeVisible();
  });

  test("Titanic: 891 passengers, 342 survivors", async ({ page }) => {
    const app = await tryIt(page, "Titanic Survival Analysis", "titanic-ship-survival");
    await expect(app.getByRole("heading", { name: "Titanic Survival Analysis" })).toBeVisible({ timeout: 180_000 });
    await expect(app.getByText("891", { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(app.getByText("342", { exact: true })).toBeVisible();
    await expect(app.getByText("38.4%", { exact: true })).toBeVisible();
  });

  test("House price (SCT_ML_1): R² 0.658 as in the notebook", async ({ page }) => {
    const app = await tryIt(page, "House Price · Linear Regression", "sct-ml-1");
    await expect(app.getByText("Estimated sale price")).toBeVisible({ timeout: 180_000 });
    await expect(app.getByText("0.658", { exact: true })).toBeVisible();
    await expect(app.getByText("$169,595", { exact: true })).toBeVisible();
  });

  test("Netflix EDA: cleaned catalogue counts and the title browser", async ({ page }) => {
    const app = await tryIt(page, "Netflix Content EDA", "netflix-content-eda");
    await expect(app.getByRole("heading", { name: "Netflix content explorer" })).toBeVisible({ timeout: 180_000 });
    await expect(app.getByText("7,770", { exact: true })).toBeVisible({ timeout: 90_000 });
    await app.getByRole("tab", { name: "Browse titles" }).click();
    await expect(app.getByText(/titles match/)).toBeVisible();
  });

  test("Linear regression from scratch: reproduces the notebook's w = 9,514 and b = 23,697", async ({ page }) => {
    const app = await tryIt(page, "Linear Regression from Scratch", "linear-regression-from-scratch");
    await expect(app.getByText("Weight w")).toBeVisible({ timeout: 180_000 });
    await expect(app.getByText("9,514", { exact: true })).toBeVisible();
    await expect(app.getByText("23,697", { exact: true })).toBeVisible();
  });

  test("Logistic regression from scratch: reproduces the notebook's accuracies", async ({ page }) => {
    const app = await tryIt(page, "Logistic Regression from Scratch", "logistic-regression-from-scratch");
    await expect(app.getByText("Accuracy on test data")).toBeVisible({ timeout: 180_000 });
    await expect(app.getByText("0.777", { exact: true })).toBeVisible();
    await expect(app.getByText("0.766", { exact: true })).toBeVisible();
    await app.getByRole("button", { name: "Predict" }).click();
    await expect(app.getByText("The person is diabetic")).toBeVisible({ timeout: 30_000 });
  });
});
