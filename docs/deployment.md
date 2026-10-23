# SFHYL 部署手册（2026-10-12）

本项目由 React 官网、Vben 管理后台、NestJS API、MySQL、Redis 和 MinIO 组成。当前生产媒体使用 API 本地持久存储，公开地址为 `/uploads/`；原 MinIO 服务及对象保留用于兼容和回退。迁移数据时，数据库和对应存储对象必须一起迁移。`public/about`、`public/cars` 和 `public/brand-icons` 是首页及车源默认素材；品牌图标随官网静态构建进入发布包。

1.0.1 新增 Redis 共享限流、环境缓存隔离、MinIO/S3 参数、bucket 初始化与可校验的本地媒体迁移。生产环境示例以 MinIO 为目标；升级代码后需按 [1.0.1 接入步骤](redis-minio-1.0.1.md) 启用及迁移。激活脚本根据 `STORAGE_DRIVER` 和 `MINIO_COMPOSE_ENABLED` 选择项目自带 MinIO 或外部 S3，使用 MinIO overlay 时等待 bucket 初始化成功再启动 API。历史线上配置和数据不会随源码编辑自动切换。

## 1. 构建发布包

在开发机安装 Node 22、Corepack、项目锁定的 pnpm，分别运行 `pnpm install` 和 `pnpm admin:vben:install`。将 `deploy/build.env.example` 复制成 `deploy/build.env`，填入官网 HTTPS 域名；后台路径和 API 路径分别为 `/admin`、`/api/v1`。此文件只允许 `VITE_*` 公共构建参数，不能放服务器密码。

```powershell
node scripts/build-release.mjs deploy/build.env C:\releases\sfhyl-20260929-01
```

发布目录必须位于源码目录外且尚不存在。脚本构建官网与后台、检查 API 类型，并打包运行所需的 API 源码、默认素材、Nginx 配置和静态页面；API 会在服务器的 Docker 镜像构建阶段编译。本机 `.env`、依赖目录和旧管理后台源码不会进入发布包。`release-manifest.json` 记录构建时使用的公共参数。当前 Nginx 模板以 `sfhyl.cn`、`/admin/`、`/api/v1`、`/media` 和 `sfhyl` bucket 为准；改域名或 bucket 时应同步更新 Nginx 文件、构建参数和服务器环境变量。

## 2. 准备 Linux 服务器

将 `sfhyl.cn` 的 DNS 指向服务器，签发对应的 TLS 证书，安装 Docker Compose 和 Nginx。建立 `/opt/sfhyl-platform/{releases,shared,backups}`，把发布目录上传到 `releases/<版本号>`。将 `deploy/production.env.example` 复制到 `/opt/sfhyl-platform/shared/.env`，填入唯一密码、密钥和真实邮箱，并设权限为 `600`。`MYSQL_PASSWORD` 要使用可放入数据库连接 URL 的字符；`SETTINGS_ENCRYPTION_KEY` 要长期保存，变更前需处理已有加密设置。

服务器的 Nginx 站点配置来自 `deploy/nginx/`：官网从 `/opt/sfhyl-platform/current/website` 提供，后台从同一域名的 `/admin/` 路径读取 `/opt/sfhyl-platform/current/admin`；`/api/v1` 反代 NestJS，`/media/` 反代 MinIO，`/uploads/` 反代 API 本地存储。后台包的基础路径是 `/admin/`。可变媒体要求重新校验缓存，使素材删除及时反映到公网；带内容哈希的程序资源仍可长期缓存。MySQL、Redis、MinIO、API 的主机端口在 Compose 中只绑定 `127.0.0.1`。

## 3. 迁移数据并激活

若保留当前网站数据，先导出 MySQL `sfhyl` 库和 MinIO `sfhyl` bucket 的所有对象，在目标环境恢复后核对行数、对象数和抽样图片。应用的数据库字段保存的是媒体 URL/对象键，只有数据库而没有对象时图片会丢失。运行种子命令时只更新与旧默认值一致的首页服务模块文案，并导入热门品牌的默认图标；保留后台手工编辑的品牌名称、图标、排序和显示设置。

```bash
SFHYL_ROOT=/opt/sfhyl-platform bash /opt/sfhyl-platform/releases/<版本号>/deploy/scripts/preflight-release.sh /opt/sfhyl-platform/releases/<版本号>
SFHYL_ROOT=/opt/sfhyl-platform bash /opt/sfhyl-platform/releases/<版本号>/deploy/scripts/activate-release.sh /opt/sfhyl-platform/releases/<版本号>
cd /opt/sfhyl-platform/current && docker compose exec -T api ./node_modules/.bin/prisma db seed
```

Preflight 检查发布文件、服务器环境文件、Compose 和 Nginx 配置；DNS 和证书就绪后可加 `--online`。激活脚本构建 API 镜像、启动依赖和 API、等待就绪，再切换 `current` 软链接并重载 Nginx。种子命令创建初始管理员及默认内容，并安全升级未手工修改的默认文案；迁移旧库时先确认数据库版本、管理员和内容情况，避免重复导入旧 JSON。

## 4. 上线核验

```bash
curl -fsS http://127.0.0.1:3002/health/ready
curl -fsS https://sfhyl.cn/api/v1/public/site
curl -fsS 'https://sfhyl.cn/api/v1/public/vehicles?pageSize=1'
curl -fsS https://sfhyl.cn/admin/ | head
docker compose ps
nginx -t
```

浏览器检查官网 Logo/图片、五步流程与六国切换、三语页面、后台登录与媒体库、上传及车源展示。热门品牌应核对截图中的 16 个品牌，以及原有 MAZDA 和 JETOUR 的图标及关联车辆；后台路径为 `/admin/vehicles/brands`。确认旧 MinIO URL 的图片经 `/media/` 正常加载，并测试一条真实询盘。上线前保存一次数据库及媒体备份。

## 5. 备份、恢复与回滚

`deploy/scripts/backup.sh` 备份 MySQL、MinIO、API 本地存储卷及受保护的环境快照。可以每日定时执行，并设置 `BACKUP_RETENTION_DAYS`。恢复前停止写入、再做一次备份，然后运行：

```bash
SFHYL_ROOT=/opt/sfhyl-platform /opt/sfhyl-platform/current/deploy/scripts/restore.sh /opt/sfhyl-platform/backups/<时间戳> --confirm-restore
```

恢复脚本恢复数据库、MinIO 和本地存储卷，并检查 API 就绪；环境快照仅供人工核对。应用版本回退使用 `deploy/scripts/rollback.sh`。数据库迁移需与上一版本兼容；涉及不兼容变更时恢复对应版本的数据备份。至少在隔离环境演练一次恢复。

## 当前验证范围

2026-10-12 已将本机当前程序和完整数据库部署至生产，当前发布目录为 `/opt/sfhyl-platform/releases/20261012-local-update`。32 张表的规范化内容哈希与本地一致，保留 164 条素材、28 条车辆记录，其中 154 条活动素材、9 辆未删除车辆、6 辆已发布车辆。252 个存储对象和 8 个视频分段请求均验证通过，官网及后台入口浏览器检查正常。完整恢复演练及真实询盘投递仍未执行。详情见 [本次部署记录](deployment-2026-10-12.md)。首次程序部署及此前素材同步历史见 [2026-10-01 部署](deployment-2026-10-01.md) 和 [本地素材同步](media-sync-2026-10-01.md)。
