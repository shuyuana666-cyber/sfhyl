import { expect, test, type Page } from '@playwright/test';

const permissionItems = [
  { id: 'p1', code: 'vehicle:view', module: 'vehicle', nameZh: '查看车辆', nameEn: 'View vehicles' },
  { id: 'p2', code: 'vehicle:update', module: 'vehicle', nameZh: '编辑车辆', nameEn: 'Edit vehicles' },
  { id: 'p3', code: 'content:manage', module: 'content', nameZh: '管理网站内容和多语言展示', nameEn: 'Manage content' },
];
const roles = [{ id: 'r1', code: 'editor', nameZh: '内容编辑', nameEn: 'Content editor', description: '管理车辆与网站内容，描述较长时保持列表清晰可读。', isSystem: false, isEnabled: true, permissions: [{ permission: permissionItems[0] }], _count: { users: 3 } }];
const record = { id: 'l1', createdAt: '2026-10-08T08:00:00Z', actorName: '内容编辑', identifier: 'editor@example.test', action: 'UPDATE', resourceType: 'Vehicle', resourceId: 'fixture-car', summary: '修改车辆展示信息', success: true, ipAddress: '127.0.0.1', userAgent: 'Browser verification fixture', requestMethod: 'PATCH', requestPath: '/api/v1/admin/vehicles/fixture-car', beforeData: { description: '旧内容' }, afterData: { description: '长内容 '.repeat(90) } };
const allPermissions = ['dashboard:view', 'vehicle:view', 'brand:view', 'brand:manage', 'homepage:view', 'homepage:manage', 'content:view', 'content:manage', 'banner:view', 'banner:manage', 'user:view', 'user:create', 'user:update', 'user:disable', 'role:view', 'role:create', 'role:update', 'role:delete', 'permission:view', 'settings:view', 'settings:update', 'storage-settings:view', 'mail-settings:view', 'audit:view', 'login-log:view', 'system-log:view', 'system-info:view'];

async function setup(page: Page, options: { fail?: string; readonly?: boolean; features?: boolean; process?: boolean } = {}) {
  const errors: string[] = [];
  const writes: string[] = [];
  const featureWrites: Array<{ path: string; payload: Record<string, unknown> }> = [];
  const photo = { id: 'photo-1', originalName: '旧场景图片', mimeType: 'image/jpeg', url: '/feature-photo.svg' };
  const replacement = { ...photo, id: 'photo-2', originalName: '新场景图片' };
  const processBody = { zh: '<ol>' + ['需求确认', '车源匹配', '验车与资料', '跨境运输', '交付跟进'].map(title => `<li><strong>${title}</strong><p>保留阶段说明</p><ul><li>保留服务要点</li></ul></li>`).join('') + '</ol>', en: '<p>Original English content</p>', ru: '<p>Исходный текст</p>' };
  const processModule = { id: 'home-service-process', enabled: true, placement: 'HOME_AFTER_FEATURES', displayScope: 'HOME', mediaType: 'NONE', imageMediaId: null, title: { zh: '服务流程', en: 'Service process', ru: 'Этапы обслуживания' }, body: processBody, button: { href: '', label: { zh: '', en: '', ru: '' } }, stageImages: Array.from({ length: 5 }, () => ({ imageMediaId: photo.id })) };
  const processWrites: Array<{ content: { customModules: Array<typeof processModule> } }> = [];
  let featureRows = options.features ? [1, 2].map(id => ({ id: String(id), key: `service-${id}`, iconType: 'IMAGE', iconName: 'ri:shield-check-line', imageMediaId: photo.id, imageMedia: photo, titleZh: `服务优势 ${id}`, titleEn: `Service ${id}`, titleRu: `Услуга ${id}`, descriptionZh: '完整中文说明', descriptionEn: 'Full English description', descriptionRu: 'Полное описание', sortOrder: id - 1, isEnabled: true })) : [];
  await page.route('**/feature-photo.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><rect width="1200" height="675" fill="#ddd"/></svg>' }));
  let failed = false;
  page.on('pageerror', error => { errors.push(error.message); if (options.features) console.log('Feature editor error:', error.message); });
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET' && !path.endsWith('/auth/login')) writes.push(path);
    if (options.fail && path.endsWith(options.fail) && !failed) {
      failed = true;
      await new Promise(resolve => setTimeout(resolve, 600));
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 50301, message: '读取失败，请重试' }) });
    }
    let data: unknown = {};
    const paginate = (items: unknown[]) => ({ items, pagination: { page: 1, pageSize: 20, total: items.length, totalPages: 1 } });
    if (path.endsWith('/auth/login')) data = { accessToken: 'fixture-access', refreshToken: 'fixture-refresh' };
    else if (path.endsWith('/auth/me')) data = { id: 'fixture', username: 'review', displayName: '界面复核', roleCodes: ['super_admin'], permissions: allPermissions.filter(p => !options.readonly || !p.endsWith(':manage')), menus: [] };
    else if (path.endsWith('/public/site')) data = { settings: { branding: { logoUrl: '/brand-logo.jpg' } } };
    else if (path.endsWith('/admin/dashboard')) data = { summary: { vehicleTotal: 128 }, inquiryTrend: [], vehicleTrend: [], recentLogins: [], recentAudits: [], topVehicles: [] };
    else if (path.endsWith('/admin/permissions')) data = permissionItems;
    else if (path.endsWith('/admin/roles')) data = roles;
    else if (path.endsWith('/admin/users')) data = paginate([{ id: 'u1', username: 'editor', displayName: '内容编辑', email: 'editor@example.test', status: 'ACTIVE', roles: [{ role: roles[0] }] }]);
    else if (path.endsWith('/admin/homepage-content')) {
      if (request.method() === 'PUT') { processWrites.push(request.postDataJSON()); data = { id: 'homepage' }; }
      else data = { content: { heroEnabled: true, hero: [{ enabled: true, imageMediaId: null, mobileMediaId: null, title: { zh: '欢迎了解我们的车辆', en: 'Vehicle inventory', ru: 'Автомобили' } }], ...(options.process ? { customModules: [processModule] } : {}) }, media: { [photo.id]: photo, [replacement.id]: replacement } };
    }
    else if (path.endsWith('/admin/homepage-sections')) data = [{ id: 's1', key: 'featured', type: 'FEATURED_VEHICLES', titleZh: '推荐车辆', isEnabled: true, displayCount: 8 }];
    else if (path.endsWith('/admin/features/sort')) {
      const payload = request.postDataJSON();
      featureWrites.push({ path, payload });
      featureRows.sort((a, b) => payload.items.findIndex((item: { id: string }) => item.id === a.id) - payload.items.findIndex((item: { id: string }) => item.id === b.id));
      featureRows.forEach((row, index) => { row.sortOrder = index; });
      data = { sorted: true };
    }
    else if (/\/admin\/features\/\d+$/.test(path)) {
      const payload = request.postDataJSON();
      featureWrites.push({ path, payload });
      const row = featureRows.find(item => path.endsWith(`/${item.id}`))!;
      Object.assign(row, payload, { imageMedia: payload.imageMediaId === replacement.id ? replacement : photo });
      data = row;
    }
    else if (path.endsWith('/admin/features')) data = featureRows;
    else if (path.endsWith('/admin/media/folders')) data = [];
    else if (path.endsWith('/admin/media')) data = paginate([photo, replacement]);
    else if (path.endsWith('/admin/banners') || path.endsWith('/admin/recommendations')) data = [];
    else if (path.endsWith('/public/home')) data = { sections: [] };
    else if (path.endsWith('/public/vehicles') || path.endsWith('/admin/vehicles')) data = paginate([]);
    else if (path.endsWith('/admin/brands')) data = [{ id: 'b1', nameZh: '示例品牌', nameEn: 'Example', isEnabled: true, sortOrder: 0 }];
    else if (path.endsWith('/admin/audit-logs') || path.endsWith('/admin/login-logs')) data = paginate([record]);
    else if (path.endsWith('/admin/system/logs')) data = [{ timestamp: record.createdAt, level: 'warn', context: 'Content', message: '示例状态消息 '.repeat(20) }];
    else if (path.endsWith('/admin/system/mail')) data = { enabled: true, host: 'smtp.example.test', port: 587, secure: true, username: 'mail@example.test', passwordConfigured: true, fromName: 'SFHYL', fromAddress: 'mail@example.test' };
    else if (path.endsWith('/admin/system/storage')) data = { driver: 's3', implementation: 'ready', publicUrl: 'https://example.test/media/' + 'folder/'.repeat(25), bucket: 'vehicle-media', region: 'example-region', credentialsConfigured: true };
    else if (path.endsWith('/admin/system/info')) data = { version: '1.0.0', environment: 'fixture', services: { database: 'connected', cache: 'connected' } };
    else if (path.endsWith('/admin/settings')) data = { translation_model: { protocol: 'openai', model: 'fixture-model', baseUrl: 'https://example.test/v1', apiKeyConfigured: true } };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 0, data, message: 'success' }) });
  });
  await page.goto('/admin/auth/login');
  await page.getByLabel('账号', { exact: true }).fill('review');
  await page.getByLabel('密码', { exact: true }).fill('UiReview123');
  await page.getByRole('button', { name: 'login', exact: true }).click();
  await expect(page.getByRole('heading', { name: '数据概览', exact: true })).toBeVisible();
  return { errors, writes, featureWrites, processWrites, processBody };
}

test('service process editor replaces one stage photo and preserves the other stages and languages', async ({ page }) => {
  const { errors, processWrites, processBody } = await setup(page, { process: true });
  await page.goto('/admin/homepage/content');
  await page.getByRole('tab', { name: '自定义模块', exact: true }).click();
  const stages = page.locator('.process-stage-image');
  await expect(stages).toHaveCount(5);
  for (const width of [1440, 1024, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => page.locator('.process-stage-images').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
  await stages.nth(1).getByRole('button', { name: '替换图片', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '选择素材' });
  await picker.getByRole('button', { name: /未分类素材/ }).click();
  await picker.locator('.picker-item').filter({ hasText: '新场景图片' }).click();
  await picker.getByRole('button', { name: '确认', exact: true }).click();
  await expect(stages.nth(1).locator('.selected-media')).toContainText('新场景图片');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(page.getByText('草稿已保存', { exact: true })).toBeVisible();
  expect(processWrites[0].content.customModules[0].stageImages.map(stage => stage.imageMediaId)).toEqual(['photo-1', 'photo-2', 'photo-1', 'photo-1', 'photo-1']);
  expect(processWrites[0].content.customModules[0].body).toEqual(processBody);
  expect(processWrites[0].content.customModules[0].mediaType).toBe('NONE');
  expect(errors).toEqual([]);
});

test('service advantage editor replaces wide photos, hides and sorts without losing multilingual content', async ({ page }) => {
  const { errors, featureWrites } = await setup(page, { features: true });
  await page.goto('/admin/homepage/features');
  await expect(page.getByRole('heading', { name: '首页服务优势', exact: true })).toBeVisible({ timeout: 15000 });
  for (const width of [1440, 1280, 1024, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole('button', { name: '编辑', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: '编辑优势' });
    await expect(dialog.getByText(/1200×675px/)).toBeVisible();
    await expect(dialog.locator('.selected-media img')).toBeVisible();
    await expect.poll(() => dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: '编辑', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: '编辑优势' });
  await dialog.getByRole('button', { name: '替换图片', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '选择素材' });
  await picker.getByRole('button', { name: /未分类素材/ }).click();
  await picker.locator('.picker-item').filter({ hasText: '新场景图片' }).click();
  await picker.getByRole('button', { name: '确认', exact: true }).click();
  await expect(dialog.locator('.selected-media')).toContainText('新场景图片');
  await dialog.locator('.el-switch').click();
  await expect(dialog.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(featureWrites[0].payload).toMatchObject({ imageMediaId: 'photo-2', iconType: 'IMAGE', isEnabled: false, descriptionZh: '完整中文说明', descriptionEn: 'Full English description', descriptionRu: 'Полное описание', iconName: 'ri:shield-check-line' });
  await page.locator('.el-table__body-wrapper tr').first().getByRole('button').nth(1).click();
  await expect(page.locator('.el-table__body-wrapper tr').first()).toContainText('服务优势 2');
  expect(featureWrites[1].payload).toEqual({ items: [{ id: '2', sortOrder: 0 }, { id: '1', sortOrder: 1 }] });
  expect(errors).toEqual([]);
});

test('content, permissions, logs and configuration fit four viewport widths', async ({ page }, testInfo) => {
  const { errors, writes } = await setup(page);
  for (const width of [1440, 1280, 1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [path, title] of [['homepage/content', '首页展示内容'], ['homepage/banners', '首页轮播图'], ['homepage/sections', '首页模块'], ['homepage/features', '首页服务优势'], ['permissions/users', '管理员'], ['permissions/roles', '角色权限'], ['permissions/list', '权限列表'], ['system/audit', '操作日志'], ['system/login-logs', '登录记录'], ['system/logs', '系统日志'], ['system/mail', '邮件设置'], ['system/storage', '文件存储'], ['system/info', '系统信息'], ['system/translation-model', 'API 模型配置'], ['vehicles/brands', '车辆目录']]) {
      await page.goto(`/admin/${path}`);
      await expect(page.getByRole('heading', { name: title, exact: true, level: 1 })).toBeVisible();
      await expect(page.getByLabel('正在加载页面')).toHaveCount(0);
      await expect(page.locator('.bg-overlay-content:visible, .el-loading-mask:visible')).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      if (path === 'homepage/content') {
        await expect(page.getByRole('alert')).toHaveCount(0);
        await expect(page.locator('.el-tab-pane:visible').getByLabel('中文标题', { exact: true })).toHaveValue('欢迎了解我们的车辆');
        await expect(page.getByRole('status').filter({ hasText: '没有未保存的修改' })).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath(`content-${width}.png`) });
      }
      if (path === 'permissions/roles') {
        await page.getByRole('button', { name: '编辑', exact: true }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect.poll(() => page.getByRole('dialog').evaluate(dialog => {
          for (let element: Element | null = dialog; element; element = element.parentElement) {
            if (Number(getComputedStyle(element).opacity) < 0.99) return false;
          }
          return true;
        })).toBe(true);
        await expect(page.locator('.bg-overlay-content:visible, .el-loading-mask:visible')).toHaveCount(0);
        await expect(page.locator('.el-message:visible')).toHaveCount(0);
        await expect.poll(() => page.getByRole('dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth + 1)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`role-dialog-${width}.png`) });
        await page.getByRole('button', { name: '取消', exact: true }).click();
      }
      if (path === 'system/audit') {
        await page.getByRole('button', { name: '详情', exact: true }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect.poll(() => page.getByRole('dialog').evaluate(drawer => drawer.scrollWidth <= drawer.clientWidth + 1)).toBe(true);
        await page.keyboard.press('Escape');
      }
    }
  }
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test('permissions keep selected codes when filtering and support partial selection', async ({ page }) => {
  const { errors, writes } = await setup(page);
  await page.goto('/admin/permissions/roles');
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('status')).toContainText('已选择 1 项');
  await expect(dialog.getByLabel('选择 vehicle 模块')).toHaveAttribute('aria-checked', 'mixed');
  await dialog.getByLabel('搜索权限').fill('管理网站');
  await expect(dialog.getByText('查看车辆', { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('status')).toContainText('已选择 1 项');
  await dialog.getByLabel('搜索权限').fill('没有对应权限');
  await expect(dialog.getByText('没有匹配的权限')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '删除', exact: true }).click();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test('configuration errors retry without showing incorrect disabled status', async ({ page }) => {
  const { errors, writes } = await setup(page, { fail: '/admin/system/mail' });
  await page.goto('/admin/system/mail');
  await expect(page.getByLabel('正在加载页面')).toBeVisible();
  await expect(page.locator('.request-error')).toBeVisible();
  await expect(page.getByText('未启用', { exact: true })).toHaveCount(0);
  await expect(page.locator('.system-detail')).toHaveCount(0);
  await page.getByRole('button', { name: '重新加载' }).click();
  await expect(page.getByText('smtp.example.test')).toBeVisible();
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test('readonly localized content is disabled for mouse and keyboard', async ({ page }) => {
  const { errors, writes } = await setup(page, { readonly: true });
  await page.goto('/admin/homepage/content');
  await expect(page.locator('.el-tab-pane:visible').getByLabel('中文标题', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '保存并发布', exact: true })).toHaveCount(0);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test('required account fields show local errors at 390px without a request', async ({ page }) => {
  const { errors, writes } = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/permissions/users');
  await page.getByRole('button', { name: '新增管理员' }).click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const dialog = page.getByRole('dialog');
  for (const text of ['请填写用户名', '请填写邮箱', '初始密码至少需要 12 位', '请选择至少一个角色']) await expect(dialog.getByText(text, { exact: true })).toBeVisible();
  await expect.poll(() => dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.keyboard.press('Escape');
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test('failed role save keeps entered fields and permissions without an unhandled error', async ({ page }) => {
  const { errors, writes } = await setup(page, { fail: '/admin/roles/r1' });
  await page.goto('/admin/permissions/roles');
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('中文名称', { exact: true }).fill('修改中的名称');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.el-message').filter({ hasText: '读取失败，请重试' }).first()).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('中文名称', { exact: true })).toHaveValue('修改中的名称');
  await expect(dialog.getByRole('status')).toContainText('已选择 1 项');
  expect(writes).toEqual(['/api/v1/admin/roles/r1']);
  expect(errors).toEqual([]);
});
