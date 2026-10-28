# AI-News · AI Meow Lab

A self-hosted AI industry news reader built on the [AIHOT](https://github.com/KKKKhazix/AIHOT) open-source foundation. It collects public sources, produces Chinese reading material, groups related reporting into events, and publishes selected news, trending topics, rankings and periodic reports.

[Visit the site](https://news.echohaoran.top/) · [中文说明](README.md) · [Deployment](docs/deploy.md) · [Development](docs/开发.md)

![AI-News home page with selected stories and trending topics](docs/assets/screenshots/home.png)

Screenshots were captured on October 28, 2026; articles and figures change over time. Collection and AI-assisted editing are not independent fact-checking. Follow the original source link to verify a report.

## Features

- Selected and all-news feeds with search, categories, bookmarks, Chinese reading views and source links.
- Event trends, company and technology topics, and OpenRouter usage, benchmark and application rankings.
- Daily, weekly and monthly editions when the required material and processing results are available.
- RSS, public API, Agent Markdown and remote MCP. Add the MCP URL as a connector in a compatible client; pasting it into a chat does not establish a connection.
- Responsive desktop and mobile layouts, with light and dark themes.

| Topics | Model rankings |
| --- | --- |
| ![Company and model topics](docs/assets/screenshots/topics.png) | ![OpenRouter model rankings](docs/assets/screenshots/rankings.png) |

The repository includes 203 configured sources; actual enabled sources and freshness depend on the installation. Readers do not trigger collection or model calls. Original-text display and redistribution use separate source permissions. See the [content pipeline](docs/内容流程.md), [sources](docs/sources.md) and [Chinese reading module](docs/frontend/中文整理稿.md).

## Getting started

Use Docker Engine with a recent Compose v2, or Node.js 24.22.1+, npm and PostgreSQL 17. Start with the [fresh-install guide](docs/deploy.md), [configuration reference](docs/配置参考.md) and [development guide](docs/开发.md). The portable deployment starts the web, API and database with collection and model calls disabled; enabling the worker requires a reviewed model endpoint, credentials and budgets.

```bash
git clone https://github.com/echohaoran/AI-Meow-News.git
cd AI-Meow-News
mkdir -p ../ai-news-runtime/data
cp deploy/portable/compose.env.example ../ai-news-runtime/compose.env
cp deploy/portable/backend.env.example ../ai-news-runtime/backend.env
chmod 600 ../ai-news-runtime/*.env
```

Configure those files outside the repository and follow the deployment guide for building, migrations, seeding and startup. The dated [operations snapshot](docs/验收与现状.md) documents a model connectivity incident; consult live service health rather than treating a historical snapshot as current status.

## Project layout

`apps/` contains the web, API and worker; `packages/` holds shared backend logic and contracts; `site/`, `industry/` and `modules/` contain site configuration and extensions. See [architecture](docs/项目架构.md), [API contracts](docs/backend/API契约.md), [operations](docs/部署与维护.md) and [industry customization](docs/customize.md).

The code is distributed under the [MIT license](LICENSE), with upstream notices in [NOTICE](NOTICE). Third-party articles, marks and other assets remain subject to their own rights. See [CONTRIBUTING](CONTRIBUTING.md) and [SECURITY](SECURITY.md).
