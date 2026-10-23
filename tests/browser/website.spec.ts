import { expect, test, type Page, type Route } from "@playwright/test";

const site = {
  settings: {
    basic: {
      shortName: "SFHYL TEST",
      siteNameEn: "SFHYL Test Motors",
    },
    contact: {
      phone: "+86 100 2000 3000",
      email: "sales@example.test",
      address: "Test vehicle yard",
    },
    features: { maintenanceMode: false },
  },
  navigation: [
    {
      key: "home",
      labelZh: "首页",
      labelEn: "Home",
      labelRu: "Главная",
      href: "/",
      target: "SELF",
    },
    {
      key: "contact",
      labelZh: "联系我们",
      labelEn: "Contact",
      labelRu: "Контакты",
      href: "/contact",
      target: "SELF",
    },
  ],
};

const home = {
  sections: [],
  features: [],
  banners: [
    {
      id: "1",
      titleZh: "测试出口车场",
      titleEn: "Test export yard",
      desktopMedia: { url: "/about/hero-03.jpg" },
      mobileMedia: null,
    },
  ],
};

const homepageContent = {
  content: {
    managed: true,
    heroEnabled: true,
    hero: [
      {
        imageMediaId: "custom-hero",
        mobileMediaId: null,
        enabled: true,
        title: { zh: "自定义首页轮播", en: "Custom homepage carousel" },
      },
    ],
  },
  media: {
    "custom-hero": { url: "/about/hero-04.jpg" },
  },
};

const serviceEntry = (title: string) => `<li><strong>${title}</strong><p>${title} summary</p><ul><li>${title} detail</li></ul></li>`;
const serviceModules = [
  {
    id: "home-service-process",
    enabled: true,
    placement: "HOME_AFTER_FEATURES",
    displayScope: "HOME",
    title: { zh: "服务流程", en: "How the service works", ru: "Как проходит работа" },
    body: {
      zh: `<ol>${["需求确认", "车源匹配", "验车与资料", "跨境运输", "交付跟进"].map(serviceEntry).join("")}</ol>`,
      en: `<ol>${["Confirm needs", "Match supply", "Inspection", "Transport", "Handover"].map(serviceEntry).join("")}</ol>`,
      ru: `<ol>${["Задача", "Подбор", "Проверка", "Перевозка", "Передача"].map(serviceEntry).join("")}</ol>`,
    },
    mediaType: "NONE",
  },
  {
    id: "home-service-regions",
    enabled: true,
    placement: "HOME_AFTER_FEATURES",
    displayScope: "HOME",
    title: { zh: "服务区域", en: "Service regions", ru: "География обслуживания" },
    body: {
      zh: `<p>选择国家</p><ul>${["俄罗斯", "哈萨克斯坦", "吉尔吉斯斯坦", "乌兹别克斯坦", "塔吉克斯坦", "土库曼斯坦"].map(serviceEntry).join("")}</ul>`,
      en: `<p>Select a country</p><ul>${["Russia", "Kazakhstan", "Kyrgyzstan", "Uzbekistan", "Tajikistan", "Turkmenistan"].map(serviceEntry).join("")}</ul>`,
      ru: `<p>Выберите страну</p><ul>${["Россия", "Казахстан", "Кыргызстан", "Узбекистан", "Таджикистан", "Туркменистан"].map(serviceEntry).join("")}</ul>`,
    },
    mediaType: "NONE",
  },
];

const vehicle = {
  id: "101",
  slug: "test-suv",
  stockNo: "TEST-001",
  nameZh: "测试 SUV",
  nameEn: "Test SUV",
  brand: { nameZh: "测试汽车", nameEn: "TEST MOTORS" },
  model: { nameZh: "一号", nameEn: "X1" },
  year: 2025,
  price: "15000.00",
  currency: "USD",
  showPrice: false,
  mileage: 1200,
  mileageUnit: "KM",
  saleStatus: "AVAILABLE",
  coverMedia: { url: "/cars/car-01.jpg" },
  media: [],
};

function json(route: Route, data: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify({ code: status >= 400 ? status * 100 + 1 : 0, data }),
  });
}

async function mockPublicApi(
  page: Page,
  onInquiry?: (payload: unknown) => void,
  options: {
    siteDelayMs?: number;
    siteFailure?: boolean;
    siteFailuresRemaining?: number;
    vehicleFailuresRemaining?: number;
    vehicleItems?: Array<typeof vehicle>;
    customModules?: unknown[];
    customMedia?: Record<string, { url: string }>;
    homeFeatures?: Array<Record<string, unknown>>;
    homeSections?: unknown[];
    footerContent?: Record<string, unknown>;
    branding?: Record<string, string>;
    social?: Record<string, string>;
    whatsapp?: string;
    brandItems?: Array<Record<string, unknown>>;
  } = {},
): Promise<void> {
  let siteFailuresRemaining = options.siteFailuresRemaining ?? (options.siteFailure ? Infinity : 0);
  let vehicleFailuresRemaining = options.vehicleFailuresRemaining ?? 0;
  const publicVehicles = options.vehicleItems ?? [vehicle];
  await page.route("**/api/v1/public/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/public/exchange-rates")) {
      return json(route, {
        ok: true,
        formatted: { cnyRub: "₽11.31", cnyUsd: "$0.15", cnyEur: "€0.13" },
      });
    }
    if (path.endsWith("/public/site")) {
      if (options.siteDelayMs) {
        await new Promise<void>((resolve) => setTimeout(resolve, options.siteDelayMs));
      }
      if (siteFailuresRemaining > 0) {
        siteFailuresRemaining -= 1;
        return json(route, {}, 503);
      }
      return json(route, {
        ...site,
        settings: {
          ...site.settings,
          ...(options.branding ? { branding: options.branding } : {}),
          ...(options.social ? { social: options.social } : {}),
          ...(options.whatsapp ? { contact: { ...site.settings.contact, whatsapp: options.whatsapp } } : {}),
        },
      });
    }
    if (path.endsWith("/public/home")) return json(route, { ...home, sections: options.homeSections ?? home.sections, features: options.homeFeatures ?? home.features });
    if (path.endsWith("/public/brands")) return json(route, options.brandItems || []);
    if (path.endsWith("/public/homepage-content")) return json(route, {
      ...homepageContent,
      media: { ...homepageContent.media, ...options.customMedia },
      content: { ...homepageContent.content, ...options.footerContent, ...(options.customModules ? { customModules: options.customModules } : {}) },
    });
    if (path.endsWith("/public/vehicles")) {
      if (vehicleFailuresRemaining > 0) {
        vehicleFailuresRemaining -= 1;
        return json(route, {}, 503);
      }
      return json(route, {
        items: publicVehicles,
        pagination: {
          page: 1,
          pageSize: 100,
          total: publicVehicles.length,
          totalPages: 1,
        },
      });
    }
    if (path.includes("/public/vehicles/")) {
      const slug = decodeURIComponent(path.split("/").pop() || "");
      const item = publicVehicles.find(candidate => candidate.slug === slug);
      return item ? json(route, item) : json(route, {}, 404);
    }
    if (path.endsWith("/public/inquiries") && request.method() === "POST") {
      onInquiry?.(request.postDataJSON());
      return json(
        route,
        { id: "9001", reference: "INQ-TEST-001", duplicate: false },
        201,
      );
    }
    if (path.endsWith("/public/pages/about")) {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ code: 40401, message: "页面不存在" }),
      });
    }
    return json(route, {});
  });
}

test("renders the API-backed vehicle catalogue", async ({
  page,
}, testInfo) => {
  await mockPublicApi(page);
  await page.goto("/vehicles?lang=en");

  await expect(
    page.getByRole("link", { name: "SFHYL TEST home" }),
  ).toBeVisible();
  await expect(page.getByText("Test SUV", { exact: true })).toBeVisible();
  await expect(page.locator(".vehicle-card")).toHaveCount(1);
  await expect(page.locator(".vehicle-card .price")).toContainText("$15,000");
  await expect(page.locator(".vehicle-card .price")).not.toContainText("Inquire");
  const screenshotPath = testInfo.outputPath("desktop-catalogue.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("desktop-catalogue", {
    path: screenshotPath,
    contentType: "image/png",
  });
});

test("shares the About footer across the home, catalogue and contact pages", async ({ page }) => {
  await mockPublicApi(page, undefined, {
    footerContent: {
      quickNav: {
        enabled: true,
        title: { zh: '快捷导航', en: 'Quick navigation' },
        items: [
          { href: '#about', label: { zh: '关于我们', en: 'About us' }, enabled: true },
          { href: '#fahuo', label: { zh: '运输与交付', en: 'Transport and delivery' }, enabled: true },
        ],
      },
      locations: {
        enabled: true,
        title: { zh: '办公室与停车场', en: 'Offices and parking yards' },
        items: [{ enabled: true, address: { zh: '测试办公室地址', en: 'Test office address' } }],
      },
    },
  });

  for (const route of ['/', '/vehicles', '/contact', '/about']) {
    await page.goto(`${route}?lang=zh`);
    const footer = page.locator('.about-footer');
    await expect(footer.getByRole('heading', { name: '快捷导航' })).toBeVisible();
    await expect(footer.getByRole('heading', { name: '办公室与停车场' })).toBeVisible();
    await expect(footer.getByText('测试办公室地址')).toBeVisible();
    await expect(footer.locator('.about-footer-copy')).toContainText('Copyright ©');
    await expect(footer.getByRole('link', { name: '运输与交付' })).toHaveAttribute(
      'href', route === '/about' ? '#fahuo' : '/about?lang=zh#fahuo',
    );
  }

  await page.goto('/contact?lang=en');
  await expect(page.locator('.about-footer').getByRole('heading', { name: 'Quick navigation' })).toBeVisible();
  await expect(page.locator('.about-footer').getByText('Test office address')).toBeVisible();
  await page.locator('.about-footer').getByRole('link', { name: 'Transport and delivery' }).click();
  await expect(page).toHaveURL(/\/about\?lang=en#fahuo$/);
});

test('opens configured contact channels and keeps missing links inactive', async ({ page }) => {
  await mockPublicApi(page, undefined, {
    whatsapp: '+7 914 069 31 89',
    social: { facebook: 'https://facebook.com/sfhyl-test', tiktok: '' },
  });
  await page.goto('/contact?lang=zh');

  await expect(page.locator('.contact-social-link')).toHaveCount(3);
  await expect(page.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/79140693189');
  await expect(page.getByRole('link', { name: 'Facebook' })).toHaveAttribute('href', 'https://facebook.com/sfhyl-test');
  await expect(page.locator('.contact-social-link--tiktok')).not.toHaveAttribute('href');
  await expect(page.getByRole('link', { name: 'TikTok' })).toHaveCount(0);
});

test('uses an editable WhatsApp link when supplied', async ({ page }) => {
  await mockPublicApi(page, undefined, {
    whatsapp: '+7 914 069 31 89',
    social: { whatsapp: 'https://wa.me/message/SFHYLTEST', tiktok: 'https://tiktok.com/@sfhyl-test' },
  });
  await page.goto('/contact?lang=en');

  await expect(page.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/message/SFHYLTEST');
  await expect(page.getByRole('link', { name: 'TikTok' })).toHaveAttribute('href', 'https://tiktok.com/@sfhyl-test');
});

test("shows contact before the site menu request finishes", async ({ page }) => {
  await mockPublicApi(page, undefined, { siteDelayMs: 2000 });
  await page.goto("/?lang=en");

  await expect(page.locator('.nav-link[href^="/aboutus.html"]')).toHaveCount(0);
  await expect(page.locator('.nav-link[href*="waybill"]')).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("link", { name: "Contact us", exact: true })).toBeVisible({ timeout: 500 });
  await expect(page.getByRole("link", { name: "SFHYL TEST home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Contact", exact: true })).toBeVisible();
});

test("renders the published home banner and managed About carousel", async ({ page }) => {
  await mockPublicApi(page);
  await page.goto("/?lang=en");

  await expect(page.locator(".home-hero-picture img")).toHaveAttribute("src", /\/about\/hero-03\.webp$/);
  await expect(page.locator(".home-hero-picture img")).toHaveAttribute("alt", "Test export yard");
  await expect(page.locator(".home-hero h1")).toHaveText("Test export yard");
  await page.goto("/about?lang=en");
  await expect(page.locator(".about-hero img")).toHaveAttribute("src", /\/about\/hero-04\.webp$/);
  await expect(page.locator(".about-hero img")).toHaveAttribute("alt", "Custom homepage carousel");
  for (const width of [1920, 1440, 1280, 1024, 768]) {
    await page.setViewportSize({ width, height: 1080 });
    const ratio = await page.locator(".about-hero img").evaluate(image => {
      const rect = image.getBoundingClientRect();
      return rect.width / rect.height;
    });
    expect(ratio).toBeCloseTo(16 / 9, 3);
  }
});

test("serves legacy MinIO vehicle images through the media route", async ({ page }) => {
  const vehicleWithLegacyMedia = {
    ...vehicle,
    coverMedia: { url: "http://localhost:9200/sfhyl/vehicles/test-cover.webp" },
  };
  await mockPublicApi(page, undefined, { vehicleItems: [vehicleWithLegacyMedia] });
  await page.goto("/vehicles?lang=en");

  await expect(page.locator(".vehicle-card img")).toHaveAttribute("src", "/media/vehicles/test-cover.webp");
});

test("serves a configured legacy logo through the media route", async ({ page }) => {
  await mockPublicApi(page, undefined, {
    branding: { logoUrl: "http://localhost:9200/sfhyl/branding/logo.webp" },
  });
  await page.goto("/?lang=en");

  await expect(page.locator(".brand img")).toHaveAttribute("src", "/media/branding/logo.webp");
  await expect(page.locator(".brand span")).toHaveText("SFHYL TEST");
});

test("builds brand and year filters from published vehicles", async ({ page }) => {
  await mockPublicApi(page);
  await page.goto("/vehicles?lang=en&brand=TEST%20MOTORS&year=2025");

  await expect(page.locator(".select-control").nth(0)).toContainText("TEST MOTORS");
  await expect(page.locator(".select-control").nth(3)).toContainText("2025");
  await expect(page.locator(".vehicle-card:not(.vehicle-skeleton-card)")).toHaveCount(1);
});

test("renders managed brand icons and filters brands without published vehicles", async ({ page }) => {
  await mockPublicApi(page, undefined, {
    brandItems: [
      { id: "1", slug: "lada", nameZh: "拉达（VAZ）", nameEn: "LADA", nameRu: "Лада", logoMedia: { url: "/brand-icons/lada-logo.svg" } },
      { id: "2", slug: "ford", nameZh: "福特", nameEn: "FORD", nameRu: "Форд", logoMedia: { url: "/brand-icons/ford-logo.png" } },
    ],
  });
  await page.goto("/?lang=zh");
  await expect(page.locator(".brand-strip a")).toHaveCount(2);
  await expect(page.locator(".brand-strip a").first()).toContainText("拉达（VAZ）");
  await expect(page.locator(".brand-strip img").first()).toHaveAttribute("src", "/brand-icons/lada-logo.svg");
  await page.locator(".brand-strip a").first().click();
  await expect(page).toHaveURL(/vehicles\?.*brand=LADA/);
  await expect(page.locator(".select-control").first()).toContainText("拉达（VAZ）");
  await expect(page.locator(".empty-state")).toBeVisible();
  await page.goto("/?lang=ru");
  await expect(page.locator(".brand-strip a").first()).toContainText("Лада");
});

test("switches service steps and regions in three languages", async ({ page }) => {
  await mockPublicApi(page, undefined, { customModules: serviceModules });
  await page.goto("/?lang=en");

  await expect(page.locator(".service-step")).toHaveCount(5);
  await expect(page.locator(".service-country")).toHaveCount(6);
  await expect(page.locator(".service-process .service-detail-copy h3")).toHaveText("Confirm needs");
  await page.locator(".service-step").nth(4).click();
  await expect(page.locator(".service-process .service-detail-copy h3")).toHaveText("Handover");
  await expect(page.locator(".service-step[aria-pressed='true']")).toHaveCount(1);
  await page.locator(".service-country").nth(3).click();
  await expect(page.locator(".service-regions .service-detail-copy h3")).toHaveText("Uzbekistan");
  await expect(page.locator(".service-country[aria-pressed='true']")).toHaveCount(1);
  await expect(page.locator(".service-region-contact")).toHaveAttribute("href", "/contact?lang=en");

  await page.goto("/?lang=zh");
  await expect(page.locator(".service-process .service-detail-copy h3")).toHaveText("需求确认");
  await page.goto("/?lang=ru");
  await expect(page.locator(".service-regions .service-detail-copy h3")).toHaveText("Россия");

  await page.setViewportSize({ width: 375, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator(".service-step").nth(2).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".service-process .service-detail-copy h3")).toHaveText("Проверка");
  await page.locator(".service-country").nth(5).focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".service-regions .service-detail-copy h3")).toHaveText("Туркменистан");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator(".service-detail-panel").first().evaluate((element) => getComputedStyle(element).animationDuration)).toBe("1e-05s");
});

test("keeps manually edited service markup visible when it has no interactive structure", async ({ page }) => {
  await mockPublicApi(page, undefined, { customModules: [
    { ...serviceModules[0], body: { zh: "<p>手工流程</p>", en: "<p>Manual process</p>", ru: "<p>Ручной процесс</p>" } },
    { ...serviceModules[1], enabled: false },
  ] });
  await page.goto("/?lang=en");

  await expect(page.locator("#custom-home-service-process .custom-content-rich-text")).toHaveText("Manual process");
  await expect(page.locator(".service-step")).toHaveCount(0);
  await expect(page.locator("#custom-home-service-regions")).toHaveCount(0);
});

test("keeps service steps interactive with a managed photo across screen sizes", async ({ page }) => {
  await mockPublicApi(page, undefined, { customModules: [
    { ...serviceModules[0], mediaType: "IMAGE", imageMediaId: "custom-hero" },
  ] });
  await page.goto("/?lang=zh");
  const photo = page.locator(".service-process-media img");
  await expect(photo).toHaveAttribute("src", "/about/hero-04.webp");
  await photo.scrollIntoViewIfNeeded();
  await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  for (const width of [1440, 1280, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator(".service-step").nth(3).click();
    await expect(page.locator(".service-process .service-detail-copy h3")).toHaveText("跨境运输");
    await expect(page.locator(".service-step[aria-pressed='true']")).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    const layout = await page.locator(".service-detail-container").evaluate(element => {
      const text = element.children[0].getBoundingClientRect();
      const image = element.children[1].getBoundingClientRect();
      return { sideBySide: image.left >= text.right, stacked: image.top >= text.bottom };
    });
    expect(width > 768 ? layout.sideBySide : layout.stacked).toBe(true);
  }
});

test("switches stage photos in three languages and falls back without breaking the next stage", async ({ page }) => {
  const customMedia = Object.fromEntries(Array.from({ length: 5 }, (_, index) => [`stage-${index}`, { url: `/fixture-stage-${index}.svg` }]));
  await page.route('**/fixture-stage-*.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><rect width="1200" height="675" fill="#ccc"/></svg>' }));
  await page.route('**/fixture-stage-2.svg', route => route.fulfill({ status: 404 }));
  await mockPublicApi(page, undefined, { customMedia, customModules: [{ ...serviceModules[0], mediaType: 'IMAGE', imageMediaId: 'custom-hero', stageImages: Array.from({ length: 5 }, (_, index) => ({ imageMediaId: `stage-${index}` })) }] });
  for (const lang of ['zh', 'en', 'ru']) {
    for (const width of [1440, 1024, 768, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/?lang=${lang}`);
      for (let index = 0; index < 5; index++) {
        await page.locator('.service-step').nth(index).click();
        const photo = page.locator('.service-process-media img');
        await page.locator('.service-process-media').scrollIntoViewIfNeeded();
        await expect(photo).toHaveAttribute('src', index === 2 ? '/about/hero-04.webp' : `/fixture-stage-${index}.svg`);
        await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
        await expect(page.locator('.service-step[aria-pressed="true"]')).toHaveCount(1);
        const heading = await page.locator('.service-process .service-detail-copy h3').textContent();
        await expect(photo).toHaveAttribute('alt', new RegExp(heading!));
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }
  }
});

test("uses stage photos with the legacy default media mode", async ({ page }) => {
  await mockPublicApi(page, undefined, { customModules: [{ ...serviceModules[0], mediaType: 'NONE', stageImages: [{ imageMediaId: 'custom-hero' }] }] });
  await page.goto('/?lang=zh');
  await expect(page.locator('.service-process-media img')).toHaveAttribute('src', '/about/hero-04.webp');
  await page.locator('.service-step').nth(1).click();
  await expect(page.locator('.service-process .service-detail-copy h3')).toHaveText('车源匹配');
});

test("keeps service text and controls available when its photo fails", async ({ page }) => {
  await mockPublicApi(page, undefined, { customModules: [
    { ...serviceModules[0], mediaType: "IMAGE", imageMediaId: "custom-hero" },
  ] });
  await page.route("**/about/hero-04.webp", route => route.fulfill({ status: 404, body: "missing" }));
  await page.goto("/?lang=en");
  await page.locator(".service-process").scrollIntoViewIfNeeded();
  await expect(page.locator(".service-process-media")).toHaveCount(0);
  await page.locator(".service-step").nth(4).click();
  await expect(page.locator(".service-process .service-detail-copy h3")).toHaveText("Handover");
  await expect(page.locator(".service-step")).toHaveCount(5);
});

test("keeps equal homepage gaps around features and between service modules", async ({ page }) => {
  await mockPublicApi(page, undefined, { customModules: serviceModules, homeFeatures: [
    { id: "feature-test", titleZh: "品质保障", titleEn: "Quality", descriptionZh: "核对车辆信息", iconName: "shieldcheck" },
  ] });
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?lang=zh");
    await expect(page.locator(".service-step")).toHaveCount(5);
    const gaps = await page.evaluate(() => {
      const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      return [
        rect(".home-features-grid").top - rect(".home-hero").bottom,
        rect(".service-process > .container").top - rect(".home-features-grid").bottom,
        rect(".service-regions > .container").top - rect(".service-process > .container").bottom,
        rect(".home-fleet-section > .container").top - rect(".service-regions > .container").bottom,
      ];
    });
    for (const gap of gaps) expect(gap).toBeCloseTo(width > 768 ? 64 : 48, 0);
  }
});

test("service advantage photos preserve multilingual copy and responsive proportions", async ({ page }) => {
  const features = Array.from({ length: 4 }, (_, index) => ({
    id: `feature-${index}`, iconType: 'IMAGE', iconName: 'shieldcheck',
    imageMedia: { url: '/about/hero-03.jpg' },
    titleZh: `品质保障 ${index}`, titleEn: `Quality assurance ${index}`, titleRu: `Гарантия качества ${index}`,
    descriptionZh: '采购前核对车况、配置与出口资料，让车辆信息和交付事项清晰可查。',
    descriptionEn: 'Review vehicle condition, specifications and export documents before procurement to keep delivery information clear and accessible.',
    descriptionRu: 'Проверяем состояние автомобиля, комплектацию и экспортные документы перед закупкой, чтобы информация об автомобиле и доставке была понятной и доступной.',
    linkUrl: index === 0 ? 'https://example.test/services' : null,
  }));
  await mockPublicApi(page, undefined, { homeFeatures: features });
  for (const lang of ['zh', 'en', 'ru']) {
    for (const width of [1440, 1280, 1100, 1024, 768, 640, 639, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/?lang=${lang}`);
      const cards = page.locator('.home-feature-item');
      await expect(cards).toHaveCount(4);
      await cards.first().scrollIntoViewIfNeeded();
      await expect(cards.first().locator('strong')).toHaveText(features[0][`title${lang[0].toUpperCase()}${lang.slice(1)}` as keyof typeof features[0]] as string);
      await expect(cards.first()).toHaveAttribute('href', features[0].linkUrl!);
      await expect(cards.first().locator('img')).toHaveAttribute('alt', /场景示意|Illustrative|Иллюстрация/);
      const metrics = await cards.evaluateAll(elements => elements.map(element => {
        const media = element.querySelector('.home-feature-media')!;
        const rect = element.getBoundingClientRect();
        const frame = media.getBoundingClientRect();
        return { top: rect.top, ratio: frame.width / frame.height, overflow: element.scrollWidth > element.clientWidth + 1 };
      }));
      expect(metrics.filter(item => Math.abs(item.top - metrics[0].top) < 1)).toHaveLength(width >= 640 ? 2 : 1);
      for (const item of metrics) { expect(item.ratio).toBeCloseTo(16 / 9, 2); expect(item.overflow).toBe(false); }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test("service advantages keep links and fixed frames for missing, failed and slow photos", async ({ page }) => {
  const features = [
    { id: 'missing', iconType: 'IMAGE', iconName: 'shieldcheck', imageMedia: null },
    { id: 'failed', iconType: 'IMAGE', iconName: 'ship', imageMedia: { url: '/fixture-failed.png' } },
    { id: 'slow', iconType: 'IMAGE', iconName: 'users', imageMedia: { url: '/fixture-slow.jpg' } },
    { id: 'svg', iconType: 'SVG', svgContent: '<svg viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>' },
  ].map(feature => ({ ...feature, titleZh: feature.id, descriptionZh: '完整说明', linkUrl: 'https://example.test/service' }));
  await page.route('**/fixture-failed.png', route => route.fulfill({ status: 404 }));
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/fixture-slow.jpg', async route => { await ready; await route.fulfill({ status: 404 }); });
  await mockPublicApi(page, undefined, { homeFeatures: features });
  await page.goto('/?lang=zh');
  const cards = page.locator('.home-feature-item');
  await cards.first().scrollIntoViewIfNeeded();
  await expect(cards.nth(1).locator('.home-feature-icon svg')).toHaveCount(1);
  await expect(cards.nth(0).locator('.home-feature-icon svg')).toHaveCount(1);
  await expect(cards.nth(3).locator('.home-feature-svg svg')).toHaveCount(1);
  const before = await cards.nth(2).boundingBox();
  release();
  await expect(cards.nth(2).locator('.home-feature-icon svg')).toHaveCount(1);
  const after = await cards.nth(2).boundingBox();
  expect(after!.height).toBeCloseTo(before!.height, 1);
  expect(after!.y).toBeCloseTo(before!.y, 1);
  for (let index = 0; index < 4; index++) {
    await expect(cards.nth(index)).toHaveAttribute('href', 'https://example.test/service');
    await expect(cards.nth(index)).toContainText('完整说明');
    await expect(cards.nth(index).locator('img')).toHaveCount(0);
  }
});

test("uses one responsive media frame for about images, videos and the placeholder", async ({ page }) => {
  await mockPublicApi(page, undefined, { customModules: [
    { id: "company-overview", enabled: true, placement: "ABOUT_AFTER_INTRO", displayScope: "ABOUT",
      title: { zh: "图片卡片" }, body: { zh: "<p>内容</p>" }, mediaType: "IMAGE", imageMediaId: "custom-hero" },
    { id: "company-core-business", enabled: true, placement: "ABOUT_AFTER_INTRO", displayScope: "ABOUT",
      title: { zh: "视频卡片" }, body: { zh: "<p>内容</p>" }, mediaType: "VIDEO", videoMediaId: "custom-hero" },
    { id: "company-core-strengths", enabled: true, placement: "ABOUT_AFTER_INTRO", displayScope: "ABOUT",
      title: { zh: "占位卡片" }, body: { zh: "<p>内容</p>" }, mediaType: "NONE" },
  ] });
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/about?lang=zh");
    await expect(page.locator(".custom-content-media")).toHaveCount(3);
    const dimensions = await page.locator(".custom-content-media").evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }));
    for (const media of dimensions) {
      expect(media.width / media.height).toBeCloseTo(601.48 / 338.32, 2);
      expect(media.width).toBeCloseTo(width > 1000 ? 601.48 : width - 32, 0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("shows inquiry only when a vehicle has no valid sale price", async ({ page }) => {
  await mockPublicApi(page, undefined, {
    vehicleItems: [{ ...vehicle, price: "0", showPrice: false }],
  });
  await page.goto("/vehicles?lang=en");

  await expect(page.locator(".vehicle-card .price")).toContainText("Inquire");
});

test("uses configured homepage recommendations even when a vehicle is outside the catalogue page", async ({ page }) => {
  const selected = { ...vehicle, id: 'outside-page', slug: 'selected-home-car', nameZh: '后台推荐车辆', nameEn: 'Selected homepage car' };
  await mockPublicApi(page, undefined, { homeSections: [
    { type: 'FEATURED_VEHICLES', isEnabled: true, displayCount: 1, _count: { recommendations: 1 },
      recommendations: [{ vehicleId: selected.id, vehicle: selected, isEnabled: true, sortOrder: 0 }] },
  ] });
  await page.goto('/?lang=en');
  await expect(page.locator('.home-preview-grid .vehicle-card')).toHaveCount(1);
  await expect(page.locator('.home-preview-grid')).toContainText('Selected homepage car');
  await expect(page.locator('.home-preview-grid .image-link')).toHaveAttribute('href', '/vehicle/selected-home-car?lang=en');
});

test("shows a valid sale price on the vehicle detail page", async ({ page }) => {
  await mockPublicApi(page);
  await page.goto("/index.php?c=show&id=101&lang=en");

  await expect(page.locator(".price-jpy")).toContainText("$15,000");
  await expect(page.locator(".price-jpy")).not.toContainText("Inquire");
});

test("preserves line breaks in a vehicle description", async ({ page }) => {
  await mockPublicApi(page, undefined, {
    vehicleItems: [{ ...vehicle, descriptionEn: "First line\nSecond line" }],
  });
  await page.goto("/index.php?c=show&id=101&lang=en");

  const description = page.locator(".vehicle-description");
  await expect(description).toHaveCSS("white-space", "pre-line");
  await expect(description).toHaveText("First line\nSecond line");
});

test("does not restore retired menu items when the navigation API is unavailable", async ({ page }) => {
  await mockPublicApi(page, undefined, { siteFailure: true });
  await page.goto("/?lang=en");

  await expect(page.locator('.nav-link[href^="/aboutus.html"]')).toHaveCount(0);
  await expect(page.locator('.nav-link[href*="waybill"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Home", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Vehicle catalogue", exact: true })).toBeVisible();
});

test("redirects the retired About URL to the homepage and keeps the language", async ({ page }) => {
  await mockPublicApi(page);
  await page.goto("/aboutus.html?lang=zh");

  await expect(page).toHaveURL(/\/?lang=zh$/);
  await expect(page.locator('.nav-link[href^="/aboutus.html"]')).toHaveCount(0);
});

test("loads the vehicle catalogue before showing an empty state", async ({ page }) => {
  await mockPublicApi(page, undefined, { siteDelayMs: 700 });
  await page.goto("/vehicles?lang=zh");

  await expect(page.locator(".vehicle-skeleton-card").first()).toBeVisible();
  await expect(page.getByText("没有符合当前筛选条件的车源。", { exact: true })).toHaveCount(0);
  await expect(page.locator(".vehicle-card:not(.vehicle-skeleton-card)")).toHaveCount(1);
});

test("shows the empty catalogue message only after a successful empty response", async ({ page }) => {
  await mockPublicApi(page, undefined, { vehicleItems: [] });
  await page.goto("/vehicles?lang=zh");

  await expect(page.getByText("没有符合当前筛选条件的车源。", { exact: true })).toBeVisible();
  await expect(page.locator(".vehicle-skeleton-card")).toHaveCount(0);
});

test("shows a retryable catalogue error instead of an empty state", async ({ page }) => {
  await mockPublicApi(page, undefined, { vehicleFailuresRemaining: 1 });
  await page.goto("/vehicles?lang=zh");

  await expect(page.getByRole("alert")).toContainText("车辆目录加载失败，请稍后重试。");
  await expect(page.getByText("没有符合当前筛选条件的车源。", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "重新加载" }).click();
  await expect(page.locator(".vehicle-card:not(.vehicle-skeleton-card)")).toHaveCount(1);
});

test("submits a public inquiry and shows its reference", async ({ page }) => {
  let submitted: Record<string, unknown> | undefined;
  await mockPublicApi(page, (payload) => {
    submitted = payload as Record<string, unknown>;
  });
  await page.goto("/contact?lang=en");

  await page.getByLabel("Name *").fill("Test Buyer");
  await page.getByLabel("Email").fill("buyer@example.test");
  await page.getByLabel("Message *").fill("Please send the export quotation.");
  await page.getByRole("button", { name: "Send inquiry" }).click();

  await expect(page.getByText(/INQ-TEST-001/)).toBeVisible();
  expect(submitted).toMatchObject({
    name: "Test Buyer",
    email: "buyer@example.test",
    preferredLanguage: "en",
  });
});

test('catalogue filters support keyboard selection and dismissal', async ({ page }) => {
  await mockPublicApi(page);
  await page.goto('/vehicles?lang=en');
  const brand = page.getByRole('combobox').first();
  await brand.focus();
  await brand.press('ArrowDown');
  await expect(brand).toHaveAttribute('aria-expanded', 'true');
  await brand.press('End');
  await brand.press('Enter');
  await expect(brand).toHaveAttribute('aria-expanded', 'false');
  await brand.click();
  await brand.press('Escape');
  await expect(brand).toBeFocused();
  await expect(brand).toHaveAttribute('aria-expanded', 'false');
});

test('vehicle inquiry dialog traps focus, closes with Escape and returns focus', async ({ page }) => {
  await mockPublicApi(page);
  await page.goto('/vehicle/test-suv?lang=en');
  const trigger = page.locator('.detail-contact-button');
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Name *')).toBeFocused();
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('public pages fit the requested desktop and tablet widths', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await mockPublicApi(page);
  for (const width of [1440, 1280, 1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/vehicles', '/about', '/contact', '/login', '/vehicle/test-suv']) {
      await page.goto(`${route}?lang=zh`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('main')).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    }
    await page.screenshot({ path: testInfo.outputPath(`vehicle-detail-${width}.png`), fullPage: true });
  }
});
