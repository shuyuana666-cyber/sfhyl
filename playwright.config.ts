import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  retries: 0,
  preserveOutput: "always",
  reporter: [["list"]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "website",
      testMatch: /(^|[\\/])website\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:5174" },
    },
    {
      name: "admin",
      testMatch: /(^|[\\/])admin\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:8848" },
    },
    {
      name: "website-mobile",
      testMatch: /(^|[\\/])responsive-website\.spec\.ts$/,
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        baseURL: "http://127.0.0.1:5174",
      },
    },
    {
      name: "admin-mobile",
      testMatch: /(^|[\\/])responsive-admin\.spec\.ts$/,
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        baseURL: "http://127.0.0.1:8848",
      },
    },
  ],
  webServer: [
    {
      command: "pnpm exec vite --config vite.config.js --host 127.0.0.1 --port 5174",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @sfhyl/admin-web exec vite --host 127.0.0.1 --port 8848",
      url: "http://127.0.0.1:8848",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
