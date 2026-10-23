# 2026-10-24 · 1.0.1 发布与部署

北京时间 2026-10-24 02:51 切换生产发布目录。官网为 `https://sfhyl.cn/`，后台为 `https://sfhyl.cn/admin/`；`erp.sfhyl.cn/admin/` 入口继续使用原站点配置。

## 版本

- GitHub 仓库：`shuyuana666-cyber/sfhyl`，主分支为 `main`。
- 固定发布标签：`v1.0.1`，源码提交：`9b1e956dc2796901dbfbca993052d34faabcad31`。
- GitHub Release 包含完整运行发布包 `sfhyl-v1.0.1.tar.gz`，大小 122,604,061 字节。
- 发布包 SHA-256：`3cc9e70e7a2bf8d8dae6fd9fa47f2d703297d92facddf4168e411038471b8445`。
- 生产目录：`/opt/sfhyl-platform/releases/20261024-v1.0.1`，`current` 指向此目录。
- API 镜像标签：`sfhyl-api:1.0.1`；镜像 ID 为 `sha256:96fd810dc8efd4fd472b0ce73e72d3ec353aaecd4a24ee953b0e73ee74295cb6`。Compose 的运行标签 `sfhyl-api:local` 指向同一镜像。
- 部署记录作为后续文档提交更新 `main`；已发布的 `v1.0.1` 标签和包保持固定，包内 manifest 记录上述源码提交。

## Redis 与 MinIO

Redis 已启用公开 API 缓存和共享限流，生产 key 前缀为 `sfhyl:production`，DB 为 0。MinIO 使用现有持久卷，bucket 为 `sfhyl`，API 内网连接为 `minio:9000`，浏览器公开地址为 `https://sfhyl.cn/media`。公开策略只授予对象读取；原 `/uploads/` 路由及本地源文件继续保留。

现网 MySQL、JWT、加密设置等凭据沿用原值，未运行种子或导入本地数据库。服务器其他项目保持运行。现有 Nginx 已包含 `/media/` 路由，本次通过检查并重载，保留官网、www 和 ERP 域名配置。

MinIO 初始化使用服务器已有可用 client 镜像，通过私有环境中的 `MINIO_MC_IMAGE` 固定为 `quay.io/minio/aistor/mc@sha256:b8a369454c7cffe3aab1cc6e6b3e7e1eb958415ea275315245d994d830299dbb`；通用 `quay.io/minio/mc:latest` 在本次环境拉取返回 401。

## 媒体与数据

迁移前预览 164 条 `LOCAL` 素材、270 个文件对象，共 190,455,357 字节，包含归档素材、原图、缩略图、WebP 和视频。252 个对象来自生产上传卷；另有 18 个默认品牌图标，其数据库 bucket 原为 `website`，URL 为 `/brand-icons/...`，实际文件位于当前官网的 `website/brand-icons/`。

这 18 个图标从生产静态目录复制到受保护的临时目录，记录源文件 SHA-256，并以只读方式挂载到迁移容器的 `/app/storage/uploads/default-brand-icons/`。迁移脚本从既有的第二源目录读取，未使用本机图片替换生产素材；静态图标也单独备份。

暂停 API 写入后保存数据库快照和一致性转储。270 个对象均上传并重新读取，逐个核对大小和 SHA-256，通过后在一个事务内将 164 条记录切为 `MINIO`，缓存失效成功。素材 ID、对象键、车辆/页面关联和其他保留字段哈希一致；其余 31 张表内容哈希不变，包括 28 条车辆、2 条页面和 1 个管理员。

迁移报告位于 API 日志卷的 `/app/logs/dev/minio-migration-2026-10-23T18-49-20-379Z/`，包含记录快照、逐文件校验和迁移结果。路径中的时间为 UTC。

## 检查范围

官网、后台和 API 构建完成，服务器数据库的 10 个 Prisma 迁移均已应用。新版 API 的包版本为 1.0.1，API、MySQL、Redis、MinIO 容器健康，`/health/ready` 返回各依赖 `up`。Redis 与 MinIO 的临时对象写入、读取和删除检查通过。

公网官网、主域名后台、ERP 后台以及公开站点设置、首页和车源接口返回 200。270 个媒体对象的公网 HEAD 全部返回 200，8 个视频的 Range 请求全部返回 206。启动后的 32 张表哈希与迁移结果完全一致；检查时生产 Redis 前缀下已存在 5 个公开缓存相关键和 4 个限流键。

未使用管理员密码登录、提交真实询盘或运行完整恢复演练。

## 备份与回退

升级前备份：`/opt/sfhyl-platform/backups/20261024-before-v1.0.1`，目录权限为 700，包含：

- `mysql.sql.gz`：停止 API 写入后的一致性数据库备份。
- `local-storage.tar.gz`、`minio-data.tar.gz`、`website-icons.tar.gz`：本地上传、原 MinIO 数据和静态品牌图标。
- `SHA256SUMS`：归档 SHA-256；全部 gzip 完整性和校验和检查通过。
- 原环境、Nginx、Compose、前一发布目录、旧镜像 ID 及数据库快照。

旧目录 `/opt/sfhyl-platform/releases/20261012-local-update` 和旧镜像 `sfhyl-api:before-v1.0.1` 保留。实际运维材料位于 `/opt/sfhyl-platform/shared/deploy-v1.0.1-20261024`，其中含私有环境和业务迁移记录，按备份管理。

仅切换上传驱动或旧程序不会恢复媒体记录。若需要保留上线后的新增素材，先暂停写入并做新备份，再按接入文档迁回本地并核对后回退程序；若恢复本次升级前状态，应恢复同一组数据库、存储和环境备份后启动旧镜像，再切换发布目录。恢复升级前数据库会替换后续业务修改，恢复前应先保存当前数据。

本次文档和仓库不保存运行密码、私钥或数据库转储。
