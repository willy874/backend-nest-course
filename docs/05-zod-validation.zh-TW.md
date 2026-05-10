> 🌏 [English](./05-zod-validation.md) | **繁體中文**

# 05 · Zod 驗證

## 你會學到

- 為什麼 server-side validation 是不可妥協的安全底線
- Parse 與 Validate 的觀念差別 — Zod 為什麼設計成「解析」
- 一份 Zod schema 同時擔任「型別、驗證、文件」三角色的威力
- 如何用 Zod 守住 env、request、response 三個關鍵邊界
- 常見的 validation 反 pattern

---

## 一句話:**永遠不要相信 client 送來的資料**

不管前端做了多漂亮的驗證,後端**必須再驗一次**。為什麼?

- 攻擊者可以直接用 `curl` 繞過你的 React 表單
- 不同 client(iOS、Android、Postman、其他公司接你 API)行為不一
- 前端版本落後幾天,規則改了它沒更新
- 瀏覽器外掛可能改 request

**Server-side validation 是安全與資料完整性的最後一道防線**,叫做 **Defense in Depth**(縱深防禦)。

> ⚠️ **常見漏洞**:後端只擋必填欄位,沒擋 `role: "admin"` 也能被傳進來 → mass assignment 漏洞。Zod 的 strict schema 會自動拒絕未宣告的欄位。

---

## Zod 的核心哲學:Parse,別只是 Validate

傳統 validator(class-validator、Joi)是「**檢查資料是否合法**」 — 答 yes/no。

Zod 的設計是「**解析**」 — 輸入是 unknown,輸出是強型別:

```ts
const schema = z.object({ age: z.coerce.number() });
const result = schema.parse({ age: "30" });
//      ^? { age: number }   ← 不是 string 了
```

差別在哪?

- **Validate** 風格:你還是抱著 `unknown` 在後面寫 `as number`,型別系統幫不了你。
- **Parse** 風格:解析成功後,變數型別**就是**對的,不需要 cast。

> 💡 **觀念**:這跟 Rust 的 `Result<T, E>` 是同一種思路 — 邊界處解析一次,內部就能信任型別。

---

## 一份 Schema,三種用途

```ts
export const createTodoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  categoryIds: z.array(z.string().uuid()).optional().default([]),
});

export class CreateTodoDto extends createZodDto(createTodoSchema) {}
```

這一份 schema 同時提供:

| 用途 | 怎麼用 |
|---|---|
| **執行期驗證** | `ZodValidationPipe` 在 controller 之前自動 parse |
| **TypeScript 型別** | `z.infer<typeof schema>` 自動推導 |
| **OpenAPI 文件** | `nestjs-zod` 把 schema 翻譯成 OpenAPI JSON Schema |

「**Single Source of Truth**(單一真實來源)」是後端工程的重要原則 — 同一個事實只在一個地方定義,改一處全動。如果驗證、型別、文件分三處寫,**它們一定會慢慢分歧**,然後 bug 就藏在縫裡。

---

## Wiring:全域註冊驗證

```ts
// app.module.ts
{ provide: APP_PIPE, useClass: ZodValidationPipe }
```

這一行做了什麼?

- 註冊一個全域 pipe,在每次 request 進到 controller **之前**執行
- pipe 看 controller method 簽名上的 DTO 型別 → 用對應的 Zod schema 解析 → 失敗 throw `ZodError`
- 我們的 `AllExceptionsFilter` 把 `ZodError` 統一格式化成 400 回應

驗證失敗的回應長這樣:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    { "code": "too_small", "minimum": 1, "path": ["title"], "message": "..." }
  ]
}
```

> 💡 **API 設計提示**:錯誤訊息要結構化(可被前端解析),而不是純字串。前端才能精準把錯誤訊息綁到對應欄位。

---

## Partial / Update Schema 的省力做法

```ts
export const updateTodoSchema = createTodoSchema.partial();
export class UpdateTodoDto extends createZodDto(updateTodoSchema) {}
```

`.partial()` 把每個欄位變 optional — 完美對應 PATCH 語意(只更新有給的欄位)。

> ⚠️ **PATCH vs PUT 觀念**:
> - **PUT**:整個資源替換,沒給的欄位視為 reset 為預設值
> - **PATCH**:只更新有給的欄位
>
> 本專案用 PATCH,所以 `.partial()` 是正確的。

---

## 型別轉換(Coercion)什麼時候用?

HTTP 世界裡,query string、env var **都是字串**。要變成 number/date/boolean 必須轉:

```ts
z.coerce.number()    // "42" → 42
z.coerce.date()      // "2026-05-10" → Date
```

⚠️ Boolean 要小心:`z.coerce.boolean()` 對任何非空字串都回 `true`(包括 `"false"`)!所以本專案這樣寫:

```ts
isCompleted: z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
```

明確列出合法值再轉換,避免 coercion 陷阱。

---

## 守住 Env:Fail Fast

```ts
// src/config/env.schema.ts
export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DB_HOST: z.string().default('localhost'),
  ...
});
```

`ConfigModule.forRoot({ validate: validateEnv })` 在啟動時跑這個 schema。env 不合法 → app 拒絕啟動。

> 💡 **後端工程觀念**:**Fail Fast**(早失敗)。寧可在啟動時就因為缺少 `DB_HOST` 而 crash,也不要服務跑起來、第一個 request 進來才發現連不到 DB。早失敗比晚失敗便宜一萬倍。

---

## Validation 的反 Pattern

| 反 pattern | 為何不要 |
|---|---|
| 在 service 層補驗證 | 違反「邊界一次性 parse」原則,內部該信任型別 |
| 在 SQL 層用 CHECK constraint 取代 schema 驗證 | DB 報的錯不適合直接當 API response |
| 把驗證錯誤訊息寫成自然語言 | 前端要 parse 字串,語系切換爆炸 |
| 信任 ID 由前端傳(例如 `userId` 來自 body)| 永遠從 auth context 取,不信任 client |
| `try/catch` 包驗證然後吞錯 | 錯誤訊息消失,debug 地獄 |

---

## Zod vs class-validator 完整比較

| | class-validator | zod |
|---|---|---|
| Schema 來源 | class 上的 decorator | 純資料(`z.object`) |
| TS 型別 | 手寫 class | 推導(`z.infer`) |
| 邊界外重用 | 困難(綁 class)| 輕鬆(同份 schema 用在 script、test、env、config)|
| OpenAPI 整合 | 內建 | 透過 `nestjs-zod` |
| 函式式組合 | 弱 | 強(`.merge`、`.partial`、`.refine`、`.transform`) |
| 生態系 | NestJS 預設 | 跨框架(tRPC、React Hook Form、Drizzle 都支援) |

當專案已經用 Zod 做 env / DTO / response,**整個系統的驗證觀念都統一**,維護成本最低。

---

## Recap

- Server-side validation 是**不可妥協**的安全底線。
- Zod 的「parse」觀念把邊界驗證和型別系統打通。
- 一份 schema 同時當「型別、驗證、OpenAPI」三用,做到 Single Source of Truth。
- Env 也走 Zod,**fail fast** 在啟動階段擋住設定錯誤。
- PATCH 用 `.partial()`,coercion 用 `z.coerce.*` 但小心 boolean 陷阱。
