> 🌏 **English** | [繁體中文](../zh-TW/01-architecture.md)

# 01 · Architecture & Layered Design

## What you'll learn

- Why backend services need *layers* instead of one big file
- The trade-offs between Layer-based, Feature-based, and Hexagonal architectures
- Why "direction of dependencies" matters more than "what the folders look like"
- The six layers of this project and the contract between each pair

---

## Why layers?

When you're writing a quick script, putting everything in one file is fastest. But backend services live a long time — two years from now, someone else is going to have to change this code. The dominant cost won't be *writing* code; it will be **reading code other people wrote**.

The point of layering is: **let each file answer one question.**

- Read a controller → I just want to know how this HTTP route comes in and goes out.
- Read a service → I just want to know the business flow.
- Read a repository → I just want to know how data moves to/from the DB.

Once each layer answers exactly one question, you can **test, replace, and understand** any piece independently. That's the **Single Responsibility Principle** at architectural scale.

---

## Three common backend architecture styles

| Style | Organization | Pros | Cons |
|---|---|---|---|
| **Layer-based** (this project) | By role (`controllers/`, `services/`, ...) | Roles obvious, beginner-friendly | Editing one feature touches multiple folders |
| **Feature-based** | By feature (`modules/todos/`, ...) | One stop per feature, easy to extract microservice | Role boundaries depend on convention |
| **Hexagonal / Clean** | Domain core inward, IO outward | Domain logic completely framework-free, highly testable | Steep learning curve, lots of boilerplate |

> 💡 **Practitioner's note**: There's no "best" architecture, only the one that fits *this team, this maturity level, this domain complexity*. We chose layer-based for teaching because **it makes every responsibility visible**.

---

## The layers in this project

```
HTTP Request
    │
    ▼
┌───────────────┐
│  controllers  │   HTTP boundary. Speaks DTO ↔ Model.
└───────┬───────┘
        ▼
┌───────────────┐
│   services    │   Business orchestration. Speaks Model.
└───────┬───────┘
        ▼
┌───────────────┐
│ repositories  │   DB access. Schema row → Model.
└───────┬───────┘
        ▼
┌───────────────┐
│   schemas     │   Drizzle table definitions (DB shape).
└───────────────┘

         models   ◄── pure data shape used above repositories
         dto      ◄── Zod-driven request/response contracts
```

Each layer has a different "currency":

- Controllers talk in **DTOs** (HTTP-world contracts, JSON-serializable).
- Services talk in **Models** (the app's internal data shape).
- Repositories meet the DB in **schema rows** (Drizzle's inferred types).

---

## Direction of dependencies (more important than the structure)

```
controllers  →  services  →  repositories  →  schemas
     │             │              │
     └─── dto      └─── models ───┘
```

One rule: **arrows only flow one way.**

- ✅ Controllers may call Services
- ❌ Services **never** call Controllers
- ❌ Repositories **never** throw `BadRequestException` (that's an HTTP concept)

> 💡 **Backend concept**: This is exactly Robert C. Martin's **Dependency Rule** from Clean Architecture: source code dependencies must point only inward. Break it and you end up with absurdities like "to test my service I have to mock an HTTP request."

---

## Why must Service NOT import DTOs?

The most common beginner mistake: "DTOs are just objects, may as well use them in the service."

The problem is: **DTOs are HTTP-world contracts**. Tomorrow this service is invoked by a cron job — where's the HTTP body? The day after, by a Kafka consumer — does it really get an HTTP DTO?

The fix: **the Controller unwraps the DTO into an internal shape (a model or plain object) before calling the service**. Services only know internal shapes.

That's exactly why this project has a `models/` layer — it's the Service's *official language*. See [docs/09](./09-models-layer.md).

---

## Where do cross-cutting concerns live?

Some functionality doesn't belong to any one layer — it cuts across the whole app: validation, error handling, logging, auth, tracing. NestJS provides four mechanisms:

| Mechanism | Triggers | This project uses |
|---|---|---|
| **Pipe** | Before the handler runs | `ZodValidationPipe` (global), `ParseUUIDPipe` (per-route) |
| **Guard** | Before the pipe — admit/reject | None (you'd add JWT auth here) |
| **Interceptor** | Wraps the handler (can rewrite response) | None (you'd add logging/cache here) |
| **Filter** | Catches anything thrown | `AllExceptionsFilter` (global) |

These are NestJS's expression of **Aspect-Oriented Programming (AOP)** — pulling cross-cutting concerns out of business code so they're managed in one place.

---

## Recap

- Layering's goal is **one question per file** — long-term maintenance becomes affordable.
- The key isn't "what folders" but **arrows pointing one way**.
- Each layer pair talks via a **clear data contract** (DTO, Model, Row), no mixing.
- Cross-cutting concerns go through Nest's Pipe / Guard / Interceptor / Filter — keep them out of business code.
