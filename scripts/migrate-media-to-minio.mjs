import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localObjectPath } from './migrate-media-to-local.mjs';
import { apiRoot, invalidatePublicCache, minioOptions, projectRoot, readEnvironment, requireFromApi } from './infrastructure.mjs';

async function digest(stream) {
  const hash = createHash('sha256');
  let size = 0;
  for await (const block of stream) { hash.update(block); size += block.length; }
  return { sha256: hash.digest('hex'), size };
}

function sameContent(first, second) {
  return first.size === second.size && first.sha256 === second.sha256;
}

export async function resolveSourceFile(roots, key) {
  const candidates = [];
  for (const root of [...new Set(roots.map(root => path.resolve(root)))]) {
    const target = localObjectPath(root, key);
    let info;
    try { info = await stat(target); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (!info.isFile()) throw new Error(`Source is not a file: ${key}`);
    const [actualRoot, actualFile] = await Promise.all([realpath(root), realpath(target)]);
    const relative = path.relative(actualRoot, actualFile);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Source resolves outside storage: ${key}`);
    candidates.push({ file: actualFile, ...await digest(createReadStream(actualFile)) });
  }
  if (!candidates.length) throw new Error(`Source file is missing: ${key}`);
  if (candidates.some(candidate => !sameContent(candidate, candidates[0]))) throw new Error(`Source folders contain different files for ${key}`);
  return candidates[0];
}

export async function uploadVerifiedObject({ client, bucket, key, file, mimeType, expectedChecksum }) {
  const original = await digest(createReadStream(file));
  if (expectedChecksum && expectedChecksum !== original.sha256) throw new Error(`Source checksum differs from media metadata: ${key}`);
  let existing;
  try { existing = await client.statObject(bucket, key); }
  catch (error) { if (!['NotFound', 'NoSuchKey', 'NoSuchObject'].includes(error.code)) throw error; }
  if (existing) {
    const remote = await digest(await client.getObject(bucket, key));
    if (!sameContent(original, remote)) throw new Error(`Existing object differs; preserved without overwrite: ${key}`);
    return { ...remote, reused: true };
  }
  await client.putObject(bucket, key, createReadStream(file), original.size, {
    'Content-Type': mimeType || 'application/octet-stream', 'x-amz-meta-sha256': original.sha256,
  });
  const remote = await digest(await client.getObject(bucket, key));
  const after = await digest(createReadStream(file));
  if (!sameContent(original, remote) || !sameContent(original, after)) throw new Error(`Uploaded object verification failed: ${key}`);
  return { ...remote, reused: false };
}

export async function switchMediaRecords(prisma, assets, bucket, publicUrl) {
  await prisma.$transaction(async transaction => {
    for (const asset of assets) {
      const data = { driver: 'MINIO', bucket };
      for (const [keyField, urlField] of [['objectKey', 'url'], ['thumbnailObjectKey', 'thumbnailUrl'], ['webpObjectKey', 'webpUrl']]) {
        data[urlField] = asset[keyField] ? `${publicUrl}/${asset[keyField].split('/').map(encodeURIComponent).join('/')}` : null;
      }
      const result = await transaction.mediaAsset.updateMany({
        where: { id: asset.id, driver: 'LOCAL', objectKey: asset.objectKey, updatedAt: asset.updatedAt }, data,
      });
      if (result.count !== 1) throw new Error(`Asset changed during migration: ${asset.id}; transaction rolled back`);
    }
  }, { timeout: 60_000 });
}

async function main() {
  const args = process.argv.slice(2);
  const env = await readEnvironment(args);
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const publicUrl = (env.STORAGE_PUBLIC_URL || '').replace(/\/+$/, '');
  if (!/^https?:\/\//.test(publicUrl) || /\/uploads$/.test(publicUrl)) throw new Error('Set STORAGE_PUBLIC_URL to the public MinIO media URL before migration');
  const roots = [
    path.resolve(apiRoot, env.LOCAL_STORAGE_PATH || './storage'),
    path.join(projectRoot, 'storage/uploads'),
  ];
  const { PrismaClient } = requireFromApi('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
  try {
    // Include archived assets so the recycle bin remains restorable.
    const assets = await prisma.mediaAsset.findMany({ where: { driver: 'LOCAL' }, orderBy: { id: 'asc' } });
    const objects = new Map();
    for (const asset of assets) {
      for (const key of new Set([asset.objectKey, asset.thumbnailObjectKey, asset.webpObjectKey].filter(Boolean))) {
        localObjectPath(roots[0], key);
        const item = { key, mimeType: key === asset.objectKey ? asset.mimeType : 'image/webp', expectedChecksum: key === asset.objectKey ? asset.checksum : undefined };
        const previous = objects.get(key);
        if (previous?.expectedChecksum && item.expectedChecksum && previous.expectedChecksum !== item.expectedChecksum) throw new Error(`Media records disagree on checksum: ${key}`);
        if (!previous || item.expectedChecksum) objects.set(key, item);
      }
    }
    const bucket = env.MINIO_BUCKET || 'sfhyl';
    console.log(JSON.stringify({ mode: args.includes('--apply') ? 'apply' : 'plan', assets: assets.length, objects: objects.size, bucket, publicUrl, roots }, null, 2));
    if (!args.includes('--apply') || !assets.length) return;
    const { Client } = requireFromApi('minio');
    const client = new Client(minioOptions(env));
    if (!(await client.bucketExists(bucket))) throw new Error('Target bucket is missing; run pnpm infra:init');
    const backup = path.join(projectRoot, 'logs/dev', `minio-migration-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    await mkdir(backup, { recursive: true });
    const stringify = value => JSON.stringify(value, (_, item) => typeof item === 'bigint' ? String(item) : item, 2);
    await writeFile(path.join(backup, 'media-before.json'), stringify({ roots, bucket, publicUrl, assets }));
    const files = [];
    for (const item of objects.values()) {
      const source = await resolveSourceFile(roots, item.key);
      files.push({ key: item.key, ...await uploadVerifiedObject({ client, bucket, ...item, file: source.file }) });
      await writeFile(path.join(backup, 'files-verified.json'), stringify(files));
    }
    await switchMediaRecords(prisma, assets, bucket, publicUrl);
    let cacheInvalidated = true;
    try { await invalidatePublicCache(env); } catch { cacheInvalidated = false; }
    const result = { migratedAssets: assets.length, verifiedFiles: files.length, sourceFilesPreserved: true, cacheInvalidated, backup };
    await writeFile(path.join(backup, 'result.json'), stringify(result));
    console.log(stringify(result));
  } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
