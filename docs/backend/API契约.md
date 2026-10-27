# AI-News API 契约

2026-10-27，依据当前 `apps/api/src/routes` 与 `packages/contracts/src/site.ts`。前端沿用 typed HTTP client；运行版本和验证边界见[验收与现状](../验收与现状.md)。

## 接入

网页唯一入口43180；API 43182 仅内部，前端服务端经 API_BASE_URL 读取。匿名公开读取不读管理员 Cookie、不调用模型。API 启动前须迁移同一数据库。本文是接口契约；运行状态以带日期的验收摘要为准。

## 网站读取

| GET 路径 | 查询 | 响应 |
|---|---|---|
| /api/health | 无 | {ok:true,db:"ok",ms:number,release:string}，真实 SELECT 1，无缓存 |
| /api/site/meta | 无 | siteMeta()；类型 SiteMeta，以共享 contracts 为准 |
| /api/site/timeline | channel=all/news/x；category 为 industry/taxonomy.ts 分类；tag 最长60；limit 默认20、夹在1–40；cursor 不透明 | TimelineResponse：filters,cards,nextCursor,hot,dayCounts。card 为 {key,anchorAt,item,group} |
| /api/site/pool | 同上过滤；q trim 后最多200；tab=time/relevance；page 默认1、夹在1–50 | PoolResponse：filters,items,page,pageCount,total,todayCount,freshness。固定每页40条 |
| /api/site/items/:id | 无 | SiteItemDetail；不存在/撤回/不公开返回404 |
| /api/site/items/:id/original | 无 | 同一详情的原文视图；全文许可仍生效 |
| /api/site/items/availability | ids 逗号列表 | 按现有 itemAvailability 返回，no-store |
| /api/site/hot | 无 | {computedAt,windowHours,entries}；无模型结果时 entries 可为空 |
| /api/site/topics | 无 | listTopicSummaries() |
| /api/site/topics/:slug | page | TopicPage 或404 |
| /api/site/search/suggestions | 无 | {topics,hot} |
| /api/site/stories/:publicId | 无 | 事件详情；合并返回308和 mergedInto；不存在404 |
| /api/site/groups/:factId/reports | 同上过滤 | {factId,reports} |
| /api/site/stories/:publicId/followups | 无 | 追踪详情或404，no-store |
| /api/site/reports/:kind | daily/weekly/monthly | {kind,items} |
| /api/site/reports/:kind/latest-page | 无 | {index,report}，未成刊 report=null |
| /api/site/reports/:kind/:key | kind 对应日期/ISO周/月 | 报告详情或404 |
| /api/site/stats、contact、changelog | 无 | 沿用共享类型及现有站点 client |

FeedItemSummary 字段为 id,title,summary,reason,source:{name},publishedAt,timelineAt,category,tags,score,selected,channel,x，可有 sameEvent。timeline.cards[].item 与 pool.items 使用此类型。详情另外有 originalTitle,links:{original},discoveredAt,story,readingMode,author,body,outline,relatedStories,topics,indexable,markdownAvailable,group,hasTranslation,bodyLanguage。body 具有 zh,original,zhKind,complete；readingMode=summary-only 是人工限制视图；readingMode=full 也不代表来源允许转载全文，必须以实际 body 字段为准，body=null 时不得补正文。

公开结果保留 source 原文信息及模型结果的各自持久化来源；null 不能由前端伪造为 AI 摘要、分数或核验通过。selected 代表编辑流程席位，不等于独立事实核验。无模型模式中，未分析资料是否可公开遵循 publication/scope.ts 和日期/撤回规则，精选与报告可以为空。

## 公开 API v1

GET /api/v1/items：mode=selected(默认)/all，window=7d(默认)/24h，by=timeline(默认)/published，category 为 PUBLIC_API_CATEGORY_KEYS，q 为2–200字符，limit 为1–100(默认50)，cursor 为不透明游标。返回结构以 /openapi-v1.json 和 publication/v1.ts 为准，不把 site 和 v1 字段混用。v1 拒绝未知、重复参数；游标错误400；需快照的增量游标错误409。

其他真实路径：/api/v1/hot-topics、/api/v1/stories/:publicId、/api/v1/dailies[/:date|/latest]、/api/v1/weeklies[/:week|/latest]、/api/v1/monthlies[/:month|/latest]、/api/v1/selected/snapshot、/api/v1/selected/changes。所有 v1 只读；写方法405，OPTIONS204。精选快照 fields=default/minimal、limit1–1000默认500、page 不透明；增量 cursor 必填、limit1–100默认100。

## 管理认证与写入

| 路径 | 要求与响应 |
|---|---|
| GET /api/auth/options | {password:boolean,feishu:boolean}；不暴露配置值 |
| GET /api/auth/login?return=/admin | 302跳转登录或已有会话的站内路径 |
| POST /api/auth/password | application/x-www-form-urlencoded：password、return；成功303+HttpOnly会话Cookie，失败303回登录；每IP15分钟最多10次、全局50次 |
| GET /api/admin/me | 已登录返回{name,csrf,dev}；未登录401 |
| GET /api/auth/check | 真实管理员会话204，否则401；不接受开发旁路 |
| POST /api/auth/logout | 表单；撤销会话，清Cookie，303 |
| /api/admin/* | 全部 adminHandler 守卫，写请求需 Cookie + X-CSRF-Token（来自 me）；缺失/过期403 |

管理员实体及写入类型沿用 packages/contracts/src/admin.ts 和 apps/api/src/routes/admin.ts；禁止前端直连数据库或存储模型凭据。生产拒绝 DEV_AUTH_*，密码至少12字符；HTTPS下 Cookie Secure，生产需 SESSION_SECRET/IMG_PROXY_SIGN_SECRET。

## 错误、缓存与撤回

错误 JSON 使用 application/problem+json，字段以 http/respond.ts 为准，包含 status/code/detail 等。普通无数据是成功空数组或约定的404，不能替换为演示新闻。site/v1 大多有 ETag；If-None-Match 命中304。列表缓存通常60秒、热点30秒；撤回在当前读取层生效，代理不得延长缓存。后台及会话 no-store。读者请求只执行数据库读取，不触发采集或模型。


## 无模型来源动态（本轮新增）

GET /api/site/source-items，匿名只读。参数：sourceId 可选（1–120位字母数字、下划线、连字符），q 可选（trim后2–200字符），page 整数1–50默认1，limit 整数1–40默认20。拒绝未知、重复参数及非法数字。

响应为 SourceItemsResponse：{mode:"source",verificationStatus:"unverified",page,limit,hasMore,items}。
items[] 为 {id,title,sourceSummary,source:{id,name},links:{original},publishedAt,discoveredAt,verificationStatus:"unverified",selected:false}。sourceSummary 来自原 feed excerpt，转纯文本、最多2000字符；它不是 AI 摘要。该视图不提供生成摘要/评分，也不把来源可信度当成事实核验。已有生成/编辑摘要仍由原详情接口及持久化 analyses/editorial_overrides 提供。

按来源发布时间倒序、ID倒序；动态翻页可能因新到条目移动，hasMore 指本次查询后仍有条目。仅通过 publication 读取层返回 editorial 来源的 public、已释放、已知非未来发布时间的新闻资料；撤回、隔离及其他模式不进入此接口。原精选/全部动态的模型门槛不变。无模型时请显式展示“来源动态·未核验”，不能把本接口数据填充成精选。本接口可独立于后台 worker 和模型运行，前端目前尚未接入该新入口，交全栈接线。

2026-10-26全栈集成：公开来源页面现为 `/source-news`，通过共享SourceItemsResponse读取本接口；“来源名称”链接执行sourceId筛选。原 `/sources` 保留底座后台书签重定向。运行验证与模型处理边界见[验收与现状](../验收与现状.md)。
