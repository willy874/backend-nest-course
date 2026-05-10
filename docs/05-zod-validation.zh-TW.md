> 🌏 [English](./05-zod-validation.md) | **繁體中文**

# 05 · Zod 驗證

Zod 讓我們用**同一份 schema**同時得到:

1. 執行期驗證
2. TypeScript 型別(`z.infer`)
3. OpenAPI schema(透過 `nestjs-zod`)

## 定義一個 DTO

```ts
// src/dto/todos/create-todo.dto.ts
export const createTodoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  categoryIds: z.array(z.string().uuid()).optional().default([]),
});

export class CreateTodoDto extends createZodDto(createTodoSchema) {}
```

`createZodDto()`(來自 `nestjs-zod`)回傳一個 class:

- 攜帶 schema(用於驗證時機)。
- 攜帶推導後的 TS 型別(用在 service 簽名)。
- 在 `patchNestJsSwagger()` 後被 Swagger 認識。

## 全域註冊驗證 Pipe

```ts
// app.module.ts
{ provide: APP_PIPE, useClass: ZodValidationPipe }
```

之後任何 `@Body() dto: SomeZodDto` 都會在進 controller 之前被驗證。失敗時丟 `ZodError`,由 `AllExceptionsFilter` 統一格式化為 400。

## Partial / Update DTO

```ts
export const updateTodoSchema = createTodoSchema.partial();
export class UpdateTodoDto extends createZodDto(updateTodoSchema) {}
```

`.partial()` 把每個欄位變成 optional — 對 `PATCH` 剛剛好。

## 型別轉型 (Coercion)

`z.coerce.date()` 適用於 query param 或 JSON 字串轉 `Date`;`z.coerce.number()` 用於 env 字串轉數字。

## 用同一套驗證 env

完全同模式套到 `process.env`:

```ts
// src/config/env.schema.ts
export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DB_HOST: z.string().default('localhost'),
  ...
});
```

`ConfigModule.forRoot({ validate: validateEnv })` 在啟動時執行;env 不合法的話,app 直接拒絕啟動。

## 為何選 Zod(對比 class-validator)?

| | class-validator | zod |
|---|---|---|
| Schema 來源 | class 上的 decorator | 純資料 |
| TS 型別 | 手寫 | 推導 |
| HTTP 以外重用 | 困難 | 輕鬆(同一份 `z.object` 可用於 script、test、env) |
| OpenAPI 整合 | 內建 | 透過 `nestjs-zod` |

當專案已經用 Zod 做 env / response 時,讓所有驗證共用同一個工具是最大優勢。
