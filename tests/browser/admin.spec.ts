import { expect, test, type Page, type Route } from "@playwright/test";

const contentPermissions = ["dashboard:view", "content:view", "content:manage"];
let grantedPermissions = [...contentPermissions];
let pageFailuresRemaining = 0;
let savedVehiclePayload: Record<string, unknown> | null = null;
let vehicleListDelayMs = 0;

const mediaAssets = [
  {
    id: "media-a",
    folderId: "folder-root",
    url: "/uploads/media-a.jpg",
    originalName: "front.jpg",
    filename: "media-a.jpg",
    mimeType: "image/jpeg",
    sizeBytes: "1024",
    createdAt: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "media-b",
    folderId: "folder-root",
    url: "/uploads/media-b.jpg",
    originalName: "rear.jpg",
    filename: "media-b.jpg",
    mimeType: "image/jpeg",
    sizeBytes: "1024",
    createdAt: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "media-c",
    folderId: null,
    url: "/uploads/media-c.jpg",
    originalName: "replacement.jpg",
    filename: "media-c.jpg",
    mimeType: "image/jpeg",
    sizeBytes: "1024",
    createdAt: "2026-07-01T00:00:00.000Z",
  },
];

const mediaFolders = [
  {
    id: "folder-root",
    name: "Vehicle photos",
    parentId: null,
    _count: { assets: 2, children: 1 },
  },
  {
    id: "folder-child",
    name: "SUV details",
    parentId: "folder-root",
    _count: { assets: 0, children: 0 },
  },
  {
    id: "folder-brand",
    name: "Brand logos",
    parentId: null,
    _count: { assets: 0, children: 0 },
  },
];

const uploadRecords = [
  {
    id: "upload-1",
    originalName: "vehicle-brochure.pdf",
    mimeType: "application/pdf",
    sizeBytes: "2048",
    status: "SUCCEEDED",
    durationMs: 120,
    createdAt: "2026-07-15T08:30:00.000Z",
    completedAt: "2026-07-15T08:30:00.120Z",
    mediaAsset: { id: "media-a", url: "/uploads/media-a.jpg", thumbnailUrl: null },
    createdBy: { id: "1", username: "playwright-admin", displayName: "Playwright Admin" },
  },
  {
    id: "upload-2",
    originalName: "unsupported.exe",
    mimeType: "application/octet-stream",
    sizeBytes: "12",
    status: "FAILED",
    errorMessage: "Invalid file type",
    durationMs: 4,
    createdAt: "2026-07-15T08:20:00.000Z",
    completedAt: "2026-07-15T08:20:00.004Z",
    createdBy: { id: "1", username: "playwright-admin", displayName: "Playwright Admin" },
  },
];

const vehicle = {
  id: "vehicle-1",
  stockNo: "PW-001",
  nameZh: "测试车辆",
  nameEn: "Test Vehicle",
  slug: "test-vehicle",
  type: "NEW",
  year: 2026,
  price: "25000",
  currency: "USD",
  status: "DRAFT",
  saleStatus: "AVAILABLE",
  isFeatured: false,
  brandId: "brand-1",
  brand: {
    id: "brand-1",
    nameZh: "测试品牌",
    nameEn: "Test Brand",
    slug: "test-brand",
    isEnabled: true,
  },
  coverMediaId: "media-a",
  highlights: [],
  specifications: {},
  tags: [],
  media: [
    {
      mediaId: "media-a",
      type: "COVER",
      altZh: "正面",
      altEn: "Front",
      sortOrder: 0,
      isCover: true,
      media: mediaAssets[0],
    },
    {
      mediaId: "media-b",
      type: "GALLERY",
      altZh: "背面",
      altEn: "Rear",
      sortOrder: 1,
      isCover: false,
      media: mediaAssets[1],
    },
  ],
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

function envelope(route: Route, data: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization,content-type",
      "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    },
    contentType: "application/json",
    body: JSON.stringify({
      code: 0,
      message: "success",
      data,
      requestId: "pw-test",
    }),
  });
}

async function mockAdminApi(page: Page): Promise<void> {
  await page.route("http://127.0.0.1:3002/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") return envelope(route, null, 204);
    if (path.endsWith("/auth/login")) {
      return envelope(route, {
        accessToken: "playwright-access-token",
        refreshToken: "playwright-refresh-token",
        accessExpiresIn: "15m",
        refreshExpiresAt: "2099-01-01T00:00:00.000Z",
      });
    }
    if (path.endsWith("/auth/me")) {
      return envelope(route, {
        id: "1",
        username: "playwright-admin",
        email: "admin@example.test",
        displayName: "Playwright Admin",
        roleCodes: ["super_admin"],
        permissions: grantedPermissions,
        menus: [],
      });
    }
    if (path.endsWith("/admin/dashboard")) {
      return envelope(route, {
        period: { from: "2026-07-01", to: "2026-07-30" },
        summary: { vehicleTotal: 7, vehicleAvailable: 5, inquiryToday: 2 },
        inquiryTrend: [],
        vehicleTrend: [],
        recentLogins: [],
        recentAudits: [],
        recentVehicles: [],
        topVehicles: [],
      });
    }
    if (path.endsWith("/admin/pages")) {
      if (pageFailuresRemaining > 0) {
        pageFailuresRemaining -= 1;
        return route.fulfill({
          status: 500,
          headers: { "access-control-allow-origin": "*" },
          contentType: "application/json",
          body: JSON.stringify({
            code: 50001,
            message: "测试加载失败",
            requestId: "pw-test",
          }),
        });
      }
      return envelope(route, {
        items: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      });
    }
    if (path.endsWith("/admin/brands")) return envelope(route, [vehicle.brand]);
    if (path.endsWith("/admin/categories")) return envelope(route, []);
    if (path.endsWith("/admin/tags")) return envelope(route, []);
    if (path.endsWith("/admin/series")) return envelope(route, []);
    if (path.endsWith("/admin/models")) return envelope(route, []);
    if (path.endsWith("/admin/media/uploads")) {
      return envelope(route, {
        items: uploadRecords,
        pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
      });
    }
    if (path.endsWith("/admin/media/folders")) {
      return envelope(route, mediaFolders);
    }
    if (path.endsWith("/admin/media")) {
      const folderId = new URL(request.url()).searchParams.get("folderId");
      const unfiled = new URL(request.url()).searchParams.get("unfiled") === "true";
      const filtered = unfiled
        ? mediaAssets.filter(item => !item.folderId)
        : folderId
          ? mediaAssets.filter(item => item.folderId === folderId)
          : mediaAssets;
      return envelope(route, {
        items: filtered,
        pagination: { page: 1, pageSize: 100, total: filtered.length, totalPages: 1 },
      });
    }
    if (path.endsWith("/admin/inquiries/notes")) {
      return envelope(route, {
        items: [
          {
            id: "note-1",
            content: "已发送报价单，周五回访确认运输方案。",
            createdAt: "2026-07-15T08:30:00.000Z",
            author: {
              id: "1",
              username: "playwright-admin",
              displayName: "Playwright Admin",
            },
            inquiry: {
              id: "inquiry-1",
              name: "测试客户",
              companyName: "测试贸易有限公司",
              status: "FOLLOWING",
              vehicle: { stockNo: "PW-001", nameZh: "测试车辆" },
            },
          },
        ],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      });
    }
    if (path.endsWith("/admin/vehicles/vehicle-1")) {
      if (request.method() === "PATCH") {
        savedVehiclePayload = request.postDataJSON() as Record<string, unknown>;
        return envelope(route, { ...vehicle, ...savedVehiclePayload });
      }
      return envelope(route, vehicle);
    }
    if (path.endsWith("/admin/vehicles")) {
      if (vehicleListDelayMs) {
        await new Promise<void>(resolve => setTimeout(resolve, vehicleListDelayMs));
      }
      return envelope(route, {
        items: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      });
    }
    return envelope(route, {});
  });
}

async function login(page: Page): Promise<void> {
  await page.goto("/#/login");
  await page.getByPlaceholder("用户名或邮箱").fill("playwright-admin");
  await page.getByPlaceholder("密码").fill("PlaywrightPassword123");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/#\/dashboard/);
}

test.beforeEach(async ({ page }) => {
  grantedPermissions = [...contentPermissions];
  pageFailuresRemaining = 0;
  savedVehiclePayload = null;
  vehicleListDelayMs = 0;
  await mockAdminApi(page);
});

test("logs in, renders dashboard data, and hides unauthorized menus", async ({
  page,
}, testInfo) => {
  await login(page);
  await page.waitForTimeout(3500);

  await expect(page.getByRole("heading", { name: "数据概览" })).toBeVisible();
  await expect(
    page.locator(".metric-tile", { hasText: "车辆总数" }),
  ).toContainText("7");
  await expect(page.getByText("车辆管理", { exact: true })).toHaveCount(0);
  const screenshotPath = testInfo.outputPath("desktop-admin-dashboard.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("desktop-admin-dashboard", {
    path: screenshotPath,
    contentType: "image/png",
  });
});

test("warns before leaving a modified page form", async ({ page }) => {
  await login(page);
  await page.goto("/#/content/pages/create");
  await expect(page.getByRole("heading", { name: "新增页面" })).toBeVisible();

  await page.getByLabel("中文标题").fill("未保存页面");
  await page.getByRole("button", { name: "返回列表" }).click();
  await expect(
    page.getByText("当前修改尚未保存，离开后将丢失。是否继续？"),
  ).toBeVisible();
  await page.getByRole("button", { name: "继续编辑" }).click();
  await expect(page).toHaveURL(/#\/content\/pages\/create/);

  await page.getByRole("button", { name: "返回列表" }).click();
  await page.getByRole("button", { name: "离开" }).click();
  await expect(page).toHaveURL(/#\/content\/pages$/);
});

test("uses Chinese-only editor fields and optional automatic vehicle stock numbers", async ({ page }) => {
  grantedPermissions = [...contentPermissions, "vehicle:view", "vehicle:create"];
  await login(page);

  await page.goto("/#/vehicles/create");
  await expect(page.getByLabel("库存编号")).toHaveAttribute(
    "placeholder",
    "留空后自动按日期生成"
  );
  await expect(page.getByText("英文名称", { exact: true })).toHaveCount(0);
  await expect(page.getByText("俄文名称", { exact: true })).toHaveCount(0);

  await page.goto("/#/content/pages/create");
  await expect(page.getByText("英文标题", { exact: true })).toHaveCount(0);
  await expect(page.getByText("俄文标题", { exact: true })).toHaveCount(0);
});

test("shows a retryable list error and recovers to the empty state", async ({
  page,
}) => {
  await login(page);
  pageFailuresRemaining = 1;
  await page.goto("/#/content/pages");

  const errorState = page.locator(".request-error");
  await expect(
    errorState.getByText("测试加载失败", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "重新加载" }).click();
  await expect(errorState).toHaveCount(0);
  await expect(page.getByText("暂无页面", { exact: true })).toBeVisible();
});

test("loads vehicles before rendering the empty state", async ({ page }) => {
  grantedPermissions = [...contentPermissions, "vehicle:view"];
  await login(page);
  vehicleListDelayMs = 700;
  await page.goto("/#/vehicles/list");

  await expect(page.locator(".vehicle-list-loading")).toBeVisible();
  await expect(page.getByText("暂无车辆", { exact: true })).toHaveCount(0);
  await expect(page.getByText("暂无车辆", { exact: true })).toBeVisible();
});

test("reorders and replaces vehicle media with an automatic cover", async ({
  page,
}) => {
  grantedPermissions = [
    ...contentPermissions,
    "vehicle:view",
    "vehicle:update",
  ];
  await login(page);
  await page.goto("/#/vehicles/edit/vehicle-1");
  await expect(page.getByRole("heading", { name: "编辑车辆" })).toBeVisible();
  await page.getByRole("tab", { name: "媒体素材" }).click();

  const rows = page.locator(".media-editor-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAttribute("data-media-id", "media-a");
  await page
    .getByRole("button", { name: "拖动排序" })
    .first()
    .dragTo(rows.nth(1));
  await expect(rows.nth(0)).toHaveAttribute("data-media-id", "media-b");
  await expect(rows.nth(0).getByText("封面", { exact: true })).toBeVisible();

  await rows.nth(1).getByRole("button", { name: "替换素材" }).click();
  const picker = page.getByRole("dialog", { name: "选择素材" });
  await picker.getByText("未分类素材", { exact: true }).click();
  await picker.getByText("replacement.jpg", { exact: true }).click();
  await picker.getByRole("button", { name: "确认" }).click();
  await expect(rows.nth(1)).toHaveAttribute("data-media-id", "media-c");

  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect.poll(() => savedVehiclePayload).not.toBeNull();
  expect(savedVehiclePayload).not.toHaveProperty("coverMediaId");
  expect(
    (
      savedVehiclePayload?.media as Array<{
        mediaId: string;
        sortOrder: number;
      }>
    ).map((item) => ({
      mediaId: item.mediaId,
      sortOrder: item.sortOrder,
    })),
  ).toEqual([
    { mediaId: "media-b", sortOrder: 0 },
    { mediaId: "media-c", sortOrder: 1 },
  ]);
  expect((savedVehiclePayload?.media as Array<Record<string, unknown>>).every(item => !("isCover" in item))).toBe(true);
});

test("lists internal notes across inquiries", async ({ page }) => {
  grantedPermissions = [
    ...contentPermissions,
    "inquiry:list",
    "inquiry:note",
  ];
  await login(page);
  await page.goto("/#/inquiries/notes");

  await expect(page.getByRole("heading", { name: "客户备注" })).toBeVisible();
  await expect(page.getByText("测试客户", { exact: true })).toBeVisible();
  await expect(
    page.getByText("已发送报价单，周五回访确认运输方案。", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".table-wrap").getByText("Playwright Admin", { exact: true }),
  ).toBeVisible();
});

test("lists persisted upload records separately from the media library", async ({
  page,
}) => {
  grantedPermissions = [...contentPermissions, "media:view"];
  await login(page);
  await page.goto("/#/media/uploads");

  await expect(page.getByRole("heading", { name: "上传记录" })).toBeVisible();
  await expect(page.getByText("vehicle-brochure.pdf", { exact: true })).toBeVisible();
  await expect(page.getByText("unsupported.exe", { exact: true })).toBeVisible();
  await expect(page.getByText("Invalid file type", { exact: true })).toBeVisible();
  await expect(
    page.locator(".table-wrap").getByText("Playwright Admin", { exact: true }),
  ).toHaveCount(2);
});

test("renders child folders in the media grid and keeps a two-column mobile layout", async ({
  page,
}) => {
  grantedPermissions = [...contentPermissions, "media:view"];
  await page.setViewportSize({ width: 600, height: 900 });
  await login(page);
  await page.goto("/#/media/images");

  const grid = page.locator(".media-library-grid");
  await expect(grid.locator('[data-folder-id="folder-root"]')).toBeVisible();
  await expect(grid.locator('[data-folder-id="folder-brand"]')).toBeVisible();
  expect(
    await grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length),
  ).toBe(2);

  await grid.locator('[data-folder-id="folder-root"] .media-folder-card__open').click();
  await expect(grid.locator('[data-folder-id="folder-child"]')).toBeVisible();
  await expect(grid.getByText("front.jpg", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "文件夹路径" })).toContainText("Vehicle photos");
});
