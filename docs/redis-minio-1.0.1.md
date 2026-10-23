# Redis 与 MinIO/S3 接入（1.0.1）

本版本在 `test` 开发目录实现。更新源码不会自动启用真实环境的 Redis、切换上传驱动或迁移业务数据。原 `main` 为 1.0.0 基线。根项目、API 包、Swagger 与系统信息版本统一为 1.0.1；Vben 的版本号仍表示其框架版本。

## 在这个项目中的用途与优势

| 组件 | 实际接入位置 | 收益 |
| --- | --- | --- |
| Redis 缓存 | 官网公开设置、首页、车源等已有 `PublicCacheService` 调用 | 重复读取使用短期缓存，减少 MySQL 查询；后台修改后通过共享 generation 失效 |
| Redis 限流 | 全局、登录、公开询盘的 NestJS 守卫 | 多个 API 实例共享计数；请求分配到不同进程仍受同一限制 |
| Redis 环境前缀 | 缓存、失效标记、限流计数 | 测试与生产可共用 Redis 服务并隔离数据，前缀应分别配置 |
| MinIO/S3 | 原图、缩略图、WebP、视频的上传和删除 | 媒体文件集中存储，API 实例扩容时共享文件；数据库继续保存媒体 ID、对象键及页面引用 |
| 独立公开地址 | `STORAGE_PUBLIC_URL` | SDK 连接内网地址，浏览器访问同源 `/media/` 或 CDN 地址；两者分别配置 |
| 媒体迁移 | `media:migrate:minio` | 先上传并校验大小和 SHA-256，再在事务中切换媒体记录；源文件保留供核对 |

Redis 不保存业务主数据。本版本未引入消息队列或把登录会话迁移到 Redis。实际性能收益取决于访问量、缓存命中率和部署环境。

## 配置

保留现有数据库连接、密钥和上传路径，参考 `.env.example` 合并下列配置。示例密码需要替换为实际值。

```dotenv
REDIS_ENABLED=true
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_USERNAME=
REDIS_DB=0
REDIS_TLS=false
REDIS_KEY_PREFIX=sfhyl:test
PUBLIC_CACHE_TTL_SECONDS=120

STORAGE_DRIVER=minio
STORAGE_PUBLIC_URL=http://127.0.0.1:5173/media
LOCAL_STORAGE_PATH=./storage/uploads
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9200
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=your_minio_access_key
MINIO_SECRET_KEY=your_minio_secret_key
MINIO_BUCKET=sfhyl
MINIO_REGION=us-east-1
MINIO_PATH_STYLE=true
MINIO_SESSION_TOKEN=
MINIO_PUBLIC_READ=true
MINIO_MANAGED_EXTERNALLY=true
```

- `MINIO_ENDPOINT` 仅填写主机名/IP，协议由 `MINIO_USE_SSL` 决定，端口单独填写。
- `MINIO_PATH_STYLE=true` 使用 `host/bucket/key`；`false` 使用 `bucket.host/key`，适用于支持该方式的 S3 服务。
- `MINIO_REGION`、`MINIO_SESSION_TOKEN` 用于相应 S3 服务；临时凭据过期后需更新配置并重启 API。
- `MINIO_PUBLIC_READ=true` 允许初始化命令设置匿名 `s3:GetObject`。该策略不授予匿名列举和写入权限；它会替换 bucket 的现有匿名读取策略，已有定制策略应由运维统一管理。
- `MINIO_PUBLIC_READ=false` 表示初始化时保留已有策略，**不会撤销**先前已配置的公开权限。公开图片 URL 仍需要对象读取权限或已配置的 CDN/网关；本版本未增加私有文件的签名下载接口。
- `LOCAL_STORAGE_PATH` 相对 API 工作目录解析：源码模式为 `apps/api-server`，容器模式为 `/app`。切换 MinIO 时保持原路径及文件卷，原 `/uploads/` 地址继续可读。
- `STORAGE_PUBLIC_URL` 保存到新媒体记录中，需使用浏览器能访问的完整 HTTP(S) 地址；修改它只影响后续上传，不会重写已存在的媒体 URL。
- 生产使用 `REDIS_KEY_PREFIX=sfhyl:production`。同一环境的多个 API 实例使用相同前缀和 DB；不同环境分别设置前缀。

### 地址区别

| 场景 | SDK 访问地址 | 浏览器公开地址示例 |
| --- | --- | --- |
| 本机 API + Docker MinIO | `127.0.0.1:9200` | `http://127.0.0.1:5173/media` |
| Compose API + 同栈 MinIO | `minio:9000` | `https://sfhyl.cn/media` |
| 外部 S3 | 服务商 endpoint、端口及 TLS 配置 | 已配置的 CDN 或公开 bucket URL |

Compose 内的 API 使用 `MINIO_INTERNAL_ENDPOINT`（默认 `minio`）、`MINIO_INTERNAL_PORT`（默认 `9000`）。`.env` 的 `MINIO_PORT=9200` 是本机映射端口，供本机 SDK 或 Nginx 使用。Compose Redis 默认使用容器内 `redis:6379`；ACL、TLS 选项可用于直接部署的 API，连接外部 Redis 的 Compose 部署需同步调整服务地址、依赖与 TLS 配置。

## 本地开发

先启动 Docker Desktop，安装依赖并生成 Prisma 客户端：

```powershell
pnpm install --frozen-lockfile
pnpm admin:vben:install
pnpm db:generate
```

已经有 MySQL 的项目，只启动 Redis 与 MinIO：

```powershell
docker compose --profile minio up -d redis minio minio-init
pnpm infra:init
pnpm infra:check --write-check
.\start-dev.bat
```

新安装且需要项目自带 MySQL 时，使用 `pnpm infra:up:minio`。该命令启动 MySQL、Redis、MinIO 及 bucket 初始化服务；数据库 schema 的初始化继续按原项目流程执行。

`MINIO_MANAGED_EXTERNALLY=true` 表示开发启动器连接 Docker/外部服务；它不启动 native MinIO。已有本机 native MinIO 安装可设为 `false`，启动器会使用原安装路径及数据目录，并初始化 bucket。普通外部 S3 服务无需提供 MinIO 专有健康检查路由。网站和后台的开发代理依据 TLS、bucket 和寻址方式转发 `/media/`。

## 初始化与连接检查

```powershell
pnpm infra:init
pnpm infra:check
pnpm infra:check --write-check
pnpm infra:check --env .env.staging --write-check
```

`init` 在 `STORAGE_DRIVER=minio` 时创建缺失的 bucket，并按显式配置设置公开读取策略；重复执行不会重复创建 bucket。`check` 检查已启用 Redis 的 PING 和 bucket 是否存在；`--write-check` 额外使用随机 key/对象执行写入、读取、删除。关闭的组件报告 `disabled`，其结果不表示连接已经验证。脚本默认读取根目录 `.env`，支持 `--env FILE`，进程环境变量具有更高优先级。

生产可先由管理账号建 bucket/设置策略，再让 API 使用仅允许业务对象读写和健康检查所需权限的账号。公开策略只适合本项目用于公开展示的媒体 bucket。

## 历史本地素材迁移

1. 备份数据库和整个本地上传目录；在维护窗口暂停素材上传、删除和内容编辑。多个 API 实例都应停止写入。
2. 准备迁移专用环境文件，复制实际数据库、Redis、MinIO 连接参数，设置目标 `STORAGE_PUBLIC_URL`，例如 `http://127.0.0.1:5173/media`。保留实际 `LOCAL_STORAGE_PATH`。`STORAGE_DRIVER` 可暂时保持 `local`。
3. 先通过 MinIO profile 或 `infra:init` 建好目标 bucket。
4. 在根目录执行预览，再执行应用：

```powershell
pnpm media:migrate:minio --env .env.minio-migration
pnpm media:migrate:minio --env .env.minio-migration --apply
```

预览只查询并显示待迁移记录数、对象数和路径，不写文件或数据库。应用步骤包括：

- 包含回收站内的 `LOCAL` 素材，收集原图、缩略图、WebP 和视频对象键。
- 从 API 上传目录与历史根目录 `storage/uploads` 找源文件；同名文件内容不同、缺失文件、非法路径或校验值冲突会中止。
- 上传后读取完整对象，核对大小和 SHA-256；已有同名对象只有内容一致才复用，内容冲突时中止。
- 全部对象通过后，在一个数据库事务中修改驱动、bucket 和 URL；保留素材 ID、对象键、车源和页面关系。素材在期间被修改时事务回滚。
- 保留本地源文件和上传对象。中途失败后修复问题可重复执行；维护期间避免其他进程写入目标 bucket 的同名 key。

记录备份和结果保存在 `logs/dev/minio-migration-*/`，包含 `media-before.json`、`files-verified.json` 和成功后的 `result.json`。这些文件属于运维数据，需妥善保存。迁移成功后将正式 `.env` 切换为 MinIO，重启全部 API 与开发代理，再恢复写入。Redis 失效失败会在结果中标记 `cacheInvalidated=false`，此时等待缓存 TTL 或主动清理对应环境缓存后再核对。

文件已迁移不代表所有文案中的硬编码 URL 已改写。原 `/uploads/` 继续有效，保留本地文件直到完成全站引用检查。

## 生产部署

`deploy/production.env.example` 提供 1.0.1 目标配置。Nginx 模板的 `/media/` 指向 `http://127.0.0.1:9200/sfhyl/`，`/uploads/` 保留到 API；使用其他 bucket、端口、域名或外部 S3 时同步更新代理与公开地址。

项目自带 MinIO：

```sh
docker compose --profile minio -f docker-compose.yml -f docker-compose.minio.yml up -d --build api
```

或在源码目录执行 `pnpm stack:up:minio`。该组合会等待 MySQL、Redis、Prisma 迁移和 MinIO bucket 初始化成功后再启动 API。发布目录内也包含 overlay、运维脚本和本文档；激活脚本在 `STORAGE_DRIVER=minio`、`MINIO_COMPOSE_ENABLED` 非 `false` 时自动采用该组合。

迁移既有生产本地素材时，先构建新镜像并启动依赖，暂停 API 写入后使用一次性容器运行迁移。不要把已升级代码与历史数据迁移混成一次不可观察的启动动作：

```sh
docker compose build api
docker compose --profile minio up -d mysql redis minio minio-init
docker compose stop api
docker compose run --rm --no-deps -e STORAGE_PUBLIC_URL=https://sfhyl.cn/media api node scripts/migrate-media-to-minio.mjs
docker compose run --rm --no-deps -e STORAGE_PUBLIC_URL=https://sfhyl.cn/media api node scripts/migrate-media-to-minio.mjs --apply
```

在更新服务器 `.env` 和 Nginx 后通过激活脚本启动新版本。API 镜像内已包含初始化与双向迁移脚本，日志保存在挂载的 `/app/logs` 下。运行中的服务也可以执行：

```sh
docker compose exec -T api node scripts/infrastructure.mjs check --write-check
```

外部 S3 服务：设置 `MINIO_COMPOSE_ENABLED=false`、`MINIO_INTERNAL_ENDPOINT`、`MINIO_INTERNAL_PORT`、TLS/region/寻址选项及公开 URL。由外部服务管理 bucket 与权限，或使用一次性 API 容器运行 `node scripts/infrastructure.mjs init`；随后用基础 `docker compose up -d --build api` 启动，激活脚本也会采用基础配置。`stack:up:minio` 专用于启动项目自带 MinIO。原备份脚本面向项目内 MinIO；外部 S3 的备份、版本保留和恢复按服务商方案配置。

## 故障、观测与回退

- `/health/ready`：MySQL 和当前存储为必须依赖；Redis 故障时报告 `degraded`，API 继续可用。
- Redis 故障时公开缓存回源 MySQL，限流使用各进程内计数；此时没有跨实例的统一限流保证。重连后自动恢复 Redis。Redis 限流采用固定窗口及独立阻断时间；故障切换时计数可能重新开始。Redis 关闭时使用原有内存限流。
- 系统信息显示版本、Redis 开关、配置的限流模式及 key 前缀；实时可用性以健康检查为准。系统存储信息显示 bucket/region/寻址方式，不返回密钥。
- 只回退上传驱动不会自动回退历史媒体记录。需要迁回本地时，准备 `STORAGE_DRIVER=local`、正确的本地目录及 `/uploads` 公开 URL，然后运行 `node scripts/migrate-media-to-local.mjs --env FILE` 预览，加 `--apply` 执行。该命令处理环境内所有 `MINIO` 媒体，包含新上传素材；核对范围后在维护窗口执行，源对象保留。
- 程序回退使用原发布回退流程；数据库与文件恢复需使用对应的一组备份。切换前后都要保留实际文件，避免仅恢复数据库后引用丢失。

2026-10-24 已在生产完成 1.0.1 容器部署、Redis/MinIO 读写检查及 164 条素材迁移，270 个媒体对象和 8 个视频分段请求检查通过，详情见 [部署记录](deployment-2026-10-24.md)。其他环境需要按本文配置和迁移。历史默认品牌图标的记录可能为 `LOCAL` + `bucket=website`，实际文件在官网静态目录；迁移前需将这些既有文件按 `default-brand-icons/<文件名>` 组织为第二源目录，并只读挂载到迁移容器的 `/app/storage/uploads/`，参见部署记录。预览只统计记录和对象，执行迁移时才读取和验证源文件。
