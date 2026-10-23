# SFHYL 平台架构（1.0.1 / 2026-10-24）

## 技术栈

| 层级 | 当前技术与版本来源 |
| --- | --- |
| 官网 | React 19、React Router 7、Vite 8；版本以根目录 `package.json` 和 `pnpm-lock.yaml` 为准 |
| 管理后台 | Vue 3.5、Vue Vben Admin V5 (`@vben/web-ele` 5.8.0)、Element Plus 2；版本以 `admin-vben/pnpm-workspace.yaml` 和锁文件为准 |
| API | NestJS 10、TypeScript 5.8、Prisma 6；版本以 `apps/api-server/package.json` 为准 |
| 数据与媒体 | MySQL 8.4、Redis、MinIO 或本地上传目录；运行配置以 `deploy/` 和环境变量为准 |
| 构建与测试 | 根工作区 pnpm 10.13.1，后台独立工作区 pnpm 11.16.0；Playwright、Jest、Vben Typecheck |

根工作区与后台工作区使用各自的锁文件。升级依赖时分别执行安装、构建和类型检查，发布目录由 `scripts/build-release.mjs` 生成。

## 运行结构

```text
sfhyl.cn/ (React 官网) ────────┐
sfhyl.cn/admin/ (Vben 后台) ──┴── sfhyl.cn/api/v1 (NestJS)
                                           │
                                  MySQL 8.4 / Redis / MinIO
```

Nginx 负责 TLS、静态文件和反向代理。官网与后台直接使用 API；API 从 MySQL 读取页面、服务模块、车源和设置。MySQL 保存媒体元数据、URL 和对象键；文件通过本地目录或 MinIO/S3 保存，由环境配置选择。Nginx 的 `/media/` 代理提供对象存储媒体，`/uploads/` 提供 API 本地文件。历史 `localhost:9200/sfhyl` URL 由前端媒体解析器转换为 `/media/`。默认静态素材位于 `public/about`、`public/cars`、`public/brand-icons` 与 `public/brand-logo.jpg`。生产环境的历史切换见部署记录，当前接入方式见 [Redis 与 MinIO 1.0.1](redis-minio-1.0.1.md)。

## 源码边界

| 目录 | 用途 |
| --- | --- |
| `src/` | 官网 React 页面、公共 API 映射与三语界面 |
| `admin-vben/apps/web-ele/` | 当前后台、权限路由与业务页面 |
| `apps/admin-web/` | 旧后台源码及当前发布构建输出 `dist/` |
| `apps/api-server/` | NestJS 业务模块、Prisma、数据库迁移与种子 |
| `deploy/` | Compose、Nginx 和上线运维脚本 |

官网只调用公开 API，不依赖浏览器本地存储作为业务内容源。首页服务流程和服务区域从已有自定义模块读取三语富文本；符合五步或六国结构时渲染可点击组件，结构变化时展示原始富文本。后台内容、显示开关和顺序以数据库为准。新安装的种子提供默认内容，已有站点仅升级仍与旧默认值完全一致的文案。

后台由 Vben 提供应用外壳、登录、菜单和权限路由；服务端守卫执行真实权限检查。API 使用 Prisma 迁移管理 schema，负责身份、车源、内容、媒体、询盘、设置及日志。Redis 保存公开 API 缓存和跨实例共享的限流计数；不同环境通过 key 前缀隔离。Redis 故障时缓存回源 MySQL，限流使用进程内计数。文件存储通过 `StorageProvider` 适配；MinIO 客户端支持 region、TLS、路径/虚拟主机寻址和临时 session token。未完成验证的 OSS/COS 适配器不应作为部署驱动。

“关于我们”的核心优势使用已有自定义模块 `company-core-strengths`。未配置媒体时前端显示右侧占位；后台设置图片或视频后直接显示该媒体。网站与后台共用公开站点设置中的 `branding.logoUrl`，静态 `brand-logo.jpg` 为 API 暂不可用时的回退素材。登录页默认浅色主题。

## 发布与数据

`scripts/build-release.mjs` 生成三端静态与 API 运行包；服务器密钥放在发布目录外的 `/opt/sfhyl-platform/shared/.env`。Compose 在容器启动前执行 Prisma 迁移，激活脚本切换 `current` 软链接。既有数据迁移需要同时搬迁 MySQL、MinIO 对象与必要的本地存储；备份及恢复脚本覆盖这三类数据。完整步骤见 [部署手册](deployment.md)。
