# AI-News · AI喵实验室

当前接续验收（2026-10-27）：独立RSS collector已上线，14个到期源真实采集新增112条，现可读132条来源资料；仍为3条模型分析、1条按原规则入选。内网入口43180。详见[修复最终验收报告](docs/integration/修复最终验收报告.md)。采集持续运行，完整worker、自动分析与自动成刊仍未启用，积压保留；热点/日报未达条件时不造内容。

用于 homelab 内网的 AI 资讯阅读站。来源动态保留来源标题、摘要、原文和真实发布时间，显式标为“未核验”；精选、AI 摘要、事件与 AI喵日报只展示实际处理和发布的结果。页面读取不会启动采集或模型调用。

唯一源码：homelab `/mnt/local_data/Repo/AI-News/source`。Node.js 24.22.1、PostgreSQL 17、React Router SSR、Fastify、TypeScript。前端、后端、品牌资产和中文说明均在本仓库。

## 开发与检查

所有命令只在 homelab 执行。开发 web 为 `127.0.0.1:43181`，API 为 `127.0.0.1:43182`，开发数据库为 `127.0.0.1:43184`。运行配置从仓库外的项目 `.secrets` 读取，不复制到源码。

```bash
cd /mnt/local_data/Repo/AI-News/source
source ../.tooling/development-environment.env
npm run verify:integration
node deploy/ai-news/run.mjs development api
# 另一 SSH 会话；web 仅给入前端配置
API_BASE_URL=http://127.0.0.1:43182 node apps/web/server.ts
```

[统一审查与测试报告](docs/integration/全栈审查与测试报告.md)记录实际通过项与缺项；[部署与维护](docs/部署与维护.md)记录镜像构建、认证配置、迁移、备份和回滚；[API 契约](docs/backend/API契约.md)记录真实字段。`npm test` 的并行分库需要 CREATEDB；普通开发角色使用预建 `_test` 库执行有界相关测试，不能对业务库运行破坏性测试。

## 部署边界

唯一 LAN 入口为 `http://192.168.1.77:43180`，web 43181、API 43182 仅容器内部。根 compose 引用 `deploy/ai-news/compose.app.yaml`；基础设施只使用父目录 `ops/compose.dependencies.yaml` 和现有 `ainews-db`，不创建第二个生产数据库。生产数据库 43183 不发布到 LAN。

web 只通过 `API_BASE_URL=http://api:43182` 读取后端，不接收数据库或模型密钥。worker 默认不启动；采集、模型、外推和索引提交默认关闭。来源动态可在这些开关关闭时阅读。尚无实际日报时不生成示例成刊记录。

## 目录

| 路径 | 内容 |
|---|---|
| apps/web | SSR 页面、搜索、阅读设置与后台界面 |
| apps/api、apps/worker、packages/backend | HTTP、采集、模型处理、发布与回执 |
| packages/contracts | 前后端共享类型 |
| site、industry | AI喵品牌、站点文案、来源与处理标准 |
| deploy/ai-news、docs | 本项目检查入口、部署模板与交付说明 |

本项目复用 AIHOT 开源底座，保留 [MIT LICENSE](LICENSE) 和 [NOTICE](NOTICE) 中的著作权及第三方许可。上游商标不作为本站标识。内部包名保留以维持兼容。
