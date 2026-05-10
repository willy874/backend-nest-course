> 🌏 [English](./05-zod-validation.md) | [繁體中文](./05-zod-validation.zh-TW.md)

# 05 · Zod Validation

Zod gives us **one schema** that produces:

1. Runtime validation
2. TypeScript types (`z.infer`)
3. OpenAPI schema (via `nestjs-zod`)

## Defining a DTO

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

`createZodDto()` (from `nestjs-zod`) returns a class that:

- Carries the schema (used at validation time).
- Carries the inferred TypeScript shape (used in service signatures).
- Is recognized by Swagger after `patchNestJsSwagger()`.

## Wiring the Pipe Globally

```ts
// app.module.ts
{ provide: APP_PIPE, useClass: ZodValidationPipe }
```

Now any `@Body() dto: SomeZodDto` is validated before reaching the controller. Failures throw a `ZodError`, which our `AllExceptionsFilter` formats as a 400.

## Partial / Update DTOs

```ts
export const updateTodoSchema = createTodoSchema.partial();
export class UpdateTodoDto extends createZodDto(updateTodoSchema) {}
```

`.partial()` makes every field optional — perfect for `PATCH`.

## Coercion

Use `z.coerce.date()` for query params or JSON strings that should become `Date`. Use `z.coerce.number()` for env strings → numbers.

## Env Validation

Same pattern, applied to `process.env`:

```ts
// src/config/env.schema.ts
export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DB_HOST: z.string().default('localhost'),
  ...
});
```

`ConfigModule.forRoot({ validate: validateEnv })` runs this at startup; the app refuses to boot if env is invalid.

## Why Zod (vs class-validator)

| | class-validator | zod |
|---|---|---|
| Schema source | decorators on classes | data |
| TS types | hand-written | inferred |
| Reuse outside HTTP | hard | trivial (same `z.object` works in scripts, tests, env) |
| OpenAPI integration | built-in | via `nestjs-zod` |

For a project that already uses Zod for env + responses, having a single validator everywhere is the win.
