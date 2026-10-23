import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { apiRoot, invalidatePublicCache, minioOptions, projectRoot, readEnvironment, requireFromApi } from './infrastructure.mjs';

export function localObjectPath(root, key) {
  if (!/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+$/.test(key)) {
    throw new Error(`Unsafe object key: ${key}`);
  }
  const target = path.resolve(root, key);
  if (!target.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error('Object escapes local storage');
  return target;
}

async function digest(stream) {
  const hash = createHash('sha256');
  let size = 0;
  for await (const block of stream) { hash.update(block); size += block.length; }
  return { sha256: hash.digest('hex'), size };
}

export async function copyVerifiedObject({ root, key, source, expectedSize }) {
  const target = localObjectPath(root, key);
  await mkdir(path.dirname(target), { recursive: true });
  let existing;
  try { existing = await stat(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing) {
    const [original, local] = await Promise.all([digest(source), digest(createReadStream(target))]);
    if (original.sha256 !== local.sha256 || original.size !== expectedSize) {
      throw new Error(`Existing local file differs; preserved without overwrite: ${key}`);
    }
    return { ...local, reused: true };
  }
  const hash = createHash('sha256');
  let size = 0;
  let created = false;
  const output = createWriteStream(target, { flags: 'wx' });
  output.once('open', () => { created = true; });
  try {
    await pipeline(source, new Transform({ transform(block, _encoding, callback) {
      hash.update(block); size += block.length; callback(null, block);
    } }), output);
    const sha256 = hash.digest('hex');
    const local = await digest(createReadStream(target));
    if (size !== expectedSize || local.size !== size || local.sha256 !== sha256) {
      throw new Error(`Copied file verification failed: ${key}`);
    }
    return { sha256, size, reused: false };
  } catch (error) {
    if (created) await unlink(target).catch(() => {});
    throw error;
  }
}

async function main() {
  const env = await readEnvironment();
  const { PrismaClient } = requireFromApi('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
  try {
    if (env.STORAGE_DRIVER !== 'local') throw new Error('Configure STORAGE_DRIVER=local before this migration');
    const root = path.resolve(apiRoot, env.LOCAL_STORAGE_PATH || './storage');
    const publicUrl = (env.STORAGE_PUBLIC_URL || 'http://localhost:3002/uploads').replace(/\/$/, '');
    const assets = await prisma.mediaAsset.findMany({ where: { driver: 'MINIO' }, orderBy: { id: 'asc' } });
    const objects = new Map();
    for (const asset of assets) {
      for (const key of new Set([asset.objectKey, asset.thumbnailObjectKey, asset.webpObjectKey].filter(Boolean))) {
        localObjectPath(root, key);
        const bucket = asset.bucket || env.MINIO_BUCKET || 'sfhyl';
        const existing = objects.get(key);
        if (existing && existing.bucket !== bucket) throw new Error(`Different buckets share object key ${key}`);
        objects.set(key, { bucket, key });
      }
    }
    console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'plan', assets: assets.length, objects: objects.size, root }));
    if (!process.argv.includes('--apply') || assets.length === 0) return;
    const backup = path.join(projectRoot, 'logs/dev', `local-storage-migration-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    await mkdir(backup, { recursive: true });
    const stringify = (value) => JSON.stringify(value, (_, item) => typeof item === 'bigint' ? String(item) : item, 2);
    const counts = { media: await prisma.mediaAsset.count(), vehicles: await prisma.vehicle.count(), pages: await prisma.page.count() };
    await writeFile(path.join(backup, 'media-before.json'), stringify({ counts, root, assets }));
    const { Client } = requireFromApi('minio');
    const minio = new Client(minioOptions(env));
    const files = [];
    for (const { bucket, key } of objects.values()) {
      const metadata = await minio.statObject(bucket, key);
      const source = await minio.getObject(bucket, key);
      const verified = await copyVerifiedObject({ root, key, source, expectedSize: metadata.size });
      files.push({ bucket, key, ...verified });
      if (files.length % 40 === 0) console.log(`Verified ${files.length}/${objects.size} files`);
    }
    await writeFile(path.join(backup, 'files-verified.json'), stringify(files));
    // No media IDs, object keys, vehicle references, or content configuration change.
    // All files are present and verified before the atomic metadata switch.
    await prisma.$transaction(async (transaction) => {
      for (const asset of assets) {
        const data = { driver: 'LOCAL', bucket: null };
        for (const [keyField, urlField] of [['objectKey', 'url'], ['thumbnailObjectKey', 'thumbnailUrl'], ['webpObjectKey', 'webpUrl']]) {
          data[urlField] = asset[keyField] ? `${publicUrl}/${asset[keyField].split('/').map(encodeURIComponent).join('/')}` : null;
        }
        const result = await transaction.mediaAsset.updateMany({
          where: { id: asset.id, driver: 'MINIO', objectKey: asset.objectKey, updatedAt: asset.updatedAt }, data,
        });
        if (result.count !== 1) throw new Error(`Asset changed during migration: ${asset.id}; transaction rolled back`);
      }
    }, { timeout: 60_000 });
    const after = { media: await prisma.mediaAsset.count(), vehicles: await prisma.vehicle.count(), pages: await prisma.page.count() };
    let cacheInvalidated = true;
    try { await invalidatePublicCache(env); } catch { cacheInvalidated = false; }
    const report = {
      migratedAssets: assets.length, verifiedFiles: files.length, bytes: files.reduce((sum, file) => sum + file.size, 0),
      remainingMinio: await prisma.mediaAsset.count({ where: { driver: 'MINIO' } }),
      before: counts, after, root, backup, sourceObjectsPreserved: true, cacheInvalidated,
    };
    await writeFile(path.join(backup, 'result.json'), stringify(report));
    console.log(stringify(report));
  } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
