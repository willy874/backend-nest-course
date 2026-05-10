> 🌏 **English** | [繁體中文](./05-zod-validation.zh-TW.md)

# 05 · Zod Validation

## What you'll learn

- Why server-side validation is a non-negotiable security baseline
- The conceptual difference between *parsing* and *validating* — why Zod is designed as a parser
- The leverage of one Zod schema acting as type, validator, and OpenAPI spec at once
- How to guard the three critical boundaries: env, request, response
- Common validation anti-patterns

---

## One sentence: **never trust client input.**

No matter how nice your frontend validation is, the backend **must validate again**. Why?

- An attacker can hit your API with `curl` and bypass any frontend
- Different clients (iOS, Android, Postman, third-party integrators) behave differently
- Frontend versions lag the backend; rules diverge
- Browser extensions can mutate requests

**Server-side validation is the last line of defense for security and data integrity.** This principle is called **Defense in Depth**.

> ⚠️ **Common vulnerability**: Backend only checks required fields, doesn't restrict the shape — `role: "admin"` slips through. That's mass assignment. Zod's strict schemas reject unknown fields by default.

---

## Zod's philosophy: *parse*, don't just validate

Traditional validators (class-validator, Joi) ask "is this data valid?" — yes/no.

Zod's approach is to *parse*: input is `unknown`, output is strongly typed:

```ts
const schema = z.object({ age: z.coerce.number() });
const result = schema.parse({ age: "30" });
//      ^? { age: number }   ← no longer string
```

Why does this matter?

- **Validate** style: you still hold an `unknown` and have to `as number`. The type system can't help.
- **Parse** style: after parsing, the variable's type **is** correct. No casts needed.

> 💡 **Concept**: Same idea as Rust's `Result<T, E>` — parse once at the boundary; trust the types inside.

---

## One schema, three uses

```ts
export const createTodoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  categoryIds: z.array(z.string().uuid()).optional().default([]),
});

export class CreateTodoDto extends createZodDto(createTodoSchema) {}
```

Same schema does triple duty:

| Use | How |
|---|---|
| **Runtime validation** | `ZodValidationPipe` parses before the controller runs |
| **TypeScript type** | `z.infer<typeof schema>` derives it |
| **OpenAPI doc** | `nestjs-zod` translates schema → JSON Schema |

**Single Source of Truth** is a foundational backend principle: define a fact in exactly one place, change it once, change everywhere. If validation, types, and docs are written separately, **they will drift**, and bugs will hide in the gaps.

---

## Wiring: global validation

```ts
// app.module.ts
{ provide: APP_PIPE, useClass: ZodValidationPipe }
```

This single line:

- Registers a global pipe that runs *before* every controller
- Pipe inspects the DTO type → parses with the matching Zod schema → throws `ZodError` on failure
- Our `AllExceptionsFilter` formats `ZodError` into a 400 response

A failure response looks like:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    { "code": "too_small", "minimum": 1, "path": ["title"], "message": "..." }
  ]
}
```

> 💡 **API design tip**: Error responses should be **structured**, not free-text strings, so the frontend can map errors back to specific fields.

---

## Partial / Update schemas

```ts
export const updateTodoSchema = createTodoSchema.partial();
export class UpdateTodoDto extends createZodDto(updateTodoSchema) {}
```

`.partial()` makes every field optional — perfectly matching PATCH semantics ("only update what was sent").

> ⚠️ **PATCH vs PUT**:
> - **PUT**: full replacement; missing fields reset to defaults
> - **PATCH**: partial update; only sent fields change
>
> This project uses PATCH, so `.partial()` is correct.

---

## When to use coercion

In HTTP, query strings and env vars are **all strings**. To turn them into numbers/dates/booleans, coerce:

```ts
z.coerce.number()    // "42" → 42
z.coerce.date()      // "2026-05-10" → Date
```

⚠️ Beware booleans: `z.coerce.boolean()` returns `true` for any non-empty string (including `"false"`)! That's why this project does:

```ts
isCompleted: z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
```

Explicit allowlist + transform — sidesteps the coercion footgun.

---

## Guarding env: fail fast

```ts
// src/config/env.schema.ts
export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DB_HOST: z.string().default('localhost'),
  ...
});
```

`ConfigModule.forRoot({ validate: validateEnv })` runs this at startup. Bad env → app refuses to boot.

> 💡 **Backend principle**: **Fail Fast**. It's far cheaper to crash at startup with "missing DB_HOST" than to boot, accept traffic, and discover the problem on the first request. Failing early is 1000× cheaper than failing late.

---

## Validation anti-patterns

| Anti-pattern | Why it's bad |
|---|---|
| Re-validating in services | Violates "parse once at the boundary"; internals should trust types |
| Replacing schema validation with SQL CHECK constraints | DB errors don't make good API responses |
| Free-text error messages | Frontend has to parse strings; localization explodes |
| Trusting client-provided IDs (e.g. `userId` in body) | Always derive from auth context |
| `try/catch` swallowing validation errors | Errors vanish; debugging hell |

---

## Zod vs class-validator

| | class-validator | zod |
|---|---|---|
| Schema source | Decorators on classes | Plain data (`z.object`) |
| TS types | Hand-written class | Inferred (`z.infer`) |
| Reuse outside HTTP | Hard (class-bound) | Trivial (same `z.object` works in scripts, tests, env) |
| OpenAPI integration | Built-in | Via `nestjs-zod` |
| Functional composition | Weak | Strong (`.merge`, `.partial`, `.refine`, `.transform`) |
| Ecosystem | NestJS-native | Cross-framework (tRPC, RHF, Drizzle all support) |

When the project already uses Zod for env/DTOs/responses, **all validation shares one mental model** — minimum maintenance cost.

---

## Recap

- Server-side validation is a **non-negotiable** safety baseline.
- Zod's "parse" model unifies boundary validation with the type system.
- One schema serves as **type, validator, and OpenAPI** — Single Source of Truth.
- Validate **env** with Zod too, **fail fast** at startup.
- PATCH uses `.partial()`; coerce with `z.coerce.*` but watch the boolean trap.
