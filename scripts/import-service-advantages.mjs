import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Local-only maintenance entry point. Calls the existing upload/feature services,
// preserving their validation, WebP/thumbnail processing and audit records.
const root = fileURLToPath(new URL('../', import.meta.url));
const req = createRequire(path.join(root, 'apps/api-server/package.json'));
const env = req('dotenv').parse(await readFile(path.join(root, '.env')));
if (env.NODE_ENV !== 'development' || env.STORAGE_DRIVER !== 'local') throw new Error('Development local storage is required');
if (!['localhost', '127.0.0.1'].includes(new URL(env.DATABASE_URL).hostname)) throw new Error('Local database is required');
const { PrismaClient } = req('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const assetRoot = path.join(root, 'design-assets/service-advantages/v1');
const stringify = value => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? String(v) : v, 2);
const entries = [
  ['quality', 'quality-assurance'], ['shipping', 'global-shipping'],
  ['consulting', 'professional-service'], ['support', 'after-sales'],
];
try {
  const before = await prisma.featureItem.findMany({ where: { key: { in: entries.map(([, key]) => key) }, deletedAt: null }, orderBy: { sortOrder: 'asc' } });
  if (before.length !== 4) throw new Error('Expected four existing service advantages');
  for (const [scene] of entries) await readFile(path.join(assetRoot, `${scene}-original.png`));
  console.log(stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'plan', features: before.map(({ id, key, iconType, imageMediaId }) => ({ id, key, iconType, imageMediaId })) }));
  if (process.argv.includes('--apply')) {
    const admin = await prisma.adminUser.findFirst({ where: { id: before[0].createdById || undefined, deletedAt: null, status: 'ACTIVE' }, orderBy: { id: 'asc' }, select: { id: true } });
    if (!admin) throw new Error('An active local content administrator is required');
    req('reflect-metadata');
    const configValues = Object.fromEntries(Object.entries(env).map(([key, value]) => [key, value === 'true' ? true : value === 'false' ? false : /^\d+$/.test(value) ? Number(value) : value]));
    configValues.LOCAL_STORAGE_PATH = path.resolve(root, 'apps/api-server', env.LOCAL_STORAGE_PATH);
    const { ConfigService } = req('@nestjs/config');
    const config = new ConfigService(configValues);
    const { LocalStorageProvider } = req('./dist/infrastructure/storage/local-storage.provider.js');
    const { FileValidationService } = req('./dist/media/file-validation.service.js');
    const { AuditService } = req('./dist/audit/audit.service.js');
    const { MediaService } = req('./dist/media/media.service.js');
    const { HomepageService } = req('./dist/homepage/homepage.service.js');
    const storage = new LocalStorageProvider(config);
    const audit = new AuditService(prisma);
    const media = new MediaService(prisma, storage, new FileValidationService(config), audit, config);
    const homepage = new HomepageService(prisma, audit);
    const meta = { ipAddress: '127.0.0.1', userAgent: 'Local service-advantages maintenance CLI', requestId: `service-advantages-${Date.now()}`, method: 'CLI', path: '/local/import-service-advantages', durationMs: 0 };
    const backup = path.join(root, 'logs/dev', `service-advantages-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    await mkdir(backup, { recursive: true });
    await writeFile(path.join(backup, 'features-before.json'), stringify(before));
    const folderName = '首页服务优势场景示意';
    const folders = await media.folders();
    const folder = folders.find(item => item.name === folderName && !item.parentId) || await media.createFolder({ name: folderName }, admin.id, meta);
    const assets = [];
    for (const [scene, key] of entries) {
      const feature = before.find(item => item.key === key);
      const originalName = `service-advantage-${scene}-v1.webp`;
      let asset = await prisma.mediaAsset.findFirst({ where: { originalName, folderId: BigInt(folder.id), deletedAt: null, status: 'ACTIVE' } });
      if (!asset) {
        // Preserve generated originals; upload a 1200x675 derivative through MediaService.
        const source = await readFile(path.join(assetRoot, `${scene}-original.png`));
        const input = await req('sharp')(source).resize(1200, 675, { fit: 'cover', position: 'centre' }).png().toBuffer();
        asset = await media.upload({ buffer: input, originalname: `service-advantage-${scene}-v1.png`, mimetype: 'image/png', size: input.length }, {
          folderId: String(folder.id), altZh: `${feature.titleZh} · 服务场景示意`,
          altEn: `${feature.titleEn} · Illustrative service scene`, altRu: `${feature.titleRu} · Иллюстрация обслуживания`,
        }, admin.id, meta);
      }
      if (asset.driver !== 'LOCAL' || asset.mimeType !== 'image/webp' || asset.width !== 1200 || asset.height !== 675 || !asset.thumbnailUrl) throw new Error(`Unexpected uploaded asset: ${scene}`);
      for (const url of new Set([asset.url, asset.webpUrl, asset.thumbnailUrl].filter(Boolean))) {
        const parsed = new URL(url);
        if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) throw new Error('Media URL must be local');
        const response = await fetch(`http://127.0.0.1:5173${parsed.pathname}`, { method: 'HEAD' });
        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Media verification failed: ${scene}`);
      }
      assets.push({ scene, key, asset });
    }
    await writeFile(path.join(backup, 'uploaded-assets.json'), stringify(assets));
    // All four files are uploaded and reachable before the first binding is changed.
    const current = await prisma.featureItem.findMany({ where: { id: { in: before.map(item => item.id) } }, orderBy: { sortOrder: 'asc' } });
    for (const original of before) {
      if (stringify(current.find(item => item.id === original.id)) !== stringify(original)) throw new Error('Features changed during upload; preserved without binding');
    }
    for (const { key, asset } of assets) {
      const feature = before.find(item => item.key === key);
      await homepage.updateFeature(feature.id, { iconType: 'IMAGE', imageMediaId: String(asset.id), sortOrder: feature.sortOrder, isEnabled: feature.isEnabled }, admin.id, meta);
    }
    const after = await prisma.featureItem.findMany({ where: { id: { in: before.map(item => item.id) } }, orderBy: { sortOrder: 'asc' } });
    for (const original of before) {
      const changed = after.find(item => item.id === original.id);
      for (const field of Object.keys(original).filter(field => !['iconType', 'imageMediaId', 'updatedAt', 'updatedById'].includes(field))) {
        if (stringify(changed[field]) !== stringify(original[field])) throw new Error(`Unexpected feature change: ${original.key}/${field}`);
      }
    }
    await writeFile(path.join(backup, 'features-after.json'), stringify(after));
    await writeFile(path.join(assetRoot, 'media-bindings.json'), stringify({ backup, assets: assets.map(({ scene, key, asset }) => ({ scene, key, id: String(asset.id), url: asset.url, thumbnailUrl: asset.thumbnailUrl, width: asset.width, height: asset.height })) }));
    console.log(stringify({ backup, bound: assets.map(({ key, asset }) => ({ key, mediaId: asset.id, url: asset.url })) }));
  }
} finally { await prisma.$disconnect(); }
