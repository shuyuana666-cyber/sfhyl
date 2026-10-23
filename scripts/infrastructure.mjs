import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
// Source releases keep the workspace layout; the API image has a flat /app layout.
export const apiRoot = existsSync(path.join(projectRoot, 'apps/api-server/package.json'))
  ? path.join(projectRoot, 'apps/api-server') : projectRoot;
export const requireFromApi = createRequire(path.join(apiRoot, 'package.json'));

export async function readEnvironment(args = process.argv.slice(2)) {
  const index = args.indexOf('--env');
  if (index >= 0 && !args[index + 1]) throw new Error('--env requires a file path');
  const filename = path.resolve(projectRoot, index >= 0 ? args[index + 1] : '.env');
  let file = '';
  try { file = await readFile(filename, 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT' || index >= 0) throw error; }
  return { ...requireFromApi('dotenv').parse(file), ...process.env };
}

export function minioOptions(env) {
  const endPoint = env.MINIO_ENDPOINT || '127.0.0.1';
  if (endPoint.includes('://') || endPoint.includes('/')) throw new Error('MINIO_ENDPOINT must contain a hostname, without a URL scheme or path');
  return {
    endPoint, port: Number(env.MINIO_PORT || 9200), useSSL: env.MINIO_USE_SSL === 'true',
    accessKey: env.MINIO_ACCESS_KEY, secretKey: env.MINIO_SECRET_KEY,
    region: env.MINIO_REGION || undefined, pathStyle: env.MINIO_PATH_STYLE !== 'false',
    sessionToken: env.MINIO_SESSION_TOKEN || undefined,
  };
}

export function publicReadPolicy(bucket) {
  return JSON.stringify({ Version: '2012-10-17', Statement: [{
    Effect: 'Allow', Principal: { AWS: ['*'] }, Action: ['s3:GetObject'], Resource: [`arn:aws:s3:::${bucket}/*`],
  }] });
}

export async function initializeMinio(client, env) {
  const bucket = env.MINIO_BUCKET || 'sfhyl';
  if (!(await client.bucketExists(bucket))) {
    try { await client.makeBucket(bucket, env.MINIO_REGION || 'us-east-1'); }
    catch (error) { if (error.code !== 'BucketAlreadyOwnedByYou') throw error; }
  }
  // Anonymous reads are explicitly opt-in; anonymous writes/listing are never granted.
  if (env.MINIO_PUBLIC_READ === 'true') await client.setBucketPolicy(bucket, publicReadPolicy(bucket));
  return bucket;
}

export function createRedis(env) {
  const Redis = requireFromApi('ioredis');
  const client = new Redis({
    host: env.REDIS_HOST || '127.0.0.1', port: Number(env.REDIS_PORT || 6379),
    password: env.REDIS_PASSWORD || undefined, username: env.REDIS_USERNAME || undefined,
    db: Number(env.REDIS_DB || 0), tls: env.REDIS_TLS === 'true' ? {} : undefined,
    lazyConnect: true, connectTimeout: 3000, commandTimeout: 3000,
    maxRetriesPerRequest: 0, retryStrategy: () => null,
  });
  client.on('error', () => {});
  return client;
}

export async function invalidatePublicCache(env) {
  if (env.REDIS_ENABLED !== 'true') return;
  const redis = createRedis(env);
  try {
    await redis.connect();
    await redis.incr(`${env.REDIS_KEY_PREFIX || 'sfhyl'}:public:v1:generation`);
  } finally { redis.disconnect(); }
}

async function main() {
  const args = process.argv.slice(2);
  const action = args[0];
  if (!['init', 'check'].includes(action)) throw new Error('Usage: node scripts/infrastructure.mjs init|check [--env FILE] [--write-check]');
  const env = await readEnvironment(args);
  const report = { redis: 'disabled', minio: 'disabled' };
  if (env.REDIS_ENABLED === 'true') {
    const redis = createRedis(env);
    try {
      await redis.connect();
      if (await redis.ping() !== 'PONG') throw new Error('Redis PING failed');
      if (args.includes('--write-check')) {
        const key = `${env.REDIS_KEY_PREFIX || 'sfhyl'}:check:${randomUUID()}`;
        try {
          await redis.set(key, 'ok', 'EX', 30);
          if (await redis.get(key) !== 'ok') throw new Error('Redis read/write check failed');
        } finally { await redis.del(key); }
      }
      report.redis = 'up';
    } finally { redis.disconnect(); }
  }
  if (env.STORAGE_DRIVER === 'minio') {
    const { Client } = requireFromApi('minio');
    const client = new Client(minioOptions(env));
    const bucket = env.MINIO_BUCKET || 'sfhyl';
    if (action === 'init') await initializeMinio(client, env);
    if (!(await client.bucketExists(bucket))) throw new Error(`Bucket ${bucket} is missing; run pnpm infra:init`);
    if (args.includes('--write-check')) {
      const key = `checks/${randomUUID()}.txt`;
      const content = Buffer.from('sfhyl storage check');
      let uploaded = false;
      try {
        await client.putObject(bucket, key, content, content.length, { 'Content-Type': 'text/plain' });
        uploaded = true;
        const chunks = [];
        for await (const chunk of await client.getObject(bucket, key)) chunks.push(chunk);
        if (!Buffer.concat(chunks).equals(content)) throw new Error('MinIO read/write check failed');
      } finally { if (uploaded) await client.removeObject(bucket, key); }
    }
    report.minio = 'up';
    report.bucket = bucket;
    report.publicRead = env.MINIO_PUBLIC_READ === 'true';
  }
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    const code = typeof error.code === 'string' && /^[A-Za-z0-9_-]+$/.test(error.code) ? ` (${error.code})` : '';
    console.error(`Infrastructure check failed${code}. Check service availability, credentials, bucket permissions and the selected --env file.`);
    process.exitCode = 1;
  });
}
