> 后续范围更正：用户本轮取消GitHub登记/连接准备/推送；下文仅保存先前检查历史，不是待执行授权或修复前置。当前内容缺陷修复见[内容链路修复](内容链路修复.md)。

# GitHub 交付检查点

2026-10-26。唯一源码及所有检查均在 homelab `/mnt/local_data/Repo/AI-News/source`。

目标仅为 `git@github.com:echohaoran/AI-Meow-News.git`，不向 AIHOT 上游推送、不修改仓库可见性、不 force。上游 MIT LICENSE、NOTICE 和原提交保持。原仓库是浅克隆；直连补历史90秒超时exit124，改用现有mihomo代理后fetch --unshallow exit0，本地已有160个上游提交、shallow=false。

Hermes前置已由总助核验并单独告知用户。继承既有108项相关测试、真实单条模型和生产验收成果，不重复调用模型、采集或整套测试。最终审查另发现来源名/分页链接仍指向后台重定向的 `/sources`，已改 `/source-news`；增加真实SSR读取链接并跟随的行为检查，修复前exit1（302而非200），修复后21项真实API/SSR记录、web及前端测试类型检查、构建均exit0。因源码有增量，需要运维更新最终镜像后才提交/推送。

## 上传清单与敏感信息

代码、品牌、测试、部署模板及说明同仓。检查全部tracked/untracked非忽略清单和可达Git历史，采用路径审查及私钥/provider token/凭据URL/硬编码凭据模式扫描，证据只记录路径、行号及类型，不输出敏感值。扫描705个当前文件及160提交中2778个唯一blob；命中的测试常量及历史compose运行时变量插值已分类，未发现需上传的真实凭据。该扫描不等于能证明不存在任何未知形式密钥。最终暂存后仍需复核，新增文档在最终扫描纳入。

.gitignore已补齐.secrets、运行目录、协调目录、临时文件、日志、数据库、私钥和覆盖率等排除规则；真实env和运行数据均在仓库外。没有使用未经清单审查的git add -A。LICENSE、NOTICE、package-lock未修改。

## 远端认证及未完成项

运维任务2d249fa6已完成严格GitHub主机身份核验；不是仍缺known_hosts。两账号既有认证均被GitHub拒绝。本轮在ainews再次执行严格 `git ls-remote --symref <精确目标> HEAD 'refs/heads/*'`，exit128：`Permission denied (publickey)`。未取得目标默认分支、历史、读取或写入权限，不能称空仓或已推送。未搜索其他私钥或把凭据复制到源码。

等待的是homelab实际Git操作者的安全仓库授权；凭据不得通过聊天提交。授权就绪后先ls-remote/fetch审查目标历史，保留双方历史并解决常规冲突，再正常push并ls-remote核对SHA。最终提交SHA写仓库外回执，避免文档自引用。实际部署对应、提交/推送结果在最终验收及仓库外回执补全。

证据正本：`/mnt/local_data/File/AI-News/00-临时文件/GitHub推送/`；既有运维认证报告在相邻 `GitHub连接准备/20261026-220211-2d249fa6/REPORT.md`。
