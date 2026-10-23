import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { createConnection, createServer } from 'node:net';
import { get as httpGet } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { superviseService } from './service-supervisor.mjs';
import { checkPublishedImages } from './dev-media-check.mjs';
import { createRedis, initializeMinio, minioOptions } from './infrastructure.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const logDirectory = path.join(projectRoot, 'logs', 'dev');
const launcherPidFile = path.join(logDirectory, 'launcher.pid');
let ownsPidFile = false;
const isWindows = process.platform === 'win32';
const packageManager = isWindows ? 'pnpm.cmd' : 'pnpm';
const projectMysqlPort = 3307;
const installedMysqlPort = 3306;
const requireFromApi = createRequire(path.join(projectRoot, 'apps', 'api-server', 'package.json'));
const dotenv = requireFromApi('dotenv');
const envFilePath = path.join(projectRoot, '.env');
const fileEnvironment = existsSync(envFilePath) ? dotenv.parse(readFileSync(envFilePath)) : {};
const setting = (name, fallback = '') => process.env[name] ?? fileEnvironment[name] ?? fallback;
const storageDriver = setting('STORAGE_DRIVER', 'local').toLowerCase();
const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
const minioExecutable = path.join(localAppData, 'SFHYL2', 'minio', 'bin', isWindows ? 'minio.exe' : 'minio');
const minioDataDirectory = path.resolve(projectRoot, setting('MINIO_DATA_DIR') || path.join(localAppData, 'SFHYL2', 'minio', 'data'));
// Preserved MinIO backups alone are not a runtime dependency. Existing database
// records are checked before services start, so a completed migration needs no MinIO.
let useMinio = storageDriver === 'minio';
const minioHost = setting('MINIO_ENDPOINT', '127.0.0.1');
const minioPort = Number(setting('MINIO_PORT', '9200'));
const minioConsolePort = Number(setting('MINIO_CONSOLE_PORT', '9201'));
const minioRootUser = setting('MINIO_ROOT_USER') || setting('MINIO_ACCESS_KEY');
const minioRootPassword = setting('MINIO_ROOT_PASSWORD') || setting('MINIO_SECRET_KEY');
const minioBucket = setting('MINIO_BUCKET', 'sfhyl');
const externalMinio = setting('MINIO_MANAGED_EXTERNALLY', 'false') === 'true';
const minioOrigin = `${setting('MINIO_USE_SSL', 'false') === 'true' ? 'https' : 'http'}://${minioHost}:${minioPort}`;

const services = [
  {
    name: 'website',
    title: '官网前端',
    address: 'http://127.0.0.1:5173',
    healthUrl: 'http://127.0.0.1:5173/',
    args: ['dev'],
  },
  {
    name: 'admin',
    title: 'Vben 管理后台',
    address: 'http://127.0.0.1:5173/admin/',
    listenPort: 5777,
    healthUrl: 'http://127.0.0.1:5777/admin/',
    args: ['admin:dev'],
  },
  {
    name: 'api',
    title: 'NestJS 后台接口',
    address: 'http://127.0.0.1:3002/api/v1',
    healthUrl: 'http://127.0.0.1:3002/health/ready',
    args: ['dev:api'],
  },
];

const minioService = {
  name: 'minio',
  title: 'MinIO 本地对象存储',
  address: minioOrigin,
  executable: minioExecutable,
  cwd: path.dirname(minioExecutable),
  args: [
    'server',
    minioDataDirectory,
    '--address',
    `${minioHost}:${minioPort}`,
    '--console-address',
    `127.0.0.1:${minioConsolePort}`,
  ],
};

function commandResult(command, args) {
  const executable = isWindows ? process.env.ComSpec || 'cmd.exe' : command;
  const executableArgs = isWindows ? ['/d', '/s', '/c', `${command} ${args.join(' ')}`] : args;
  return spawnSync(executable, executableArgs, {
    cwd: projectRoot,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 10_000,
  });
}

function checkPrerequisites() {
  const missing = [];
  const viteExecutable = isWindows ? 'vite.cmd' : 'vite';
  const requiredPaths = [
    ['root .env', path.join(projectRoot, '.env')],
    ...(useMinio && !externalMinio ? [['native MinIO server', minioExecutable]] : []),
    ['website Vite', path.join(projectRoot, 'node_modules', '.bin', viteExecutable)],
    ['Vben Vite', path.join(projectRoot, 'admin-vben', 'node_modules', '.bin', viteExecutable)],
    [
      'API dotenv loader',
      path.join(projectRoot, 'apps', 'api-server', 'node_modules', 'dotenv', 'config.js'),
    ],
  ];

  for (const [label, filePath] of requiredPaths) {
    if (!existsSync(filePath)) missing.push(`${label}: ${path.relative(projectRoot, filePath)}`);
  }

  if (useMinio && !externalMinio) {
    if (!minioRootUser || minioRootUser.length < 3 || !minioRootPassword || minioRootPassword.length < 8) {
      missing.push('MINIO_ACCESS_KEY and MINIO_SECRET_KEY must contain valid local MinIO credentials');
    }
  }

  const pnpmCheck = commandResult(packageManager, ['--version']);
  if (pnpmCheck.error || pnpmCheck.status !== 0) {
    missing.push(`pnpm is not available on PATH${pnpmCheck.error ? ` (${pnpmCheck.error.message})` : ''}`);
  }

  if (isWindows) {
    const corepackCheck = commandResult('corepack.cmd', ['--version']);
    if (corepackCheck.error || corepackCheck.status !== 0) {
      missing.push(
        `corepack is not available on PATH${corepackCheck.error ? ` (${corepackCheck.error.message})` : ''}`,
      );
    }
  }

  if (missing.length > 0) {
    console.error('启动前检查未通过：');
    for (const item of missing) console.error(`  - ${item}`);
    return false;
  }

  const version = (pnpmCheck.stdout || '').trim();
  console.log(`启动前检查通过（pnpm ${version}）。`);
  return true;
}

function makeServiceEnvironment(service) {
  const env = {
    ...process.env,
    NO_COLOR: '1',
    FORCE_COLOR: '0',
  };

  if (service.name === 'api') {
    const dotenvConfig = path.join(
      projectRoot,
      'apps',
      'api-server',
      'node_modules',
      'dotenv',
      'config.js',
    );
    // NODE_OPTIONS uses its own quoting rules; forward slashes preserve Windows
    // drive paths instead of having the backslashes stripped by Node's parser.
    const dotenvRequire = `--require=${dotenvConfig.replaceAll('\\', '/')}`;
    env.DOTENV_CONFIG_PATH = path.join(projectRoot, '.env');
    env.NODE_OPTIONS = [dotenvRequire, env.NODE_OPTIONS].filter(Boolean).join(' ');
  }

  if (service.name === 'minio') {
    env.MINIO_ROOT_USER = minioRootUser;
    env.MINIO_ROOT_PASSWORD = minioRootPassword;
    env.MINIO_UPDATE = 'off';
  }

  return env;
}

function createOutputRelay(service, logStream, streamName) {
  const decoder = new StringDecoder('utf8');
  let atLineStart = true;
  const marker = streamName === 'stderr' ? `[${service.name}:err] ` : `[${service.name}] `;

  const sanitize = (text) => {
    if (service.name !== 'minio') return text;
    let safe = text;
    for (const secret of [minioRootUser, minioRootPassword]) {
      if (secret) safe = safe.split(secret).join('[REDACTED]');
    }
    return safe.replace(/\b(MINIO_ROOT_(?:USER|PASSWORD)|RootUser|RootPass|AccessKey|SecretKey)(\s*[:=]\s*)\S+/gi, '$1$2[REDACTED]');
  };

  const display = (text) => {
    let offset = 0;
    while (offset < text.length) {
      if (atLineStart) {
        process.stdout.write(marker);
        atLineStart = false;
      }
      const newline = text.indexOf('\n', offset);
      const end = newline === -1 ? text.length : newline + 1;
      process.stdout.write(text.slice(offset, end));
      offset = end;
      if (newline !== -1) atLineStart = true;
    }
  };

  return {
    write(chunk) {
      const text = sanitize(decoder.write(chunk));
      logStream.write(text);
      display(text);
    },
    end() {
      const finalText = sanitize(decoder.end());
      logStream.write(finalText);
      display(finalText);
      if (!atLineStart) process.stdout.write('\n');
    },
  };
}

const activeChildren = new Map();
const mysqlSockets = new Set();
const shutdownController = new AbortController();
let stopping = false;
let mysqlForwarder;
let mysqlLogStream;
let launcherLogStream;

// Keep lifecycle evidence across launches, including after an unexpected exit.
function status(message) {
  launcherLogStream?.write(`[${new Date().toISOString()}] ${message}\n`);
  console.log(message);
}

function wait(ms) {
  return new Promise((resolve) => {
    if (stopping) return resolve();
    const finish = () => {
      clearTimeout(timer);
      shutdownController.signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    shutdownController.signal.addEventListener('abort', finish, { once: true });
  });
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(1_000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function canGet(address) {
  return new Promise((resolve) => {
    const request = httpGet(address, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.setTimeout(1_000, () => {
      request.destroy();
      resolve(false);
    });
    request.once('error', () => resolve(false));
  });
}

async function minioIsReady() {
  if (!externalMinio) return canGet(`${minioOrigin}/minio/health/ready`);
  // S3 providers need not expose MinIO's health route. Credentials and bucket
  // access are checked by the SDK during initialization and API readiness.
  try {
    const response = await fetch(minioOrigin, { method: 'HEAD', signal: AbortSignal.timeout(3_000) });
    return response.status < 500;
  } catch { return false; }
}

async function waitForMinio(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (!stopping && Date.now() < deadline) {
    if (await minioIsReady()) return true;
    await wait(1_000);
  }
  return false;
}

async function waitForEndpoint(address, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (!stopping && Date.now() < deadline) {
    if (await canGet(address)) return true;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}

async function checkStoredMediaDependencies() {
  const { PrismaClient } = requireFromApi('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: setting('DATABASE_URL') } } });
  try {
    const legacyCount = await prisma.mediaAsset.count({ where: { driver: 'MINIO', deletedAt: null } });
    useMinio = storageDriver === 'minio' || legacyCount > 0;
    status(`[storage] 上传驱动 ${storageDriver}；现有 MinIO 媒体 ${legacyCount} 条；MinIO ${useMinio ? '启用' : '未使用'}。`);
    if (useMinio) status(externalMinio ? `[storage] 外部 S3 服务：${minioOrigin}` : `[storage] MinIO 数据目录：${minioDataDirectory}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function reportPublishedImages() {
  const result = await checkPublishedImages({ bucket: minioBucket, minioPort });
  if (result.failures.length) {
    status(`[storage] 图片检查未通过（${result.checked} 个地址，${result.failures.length} 项异常）；页面启动不代表媒体已就绪。`);
    for (const failure of result.failures.slice(0, 8)) status(`[storage] ${failure.path}: ${failure.error}`);
    return false;
  }
  status(`[storage] 图片检查通过：${result.checked} 个本地图片地址均可访问。`);
  return true;
}

async function ensureMysqlEndpoint() {
  if (await canConnect(projectMysqlPort)) {
    console.log(`[mysql] MySQL 已在 127.0.0.1:${projectMysqlPort} 监听。`);
    return;
  }

  if (!(await canConnect(installedMysqlPort))) {
    throw new Error(
      `MySQL 当前没有在 127.0.0.1:${projectMysqlPort} 或 127.0.0.1:${installedMysqlPort} 监听。`,
    );
  }

  mysqlLogStream = createWriteStream(path.join(logDirectory, 'mysql-forward.log'), { flags: 'a' });
  mysqlForwarder = createServer((client) => {
    const upstream = createConnection({ host: '127.0.0.1', port: installedMysqlPort });
    mysqlSockets.add(client);
    mysqlSockets.add(upstream);
    client.pipe(upstream);
    upstream.pipe(client);

    const removePair = () => {
      mysqlSockets.delete(client);
      mysqlSockets.delete(upstream);
      upstream.destroy();
      client.destroy();
    };
    client.on('error', (error) => {
      mysqlLogStream.write(`[${new Date().toISOString()}] client: ${error.message}\n`);
      removePair();
    });
    upstream.on('error', (error) => {
      mysqlLogStream.write(`[${new Date().toISOString()}] MySQL: ${error.message}\n`);
      removePair();
    });
    client.on('close', removePair);
    upstream.on('close', removePair);
  });

  await new Promise((resolve, reject) => {
    mysqlForwarder.once('error', reject);
    mysqlForwarder.listen(projectMysqlPort, '127.0.0.1', resolve);
  });
  const message = `[${new Date().toISOString()}] forwarding 127.0.0.1:${projectMysqlPort} to 127.0.0.1:${installedMysqlPort}\n`;
  mysqlLogStream.write(message);
  console.log(`[mysql] MySQL 服务运行在 3306；本项目的 3307 连接已转发到 3306。`);
}

function stopMysqlForwarder() {
  mysqlForwarder?.close();
  for (const socket of mysqlSockets) socket.destroy();
  mysqlSockets.clear();
  mysqlLogStream?.end();
}

function terminateTree(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;

  if (isWindows) {
    const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    killer.on('error', () => child.kill());
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
}

function stopAll(exitCode, reason) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  if (reason) status(`[launcher] ${reason}`);
  shutdownController.abort();

  stopMysqlForwarder();
  for (const { child } of activeChildren.values()) terminateTree(child);

  const forceTimer = setTimeout(() => {
    for (const { child } of activeChildren.values()) terminateTree(child);
  }, 5_000);
  forceTimer.unref();
}

function startService(service) {
  const logPath = path.join(logDirectory, `${service.name}.log`);
  const logStream = createWriteStream(logPath, { flags: 'a' });
  const startedAt = new Date().toISOString();
  const executable = service.executable || (isWindows ? process.env.ComSpec || 'cmd.exe' : packageManager);
  const executableArgs = service.executable
    ? service.args
    : isWindows
    ? ['/d', '/s', '/c', `${packageManager} ${service.args.join(' ')}`]
    : service.args;
  const child = spawn(executable, executableArgs, {
    cwd: service.cwd || projectRoot,
    env: makeServiceEnvironment(service),
    windowsHide: true,
    detached: !isWindows,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdoutRelay = createOutputRelay(service, logStream, 'stdout');
  const stderrRelay = createOutputRelay(service, logStream, 'stderr');

  logStream.write(`\n[${startedAt}] Starting ${service.title} at ${service.address}\n`);
  status(`[launcher] ${service.title}: ${service.address} (日志: ${path.relative(projectRoot, logPath)})`);

  child.stdout?.on('data', (chunk) => stdoutRelay.write(chunk));
  child.stderr?.on('data', (chunk) => stderrRelay.write(chunk));
  child.stdout?.on('end', () => stdoutRelay.end());
  child.stderr?.on('end', () => stderrRelay.end());

  const done = new Promise((resolve) => {
    child.on('error', (error) => {
      const message = `[${new Date().toISOString()}] Failed to start: ${error.message}\n`;
      logStream.write(message);
      status(`[launcher] ${service.name}: ${error.message}`);
    });

    child.on('close', (code, signal) => {
      activeChildren.delete(service.name);
      const result = code ?? 1;
      const endedAt = new Date().toISOString();
      logStream.end(`\n[${endedAt}] ${service.title} exited with code ${result}${signal ? ` (${signal})` : ''}\n`);
      status(`[launcher] ${service.title} 已退出，代码 ${result}${signal ? `，信号 ${signal}` : ''}。`);
      resolve(result);
    });
  });

  activeChildren.set(service.name, { child, done });
  return done;
}

function supervise(service, reused = false) {
  let reuse = reused;
  return superviseService({
    start: () => startService(service),
    isStopping: () => stopping,
    wait,
    isRunning: async () => {
      if (!reuse) return false;
      const port = service.listenPort ?? Number(new URL(service.address).port);
      reuse = await canConnect(port);
      return reuse;
    },
    onRestart: (code, delay) => status(`[launcher] ${service.title} 意外停止（代码 ${code}），${delay / 1_000} 秒后自动重启；其他服务继续运行。`),
  });
}

async function main() {
  if (process.argv.includes('--check')) {
    process.exitCode = checkPrerequisites() ? 0 : 1;
    return;
  }

  mkdirSync(logDirectory, { recursive: true });
  if (existsSync(launcherPidFile)) {
    const previousPid = Number(readFileSync(launcherPidFile, 'utf8').trim());
    let running = false;
    if (Number.isInteger(previousPid) && previousPid > 0) {
      try { process.kill(previousPid, 0); running = true; } catch { /* Stale launcher. */ }
    }
    if (running) {
      console.log(`[launcher] 启动器已在运行（PID ${previousPid}），正在检查页面、接口和图片。`);
      const readiness = await Promise.all(services.map((service) => waitForEndpoint(service.healthUrl, 45_000)));
      const minioReady = !useMinio || await minioIsReady();
      if (readiness.every(Boolean) && minioReady && await reportPublishedImages()) {
        console.log('[launcher] 现有服务及图片检查通过，本次复用。');
      } else {
        console.error('[launcher] 现有启动器未完全就绪。关闭原启动窗口，再运行 start-dev.bat；详情见 logs/dev/。');
        process.exitCode = 1;
      }
      return;
    }
    unlinkSync(launcherPidFile);
  }
  try {
    writeFileSync(launcherPidFile, String(process.pid), { flag: 'wx' });
    ownsPidFile = true;
  } catch (error) {
    if (error.code === 'EEXIST') return;
    throw error;
  }

  if (!checkPrerequisites()) {
    stopAll(1);
    return;
  }

  mkdirSync(logDirectory, { recursive: true });
  launcherLogStream = createWriteStream(path.join(logDirectory, 'launcher.log'), { flags: 'a' });
  status(`[launcher] 开始运行，PID ${process.pid}。`);
  await ensureMysqlEndpoint();
  if (setting('REDIS_ENABLED', 'false') === 'true') {
    const redis = createRedis({ ...fileEnvironment, ...process.env });
    try {
      await redis.connect();
      await redis.ping();
      status('[redis] 缓存与共享限流服务已就绪。');
    } catch {
      status('[redis] 连接未就绪，API 将使用数据库与进程内限流。可运行 pnpm infra:up 启动 Redis。');
    } finally { redis.disconnect(); }
  }
  await checkStoredMediaDependencies();
  // A local upload driver does not remove dependencies of existing media records.
  if (!checkPrerequisites()) {
    stopAll(1);
    return;
  }
  const serviceStatus = await Promise.all(services.map(async (service) => {
    const port = service.listenPort ?? Number(new URL(service.address).port);
    const occupied = await canConnect(port);
    return { service, occupied, healthy: occupied && await canGet(service.healthUrl) };
  }));
  const unavailable = serviceStatus.filter(({ occupied, healthy }) => occupied && !healthy);
  if (unavailable.length) {
    for (const { service } of unavailable) {
      const port = service.listenPort ?? Number(new URL(service.address).port);
      console.error(`[launcher] ${service.title} 的内部端口 ${port} 已被占用，但健康检查未通过；请检查现有进程。`);
    }
    stopAll(1);
    return;
  }

  for (const { service, occupied } of serviceStatus) {
    if (occupied) console.log(`[launcher] ${service.title} 已在运行：${service.address}（本次复用）。`);
  }
  const completions = [];
  if (useMinio) {
    const minioRunning = await minioIsReady();
    if (!externalMinio) completions.push(supervise(minioService, minioRunning));
    const minioReady = await waitForMinio(45_000);
    if (!minioReady) {
      if (!stopping) stopAll(1, 'MinIO 在 45 秒内未就绪；请查看 logs/dev/minio.log。');
      await Promise.all(completions);
      return;
    }
    if (storageDriver === 'minio') {
      const { Client } = requireFromApi('minio');
      const env = { ...fileEnvironment, ...process.env };
      await initializeMinio(new Client(minioOptions(env)), env);
    }
    console.log(`[minio] MinIO 已就绪：${minioHost}:${minioPort}（控制台 ${minioConsolePort}）。`);
  } else {
    console.log(`[storage] 使用本地文件夹：${setting('LOCAL_STORAGE_PATH', './storage')}`);
  }
  console.log('\n按 Ctrl+C 可停止本次启动的服务；此前已运行的服务会继续运行。');
  completions.push(...serviceStatus.map(({ service, occupied }) => supervise(service, occupied)));
  const apiReadiness = (async () => {
    const ready = await Promise.all([
      waitForEndpoint('http://127.0.0.1:3002/health/ready', 45_000),
      waitForEndpoint('http://127.0.0.1:5173/', 45_000),
    ]);
    if (stopping) return;
    if (!ready.every(Boolean)) {
      status('[launcher] 页面或 API 暂未就绪，请查看 logs/dev/website.log 和 api.log。');
      return;
    }
    status('[api] 页面与 API 已就绪，正在验证已发布图片。');
    await reportPublishedImages();
  })();
  await Promise.all(completions);
  await apiReadiness;
  console.log('[launcher] 所有服务均已停止。');
  launcherLogStream?.end();
}

// A closed output pipe must not abort the supervisor and leave orphan servers.
process.stdout.on('error', (error) => {
  launcherLogStream?.write(`[${new Date().toISOString()}] stdout: ${error.message}\n`);
});
process.stderr.on('error', (error) => {
  launcherLogStream?.write(`[${new Date().toISOString()}] stderr: ${error.message}\n`);
});

process.on('SIGINT', () => stopAll(130, '收到 Ctrl+C，正在关闭本次启动的服务。'));
process.on('SIGTERM', () => stopAll(143, '收到终止信号，正在关闭本次启动的服务。'));
process.on('exit', () => {
  if (ownsPidFile && existsSync(launcherPidFile)) unlinkSync(launcherPidFile);
});

main().catch((error) => {
  console.error(`[launcher] ${error.stack || error.message || error}`);
  stopAll(1);
});
