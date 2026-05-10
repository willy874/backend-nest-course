> 🌏 Languages: **English** | [繁體中文](./README.zh-TW.md)

# Backend Nest Course — Todo API

A teaching project that walks through building a production-shaped backend using:

- **Node.js 24** runtime
- **NestJS 11** framework
- **Drizzle ORM** (PostgreSQL)
- **Zod** for runtime validation
- **OpenAPI / Swagger** auto-generated docs
- **Docker Compose** for local PostgreSQL
- **drizzle-kit** for schema migrations

The domain is a small **Todo list** with a **many-to-many** relation to **Categories**.

---

## 📚 Learning Map

The README is the high-level tour. Deep dives live in [`docs/`](./docs):

| # | Topic | File |
|---|---|---|
| 01 | Architecture & layered design | [docs/01-architecture.md](./docs/01-architecture.md) |
| 02 | NestJS basics (Module / Controller / Service / DI) | [docs/02-nestjs-basics.md](./docs/02-nestjs-basics.md) |
| 03 | Drizzle ORM (schema, query, relations) | [docs/03-drizzle-orm.md](./docs/03-drizzle-orm.md) |
| 04 | Migrations with drizzle-kit | [docs/04-migrations.md](./docs/04-migrations.md) |
| 05 | Zod validation + nestjs-zod | [docs/05-zod-validation.md](./docs/05-zod-validation.md) |
| 06 | OpenAPI / Swagger integration | [docs/06-openapi-swagger.md](./docs/06-openapi-swagger.md) |
| 07 | Docker Compose & PostgreSQL | [docs/07-docker-compose.md](./docs/07-docker-compose.md) |
| 08 | Many-to-many: todos × categories | [docs/08-many-to-many.md](./docs/08-many-to-many.md) |
| 09 | Models layer (schema↔app intermediary) | [docs/09-models-layer.md](./docs/09-models-layer.md) |

---

## 🧱 Tech Stack & Why

| Tool | Role | Why |
|---|---|---|
| **NestJS** | HTTP framework | Opinionated DI / module system; large teaching surface (decorators, guards, pipes, filters) |
| **Drizzle ORM** | TypeScript ORM | Type-safe, SQL-shaped API; generates real migrations; thin runtime |
| **Zod** | Validator | Same schema for runtime validation + TypeScript inference + OpenAPI |
| **nestjs-zod** | Glue | `createZodDto()` + Swagger patch so Zod schemas drive both DTOs and OpenAPI |
| **PostgreSQL** | Database | Standard relational DB; supports the M:N constraint patterns we want to teach |
| **drizzle-kit** | Migration toolkit | Generates SQL diffs from schema; keeps DB evolution under version control |
| **Docker Compose** | Local infra | Reproducible Postgres container without polluting host |

---

## 🏗 Project Structure (Layer-based + Models)

```
src/
├── main.ts                    # bootstrap + Swagger
├── app.module.ts              # root module wiring
├── config/                    # ConfigModule + Zod env validation
├── database/                  # Drizzle client provider + migration runner + migrations/
├── schemas/                   # Drizzle table definitions (DB schema)
├── models/                    # ★ Pure data shapes — intermediary between schema rows and the rest of the app
├── repositories/              # DB access; converts schema rows → models
├── services/                  # Business orchestration; speaks in models
├── controllers/               # HTTP entry; converts models ↔ DTOs
├── dto/                       # Zod-driven request/response DTOs
└── common/                    # Cross-cutting filters, etc.
```

**Why this layering** is explained in [docs/01-architecture.md](./docs/01-architecture.md). The unique part is the **models layer**, see [docs/09-models-layer.md](./docs/09-models-layer.md).

---

## 🚀 Quick Start

```bash
# 1. Install
nvm use            # Node 24
npm install

# 2. Env
cp .env.example .env

# 3. Start Postgres container (name: postgres-db)
npm run db:up

# 4. Generate + run migrations
npm run db:generate
npm run db:migrate

# 5. Start dev server
npm run start:dev
```

Then open:

- **API**: http://localhost:3000
- **Swagger**: http://localhost:3000/api/docs

---

## 🔧 npm Scripts

| Script | Purpose |
|---|---|
| `start:dev` | Run Nest in watch mode |
| `build` / `start:prod` | Compile to `dist/` and run |
| `lint` / `format` | ESLint / Prettier |
| `test` | Jest |
| `db:up` / `db:down` | Start / stop the `postgres-db` container |
| `db:generate` | Generate SQL migration from schema diff |
| `db:migrate` | Apply pending migrations |
| `db:studio` | Open Drizzle Studio |
| `db:drop` | Drop the latest migration file (teaching) |

---

## 🌐 API Overview

| Method | Path | Description |
|---|---|---|
| GET | `/todos` | List todos (`?categoryId=...&isCompleted=true|false`) |
| GET | `/todos/:id` | Single todo with categories |
| POST | `/todos` | Create todo (optionally `categoryIds: string[]`) |
| PATCH | `/todos/:id` | Update todo (omit `categoryIds` to keep, `[]` to clear) |
| DELETE | `/todos/:id` | Delete todo |
| GET | `/categories` | List categories |
| GET | `/categories/:id` | Single category |
| POST | `/categories` | Create category |
| PATCH | `/categories/:id` | Update category |
| DELETE | `/categories/:id` | Delete category (cascade removes M:N links) |

Full schema: see Swagger UI.

---

## 🗄 Data Model

```
todos                 todos_categories          categories
─────                 ────────────────          ──────────
id  (uuid, pk)        todo_id   (fk, cascade)   id  (uuid, pk)
title                 category_id (fk, cascade) name (unique)
description           PK(todo_id, category_id)  color
is_completed          created_at                created_at
due_date                                        updated_at
created_at
updated_at
```

Details in [docs/08-many-to-many.md](./docs/08-many-to-many.md).

---

## 🧯 Troubleshooting

- **Cannot connect to Postgres** → make sure `npm run db:up` finished and the `postgres-db` container is healthy (`docker ps`).
- **Migrations not applying** → run `npm run db:generate` after schema changes, then `npm run db:migrate`.
- **Swagger schema looks empty** → ensure `patchNestJsSwagger()` is called *before* `NestFactory.create()` in `main.ts`.
- **Validation errors return raw text** → confirm `ZodValidationPipe` is registered globally in `app.module.ts`.
