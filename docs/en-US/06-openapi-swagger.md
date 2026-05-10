> 🌏 **English** | [繁體中文](../zh-TW/06-openapi-swagger.md)

# 06 · OpenAPI & Swagger

## What you'll learn

- The relationship between OpenAPI and Swagger (often confused)
- Code-first vs Contract-first API design schools
- Why "documentation as a byproduct of code" is a goal worth pursuing
- How to let frontend / mobile teams **auto-generate clients from OpenAPI**, eliminating drift forever
- Common API versioning strategies

---

## Terminology

| | Meaning |
|---|---|
| **OpenAPI** | The **specification** that describes a RESTful API. Currently OpenAPI 3.x. JSON or YAML format. |
| **Swagger** | A brand of tooling (Swagger UI, Swagger Editor, Swagger Codegen). Swagger UI renders OpenAPI JSON into a browsable, interactive doc. |
| **`@nestjs/swagger`** | Nest package that reads your controllers + DTOs and **auto-generates the OpenAPI JSON**. |

In short: **OpenAPI is the spec, Swagger is the tooling.**

---

## Why does a backend service need OpenAPI?

Without OpenAPI:

- API docs live in Notion / Confluence and are **always out of sync** with code
- Frontend keeps asking "is this field a string or a number?"
- Bugs surface as "doc said 200, the API actually returns 204"
- Switching client libraries means **hand-coding** every type and fetch wrapper

With OpenAPI:

- Docs are **auto-generated** from code, always consistent with implementation
- Frontend runs `openapi-typescript-codegen` → fully typed client
- API changes go through PRs; doc diffs are reviewable
- Mobile / third-party integrators read the same spec

> 💡 **Industry baseline**: OpenAPI is the de-facto standard for REST APIs. **A backend without OpenAPI in 2026 is behind the curve.**

---

## Code-first vs Contract-first

### Code-first (this project)

```
Write code (Nest controllers + Zod DTOs)
        │
        ▼
@nestjs/swagger + nestjs-zod auto-generate OpenAPI JSON
        │
        ▼
Swagger UI renders it; client codegen consumes it
```

- ✅ Intuitive DX — write code once, get implementation + docs
- ✅ Docs can't drift from code
- ❌ API design discussions happen *after* implementation, sometimes leading to "ship first, redesign later"

### Contract-first

```
Write OpenAPI spec (YAML)
        │
        ▼
Team reviews; FE/BE align
        │
        ▼
Generate server skeleton + client SDK
        │
        ▼
Fill in implementations
```

- ✅ API design reviewed before implementation
- ✅ FE/BE can develop **in parallel** (FE uses a mock server)
- ❌ Extra YAML to maintain
- ❌ More tooling complexity

> 💡 **Choosing**: small team / agile → code-first; large org / external SDKs → contract-first. This project is the former, but Zod's type rigor lets us approach contract-first quality.

---

## Wiring (this project)

```ts
// main.ts
patchNestJsSwagger();             // ★ MUST run before NestFactory.create
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

- `patchNestJsSwagger()` (from `nestjs-zod`) teaches `@nestjs/swagger` how to read Zod schemas. **Order matters**: it has to patch the schema parser *before* the app builds, otherwise it's too late.
- `SwaggerModule.setup('api/docs', ...)` mounts the UI; the JSON is automatically at `/api/docs-json`.

---

## Decorators we use

| Decorator | Purpose |
|---|---|
| `@ApiTags('todos')` | Group routes in the UI |
| `@ApiOperation({ summary })` | Per-route description |
| `@ApiOkResponse({ type })` | (Optional) explicit 200 schema |

We deliberately keep usage minimal — **let the Zod DTOs do the talking**.

---

## Bonus: client codegen

The frontend can do this:

```bash
# assuming the API runs on localhost:3000
npx openapi-typescript http://localhost:3000/api/docs-json -o api.d.ts
```

Result:

```ts
import type { paths } from './api';

type CreateTodoBody = paths['/todos']['post']['requestBody']['content']['application/json'];
type TodoResponse = paths['/todos/{id}']['get']['responses']['200']['content']['application/json'];
```

**Frontend never reads the docs by hand again** — IDE autocompletes everything. Backend tweaks a field → regen → frontend instantly redlines.

> 💡 **Concept**: This turns the "API contract" from a rotting document into **machine-checked types**. Drift cost approaches zero.

---

## API versioning strategies

When you have to make a breaking change (drop a field, change semantics), version it. Three common approaches:

| Strategy | Example | Pros | Cons |
|---|---|---|---|
| **URL path** | `/v1/todos`, `/v2/todos` | Intuitive, easy to test, easy to cache | URL changes |
| **Header** | `Accept: application/vnd.api.v2+json` | URL stable | Clients must set headers |
| **Query** | `?version=2` | Simple | Less standard |

NestJS has built-in support: `app.enableVersioning()`. The teaching project doesn't version, but **any externally-shipped API needs a plan**.

> 💡 **Rule**: **Breaking changes always open a new version.** Don't drop v1 just because v2 is "cleaner" — clients need time to migrate.

---

## Beyond REST: GraphQL, tRPC, gRPC

OpenAPI is the standard for REST, but other protocols have their own type systems:

| Protocol | Doc / type system |
|---|---|
| REST | OpenAPI |
| GraphQL | Schema (SDL), self-documenting |
| tRPC | TypeScript types are the contract (no intermediate format) |
| gRPC | Protocol Buffers `.proto` |

Choosing one is a use-case decision. We teach REST + OpenAPI because **it's the most universal and has the largest ecosystem**.

---

## Recap

- **OpenAPI is the spec, Swagger is the tooling** — never confuse them again.
- We use **code-first** with `@nestjs/swagger` + `nestjs-zod`, making docs a byproduct of code.
- `patchNestJsSwagger()` must run **before** `NestFactory.create()`.
- Feed OpenAPI to codegen tools to **kill the doc-drift problem entirely**.
- Once your API is shipped, **breaking changes need versioning** — don't break clients.
