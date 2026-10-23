# 本地媒体存储

MySQL 保存素材 ID、名称、类型、尺寸、文件路径及页面/车辆引用。文件保存在 `LOCAL_STORAGE_PATH` 指定的目录；开发 API 的工作目录是 `apps/api-server`，当前 `./storage/uploads` 对应 `apps/api-server/storage/uploads`。

`STORAGE_DRIVER=local` 使用已有 LocalStorageProvider 完成上传、派生图生成和文件删除。API 从该目录提供 `/uploads/`，并提供 `/media/` 以兼容旧页面地址。官网和 Vben 开发代理按存储驱动选择 API 或 MinIO；数据库没有 MinIO 媒体记录后，bat 不启动 MinIO。旧 MinIO 数据目录保留为备份。

## 从 MinIO 迁移

先确保旧 MinIO 可读取，数据库与文件目录可访问，且 `.env` 配置 `STORAGE_DRIVER=local`。在项目根目录运行：

```powershell
node scripts/migrate-media-to-local.mjs
node scripts/migrate-media-to-local.mjs --apply
```

第一条只显示计划。应用时，脚本先将受影响的媒体记录保存到 `logs/dev/local-storage-migration-*/media-before.json`，再逐个导出原图、缩略图、WebP 和视频，核验文件大小及 SHA-256。不同内容的同名本地文件会中止迁移并保留原文件。全部文件核验后，在一个数据库事务内更新驱动、bucket 和 URL；媒体 ID、对象键、页面与车源引用保持一致，包括回收站素材。原 MinIO 对象保留。`files-verified.json` 和 `result.json` 记录核验与迁移结果。

重启 bat 后，确认日志显示 MinIO 未使用、图片检查通过。备份时同时保存 MySQL 和上传目录；只备份数据库不包含实际图片文件。恢复旧存储时，使用记录备份恢复对应存储字段，并恢复开发代理/启动配置；在完成验证前保留新文件与原 MinIO 数据。

## 线上使用

本地切换不自动修改现有线上存储。线上迁移也需要导出对象、备份记录、切换 `STORAGE_DRIVER`，并将 Nginx 的 `/media/` 代理从 MinIO 切换到 API `http://127.0.0.1:3002`；`/uploads/` 继续由 API 提供。现有生产 MinIO 部署配置保留，避免本地修改影响正在运行的站点。
