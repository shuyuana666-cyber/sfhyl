import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const username = process.env.SFHYL_LOGIN_USERNAME;
const password = process.env.SFHYL_LOGIN_PASSWORD;

if (!username || !password) {
  throw new Error('Set SFHYL_LOGIN_USERNAME and SFHYL_LOGIN_PASSWORD first.');
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5173/login?lang=zh');
  await page.locator('input[autocomplete="username"]').fill(username);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button.account-submit').click();
  try {
    await page.waitForURL('http://127.0.0.1:5173/admin/dashboard', {
      timeout: 20_000,
    });
  } catch (error) {
    const url = new URL(page.url());
    throw new Error(`Login stopped at ${url.origin}${url.pathname}`, {
      cause: error,
    });
  }
  await page.getByRole('heading', { name: '数据概览' }).waitFor({
    timeout: 20_000,
  });

  if (page.url().includes('Token=')) {
    throw new Error('Login tokens remained in the browser URL.');
  }
  await page.getByText('加载菜单中...').waitFor({
    state: 'hidden',
    timeout: 20_000,
  });
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/admin-login-success.png' });
  console.log('Website login reached the admin dashboard; URL is clean.');
} finally {
  await browser.close();
}
