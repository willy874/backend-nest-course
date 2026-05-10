> 🌏 [English](./06-openapi-swagger.md) | **繁體中文**

# 06 · OpenAPI 與 Swagger

Swagger UI 掛在 **`/api/docs`**,OpenAPI JSON 在 **`/api/docs-json`**。

## 啟動配置(`main.ts`)

```ts
patchNestJsSwagger();             // ★ 必須在 NestFactory.create 之前呼叫
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

`patchNestJsSwagger()` 會教 `@nestjs/swagger` 怎麼讀 **Zod schema**,讓 `createZodDto()` 產生的 class 在文件中正確顯示。

## 用到的 Decorators

| Decorator | 用途 |
|---|---|
| `@ApiTags('todos')` | 在 UI 上分組路由 |
| `@ApiOperation({ summary })` | 該路由的描述 |

decorator 用得很節制 — 大部分 schema 資訊由 Zod DTO 自動帶入。

## Response Schema

回應形狀也由 Zod 驅動:

```ts
// src/dto/todos/todo-response.dto.ts
export const todoResponseSchema = z.object({...});
export class TodoResponseDto extends createZodDto(todoResponseSchema) {}
```

Controller 只回傳 plain object(`toTodoResponse(model)`)— 由 Nest 序列化。把 response class 宣告在 controller method 的回傳型別,文件就能讀到;若要更豐富的 schema 資訊,可用 `@ApiOkResponse({ type: TodoResponseDto })`。

## 把 OpenAPI 當作 Single Source of Truth

前端 / 行動端團隊可以從 `/api/docs-json` 用 `openapi-typescript`、`openapi-generator` 等工具產生 client。因為 schema 是從 Zod 推導的,「文件與 code 一致」這件事在結構上就被保證。
