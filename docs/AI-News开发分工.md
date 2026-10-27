# AI-News 开发与交付分工

用户要求：只复用 AIHOT 底座；自有品牌 AI-News · AI喵实验室；所有开发、测试、部署均在 homelab；全部业务采用非标准端口；前后端代码和说明文档同一仓库；前后端并行，全栈最终审查和烟测。

唯一源码仓库：`/mnt/local_data/Repo/AI-News/source`。不得在其他位置再建立一套权威源码。保留必要开源许可证，不把上游品牌作为本站标识。

| 负责人 | 写入范围 |
|---|---|
| 前端工程师 | apps/web、site/brand、site/pages、site/public、site/site.ts、modules/ai-news-web、docs/frontend、tests/frontend |
| 后端工程师 | apps/api、apps/worker、packages/backend、packages/contracts、database/migrations、industry、site/models.ts、modules/ai-news-backend、docs/backend、tests/backend、deploy/ai-news |
| 全栈工程师 | 共享依赖与锁文件、根构建配置、README、docs/integration、部署维护总文档；两端交接后统一代码审查、修正、集成和端到端烟测 |
| 家庭运维 | 基础设施、受控构建和部署；不并发改应用代码；既有基础设施只有一份，不新建重复生产库 |

原生模块扩展优先；模块注册或共享接口需要跨范围改动时先交全栈协调。后端优先写 `docs/backend/API契约.md`，前端遵循其真实字段，不能把 mock 当真实业务交付。

两位开发者不操作全局 Git index、不提交、不切分支、不 reset/clean，不覆盖对方改动。全栈在两端交接后检查 diff 并统一提交，不能并发开发第三份前后端。依赖安装通过项目 `.coordination/dependencies.lock` 互斥，重型构建和完整测试串行，业务代码编辑可并行。

对外入口43180；web43181、api43182仅项目内部；生产Postgres43183不对LAN开放；开发Postgres仅127.0.0.1:43184。登录所需密钥和数据库连接环境在项目根 `.secrets` 中，由运行环境读取，禁止复制进本仓库或输出到前端/报告。

项目源文件与说明文档均在本仓库；部署模板也随仓库交付。数据库卷、敏感env、依赖缓存、运行日志和测试临时数据保留在仓库外，只在报告引用脱敏证据。最终仓库可整体上传，但本轮未授权主动公开发布仓库。
