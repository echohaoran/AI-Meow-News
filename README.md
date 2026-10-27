# AI-News · AI喵实验室

自托管 AI 资讯阅读站：收集来源动态，保留原文与原始时间，在后台按规则处理后形成中文摘要、精选、事件和日报。前端读取不会触发采集或模型调用。

**当前 Homelab 已运行 RSS 采集与完整 worker。** 来源动态仍明确标为“未核验”；采集成功不等于事实核验、模型分析或精选。文章提供中文阅读、原文入口和段落目录，外文由后台翻译；精选、事件和刊物只展示实际产生的结果，条件不足时保留空态。运行版本及历史验收边界见[验收与现状](docs/验收与现状.md)和[交接记录](docs/handoff.md)。新部署仍默认关闭采集与模型调用。

## 可以做什么

- `/source-news` 阅读来源标题、摘要、原文与发布时间，按信源筛选；无精选或热点时有真实来源预览。
- `/` 阅读精选，`/all` 阅读处理后的动态，`/items/:id` 阅读详情，`/hot`、`/story/:publicId` 阅读事件。
- `/daily`、`/weekly`、`/monthly` 仅展示实际成刊；`/more` 提供手机来源入口与阅读设置。
- `/admin` 管理信源、诊断内容、查看回执和审计；支持版本校验的人工更正，保留原始分析。
- `/agent` 提供 RSS、公开 API、Agent Markdown 和 MCP 接入说明；公开出口共用发布读取层。

## 快速开始

需要 **Node.js ≥24.22.1**（直接运行 TypeScript）、npm workspaces、PostgreSQL 17。推荐 Docker Engine + 支持 `include` 的 Compose v2；构建建议至少 2 核/4 GB。依赖使用 `package-lock.json` 和 `npm ci`，不要另装 workspace。

```bash
git clone https://github.com/echohaoran/AI-Meow-News.git
cd AI-Meow-News
```

选择一种方式：

| 目的 | 操作入口 | 初始外部行为 |
|---|---|---|
| 新机器最小 Docker 部署 | [部署指南](docs/deploy.md) | API/web/数据库；不开 worker、采集、模型 |
| 本地修改代码 | [开发指南](docs/开发.md) | 自建隔离开发库；采集和模型关闭 |
| 只恢复 RSS 更新 | [独立 collector](docs/部署与维护.md#独立-collector) | 抓 RSS、排后续任务，不消费 AI 队列 |
| 维护既有 homelab | [升级、备份、恢复和排障](docs/部署与维护.md) | 使用既有配置，不新建生产库 |

新部署按顺序完成配置、建库、迁移、seed、启动网页；空库不会自带新闻。**根 `docker-compose.yml` 专用于既有 homelab**，依赖仓库外配置及外部数据库网络。新 clone 使用同仓的 [可移植 Compose](deploy/portable/compose.yaml)，无需复制私人路径、生产 env 或旧数据。

## 文档与结构

| 文档 | 内容 |
|---|---|
| [架构与目录](docs/项目架构.md) | SSR → HTTP API → 发布读取层、角色和端口 |
| [配置参考](docs/配置参考.md) | 实际变量、默认值、秘密与前后端边界 |
| [内容流程](docs/内容流程.md) | 来源标识、日期、回填、去重、评分、热度与成刊 |
| [开发](docs/开发.md) / [部署](docs/deploy.md) | 可按顺序执行的安装与启动步骤 |
| [部署与维护](docs/部署与维护.md) | collector、完整 worker、升级、备份、故障定位 |
| [验收与现状](docs/验收与现状.md) | 时间点、版本映射、已验与未验项 |
| [信源](docs/sources.md) / [评分](docs/selection.md) / [归组](docs/grouping.md) | 引擎规则细节 |
| [行业定制](docs/customize.md) / [引擎架构](docs/architecture.md) | 扩展行业包及模块 |

技术栈为 React 19 / React Router 8 SSR、Fastify 5、TypeScript、PostgreSQL 17 与 pg-boss。`apps/web` 是网页，`apps/api` 是 HTTP，`apps/worker` 是处理角色；`packages/backend` 是共享业务，`packages/contracts` 是契约，`site` 是品牌/站点，`industry` 是信源与选稿规则，`database/migrations` 是迁移。内部 `@aihot/*` 包名及 `AIHOT_*` 变量为兼容接口。

默认最小部署只将 `127.0.0.1:43180` 发布给宿主。web 43181、API 43182、数据库 43183 仅容器内部；开发数据库可单独绑定 `127.0.0.1:43184`。LAN、域名或 HTTPS 按实际入口配置，不能把现有 HTTP 部署称作 HTTPS。

## 常见问题

- **网页没新闻？** 先看来源是否启用、最近抓取结果及 collector 心跳。seed 只插信源，不采集；网页访问也不会抓取。
- **来源很多，精选/热点/日报却为空？** 可能还未分析、未过门槛、是历史回填、独立参与者不足，或完整 worker 关闭；见[内容流程](docs/内容流程.md)。不要为填页面改时间、降门槛或造数据。
- **API_BASE_URL 配什么？** 宿主开发为 `http://127.0.0.1:43182`，容器为 `http://api:43182`。浏览器只访问网页入口，后端密钥不传给 web。
- **升级是否自动启 AI？** 不会。完整 worker 另有 profile；启用前必须评估旧队列、模型路由与请求预算，不能用开 worker 代替排障。

## 许可

本项目基于 [AIHOT](https://github.com/KKKKhazix/AIHOT) 开源底座开发，站点品牌为 AI-News · AI喵实验室。保留上游 [MIT LICENSE](LICENSE)、[NOTICE](NOTICE) 与提交历史。MIT 覆盖代码，不授予转载原文、来源商标或第三方素材的权利；来源默认只展示摘要和原文链接。
