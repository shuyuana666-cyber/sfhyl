import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const buildFile = process.argv[2];
const destination = process.argv[3];
const allowedKeys = new Set([
  'VITE_PUBLIC_API_BASE_URL',
  'VITE_ADMIN_URL',
  'VITE_GLOB_API_URL',
  'VITE_API_BASE_URL',
  'VITE_SITE_URL',
  'VITE_MEDIA_BASE_PATH',
  'VITE_LEGACY_MEDIA_BUCKET',
  'VITE_LEGACY_MEDIA_PORT',
  'VITE_CAPTCHA_PROVIDER',
  'VITE_CAPTCHA_SITE_KEY',
]);

if (!buildFile || !destination) {
  throw new Error('Usage: node scripts/build-release.mjs BUILD_ENV_FILE RELEASE_DIRECTORY');
}

const release = path.resolve(destination);
const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: workspace, encoding: 'utf8', windowsHide: true });
const gitCommit = revision.status === 0 ? revision.stdout.trim() : null;
const relativeRelease = path.relative(workspace, release);
if (
  !relativeRelease ||
  (!relativeRelease.startsWith('..') && !path.isAbsolute(relativeRelease))
) {
  throw new Error('The release directory must be outside the source workspace.');
}

const buildEnv = {};
for (const rawLine of (await readFile(path.resolve(buildFile), 'utf8')).split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const separator = line.indexOf('=');
  if (separator < 1) throw new Error(`Invalid build environment line: ${line}`);
  const key = line.slice(0, separator).trim();
  if (!allowedKeys.has(key)) throw new Error(`Unexpected public build key: ${key}`);
  let value = line.slice(separator + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  buildEnv[key] = value;
}

const siteUrl = new URL(buildEnv.VITE_SITE_URL || 'http://localhost');
if (siteUrl.protocol !== 'https:' || /^(localhost|127\.0\.0\.1)$/i.test(siteUrl.hostname)) {
  throw new Error('VITE_SITE_URL must be a public HTTPS URL.');
}
if (buildEnv.VITE_ADMIN_URL !== '/admin') {
  throw new Error('VITE_ADMIN_URL must be /admin for the shared website origin.');
}
for (const key of ['VITE_PUBLIC_API_BASE_URL', 'VITE_GLOB_API_URL', 'VITE_API_BASE_URL']) {
  if (buildEnv[key] !== '/api/v1') {
    throw new Error(`${key} must be /api/v1 for the supplied Nginx site config.`);
  }
}
if (buildEnv.VITE_MEDIA_BASE_PATH !== '/media' || buildEnv.VITE_LEGACY_MEDIA_BUCKET !== 'sfhyl') {
  throw new Error('Media path and bucket must match the supplied Nginx configuration.');
}
if (!/^\d{2,5}$/.test(buildEnv.VITE_LEGACY_MEDIA_PORT || '')) {
  throw new Error('VITE_LEGACY_MEDIA_PORT must be a port number.');
}
if (
  buildEnv.VITE_CAPTCHA_PROVIDER !== 'disabled' &&
  !buildEnv.VITE_CAPTCHA_SITE_KEY
) {
  throw new Error('VITE_CAPTCHA_SITE_KEY is required when CAPTCHA is enabled.');
}

function run(commandArgs) {
  const result = spawnSync(
    process.platform === 'win32' ? 'corepack.cmd' : 'corepack',
    ['pnpm', ...commandArgs],
    {
      cwd: workspace,
      env: { ...process.env, ...buildEnv },
      shell: process.platform === 'win32',
      stdio: 'inherit',
    },
  );
  if (result.error || result.status !== 0) {
    throw result.error || new Error(`Build failed: pnpm ${commandArgs.join(' ')}`);
  }
}

run(['build:website']);
run(['admin:build']);
// The API is compiled in its Docker build; typecheck here without replacing
// the dist directory used by a local Nest watch process.
run(['api:typecheck']);

await mkdir(release, { recursive: false });
async function copy(source, target) {
  await cp(path.join(workspace, source), path.join(release, target), {
    recursive: true,
    force: false,
    errorOnExist: true,
  });
}

for (const file of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'docker-compose.yml', 'docker-compose.minio.yml', '.dockerignore']) {
  await copy(file, file);
}
for (const file of ['infrastructure.mjs', 'migrate-media-to-minio.mjs', 'migrate-media-to-local.mjs']) {
  await copy(`scripts/${file}`, `scripts/${file}`);
}
await copy('docs/redis-minio-1.0.1.md', 'docs/redis-minio-1.0.1.md');
await cp(path.join(workspace, 'apps/api-server'), path.join(release, 'apps/api-server'), {
  recursive: true,
  filter(source) {
    const relative = path.relative(path.join(workspace, 'apps/api-server'), source);
    const parts = relative.split(path.sep);
    // Exclude runtime output at the API root while retaining src/infrastructure/storage.
    return !source.endsWith('.spec.ts') &&
      !parts.includes('node_modules') &&
      !['dist', 'storage', 'coverage', 'test'].includes(parts[0]) &&
      !parts.some((part) => part === '.env' || part.startsWith('.env.'));
  },
});
await copy('public/about', 'public/about');
await copy('public/cars', 'public/cars');
await cp(path.join(workspace, 'deploy'), path.join(release, 'deploy'), {
  recursive: true,
  filter(source) {
    return path.basename(source) !== 'build.env';
  },
});
await copy('dist', 'website');
await copy('apps/admin-web/dist', 'admin');
await writeFile(
  path.join(release, 'release-manifest.json'),
  JSON.stringify({
    version: JSON.parse(await readFile(path.join(workspace, 'package.json'), 'utf8')).version,
    gitCommit,
    builtAt: new Date().toISOString(),
    publicBuild: buildEnv,
  }, null, 2) + '\n',
);
console.log(`Release created at ${release}`);
