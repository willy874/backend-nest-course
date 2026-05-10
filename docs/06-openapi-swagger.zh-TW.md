> 🌏 [English](./06-openapi-swagger.md) | **繁體中文**

# 06 · OpenAPI 與 Swagger

## 你會學到

- OpenAPI 與 Swagger 是什麼關係(很多人搞混)
- Code-first vs Contract-first 兩種 API 設計流派
- 為什麼「文件是程式碼的副產品」這個目標值得追求
- 如何讓前端 / 行動端團隊**從 OpenAPI 自動產生 client**,徹底消除「文件過時」問題
- API versioning 的常見策略

---

## 名詞釐清

| | 意義 |
|---|---|
| **OpenAPI** | 描述 RESTful API 的**規格(spec)**,目前主要是 OpenAPI 3.x。是 JSON/YAML 格式。 |
| **Swagger** | 一系列工具(Swagger UI、Swagger Editor、Swagger Codegen)的品牌名。Swagger UI 把 OpenAPI JSON 渲染成漂亮的可互動文件。 |
| **`@nestjs/swagger`** | NestJS 套件,讀取你的 controller 與 DTO,**自動產生 OpenAPI JSON** |

簡單記:**OpenAPI 是規格,Swagger 是工具**。

---

## 為什麼後端服務需要 OpenAPI?

不寫 OpenAPI 的世界:

- API 文件寫在 Notion / Confluence,**永遠跟程式碼不同步**
- 前端要對接,跑來問「這欄位是 string 還是 number?」
- 出 bug 才發現「文件說回 200,實際回 204」
- 想換 client 庫時,**手刻**所有 type 與 fetch wrapper

有 OpenAPI 的世界:

- 文件**自動**從 code 生成,永遠跟實作一致
- 前端跑 `openapi-typescript-codegen` → 拿到完整 typed client
- API 變更走 PR,文件 diff 直接可審查
- Mobile / 第三方接接者讀同一份規格

> 💡 **業界標準**:OpenAPI 已經是 RESTful API 的事實標準。**沒有 OpenAPI 的後端,在 2026 年是落伍的**。

---

## Code-first vs Contract-first

兩種流派:

### Code-first(本專案採用)

```
寫 code(Nest controller + Zod DTO)
        │
        ▼
@nestjs/swagger + nestjs-zod 自動產 OpenAPI JSON
        │
        ▼
Swagger UI 顯示,client codegen 也吃這份
```

- ✅ 開發體驗直覺,寫一份 code 同時得到實作與文件
- ✅ 文件不會跟 code 分歧
- ❌ API 設計討論發生**在實作之後**,容易變成「先做出來,再改 API」

### Contract-first

```
先寫 OpenAPI spec(YAML)
        │
        ▼
團隊 review、前後端對齊
        │
        ▼
產 server skeleton + client SDK
        │
        ▼
填實作
```

- ✅ API 在實作前先被討論、審查
- ✅ 前後端可以**平行開發**(前端先用 mock server)
- ❌ 多一份 YAML 要維護
- ❌ 工具鏈相對複雜

> 💡 **選擇建議**:
> - 教學專案、單一團隊、敏捷開發 → code-first(快、簡單)
> - 大型組織、跨團隊、SDK 對外發布 → contract-first(嚴謹、可協作)
>
> 本專案是**前者**,但可以借助 Zod schema 的型別威力,接近 contract-first 的體驗。

---

## 本專案的 Wiring

```ts
// main.ts
patchNestJsSwagger();             // ★ 必須在 NestFactory.create 之前
const app = await NestFactory.create(AppModule);

const config = new DocumentBuilder()
  .setTitle('Backend Nest Course - Todo API')
  .setVersion('0.1.0')
  .addTag('todos')
  .addTag('categories')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

- `patchNestJsSwagger()`(來自 `nestjs-zod`)教 `@nestjs/swagger` 怎麼讀 Zod schema。**順序很重要**:必須在建立 app **之前**呼叫,否則它無法 patch 到內部的 schema 解析器。
- `SwaggerModule.setup('api/docs', ...)` 把 Swagger UI 掛在 `/api/docs`。OpenAPI JSON 自動可在 `/api/docs-json` 取得。

---

## 用到的 Decorators

| Decorator | 用途 |
|---|---|
| `@ApiTags('todos')` | 在 UI 上分組路由 |
| `@ApiOperation({ summary })` | 該路由的描述 |
| `@ApiOkResponse({ type })` | 明確聲明 200 回應的 schema(可選) |

本專案刻意保持 decorator 用得很節制,**讓 Zod DTO 自己說話**。

---

## 進階:從 OpenAPI 產 Client

前端可以這樣使用你的 API:

```bash
# 假設 API 跑在 localhost:3000
npx openapi-typescript http://localhost:3000/api/docs-json -o api.d.ts
```

得到一份完整型別:

```ts
import type { paths } from './api';

type CreateTodoBody = paths['/todos']['post']['requestBody']['content']['application/json'];
type TodoResponse = paths['/todos/{id}']['get']['responses']['200']['content']['application/json'];
```

**前端打 API 完全不用看後端文件**,IDE 自動補完。後端改欄位 → 重新 generate → 前端 TypeScript 立刻紅線。

> 💡 **觀念**:這就把「**API 契約**」從一份易腐爛的文檔變成**機器可讀的型別檢查**。同步成本接近零。

---

## API Versioning 策略

當 API 必須做 breaking change(例如砍欄位、改語意),不能直接動,要 versioning。常見三種:

| 策略 | 範例 | 優點 | 缺點 |
|---|---|---|---|
| **URL path** | `/v1/todos`、`/v2/todos` | 直覺、易測試、易快取 | URL 變動 |
| **Header** | `Accept: application/vnd.api.v2+json` | URL 不變 | 要求 client 設 header |
| **Query** | `?version=2` | 簡單 | 不主流 |

NestJS 內建支援:`app.enableVersioning()`。教學專案沒做 versioning,但**真實系統一旦對外發布就要規劃**。

> 💡 **守則**:**Breaking change 永遠開新版本**。不要為了「乾淨」就把 v1 砍掉,client 升級需要時間。

---

## REST 之外:GraphQL、tRPC、gRPC

OpenAPI 是 REST 的事實標準,但其他協議有自己的型別系統:

| 協議 | 文件 / 型別系統 |
|---|---|
| REST | OpenAPI |
| GraphQL | Schema(SDL),內建自說明 |
| tRPC | TypeScript 型別本身就是契約(無需中介格式) |
| gRPC | Protocol Buffers `.proto` |

選哪個取決於 use case。教學重點是 REST + OpenAPI,因為**它最通用、生態系最大**。

---

## Recap

- **OpenAPI 是規格,Swagger 是工具**。記清楚別混淆。
- 採 **code-first** 開發,用 `@nestjs/swagger` + `nestjs-zod` 讓文件成為 code 的副產品。
- `patchNestJsSwagger()` 必須在 `NestFactory.create()` **之前**呼叫。
- 把 OpenAPI 餵給 codegen 工具,**徹底消除「文件過時」問題**。
- API 對外發布後,**breaking change 走 versioning**,不要硬改。
