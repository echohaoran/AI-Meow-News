# 参与贡献

欢迎通过 [AI-Meow-News Issues](https://github.com/echohaoran/AI-Meow-News/issues) 提交可复现的问题和改进建议。请说明使用的版本、部署方式、预期结果和实际结果，并移除日志、截图中的凭据与个人信息。安全问题请按 [SECURITY.md](SECURITY.md) 私密报告。

## 开发与提交

1. 从本仓库 `main` 创建分支，先阅读 [README](README.md)、[AGENTS.md](AGENTS.md) 与改动涉及的专题文档。通用能力在共享引擎，站点品牌与配置在 `site/`，行业规则在 `industry/`，本站专用能力在 `modules/`。
2. 按[开发指南](docs/开发.md)准备隔离环境。测试库名必须以 `_test` 或 `_ci` 结尾；数据库测试会创建独立副本，需要测试角色具备 `CREATEDB`。不得使用生产数据库、真实模型或外部采集服务作为测试替身。
3. 根据改动运行必要检查。代码变更至少检查类型、相关测试及前端构建；涉及网页交互时检查桌面与手机。纯文档修改应检查链接、示例与截图。数据库迁移按[迁移约定](docs/architecture.md#数据库迁移)追加，不能修改已发布迁移。
4. 提交 PR 时说明问题、改动和实际验证结果；页面变更可附不含敏感信息的截图。不要将 `.env`、密钥、生产数据、会话信息或未经授权的素材加入仓库。

根目录工作流 `.github/workflows/check.yml` 目前为手动触发，不能把提交或推送视为 CI 已通过。项目部署、配置、预算和秘密均以目标环境实际设置为准。

本项目基于 [AIHOT](https://github.com/KKKKhazix/AIHOT)。若希望将通用改进贡献给上游，请先阅读上游的贡献规则；本站专属配置和品牌不应作为通用功能提交。代码遵循 [MIT LICENSE](LICENSE)，第三方素材的来源见 [NOTICE](NOTICE) 和各素材目录。
