> 🌏 [English](./01-architecture.md) | [繁體中文](./01-architecture.zh-TW.md)

# 01 · Architecture & Layered Design

This project uses a **layer-based** structure. Every responsibility lives in its own folder, and dependencies always flow in one direction.

## Layer Overview

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
│ repositories  │   DB access. Speaks schema row → Model.
└───────┬───────┘
        ▼
┌───────────────┐
│   schemas     │   Drizzle table definitions (DB shape).
└───────────────┘

         models   ◄── pure data shape used by all upper layers
         dto      ◄── Zod-driven request/response contracts
```

## Direction of Dependencies

```
controllers  →  services  →  repositories  →  schemas
     │             │              │
     └─── dto      └─── models ───┘
```

- Controllers **never** reach into repositories.
- Services **never** import DTOs (request/response is the controller's job).
- Repositories **never** know about HTTP, Zod, or DTOs.
- The **models layer** is the shared, pure-data vocabulary above repositories.

## Why Layers Instead of Feature Modules?

Both are valid. We chose layers because the teaching goal is to make each *responsibility* explicit and visible. In a feature-based layout (`modules/todos/`) the same files exist but are scattered — beginners can mistake DTO concerns for repository concerns, etc.

Once you internalize the layers, switching to feature modules is a refactor, not a rewrite.

## Cross-cutting Concerns

| Concern | Where |
|---|---|
| Validation | `ZodValidationPipe` (global) — registered in `app.module.ts` |
| Error formatting | `AllExceptionsFilter` — `src/common/filters/` |
| Config | `ConfigModule` + `validateEnv()` (Zod) — `src/config/` |
| DB client | `DatabaseModule` exposes the `DRIZZLE` provider — `src/database/` |
