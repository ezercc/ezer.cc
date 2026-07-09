# Dev API Frontend Integration V1

## Scope

本文件给前端说明 dev API 的调用方式，以及需要配合调整的 name/serverless 配置。

目标：

- dev/prod 使用同一套前端调用流程，只切换 API base URL。
- 前端继续消费现有 stream 事件，不因为 I 阶段和 Brotli 结果包改动渲染合同。
- 支持新 dev 返回的 `result_br_url`，同时兼容旧生产环境只有 `result_url` 的情况。

非目标：

- 不要求前端理解 Q/A/B/I/C 内部编排。
- 不要求前端直接处理 EM/OpenRouter key。
- 不要求改现有卡片、图表、审计区的数据结构。

## Dev Endpoint Contract

建议 dev 公网入口：

```text
https://api-dev.ezer.cc
```

dev 与 prod 路径保持一致：

```text
POST https://api-dev.ezer.cc/api/tasks
GET  https://api-dev.ezer.cc/api/tasks/{task_id}/stream
GET  https://api-dev.ezer.cc/api/tasks/{task_id}/result
GET  https://api-dev.ezer.cc/api/tasks/{task_id}/result.br
GET  https://api-dev.ezer.cc/api/tasks/{task_id}/result.br.raw
```

生产入口保持：

```text
https://api.ezer.cc
```

核心约束：

- 所有请求仍需要 `Authorization: Bearer <token>`。
- `/stream` 仍是 SSE，不使用 Brotli。
- `/result` 返回普通 JSON。
- `/result.br` 返回同一份最终 JSON 的 Brotli 版本，响应头包含 `Content-Encoding: br`。
- `/result.br.raw` 返回同一份 Brotli 源文件字节，但不设置 `Content-Encoding`，浏览器不会自动解码。
- 如果前端要直接 `resp.json()`，使用 `result_br_url`。
- 如果前端要拿原始 `.br` 文件并自行存储/转发，使用 `result_br_raw_url`。

## Create Task

请求体不变：

```json
{
  "code": "NVDA.OQ",
  "period": "FY",
  "year": 2025,
  "lang": "en"
}
```

dev 新版成功返回会包含 `result_br_url`：

```json
{
  "task_id": "task_nvda.oq_2025FY_xxxxxxxx",
  "status": "accepted",
  "stream_url": "/api/tasks/task_nvda.oq_2025FY_xxxxxxxx/stream",
  "result_url": "/api/tasks/task_nvda.oq_2025FY_xxxxxxxx/result",
  "result_br_url": "/api/tasks/task_nvda.oq_2025FY_xxxxxxxx/result.br",
  "result_br_raw_url": "/api/tasks/task_nvda.oq_2025FY_xxxxxxxx/result.br.raw"
}
```

前端兼容规则：

- 实时渲染继续读 `stream_url`。
- 完成后如果需要 JSON 对象，读 `result_url` 或 `result_br_url`。
- 完成后如果需要 Brotli 源文件，读 `result_br_raw_url`。
- 如果 `result_br_url` 不存在，回退读 `result_url`。

## Frontend URL Rule

当前前端有硬编码 `https://api.ezer.cc` 的风险点。dev 改造后，不要再手写拼接生产域名。

建议由 serverless 返回完整 task API：

```json
{
  "action": "direct_fetch",
  "config": {
    "api": "https://api-dev.ezer.cc/api/tasks",
    "token": "<backend token>",
    "params": {
      "code": "NVDA.OQ",
      "year": 2025,
      "period": "FY",
      "lang": "en"
    }
  }
}
```

页面端根据 `config.api` 反推出 base URL：

```ts
const apiBase = new URL(api).origin;

function toBackendUrl(rawUrl?: string | null) {
  if (!rawUrl) return null;
  if (rawUrl.startsWith("http")) return rawUrl;
  return `${apiBase}${rawUrl}`;
}

const streamUrl = toBackendUrl(taskData.stream_url);
const resultUrl = toBackendUrl(taskData.result_url);
const resultBrRawUrl = toBackendUrl(taskData.result_br_raw_url);
```

这样 dev/prod 只由 serverless 控制，页面不需要同时维护两套环境变量。

## Required Serverless Changes

前端 serverless 当前需要把后端 base URL 抽成环境变量。

建议变量名：

```text
EZER_AUDIT_API_BASE
BACKEND_TOKEN
```

dev 环境：

```text
EZER_AUDIT_API_BASE=https://api-dev.ezer.cc
BACKEND_TOKEN=<dev backend bearer token>
```

prod 环境：

```text
EZER_AUDIT_API_BASE=https://api.ezer.cc
BACKEND_TOKEN=<prod backend bearer token>
```

serverless 生成 task API：

```ts
const API_BASE = (import.meta.env.EZER_AUDIT_API_BASE || "https://api.ezer.cc").replace(/\/$/, "");
const BACKEND_API = `${API_BASE}/api/tasks`;
const BACKEND_TOKEN = import.meta.env.BACKEND_TOKEN;
```

当前仓库中需要前端检查的文件：

- `src/pages/api/check.ts`
- `src/pages/check.astro`
- `src/pages/en/check.astro`

## Optional Public Env

如果前端希望页面代码也能直接读取 base URL，可以额外增加公开变量：

```text
PUBLIC_EZER_AUDIT_API_BASE=https://api-dev.ezer.cc
```

但当前更推荐页面通过 `new URL(config.api).origin` 推导，减少 env 分叉。

## Stream Compatibility

I 阶段会在 B 和 C 之间新增一个 stream event：

```json
{
  "event": "i_industry_wordsea",
  "producer": "I",
  "role": "industry_news",
  "data": {
    "columns": ["keyword", "count", "links"],
    "link_columns": ["title", "date", "source", "source_url"],
    "rows": []
  }
}
```

前端最低兼容策略：

- 如果暂时没有 I 模块 UI，可以忽略未知 event。
- 如果要渲染 I，按 `data.columns` 和 `data.link_columns` 表格渲染。
- `count` 语义是出现该关键词的去重文章数量。
- `links` 是该关键词关联的文章数组。

## Final Result Compatibility

最终结果顶层结构保持不变：

```text
task
stream
final_payload
```

前端已有读取路径继续有效：

```text
final_payload.normalized
final_payload.analysis.cards
final_payload.audit
```

I 数据会同时出现在：

```text
stream[] 中 event = i_industry_wordsea
```

如果前端只依赖 stream 渲染，直接从 stream 中取 I 事件即可。

## Dev Deployment Naming

建议后端 dev 服务命名：

```text
domain:  api-dev.ezer.cc
service: ezer-audit-api-dev.service
port:    8018
path:    /opt/ezer_audit_api_dev
branch:  dev/industry-wordsea-service-20260505
```

生产服务保持：

```text
domain:  api.ezer.cc
service: ezer-audit-api.service
path:    /opt/ezer_audit_api
branch:  main
```

DNS / reverse proxy 需要配合：

- `api-dev.ezer.cc` 指向同一台 API 服务器或 dev API 所在服务器。
- Nginx/Caddy 将 `api-dev.ezer.cc` 转发到 dev 服务端口。
- CORS 允许前端站点来源访问 dev API。
- dev/prod token 分离，避免前端 preview 环境误打生产任务。

## Acceptance Checks

前端联调前，dev API 至少需要通过：

```text
POST /api/tasks -> 202
response includes stream_url, result_url, result_br_url
GET /stream -> 200 text/event-stream
stream includes final_result
stream may include i_industry_wordsea
GET /result -> 200 application/json
GET /result.br -> 200 application/json with Content-Encoding: br
GET /result.br.raw -> 200 application/octet-stream without Content-Encoding
```

前端改造通过标准：

- dev 环境实际请求域名是 `api-dev.ezer.cc`，不是 `api.ezer.cc`。
- prod 环境实际请求域名仍是 `api.ezer.cc`。
- `stream_url/result_url/result_br_url` 为相对路径时，不会被拼到错误域名。
- `result_br_raw_url` 为相对路径时，不会被拼到错误域名。
- 旧生产环境缺少 `result_br_url` 时仍能正常回退到 `result_url`。
- 旧生产环境缺少 `result_br_raw_url` 时仍能正常回退到 `result_url`。
- I event 不会影响 A/B/C 现有渲染。
