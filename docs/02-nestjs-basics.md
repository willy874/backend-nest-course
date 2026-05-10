> 🌏 **English** | [繁體中文](./02-nestjs-basics.zh-TW.md)

# 02 · NestJS Basics

## What you'll learn

- The three core building blocks: Module, Controller, Provider
- What problem Dependency Injection actually solves, and why almost every backend framework uses it
- How decorators and metadata reflection let Nest "see" your classes
- The trigger order of Pipe / Guard / Interceptor / Filter

---

## Why use a framework at all?

A simple HTTP server only needs Node's built-in `http`. So why Express, let alone NestJS?

Because real backend services have to handle:

- Routing (URL → handler)
- Validation, authorization, logging, tracing (every request)
- DB connection management, config loading, graceful shutdown
- A modular, testable, evolvable code structure

The value of a framework is **giving you the boring parts so you only write business logic**. NestJS pushes this further — it dictates *how* your app is organized, so every Nest project looks similar and onboarding is nearly free.

---

## Module: the unit of composition

```ts
@Module({
  imports: [DatabaseModule],          // capabilities I depend on
  controllers: [TodosController],     // HTTP entrypoints I expose
  providers: [TodosService, TodosRepository],   // what I make injectable
  exports: [TodosService],            // what other modules can use after importing me
})
export class TodosModule {}
```

> 💡 **Concept**: A Module is a **composable, reusable unit of capability**. Big systems split into `AuthModule`, `PaymentModule`, `NotificationModule`, each self-contained, then composed in `AppModule`.

This project deliberately puts everything in `AppModule` — that way you see the entire wiring at once. Splitting into feature modules later is a natural next step.

---

## Controller: the HTTP boundary

```ts
@Controller('todos')
export class TodosController {
  constructor(private readonly service: TodosService) {}

  @Post()
  create(@Body() dto: CreateTodoDto) {
    return this.service.create(dto).then(toTodoResponse);
  }
}
```

Two key points:

1. **Controllers should hold no business logic.** They do three things only: parse the request → call a service → format the response.
2. **Constructor parameters declare dependencies.** When Nest sees `service: TodosService`, it injects the right instance — that's DI.

---

## Provider & Dependency Injection

### What does DI solve?

Without DI:

```ts
class TodosService {
  private repo = new TodosRepository(new Pool({...}));   // ❌ builds its own deps
}
```

Problems:

- **Untestable**: you can't replace `repo` with a mock.
- **Tightly coupled**: `TodosService` is welded to a specific construction of `TodosRepository`.
- **Duplicated resources**: every service opens its own DB pool — chaos.

With DI:

```ts
class TodosService {
  constructor(private readonly repo: TodosRepository) {}   // ✅ injected from outside
}
```

The DI container (an IoC container) at startup:

1. Builds one `Pool`
2. Uses it to build one `TodosRepository`
3. Uses that to build `TodosService`
4. Uses that to build `TodosController`

The whole object graph is **constructed once and shared**. This is **Inversion of Control** — objects no longer control their dependencies; the container does.

### Custom tokens

When the dependency **isn't a class** (like the Drizzle client in this project), you need a token to identify it:

```ts
export const DRIZZLE = Symbol('DRIZZLE');

@Module({
  providers: [{
    provide: DRIZZLE,
    useFactory: (pool: Pool) => drizzle(pool),
    inject: [PG_POOL],
  }],
})
```

Consumer:

```ts
constructor(@Inject(DRIZZLE) private readonly db: Database) {}
```

> 💡 **Backend concept**: Using a `Symbol` instead of a string token avoids name collisions — if two libraries both used `'DB'` as a string token, who wins? Symbols are unique by construction.

---

## Decorators & metadata reflection

`@Controller('todos')` and `@Body()` look magical, but they're just "stickers on classes."

Nest uses the `reflect-metadata` package to read those stickers at runtime, building the routing table, DI graph, and validation rules. That's why:

- `tsconfig.json` needs `experimentalDecorators` and `emitDecoratorMetadata`
- `main.ts` needs `import 'reflect-metadata'` (we already do)

> 💡 **Concept**: This is **Aspect-Oriented Programming (AOP)**. You don't sprinkle validation/logging/auth across every handler; you put a decorator on, and the framework handles them centrally.

---

## Request lifecycle (trigger order)

```
HTTP Request
    │
    ▼
[1] Middleware            (Express level — cookies, CORS, etc.)
    │
    ▼
[2] Guard                 (admit decision — are you allowed?)
    │
    ▼
[3] Interceptor (before)  (wrapping logic — log, trace, cache lookup)
    │
    ▼
[4] Pipe                  (transform + validate input — e.g. ZodValidationPipe)
    │
    ▼
[5] Controller handler    (your business entrypoint)
    │
    ▼
[6] Interceptor (after)   (rewrite response, logging, cache write)
    │
    ▼
HTTP Response

   any throw → [7] Exception Filter formats it
```

This project uses:

| Stage | Mechanism | Purpose |
|---|---|---|
| 4 | `ZodValidationPipe` (global) | Validate + coerce request body / query / param |
| 4 | `ParseUUIDPipe` (per-route) | Reject bad `:id` with 400 |
| 7 | `AllExceptionsFilter` (global) | Format exceptions into a uniform JSON shape |

---

## Why register Pipes/Filters via `APP_PIPE` / `APP_FILTER`?

```ts
// A: in main.ts
app.useGlobalPipes(new ZodValidationPipe());      // ❌ no DI access

// B: in app.module.ts (this project)
{ provide: APP_PIPE, useClass: ZodValidationPipe }   // ✅ goes through DI
```

A `new`-s the instance — it's **not in the DI container**, so it can't inject any service (e.g., a logger).

B goes through the container, so all DI works — **always prefer B**.

---

## Recap

- **Module** is a composition unit, **Controller** is the HTTP boundary, **Provider** is what gets injected.
- The **DI container** manages object lifecycles so your code is **testable, replaceable, reusable**.
- **Decorators** become runtime metadata that the framework reads — that's where Nest's "magic" comes from.
- Requests flow **Guard → Interceptor → Pipe → Handler**; throws go to **Filter**.
- Register cross-cutting providers with **`APP_*` tokens** so DI works.
