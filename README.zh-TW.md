> 🌏 Languages: [English](./README.md) | **繁體中文**

# Backend Nest Course — Todo API

一個教學用的後端專案，帶你走過實務級後端的整套輪廓:

- **Node.js 24** runtime
- **NestJS 11** framework
- **Drizzle ORM**(PostgreSQL)
- **Zod** 執行期驗證
- **OpenAPI / Swagger** 自動產生 API 文件
- **Docker Compose** 啟動本地 PostgreSQL
- **drizzle-kit** 管理 schema migration

主題是一個小型的 **Todo list**,並與 **Categories** 建立**多對多**關聯。

---

## 📚 學習地圖

README 是高層次導覽,深入內容放在 [`docs/`](./docs):

| # | 主題 | 檔案 |
|---|---|---|
| 01 | 架構與分層設計 | [docs/01-architecture.zh-TW.md](./docs/01-architecture.zh-TW.md) |
| 02 | NestJS 基礎(Module / Controller / Service / DI) | [docs/02-nestjs-basics.zh-TW.md](./docs/02-nestjs-basics.zh-TW.md) |
| 03 | Drizzle ORM(schema、query、relations) | [docs/03-drizzle-orm.zh-TW.md](./docs/03-drizzle-orm.zh-TW.md) |
| 04 | drizzle-kit 的 migration 流程 | [docs/04-migrations.zh-TW.md](./docs/04-migrations.zh-TW.md) |
| 05 | Zod 驗證 + nestjs-zod | [docs/05-zod-validation.zh-TW.md](./docs/05-zod-validation.zh-TW.md) |
| 06 | OpenAPI / Swagger 整合 | [docs/06-openapi-swagger.zh-TW.md](./docs/06-openapi-swagger.zh-TW.md) |
| 07 | Docker Compose 與 PostgreSQL | [docs/07-docker-compose.zh-TW.md](./docs/07-docker-compose.zh-TW.md) |
| 08 | 多對多: todos × categories | [docs/08-many-to-many.zh-TW.md](./docs/08-many-to-many.zh-TW.md) |
| 09 | Models layer(schema↔app 中介層) | [docs/09-models-layer.zh-TW.md](./docs/09-models-layer.zh-TW.md) |

---

## 🧱 技術選型與理由

| 工具 | 角色 | 為什麼選 |
|---|---|---|
| **NestJS** | HTTP framework | 模組與 DI 設計鮮明,教學素材豐富(decorators、guards、pipes、filters) |
| **Drizzle ORM** | TypeScript ORM | 型別安全、貼近 SQL、產出真正的 migration、執行期負擔小 |
| **Zod** | 驗證器 | 同一份 schema 同時支援執行期驗證、TS 型別、OpenAPI |
| **nestjs-zod** | 黏合層 | `createZodDto()` + Swagger patch,讓 Zod 同時驅動 DTO 與 OpenAPI |
| **PostgreSQL** | 資料庫 | 標準關聯式 DB,適合教 M:N 等關聯模式 |
| **drizzle-kit** | Migration 工具 | 從 schema 生成 SQL diff,把 DB 演進納入版本控管 |
| **Docker Compose** | 本地基礎設施 | 不污染本機環境就能跑 Postgres |

---

## 🏗 專案結構(Layer-based + Models)

```
src/
├── main.ts                    # bootstrap + Swagger
├── app.module.ts              # 根模組組裝
├── config/                    # ConfigModule + Zod 驗證 env
├── database/                  # Drizzle client provider + migration runner + migrations/
├── schemas/                   # Drizzle table 定義(DB schema)
├── models/                    # ★ 純資料形狀 — schema row 與其他層的中介
├── repositories/              # DB 存取;將 schema row 轉換為 model
├── services/                  # 業務編排;以 model 為語言
├── controllers/               # HTTP 入口;model ↔ DTO 互轉
├── dto/                       # 由 Zod 驅動的 request / response DTO
└── common/                    # 過濾器等 cross-cutting
```

**為什麼這樣分層** 在 [docs/01-architecture.zh-TW.md](./docs/01-architecture.zh-TW.md)。本專案最特別的是 **models layer**,詳見 [docs/09-models-layer.zh-TW.md](./docs/09-models-layer.zh-TW.md)。

---

## 🚀 快速開始

```bash
# 1. 安裝
nvm use            # Node 24
npm install

# 2. 環境變數
cp .env.example .env

# 3. 啟動 Postgres 容器(name: postgres-db)
npm run db:up

# 4. 產生並執行 migration
npm run db:generate
npm run db:migrate

# 5. 啟動開發伺服器
npm run start:dev
```

開啟:

- **API**: http://localhost:3000
- **Swagger**: http://localhost:3000/api/docs

---

## 🔧 npm Scripts

| Script | 用途 |
|---|---|
| `start:dev` | 以 watch 模式啟動 Nest |
| `build` / `start:prod` | 編譯到 `dist/` 並執行 |
| `lint` / `format` | ESLint / Prettier |
| `test` | Jest |
| `db:up` / `db:down` | 啟動 / 關閉 `postgres-db` 容器 |
| `db:generate` | 比對 schema 變更並產生 SQL migration |
| `db:migrate` | 套用未執行的 migration |
| `db:studio` | 開啟 Drizzle Studio |
| `db:drop` | 刪除最後一筆 migration 檔(教學用) |

---

## 🌐 API 概覽

| Method | Path | 說明 |
|---|---|---|
| GET | `/todos` | 列表(`?categoryId=...&isCompleted=true|false`) |
| GET | `/todos/:id` | 單筆 todo(含 categories) |
| POST | `/todos` | 建立 todo(可選 `categoryIds: string[]`) |
| PATCH | `/todos/:id` | 更新(省略 `categoryIds` = 保留;傳 `[]` = 清空) |
| DELETE | `/todos/:id` | 刪除 todo |
| GET | `/categories` | 列表 |
| GET | `/categories/:id` | 單筆 |
| POST | `/categories` | 建立 |
| PATCH | `/categories/:id` | 更新 |
| DELETE | `/categories/:id` | 刪除(cascade 移除 M:N 關聯) |

完整 schema 見 Swagger UI。

---

## 🗄 資料模型

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

詳見 [docs/08-many-to-many.zh-TW.md](./docs/08-many-to-many.zh-TW.md)。

---

## 🧯 疑難排解

- **無法連線 Postgres** → 先確認 `npm run db:up` 完成且 `postgres-db` 容器健康(`docker ps`)。
- **Migration 沒套用** → 改完 schema 要先 `npm run db:generate`,再 `npm run db:migrate`。
- **Swagger schema 是空的** → 確認 `patchNestJsSwagger()` 在 `NestFactory.create()` *之前* 呼叫(`main.ts`)。
- **驗證錯誤回傳純文字** → 確認 `ZodValidationPipe` 在 `app.module.ts` 以全域 pipe 註冊。
