import { expect, test, type Page, type Route } from "@playwright/test";

function json(route: Route, data: unknown): Promise<void> {
  return route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ code: 0, data }),
  });
}

async function mockPublicApi(page: Page): Promise<void> {
  await page.route("**/api/v1/public/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/public/exchange-rates")) {
      return json(route, { ok: true, formatted: {} });
    }
    if (path.endsWith("/public/site")) {
      return json(route, {
        settings: {
          basic: { shortName: "SFHYL TEST", siteNameEn: "SFHYL Test Motors" },
          contact: { phone: "+86 100 2000 3000", email: "sales@example.test" },
          features: { maintenanceMode: false },
        },
        navigation: [
          { key: "home", labelEn: "Home", href: "/", target: "SELF" },
          { key: "contact", labelEn: "Contact", href: "/contact", target: "SELF" },
        ],
      });
    }
    if (path.endsWith("/public/home")) {
      return json(route, {
        sections: [],
        features: [],
        banners: [
          {
            id: "1",
            titleEn: "Test export yard",
            desktopMedia: { url: "/about/hero-03.jpg" },
          },
        ],
      });
    }
    if (path.endsWith("/public/vehicles")) {
      return json(route, {
        items: [
          {
            id: "101",
            slug: "test-suv",
            stockNo: "TEST-001",
            nameEn: "Test SUV",
            brand: { nameEn: "TEST MOTORS" },
            year: 2025,
            price: "15000.00",
            currency: "USD",
            saleStatus: "AVAILABLE",
            coverMedia: { url: "/cars/car-01.jpg" },
          },
        ],
        pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
      });
    }
    return json(route, {});
  });
}

test("mobile homepage renders without horizontal overflow", async ({ page }, testInfo) => {
  await mockPublicApi(page);
  await page.goto("/?lang=en");

  await expect(page.getByRole("link", { name: "SFHYL TEST home" })).toBeVisible();
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("link", { name: "Vehicle catalogue" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Contact", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth + 1),
  );

  const screenshotPath = testInfo.outputPath("mobile-homepage.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("mobile-homepage", {
    path: screenshotPath,
    contentType: "image/png",
  });
});

test("keeps the homepage hero and two-column vehicle catalogue within mobile width", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 529, height: 900 });
  await mockPublicApi(page);
  await page.goto("/?lang=en");

  await expect(page.locator(".home-hero")).toBeVisible();
  const homeLayout = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>(".home-hero");
    return {
      heroHeight: Math.round(hero?.getBoundingClientRect().height ?? 0),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });

  expect(homeLayout.heroHeight).toBeGreaterThanOrEqual(535);
  expect(homeLayout.scrollWidth).toBeLessThanOrEqual(homeLayout.clientWidth + 1);

  const screenshotPath = testInfo.outputPath("mobile-homepage-density.png");
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await testInfo.attach("mobile-homepage-density", {
    path: screenshotPath,
    contentType: "image/png",
  });

  await page.goto("/vehicles?lang=en");
  await expect(page.locator(".vehicle-card:not(.vehicle-skeleton-card)")).toHaveCount(1);
  const catalogueLayout = await page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>(".vehicle-grid");
    return {
      columnCount: getComputedStyle(grid ?? document.body).gridTemplateColumns.split(" ").length,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });

  expect(catalogueLayout.columnCount).toBe(2);
  expect(catalogueLayout.scrollWidth).toBeLessThanOrEqual(catalogueLayout.clientWidth + 1);
});

test("mobile navigation dismisses outside, restores focus and resets across breakpoints", async ({ page }) => {
  await mockPublicApi(page);
  await page.goto("/?lang=en");
  const menu = page.getByRole("button", { name: "Open menu" });
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await menu.click();
  await page.locator("main").click({ position: { x: 8, y: 500 } });
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await menu.click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(menu).toBeHidden();
  await expect(page.locator(".menu-button")).toHaveAttribute("aria-expanded", "false");
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".nav-links")).toBeHidden();
});
