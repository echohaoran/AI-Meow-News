# 文档导航

[返回项目首页](../README.md) · [English](../README.en.md)

文档分为长期说明和带日期的验收、交接记录。历史记录保留当时的版本与结果，不能当作实时运行状态；[运行快照](验收与现状.md)注明最近一次检查的时间和限制。

## 使用与部署

- [新机器部署](deploy.md)：可移植 Compose 配置、初始化和首次启动。
- [部署与维护](部署与维护.md)：采集角色、worker、备份恢复和故障排查。
- [配置参考](配置参考.md)：环境变量、安全阀、凭据与部署边界。
- [本地开发](开发.md)：隔离数据库、启动与测试。
- [API 契约](backend/API契约.md)：网站读取、公开 API 与管理员接口。

## 内容与项目结构

- [项目架构](项目架构.md) / [引擎架构](architecture.md)：进程、目录、公开读取层、模块及迁移。
- [内容流程](内容流程.md)、[信源](sources.md)、[精选与校准](selection.md)、[事件归组](grouping.md)。
- [阅读分类](category-filters.md)、[模型榜单](openrouter-rankings.md)、[事件综述评测](story-digest-evaluation.md)。
- [行业定制](customize.md)：修改站点、分类、信源、提示词与评测样本。

## 前端功能

- [中文整理稿](frontend/中文整理稿.md)、[文章阅读与目录](frontend/文章阅读.md)。
- [首页快捷入口](frontend/首页快捷入口.md)、[板块厂商标识](frontend/主题厂商标识.md)、[关于页动画](frontend/关于页星系动画.md)。
- [品牌资产](frontend/品牌资产说明.md)、[视觉设计](frontend/binance-reference.md)。
- [网站截图](assets/screenshots/)：2026 年 10 月 28 日从公开网站采集的桌面和手机视图，内容为当时快照。

## 历史与验收

- [运行快照](验收与现状.md)：检查时间、已知故障及历史验收边界。
- [交接记录](handoff.md)：按日期保存的部署、备份和验证记录。
- [首轮信源扩充](信源扩充-20261027.md) / [第二轮信源扩充](信源扩充-第二批.md)：候选、收录及验证时的情况。

提示词在 [`industry/prompts/`](../industry/prompts/)，品牌和素材的许可说明在各自目录；使用规则和隐私说明在 [`site/pages/`](../site/pages/)。
