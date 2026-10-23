// Read-only export of website content and active local media for deployment.
const { createRequire } = require('node:module');
const { mkdir, readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const req = createRequire(path.resolve('apps/api-server/package.json'));
req('dotenv').config({ path: '.env', quiet: true });
const { PrismaClient } = req('@prisma/client');
const { Client } = req('minio');
const prisma = new PrismaClient();
const minio = new Client({ endPoint: process.env.MINIO_ENDPOINT || '127.0.0.1', port: Number(process.env.MINIO_PORT || 9200), useSSL: process.env.MINIO_USE_SSL === 'true', accessKey: process.env.MINIO_ACCESS_KEY, secretKey: process.env.MINIO_SECRET_KEY });
const root = path.resolve(process.argv[2] || 'logs/dev/local-content-sync');
function refs(value, set = new Set()) {
  if (Array.isArray(value)) for (const v of value) refs(v, set);
  else if (value && typeof value === 'object') for (const [key, v] of Object.entries(value)) {
    if (/MediaId$/.test(key) && v) set.add(String(v)); else refs(v, set);
  }
  return set;
}
async function bytes(asset, key) {
  if (asset.bucket === 'website') return readFile(path.resolve('public/brand-icons', path.basename(key)));
  if (asset.driver === 'LOCAL') {
    const configured = process.env.LOCAL_STORAGE_PATH || 'storage/uploads';
    const roots = path.isAbsolute(configured) ? [configured] : [path.resolve('apps/api-server', configured), path.resolve(configured)];
    for (const directory of roots) {
      try { return await readFile(path.resolve(directory, key)); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    throw Error(`Local object missing: ${key}`);
  }
  if (asset.driver !== 'MINIO') throw Error(`Unsupported source driver: ${asset.driver}`);
  const stream = await minio.getObject(asset.bucket || process.env.MINIO_BUCKET || 'sfhyl', key);
  const blocks = []; for await (const block of stream) blocks.push(block);
  return Buffer.concat(blocks);
}
(async () => {
  await mkdir(path.join(root, 'files'), { recursive: true });
  const [pages, settings, brands, sections, banners, features, vehicles, folders, categories, series, models, tags, recommendations] = await Promise.all([
    prisma.page.findMany({ where: { deletedAt: null } }),
    prisma.siteSetting.findMany({ where: { isPublic: true, isSensitive: false } }),
    prisma.brand.findMany({ where: { deletedAt: null } }),
    prisma.homepageSection.findMany(), prisma.banner.findMany({ where: { deletedAt: null } }),
    prisma.featureItem.findMany({ where: { deletedAt: null } }),
    prisma.vehicle.findMany({ where: { deletedAt: null }, include: { media: true, tags: true } }),
    prisma.mediaFolder.findMany({ where: { deletedAt: null } }), prisma.vehicleCategory.findMany({ where: { deletedAt: null } }),
    prisma.vehicleSeries.findMany({ where: { deletedAt: null } }), prisma.vehicleModel.findMany({ where: { deletedAt: null } }),
    prisma.vehicleTag.findMany(), prisma.homepageRecommendation.findMany(),
  ]);
  const required = refs([pages, settings, brands, sections, banners, features, vehicles]);
  for (const v of vehicles) for (const m of v.media) required.add(String(m.mediaId));
  const available = await prisma.mediaAsset.findMany({ where: { deletedAt: null, status: 'ACTIVE' } });
  const selected = available.filter(a => required.has(String(a.id)) || !a.objectKey.startsWith('system/'));
  const missingRecords = [...required].filter(id => !available.some(a => String(a.id) === id));
  if (missingRecords.length) throw Error(`Referenced local records missing: ${missingRecords.join(',')}`);
  const files = new Map(); const assets = []; const skipped = [];
  for (const asset of selected) {
    const objects = {};
    try {
      for (const key of new Set([asset.objectKey, asset.thumbnailObjectKey, asset.webpObjectKey].filter(Boolean))) {
        const content = await bytes(asset, key);
        const hash = createHash('sha256').update(content).digest('hex');
        const filename = `${hash}${path.extname(key)}`;
        if (!files.has(filename)) { await writeFile(path.join(root, 'files', filename), content); files.set(filename, { filename, hash, size: content.length }); }
        objects[key] = filename;
      }
      assets.push({ ...asset, objects });
    } catch (error) {
      if (required.has(String(asset.id))) throw Error(`Referenced asset ${asset.id} (${asset.originalName}): ${error.message}`);
      skipped.push({ id: String(asset.id), name: asset.originalName, error: error.message });
    }
  }
  const manifest = { exportedAt: new Date().toISOString(), pages, settings, brands, sections, banners, features, vehicles, folders, categories, series, models, tags, recommendations, assets, files: [...files.values()], skipped };
  await writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest, (_, v) => typeof v === 'bigint' ? String(v) : v, 2));
  console.log(JSON.stringify({ destination: root, assets: assets.length, files: files.size, bytes: [...files.values()].reduce((sum, f) => sum + f.size, 0), publishedVehicles: vehicles.filter(v => v.status === 'PUBLISHED').length, referencedMedia: required.size, skipped, pageMedia: assets.filter(a => refs(pages).has(String(a.id))).map(a => ({ id: String(a.id), name: a.originalName, bytes: String(a.sizeBytes) })) }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
