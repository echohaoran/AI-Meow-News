# 项目交接

## 2026-10-27：切换到正确项目会话

- 本地仓库：`/Users/echowang/git/AI-Meow-News`。
- 开发、测试与部署设备以 `ssh homelab` 为准，本次连接设备为 HomeLab，网页入口为 `http://192.168.1.77:43180/`。
- 服务器项目根目录为 `/mnt/local_data/Repo/AI-News`，实际代码仓库为其 `source/` 子目录；父目录不作为代码同步目标。
- 两端本次核对的 HEAD 均为 `0847e8c`。服务器 Dockerfile 另有增加 `fontconfig-config` 的未提交修改，已取回本地保留。
- 后续先修改本地代码，再用 SCP 同步涉及文件到服务器；在服务器完成测试、构建及所需容器重启，用户浏览器验收完成后再推送仓库。
- 使用既有 Compose 项目 `source` 和部署配置，重启前核对运行角色、镜像与开关，不以旧文档快照推断当前状态。
- 接手时 API、web、ingress 和完整 worker 正在运行，首页 HTTP 200。完整 worker 的运行状态已不同于 `验收与现状.md` 中 08:13 的历史快照；后续部署前必须重新核对。此次未重建或重启应用、未更改运行开关。
- worker 实测 `COLLECT_ENABLED=true`、`MODEL_CALLS_ENABLED=true`，飞书内部通知、内容推送及 IndexNow 开关为 false；运行镜像为 `ainews-app:46a4cbb-fontconfig`，已安装 `fontconfig-config`。这些是接手时的既有状态，不代表本次启用或完整链路验收通过。
- 本次仅接手与保留服务器差异，未运行完整代码测试；既有运行镜像不等于当前 Git HEAD。
