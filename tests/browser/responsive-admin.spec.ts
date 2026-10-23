import { expect, test, type Page, type Route } from "@playwright/test";

function envelope(route: Route, data: unknown): Promise<void> {
  return route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ code: 0, message: "success", data, requestId: "pw-mobile" }),
  });
}

async function mockAdminApi(page: Page): Promise<void> {
  await page.route("http://127.0.0.1:3002/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/login")) {
      return envelope(route, {
        accessToken: "mobile-access-token",
        refreshToken: "mobile-refresh-token",
        accessExpiresIn: "15m",
        refreshExpiresAt: "2099-01-01T00:00:00.000Z",
      });
    }
    if (path.endsWith("/auth/me")) {
      return envelope(route, {
        id: "1",
        username: "mobile-admin",
        displayName: "Mobile Admin",
        roleCodes: ["super_admin"],
        permissions: ["dashboard:view"],
        menus: [],
      });
    }
    if (path.endsWith("/admin/dashboard")) {
      return envelope(route, {
        period: { from: "2026-07-01", to: "2026-07-30" },
        summary: { vehicleTotal: 7, vehicleAvailable: 5, inquiryToday: 2 },
        inquiryTrend: [], vehicleTrend: [], recentLogins: [], recentAudits: [],
        recentVehicles: [], topVehicles: [],
      });
    }
    return envelope(route, {});
  });
}

test("mobile admin login and dashboard do not overflow", async ({ page }, testInfo) => {
  await mockAdminApi(page);
  await page.goto("/#/login");

  const fields = page.locator("input");
  await fields.nth(0).fill("mobile-admin");
  await fields.nth(1).fill("PlaywrightPassword123");
  await page.getByRole("button").first().click();
  await expect(page).toHaveURL(/#\/dashboard/);
  await page.waitForTimeout(3500);
  await expect(page.locator(".metric-tile").first()).toContainText("7");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth + 1),
  );

  const screenshotPath = testInfo.outputPath("mobile-admin-dashboard.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("mobile-admin-dashboard", {
    path: screenshotPath,
    contentType: "image/png",
  });
});
