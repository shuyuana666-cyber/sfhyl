import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const bindings = JSON.parse(await readFile(path.join(root, 'design-assets/service-advantages/v1/media-bindings.json')));
const output = process.argv[2] ? path.resolve(root, process.argv[2]) : bindings.backup;
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const checks = [];
  for (const lang of ['zh', 'en', 'ru']) {
    for (const width of [1440, 1280, 1024, 768, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`http://127.0.0.1:5173/?lang=${lang}`);
      for (const frame of await page.locator('.home-feature-media').all()) await frame.scrollIntoViewIfNeeded();
      await page.locator('.home-feature-item').first().scrollIntoViewIfNeeded();
      await page.waitForFunction(() => {
        const images = [...document.querySelectorAll('.home-feature-media img')];
        return images.length === 4 && images.every(image => image.complete && image.naturalWidth > 0);
      });
      const result = await page.locator('.home-feature-item').evaluateAll(cards => cards.map(card => {
        const rect = card.getBoundingClientRect();
        const image = card.querySelector('img');
        const frame = card.querySelector('.home-feature-media').getBoundingClientRect();
        return { title: card.querySelector('strong').textContent, description: card.querySelector('small').textContent, top: rect.top, width: rect.width, height: rect.height, ratio: frame.width / frame.height, image: image.currentSrc, loaded: image.complete && image.naturalWidth > 0, overflow: card.scrollWidth > card.clientWidth + 1 };
      }));
      const columns = result.filter(card => Math.abs(card.top - result[0].top) < 1).length;
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      const unrelatedOverflow = overflow ? await page.evaluate(() => {
        const section = document.querySelector('.home-features');
        section.style.display = 'none';
        const remains = document.documentElement.scrollWidth > innerWidth;
        const sources = [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right > innerWidth + 1 && !section.contains(element)).slice(0, 12).map(element => ({ tag: element.tagName, class: element.className }));
        section.style.removeProperty('display');
        return { remains, sources };
      }) : null;
      if (columns !== (width >= 640 ? 2 : 1) || (overflow && !unrelatedOverflow?.remains) || result.some(card => card.overflow || Math.abs(card.ratio - 16 / 9) > 0.01)) throw new Error(`Layout verification failed: ${JSON.stringify({ lang, width, columns, overflow, result })}`);
      if (lang === 'zh' && width === 1440) await page.locator('.home-features-grid').screenshot({ path: path.join(output, 'service-advantages-desktop.png'), style: '.site-header { visibility: hidden; }' });
      if (lang === 'ru' && width === 375) await page.locator('.home-features-grid').screenshot({ path: path.join(output, 'service-advantages-mobile-ru.png'), style: '.site-header { visibility: hidden; }' });
      checks.push({ lang, width, columns, overflow, unrelatedOverflow, cards: result });
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(path.join(output, 'live-browser-verification.json'), JSON.stringify({ errors, checks }, null, 2));
  console.log(JSON.stringify({ checks: checks.length, allFourImagesLoaded: true, errors, output }));
} finally { await browser.close(); }
