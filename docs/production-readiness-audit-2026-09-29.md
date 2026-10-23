# 上线与长期维护审查（2026-09-29）

## 范围与结论

本次以仓库源码、Prisma schema、迁移、Compose、部署脚本和现有测试为依据。项目实际是汽车官网、管理后台和客户询盘系统，不是多租户 AI Agent / RAG / 订单平台。核心业务已统一使用 MySQL 8.4；Redis 只用于可丢弃的缓存，媒体元数据在 MySQL、对象在 MinIO 或本地存储。现阶段无需引入微服务、Kafka、搜索集群或新的 ORM。

认证、权限、输入校验、媒体类型检查、结构化日志、健康检查、优雅关闭、迁移与备份均有实现。上线前仍需处理下表中的具体风险，并在目标 Linux 环境做真实备份恢复和故障演练。没有执行生产迁移、修改现有业务数据或读取部署密钥的实际值。

## 已直接修复

| 等级 | 问题与处理 | 验证 |
| --- | --- | --- |
| P1 | 客户刷新 JWT 原来只含固定 `sub/family` 和秒级时间，同一秒签发会产生相同令牌并撞上 `tokenHash` 唯一约束。新令牌加入随机 `jti`，旧令牌仍可验证，无数据库迁移。见 `customer-auth.service.ts`。 | 新增同秒双签回归测试。 |
| P1 | 客户登录原来从未增加 `failedLoginAttempts`，`lockedUntil` 只读不写。现在失败计数原子递增，达到现有配置阈值后限时锁定；成功登录以条件更新确认账号仍有效，并与刷新令牌记录同事务提交。见 `customer-auth.service.ts`。 | 新增错误密码达到阈值测试。 |
| P1 | 公开内容的进程内缓存导致多实例更新后仍读旧数据。Redis 模式下改为每次读取共享版本、更新时递增版本并放弃本地副本；旧版本的在途请求只会写旧键。无 Redis 时保留单进程短时缓存。见 `public-cache.service.ts`、`redis-health.service.ts`。 | 新增双实例缓存测试。 |
| P1 | 单条与批量询盘指派现在先在事务中按 ID 顺序锁定有效询盘父行，再结束旧指派和创建新指派；并发后台写入在同一询盘上串行化。见 `inquiries.service.ts`。 | TypeScript 类型检查；仍需 MySQL 并发集成验证。 |
| P2 | 客户端可传入超长 `X-Device-Id`，写入 `VARCHAR(128)` 时可能变成 500。客户认证入口现与管理员入口一样截为 128 字符。见 `customer-auth.controller.ts`。 | API TypeScript 类型检查。 |
| P2 | 数据库文档的询盘状态与 Prisma 枚举不一致，缓存文档也未反映多实例行为，已同步修订。 | 人工对照 schema 和实现。 |

## 待处理风险（按优先级）

| 等级 | 证据 | 影响与下一步 |
| --- | --- | --- |
| P1 | `inquiry-notification.service.ts` 的 `notify()` 在邮件或 WhatsApp 开关为真时仅写 `inquiry_notification_adapter_not_configured`；`public-inquiry.service.ts` 将通知放在不持久化的异步调用里。 | 开关会让运营误以为通知已投递；进程退出会丢失在途工作。上线前保持开关关闭并让运营流程直接查看后台。若通知是交付要求，先加 DB outbox 及投递状态，再启用真正的发送器和重试。 |
| P1 | `InquiryAssignment` 只有普通索引，没有“每个询盘唯一活动指派”约束。服务层已加入父行锁，但数据库尚未独立保证这一不变量。 | 其他写入路径或旧版本进程仍可能留下两条 `endedAt = NULL` 记录。先审计、清理历史重复，再添加兼容式唯一活动槽约束；双版本共存期间观察冲突，并做真实 MySQL 并发验证。 |
| P1 | `public-inquiry.service.ts` 用 `findFirst(fingerprint, 时间窗口)` 后 `create`；schema 只有普通索引。 | 并发重试可创建重复询盘。保持现有请求/响应协议，新增带唯一键的幂等记录表，在同一事务中申领键与创建询盘；上线前按指纹检查历史重复并定好 TTL 清理策略。 |
| P1 | 多个服务先写业务数据、再调用 `audit.record()`，例如 `inquiries.service.ts` 的 `update/addNote/archive` 和 `admin-users.service.ts`。缓存失效只在成功响应后运行。 | 审计写失败会让已成功的业务操作返回 500，且缓存仍可展示旧值。逐个把关键业务写与审计写放入同一 Prisma 事务；跨存储副作用采用持久化 outbox。先覆盖权限、客户资料、询盘状态和媒体删除。 |
| P1 | 官网 `src/services/customerAuth.js` 把 access 和 refresh token 都放在 `localStorage`；页面有富文本 `dangerouslySetInnerHTML`，写入端虽有清洗。 | 一旦出现 XSS，脚本可读取长期刷新令牌。兼容迁移：新增 HttpOnly、Secure、SameSite 刷新 Cookie，同时保留旧 JSON token 请求；完成同源/CSRF 检查及前端切换后，撤销旧刷新令牌族并移除本地持久化。 |
| P1 | `deploy/production.env.example` 默认 `CAPTCHA_PROVIDER=disabled`；客户注册也只有通用进程内限流。 | 公网询盘和注册易受自动化提交影响，且多实例限流计数各自独立。上线配置验证码与站点密钥，验证前后端流程；按登录、注册、询盘分别设置共享的限流策略，观察误伤率。 |
| P1 | `deploy/scripts/backup.sh` 直接写最终时间戳目录；`restore.sh` 只检查部分文件存在，不验证备份完成标记、压缩包完整性及对象数。 | 中途失败可留下看似可恢复的目录。先新增临时目录、校验和及完成标记，成功后原子改名；恢复脚本先校验完整性。对旧备份设置显式兼容入口，演练恢复后再清理旧文件。 |
| P1 | `docker-compose.yml` 将 MySQL 默认时区设为 `+08:00`，Prisma 多处用 JS `Date` 和 `@default(now())`；`docs/database.md` 将时间解释为北京时间。 | 混合写入来源和时区可能使排序、日统计及跨区域展示出现偏差。先在生产相同版本库对照 `NOW()`、`UTC_TIMESTAMP()`、Prisma 读写值及 dashboard 日趋势；标记每类历史字段的实际语义。确认后在兼容窗口分批转换到 UTC，最后切换数据库时区和展示逻辑。不要直接改 Compose 参数而跳过历史校准。 |
| P2 | `public-inquiry.service.ts` 的客户询盘列表不分页；`inquiries.service.ts` 的详情一次加载所有备注和指派历史。 | 数据增长后响应和查询成本不受控。先增加可选 `page/pageSize` 的新响应路径或版本，维持旧数组接口的短期兼容，前端切换后再退役旧路径；详情备注独立分页。 |
| P2 | `media.controller.ts` 的 Multer 临时写入上限为单文件 500 MB、单请求最多 20 个文件，业务类型限额在写盘之后检查。 | 单个已认证请求可占用大量临时盘。把上传限额前移到代理和 Multer，并将总请求体、并发上传和临时盘配额与环境配置绑定。 |
| P2 | `docker-compose.yml` 的 MinIO 与 `mc` 使用 `latest`，并对整个 bucket 设置匿名下载。 | 重建环境时版本可能变化；若未来把私有资料放进同一 bucket 会被公开。锁定经验证的镜像版本；公开媒体和私有资料使用不同 bucket/策略。 |
| P2 | `docs/database.md`、`docs/deployment.md` 已有备份与迁移指引，但实际服务器构建、Nginx、证书、MySQL/MinIO 数据恢复未在本工作区验证。 | 上线门槛应包含隔离环境完整恢复、图片抽样、询盘写入、备份完整性、API 滚动重启及回滚演练，并记录 RPO/RTO。 |

## 架构检查摘要

| 领域 | 现状判断 |
| --- | --- |
| 数据库和迁移 | Prisma datasource 为 MySQL，未发现关键业务 SQLite 混用；31 个模型、版本化 SQL、唯一键/外键/索引覆盖主要实体。索引是否最优仍需真实慢查询及 `EXPLAIN`，不建议猜测添加。 |
| 多租户 | 当前没有 Tenant/Workspace/Organization 模型；系统是单站点运营后台加客户账号。若未来销售给多个组织，需要先引入租户主键、组合唯一约束和服务端租户过滤，不能仅靠前端隔离。 |
| 认证授权 | 管理 API 有全局 JWT 守卫和逐路由权限装饰器，密码使用 bcrypt；客户查询按 `customerId` 过滤。客户联系人尚未验证，现有实现没有自动认领历史询盘，这一点应保持。 |
| 密钥和配置 | 部署密钥来自环境，翻译模型密钥使用服务端 AES-GCM 并对后台脱敏。密钥轮换需要版本化密文和双读过渡；部署密钥应在服务器侧管理，备份环境快照也须限制访问。 |
| API 与输入 | DTO/全局 ValidationPipe、统一异常过滤器、参数化 Prisma 查询已存在；未发现业务代码使用 `queryRawUnsafe`。导出 CSV 对公式前缀做了处理。 |
| 缓存与进程状态 | 公开内容缓存已修复跨实例失效；dashboard 仍是 60 秒单进程缓存，只影响统计新鲜度。Redis 故障期间的写入可能让恢复后的旧缓存持续到 TTL，需监控这一上界。 |
| 文件与媒体 | 生产部署示例使用 MinIO 和持久卷，数据库保留对象键与元数据；上传做内容识别、尺寸及派生文件处理。数据库与对象备份必须成套恢复。 |
| 异步/队列 | 当前没有需要 Kafka 的负载。询盘通知若要可靠交付，先用 MySQL outbox + 单 worker；媒体处理若出现持续超时，再评估持久任务队列。 |
| 观测与运行 | JSON 日志、请求 ID、审计、`/health/live` 与 `/health/ready`、Prisma 断连钩子均已存在。需在目标环境确认告警、备份恢复与容量监控。 |
| AI/RAG/支付 | 仓库只有翻译模型调用，没有 Agent、RAG 向量索引、订单或支付链路。相关清单项当前不适用；不应为了预期需求预装组件。 |

## 发布顺序

1. 先用现有兼容修复构建发布包，运行 API 类型检查、单元测试、浏览器用例和目标 Linux 预检；核对旧刷新令牌仍可使用。
2. 上线前明确通知功能是否是必需交付项，启用可运行的验证码；锁定 MinIO 镜像版本并在隔离环境演练数据库和媒体恢复。
3. 按“新结构与旧协议并存 → 清理/回填 → 双读验证 → 切换写入 → 删除旧逻辑”的顺序处理幂等、唯一活动指派、审计/outbox、Cookie 和 UTC。每一步保存回滚点，先验证现有数据。
