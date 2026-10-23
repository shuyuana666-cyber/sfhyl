# 更新记录

## 1.0.1 — 2026-10-24

- Redis 接入 NestJS 限流存储，共享全局、登录、询盘计数；故障时降级到进程内计数。
- 公开 API 缓存、generation 与限流统一使用环境 key 前缀；支持 Redis ACL 用户、DB 和 TLS 配置。
- MinIO/S3 增加 region、寻址方式和 session token；分离 SDK 连接地址与浏览器公开 URL。
- 保留历史本地 `/uploads/`，新增 bucket 初始化、连接/读写检查和可校验的本地至 MinIO 迁移。
- 双向迁移脚本支持环境文件和 API 容器布局；全部文件校验后事务切换记录并失效公开缓存。
- Compose 增加 MinIO 启动依赖 overlay，发布包和 API 镜像收录运维脚本；激活流程支持项目 MinIO 与外部 S3。
- 根项目、API、Swagger 和系统信息版本统一为 1.0.1，补充接入、迁移及回退文档。

## 1.0.0

原 `main` 目录基线版本。
