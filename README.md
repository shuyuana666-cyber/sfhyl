# SFHYL.CN 项目

当前发布版本为 **1.0.1**，已于 2026-10-24 部署到生产。已启用 Redis 公开数据缓存与共享限流、MinIO/S3 媒体存储，迁移 164 条素材并校验 270 个文件对象。部署、验证和备份位置见 [本次部署记录](docs/deployment-2026-10-24.md)；配置、启动、迁移与回退步骤见 [Redis 与 MinIO 接入说明](docs/redis-minio-1.0.1.md)。其他环境仍需配置并启用依赖。

源码发布采用 `main` 分支和 `v1.0.1` 等固定版本标签，流程见 [版本管理](docs/version-management.md)。运行密钥、数据库与上传文件在服务器独立备份，不纳入仓库。

完整功能和操作说明见 [平台功能与使用手册](docs/user-manual.md)，可下载 [Word 版使用手册](docs/handbook/SFHYL平台功能与使用手册.docx)。手册覆盖官网、后台、车辆、素材、首页、询盘、权限和常见问题。

- `src/`、`public/`：React 官网及默认素材
- `admin-vben/`：当前 Vben 管理后台源码
- `apps/api-server/`：NestJS API、Prisma schema、迁移与种子
- `apps/admin-web/`：旧后台源码与当前后台构建输出；正式发布只收集其 `dist/`
- `deploy/`：Docker Compose 配套环境示例、Nginx 配置和运维脚本
- `scripts/build-release.mjs`：按公共构建参数生成精简发布目录
- `tests/`：浏览器测试

本地开发参见 [API 文档](docs/api.md)、[后台使用教程](docs/admin-guide.md) 和 [后台开发说明](docs/admin-vben.md)；服务器上线参见 [部署手册](docs/deployment.md)。业务文案、图片、联系方式、服务模块及显示设置由后台和 API 管理；源代码只保留页面结构与基础提示。

当前技术栈与版本见 [平台架构](docs/architecture.md)。官网使用 React/Vite，后台使用 Vue Vben Admin/Element Plus，API 使用 NestJS/Prisma；根目录与 `admin-vben/` 分别使用 pnpm 10 与 pnpm 11 工作区。

本地运行 `start-dev.bat` 后，官网访问 `http://127.0.0.1:5173/`，管理后台访问 `http://127.0.0.1:5173/admin/`。后台开发进程使用内部端口，由官网开发服务器转发到同一浏览器地址。正式环境对应 `https://sfhyl.cn/` 和 `https://sfhyl.cn/admin/`。

启动器会复用已有服务，并根据数据库里的现有媒体记录启动旧图片所需的 MinIO，即使新上传使用本地存储。页面和接口就绪后会通过官网的 `/media/`、`/uploads/` 地址检查已发布图片，输出检查结果；重复运行 bat 也会检查现有服务及图片。单个服务意外退出后自动重启，其他服务继续运行。保留启动窗口，按 Ctrl+C 停止本次启动的服务。生命周期日志在 `logs/dev/launcher.log`，各服务日志追加保存在同目录，便于追查退出原因。

MySQL 保存媒体元数据与引用；文件由 `STORAGE_DRIVER` 选择本地目录或 MinIO/S3。使用 MinIO 时，已有本地文件仍通过 `/uploads/` 提供。使用本地存储时，API 也提供兼容旧地址的 `/media/`；启动器根据媒体记录识别旧 MinIO 依赖。历史本地存储说明见 [本地媒体存储](docs/local-media-storage.md)。

历史压缩包、过期审计和 Figma 交接文档已移至 `C:\project\SFHYL2-archives\2026-09-29`，不参与构建。`node_modules/`、`dist/`、`test-results/`、`logs/` 是开发生成目录，不应上传到服务器；发布脚本会选择性收集运行文件。
