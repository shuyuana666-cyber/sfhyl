import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const req = createRequire(path.join(root, 'apps/api-server/package.json'));
const env = req('dotenv').parse(await readFile(path.join(root, '.env')));
if (env.NODE_ENV !== 'development' || env.STORAGE_DRIVER !== 'local' || !['localhost', '127.0.0.1'].includes(new URL(env.DATABASE_URL).hostname)) throw new Error('Local development storage and database are required');
const { PrismaClient } = req('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const assetRoot = path.join(root, 'design-assets/service-process/v1');
const stringify = value => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? String(v) : v, 2);
const stages = [
  { scene: 'needs', title: '需求确认', mediaId: '209' },
  { scene: 'matching', title: '车源匹配' },
  { scene: 'inspection', title: '验车与资料', mediaId: '207' },
  { scene: 'transport', title: '跨境运输', mediaId: '208' },
  { scene: 'handover', title: '交付跟进' },
];
try {
  const before = await prisma.page.findUnique({ where: { slug: 'homepage-content' } });
  const module = before?.content?.customModules?.find(item => item.id === 'home-service-process');
  if (!module || before.status !== 'PUBLISHED') throw new Error('Existing published service process is required');
  for (const stage of stages) await readFile(path.join(assetRoot, `${stage.scene}-original.png`));
  console.log(stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'plan', stages }));
  if (process.argv.includes('--apply')) {
    req('reflect-metadata');
    const admin = await prisma.adminUser.findFirst({ where: { deletedAt: null, status: 'ACTIVE' }, orderBy: { id: 'asc' }, select: { id: true } });
    if (!admin) throw new Error('An active local administrator is required');
    const values = Object.fromEntries(Object.entries(env).map(([key, value]) => [key, value === 'true' ? true : value === 'false' ? false : /^\d+$/.test(value) ? Number(value) : value]));
    values.LOCAL_STORAGE_PATH = path.resolve(root, 'apps/api-server', env.LOCAL_STORAGE_PATH);
    const { ConfigService } = req('@nestjs/config');
    const config = new ConfigService(values);
    const { LocalStorageProvider } = req('./dist/infrastructure/storage/local-storage.provider.js');
    const { FileValidationService } = req('./dist/media/file-validation.service.js');
    const { AuditService } = req('./dist/audit/audit.service.js');
    const { MediaService } = req('./dist/media/media.service.js');
    const audit = new AuditService(prisma);
    const media = new MediaService(prisma, new LocalStorageProvider(config), new FileValidationService(config), audit, config);
    const meta = { ipAddress: '127.0.0.1', userAgent: 'Local service-process image maintenance CLI', requestId: `service-process-${Date.now()}`, method: 'CLI', path: '/local/import-service-process-images', durationMs: 0 };
    const backup = path.join(root, 'logs/dev', `service-process-images-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    await mkdir(backup, { recursive: true });
    await writeFile(path.join(backup, 'homepage-before.json'), stringify(before));
    const folders = await media.folders();
    const name = '首页服务流程场景示意';
    const folder = folders.find(item => item.name === name && !item.parentId) || await media.createFolder({ name }, admin.id, meta);
    const assets = [];
    for (const stage of stages) {
      const originalName = `service-process-${stage.scene}-v1.webp`;
      let asset = await prisma.mediaAsset.findFirst({ where: { ...(stage.mediaId ? { id: BigInt(stage.mediaId) } : { originalName, folderId: folder.id }), deletedAt: null, status: 'ACTIVE' } });
      if (!asset) {
        if (stage.mediaId) throw new Error(`Existing media is unavailable: ${stage.scene}`);
        const input = await req('sharp')(await readFile(path.join(assetRoot, `${stage.scene}-original.png`))).resize(1200, 675, { fit: 'cover', position: 'centre' }).png().toBuffer();
        asset = await media.upload({ buffer: input, originalname: `service-process-${stage.scene}-v1.png`, mimetype: 'image/png', size: input.length }, { folderId: String(folder.id), altZh: `${stage.title} · 服务场景示意`, altEn: `${stage.scene} · Illustrative service scene`, altRu: 'Иллюстрация обслуживания' }, admin.id, meta);
      }
      if (asset.driver !== 'LOCAL' || asset.mimeType !== 'image/webp' || !asset.thumbnailUrl) throw new Error(`Unexpected asset: ${stage.scene}`);
      for (const url of [asset.url, asset.thumbnailUrl]) {
        const parsed = new URL(url);
        if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) throw new Error('Only local media is expected');
        const response = await fetch(`http://127.0.0.1:5173${parsed.pathname}`, { method: 'HEAD' });
        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Image is not reachable: ${stage.scene}`);
      }
      assets.push({ ...stage, mediaId: String(asset.id), url: asset.url, thumbnailUrl: asset.thumbnailUrl });
    }
    if (new Set(assets.map(asset => asset.mediaId)).size !== 5) throw new Error('Five distinct photos are required');
    await writeFile(path.join(backup, 'uploaded-assets.json'), stringify(assets));
    const nextContent = structuredClone(before.content);
    nextContent.customModules.find(item => item.id === module.id).stageImages = assets.map(asset => ({ imageMediaId: asset.mediaId }));
    const result = await prisma.page.updateMany({ where: { id: before.id, updatedAt: before.updatedAt }, data: { content: nextContent, updatedById: admin.id } });
    if (result.count !== 1) throw new Error('Homepage changed during upload; bindings were not applied');
    const after = await prisma.page.findUnique({ where: { id: before.id } });
    const restored = structuredClone(after.content);
    const restoredModule = restored.customModules.find(item => item.id === module.id);
    if ('stageImages' in module) restoredModule.stageImages = module.stageImages;
    else delete restoredModule.stageImages;
    if (stringify(restored) !== stringify(before.content) || after.status !== before.status) throw new Error('Unexpected homepage configuration change');
    await audit.record({ actorId: admin.id, action: 'update', resourceType: 'homepage_content', resourceId: before.id, summary: '绑定五个服务阶段配图，保留现有文字与其他模块', beforeData: before, afterData: after, meta });
    await writeFile(path.join(backup, 'homepage-after.json'), stringify(after));
    await writeFile(path.join(assetRoot, 'media-bindings.json'), stringify({ backup, assets }));
    console.log(stringify({ backup, assets }));
  }
} finally { await prisma.$disconnect(); }
