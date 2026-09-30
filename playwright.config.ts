import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3100";

/**
 * End-to-end tests run against a production build (`npm run build && npm run e2e`) by default,
 * or against any deployed URL with BASE_URL=https://… (used for the post-deploy check).
 * Uses the installed Chrome, so no browser download is required.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? `http://localhost:${PORT}`,
    channel: "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 900 } },
      grepInvert: /@mobile/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], channel: "chrome" },
      grep: /@mobile/,
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npm run start -- -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
