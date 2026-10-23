import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const bindings = JSON.parse(await readFile(path.join(root, 'design-assets/service-process/v1/media-bindings.json')));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const checks = [];
  // Existing public content cache expires after 60s; never change unrelated data to invalidate it.
  for (let attempt = 0; attempt < 65; attempt++) {
    const response = await fetch('http://127.0.0.1:3002/api/v1/public/homepage-content');
    const data = (await response.json()).data;
    const stages = data?.content?.customModules?.find(module => module.id === 'home-service-process')?.stageImages;
    if (stages?.length === 5) break;
    if (attempt === 64) throw new Error('Stage images have not appeared in the public content');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  for (const lang of ['zh', 'en', 'ru']) {
    for (const width of [1440, 1280, 1024, 768, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`http://127.0.0.1:5173/?lang=${lang}`);
      const stages = [];
      for (let index = 0; index < 5; index++) {
        await page.locator('.service-step').nth(index).click();
        await page.locator('.service-process-media').scrollIntoViewIfNeeded();
        const photo = page.locator('.service-process-media img');
        await page.waitForFunction(() => { const image = document.querySelector('.service-process-media img'); return image?.complete && image.naturalWidth > 0; });
        const result = await photo.evaluate(image => ({ url: image.currentSrc, alt: image.alt, loaded: image.complete && image.naturalWidth > 0 }));
        if (new URL(result.url).pathname !== new URL(bindings.assets[index].url).pathname) throw new Error(`Incorrect stage image: ${lang}/${width}/${index}`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        if (overflow) throw new Error(`Horizontal overflow: ${lang}/${width}/${index}`);
        stages.push({ index, ...result, title: await page.locator('.service-process .service-detail-copy h3').textContent() });
        if (lang === 'zh' && width === 1440) {
          await page.mouse.move(0, 0);
          await page.locator('.service-process').evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))));
          await page.locator('.service-process').screenshot({ path: path.join(bindings.backup, `stage-${index + 1}.png`), style: '.site-header { visibility: hidden; }' });
        }
      }
      if (new Set(stages.map(stage => stage.url)).size !== 5) throw new Error('Stage images must be distinct');
      checks.push({ lang, width, stages });
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(path.join(bindings.backup, 'live-browser-verification.json'), JSON.stringify({ errors, checks }, null, 2));
  console.log(JSON.stringify({ layouts: checks.length, stageChecks: 75, errors, output: bindings.backup }));
} finally { await browser.close(); }
