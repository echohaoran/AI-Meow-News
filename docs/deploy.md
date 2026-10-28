# 新机器最小部署

[返回 README](../README.md) · [配置](配置参考.md) · [日常维护](部署与维护.md)

本页用于全新独立环境，使用 `deploy/portable/compose.yaml`。**既有 homelab不要运行本页创建第二套数据库**；其根Compose沿用原外部网络、env与卷。上游旧版3000端口、setup服务、https profile的启动说明不适用于本仓当前根Compose。

本站公网服务现由 `192.168.1.84` 承载；早期 Homelab 的文件路径和 Compose 命令不一定适用于该机。维护既有实例前以服务器当前配置及[交接记录](handoff.md)为准。

## 1. 准备运行配置

先clone仓库，以下在仓库根执行。Docker构建使用固定Node24.22.1，宿主只需Docker/Compose；直接开发另需Node与npm。

```bash
umask 077
mkdir -p ../ai-news-runtime/data
cp deploy/portable/compose.env.example ../ai-news-runtime/compose.env
cp deploy/portable/backend.env.example ../ai-news-runtime/backend.env
chmod 600 ../ai-news-runtime/*.env
```

用本机编辑器安全填写两份env，不把内容贴到日志或命令行：

- `AI_NEWS_BACKEND_ENV`、`AI_NEWS_DATA_DIR`改成上面文件/目录的**绝对路径**。应用镜像以UID1000运行，data目录须允许UID1000写入；按本机用户/容器映射准备权限，不要全局chmod777。
- `POSTGRES_PASSWORD`为新随机密码，`backend.env`中 `DATABASE_URL`使用相同密码并做URL编码。可用随机hex避免特殊字符编码歧义。
- `ADMIN_PASSWORD`至少12字符；`SESSION_SECRET`和`IMG_PROXY_SIGN_SECRET`各用独立随机值（例如各32字节随机hex）。无默认管理员账号或固定密码。
- 无模型需求时`LLM_*`可空，所有模型和外推开关保持false。不需要模型key即可启动只读网页和RSS-only collector。
- `SITE_URL`应为读者实际入口，默认 `http://localhost:43180`。`INGRESS_BIND=127.0.0.1`只在本机发布；如需LAN，显式改为本机目标LAN地址并同步SITE_URL及防火墙。

## 2. 构建并检查配置

```bash
docker build -t ainews-local:reviewed .
# 在 compose.env 中确认 AI_NEWS_IMAGE 与上面tag一致，AIHOT_RELEASE为审查过的版本。
docker compose --env-file ../ai-news-runtime/compose.env -f deploy/portable/compose.yaml config --quiet
```

`config --quiet`验证语法但不保证能连数据库。不要把未加quiet的完整展开环境贴到报告。生产使用不可变tag或digest并记录回滚版本，不直接覆盖运行中的tag。首次构建需镜像仓库、Debian与npm网络访问；按本机网络配置代理，不能把认证代理URL写进源码。

## 3. 首次建库、迁移与seed

```bash
docker compose --env-file ../ai-news-runtime/compose.env -f deploy/portable/compose.yaml up -d db
docker compose --env-file ../ai-news-runtime/compose.env -f deploy/portable/compose.yaml --profile tools run --rm migrate
docker compose --env-file ../ai-news-runtime/compose.env -f deploy/portable/compose.yaml --profile tools run --rm migrate node scripts/seed.ts
```

迁移按完整文件名记账；seed只插入缺失的行业信源，保留管理员已改的来源配置，不生成新闻或模型结果。不要在生产重复执行历史导入器填页。PostgreSQL数据保存在命名卷`db-data`，不发布宿主端口；模板初始化角色是该独立库的owner，正式多角色部署可进一步拆分迁移与业务权限。

## 4. 启动与验证

```bash
docker compose --env-file ../ai-news-runtime/compose.env -f deploy/portable/compose.yaml up -d api web ingress
curl --fail http://localhost:43180/api/health
```

访问 `http://localhost:43180`、`/source-news` 和 `/admin`，管理员用刚配置的密码登录。此时没有worker或collector，空库页面为空是正常结果。web只拿前端变量；API、web、DB仅内部43182/43181/43183，唯一宿主映射是43180。

需要真实来源更新时，核后台只启用了不含detail规则的RSS，再按[collector步骤](部署与维护.md#独立-collector)启动。完整AI处理需另行评估，不能从本页默认推导已经启用。

## HTTPS与代理

现有Caddyfile是HTTP入口，`auto_https off`，没有证书或80/443映射。需要HTTPS时，在自己的可信网关反代43180并设置正确SITE_URL；重新验证Host、Origin、代理头、Cookie、安全策略及缓存。不承诺本仓模板已经完成HTTPS验收，不使用不存在的 `--profile https`。

代理/CDN遵循应用的Cache-Control与ETag，不延长动态内容缓存期限，不对后台和带Cookie请求缓存。MCP允许主机来自SITE_URL及本机，额外入口按 `MCP_ALLOWED_HOSTS`精确配置；这不扩大浏览器Origin授权。

## 更新与备份

见[部署与维护](部署与维护.md)。不能用`down -v`更新，也不能把生产库交给测试。自动对象存储备份依赖完整worker及配置，RSS collector不会执行它；当前部署需由运维独立保证数据库和附件备份。
