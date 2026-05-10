> 🌏 [English](./06-openapi-swagger.md) | [繁體中文](./06-openapi-swagger.zh-TW.md)

# 06 · OpenAPI & Swagger

Swagger UI is mounted at **`/api/docs`** and the OpenAPI JSON at **`/api/docs-json`**.

## Wiring (in `main.ts`)

```ts
patchNestJsSwagger();             // ★ MUST be called before NestFactory.create
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

`patchNestJsSwagger()` teaches `@nestjs/swagger` how to read **Zod schemas** so `createZodDto()` classes show up correctly in the docs.

## Decorators We Use

| Decorator | Purpose |
|---|---|
| `@ApiTags('todos')` | Group routes in the UI |
| `@ApiOperation({ summary })` | Per-route description |

We deliberately keep decorator usage minimal: most schema info comes for free from the Zod DTOs.

## Response Schemas

Response shapes are declared via Zod too:

```ts
// src/dto/todos/todo-response.dto.ts
export const todoResponseSchema = z.object({...});
export class TodoResponseDto extends createZodDto(todoResponseSchema) {}
```

Controllers return plain objects (`toTodoResponse(model)`) — Nest serializes them. Declaring the response *class* on the controller method's return type is enough for the docs to pick it up; for richer schemas you can add `@ApiOkResponse({ type: TodoResponseDto })`.

## OpenAPI as the Single Source of Truth

Frontend / mobile teams can generate clients from `/api/docs-json` using tools like `openapi-typescript` or `openapi-generator`. Because the schema is derived from Zod, "the docs match the code" is enforced by construction.
