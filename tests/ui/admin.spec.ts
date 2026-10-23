import { expect, test, type Page } from '@playwright/test';

const permissions = ['dashboard:view', 'vehicle:view', 'vehicle:create', 'vehicle:update', 'vehicle:publish', 'vehicle:offline', 'vehicle:batch', 'vehicle:delete', 'settings:view', 'settings:update', 'media:view', 'media:upload', 'inquiry:list', 'user:view', 'role:view'];
const vehicle = {
  id: 'review-car', stockNo: 'UI-001', nameZh: '2026 年出口车辆 · 超长车辆名称与规格展示', nameEn: 'Export vehicle',
  slug: 'ui-car', year: 2026, type: 'NEW', price: '25000', currency: 'USD', status: 'DRAFT', saleStatus: 'AVAILABLE',
  brand: { id: 'review-brand', nameZh: '示例品牌', nameEn: 'Brand' }, brandId: 'review-brand',
  coverMedia: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
};
const paginated = (items: unknown[]) => ({ items, pagination: { page: 1, pageSize: 20, total: items.length, totalPages: 1 } });

const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'warning' && message.text().includes('[ECharts]')) errors.push(message.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

async function mockApi(page: Page, options: { dashboardFails?: boolean; dashboardDelay?: boolean; settingsFails?: boolean } = {}) {
  let dashboardFailures = options.dashboardFails ? 1 : 0;
  let settingsFailures = options.settingsFails ? 1 : 0;
  const mutations: string[] = [];
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') mutations.push(path);
    let data: unknown = {};
    if (path.endsWith('/auth/login')) data = { accessToken: 'ui-test-access', refreshToken: 'ui-test-refresh' };
    else if (path.endsWith('/auth/me')) data = { id: 'ui-test', username: 'review', displayName: '界面验证', email: 'review@example.test', roleCodes: ['super_admin'], permissions, menus: [] };
    else if (path.endsWith('/public/site')) data = { settings: { branding: { logoUrl: '/brand-logo.jpg' } } };
    else if (path.endsWith('/admin/dashboard')) {
      if (options.dashboardDelay) await new Promise(resolve => setTimeout(resolve, 700));
      if (dashboardFailures-- > 0) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 50301, message: '统计暂时不可用' }) });
      data = { summary: { vehicleTotal: 128, vehicleAvailable: 96 }, inquiryTrend: [], vehicleTrend: [], recentLogins: [], recentAudits: [], topVehicles: [vehicle] };
    } else if (path.endsWith('/admin/settings')) {
      if (settingsFailures-- > 0) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 50301, message: '设置暂时不可用' }) });
      data = { basic: { siteNameZh: '示例网站' } };
    } else if (path.endsWith('/admin/vehicles')) data = paginated([vehicle]);
    else if (path.endsWith('/admin/brands')) data = [vehicle.brand];
    else if (/\/admin\/(categories|series|models|tags)$/.test(path)) data = [];
    else if (path.endsWith('/admin/media/folders')) data = [];
    else if (/\/admin\/(media|inquiries|users|roles)$/.test(path)) data = paginated([]);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 0, data, message: 'success', requestId: 'ui-test' }) });
  });
  return mutations;
}

async function login(page: Page) {
  await page.goto('/admin/auth/login');
  await page.getByLabel('账号', { exact: true }).fill('review');
  await page.getByLabel('密码', { exact: true }).fill('UiReview123');
  await page.getByRole('button', { name: 'login', exact: true }).click();
  await expect(page.getByRole('heading', { name: '数据概览', exact: true })).toBeVisible();
}

test('Vben business pages fit 1440, 1280, 1024 and 768px', async ({ page }, testInfo) => {
  const mutations = await mockApi(page);
  await login(page);
  for (const width of [1440, 1280, 1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [path, title] of [['dashboard', '数据概览'], ['vehicles/list', '车辆列表'], ['vehicles/create', '新增车辆'], ['system/settings', '网站设置'], ['media/images', '图片库'], ['inquiries/records', '询价记录'], ['permissions/users', '管理员']]) {
      await page.goto(`/admin/${path}`);
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      if (path === 'system/settings' && width <= 1024) {
        await page.getByRole('tab', { name: '联系方式' }).click();
        await expect(page.getByLabel('联系电话')).toBeVisible();
      }
      if (path === 'vehicles/list') {
        await expect(page.getByPlaceholder('创建开始')).toHaveCount(0);
        await page.getByRole('button', { name: '高级筛选' }).click();
        await expect(page.getByPlaceholder('创建开始')).toBeVisible();
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      }
      if (path === 'vehicles/create') {
        const positions = await page.locator('.sticky-actions').evaluate(element => {
          const rect = element.getBoundingClientRect();
          const parent = element.closest('.admin-page')!.getBoundingClientRect();
          return { left: rect.left, right: rect.right, parentLeft: parent.left, parentRight: parent.right };
        });
        expect(positions.left).toBeGreaterThanOrEqual(positions.parentLeft);
        expect(positions.right).toBeLessThanOrEqual(positions.parentRight);
      }
      if (path === 'vehicles/list' || path === 'system/settings' || path === 'dashboard') {
        await expect(page.locator('.el-message')).toHaveCount(0);
        const file = testInfo.outputPath(`${path.replaceAll('/', '-')}-${width}.png`);
        await page.screenshot({ path: file, fullPage: true });
        await testInfo.attach(`${title}-${width}`, { path: file, contentType: 'image/png' });
      }
    }
  }
  expect(mutations.filter(path => !path.endsWith('/auth/login'))).toEqual([]);
});

test('mobile settings and media picker remain usable at 390px', async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/admin/system/settings');
  await page.getByRole('tab', { name: '联系方式' }).click();
  await expect(page.getByLabel('联系电话')).toBeVisible();
  await page.goto('/admin/vehicles/create');
  await page.getByRole('tab', { name: '媒体素材' }).click();
  await page.getByRole('button', { name: '选择素材', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '选择素材' });
  await expect(dialog).toBeVisible();
  const size = await dialog.evaluate(element => element.getBoundingClientRect().width);
  expect(size).toBeLessThanOrEqual(390);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(dialog).toBeHidden();
});

test('dashboard loading, error retry and empty trend remain distinct', async ({ page }) => {
  await mockApi(page, { dashboardFails: true, dashboardDelay: true });
  await login(page);
  await expect(page.getByLabel('正在加载概览')).toBeVisible();
  await expect(page.locator('.request-error').getByText('统计暂时不可用')).toBeVisible();
  await expect(page.locator('.metric-tile')).toHaveCount(0);
  await page.getByRole('button', { name: '重新加载' }).click();
  await expect(page.locator('.metric-tile').first()).toContainText('128');
  await expect(page.getByText('所选时间内暂无趋势数据')).toBeVisible();
  await page.route('**/api/v1/admin/dashboard**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ code: 0, data: {
      summary: { vehicleTotal: 128 },
      inquiryTrend: [{ date: '2026-10-01', count: 3 }, { date: '2026-10-02', count: 5 }],
      vehicleTrend: [{ date: '2026-10-01', count: 2 }, { date: '2026-10-02', count: 4 }],
      recentLogins: [], recentAudits: [], topVehicles: [],
    } }),
  }));
  await page.getByText('7天', { exact: true }).click();
  await expect(page.locator('.chart canvas')).toBeVisible();
  await expect(page.getByText('所选时间内暂无趋势数据')).toHaveCount(0);
  await page.setViewportSize({ width: 768, height: 900 });
  await expect.poll(() => page.locator('.chart canvas').evaluate(canvas => {
    const chart = canvas.closest('.chart');
    return chart && Math.abs(canvas.getBoundingClientRect().width - chart.clientWidth) <= 1;
  })).toBe(true);
});

test('settings failure hides editing until a successful retry', async ({ page }) => {
  await mockApi(page, { settingsFails: true });
  await login(page);
  await page.goto('/admin/system/settings');
  await expect(page.locator('.request-error').getByText('设置暂时不可用')).toBeVisible();
  await expect(page.getByRole('button', { name: '保存', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '重新加载' }).click();
  await expect(page.getByLabel('网站中文名称')).toHaveValue('示例网站');
});

test('vehicle menu keeps actions and permissions and batch selection feedback', async ({ page }) => {
  const mutations = await mockApi(page);
  await login(page);
  await page.goto('/admin/vehicles/list');
  await expect(page.getByRole('button', { name: '批量操作' })).toBeDisabled();
  await page.locator('.el-table__body .el-checkbox').first().click();
  await expect(page.getByRole('checkbox', { name: '选择当前行' })).toBeChecked();
  await expect(page.getByRole('status').filter({ hasText: '已选择 1 辆' })).toBeVisible();
  await page.getByRole('button', { name: '更多' }).click();
  for (const label of ['预览官网', '发布车辆', '复制车辆', '设为推荐', '删除车辆']) await expect(page.getByRole('menuitem', { name: label })).toBeVisible();
  await page.getByRole('menuitem', { name: '删除车辆' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  expect(mutations.filter(path => !path.endsWith('/auth/login'))).toEqual([]);
});
