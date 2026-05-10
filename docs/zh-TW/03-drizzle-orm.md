> 🌏 [English](../en-US/03-drizzle-orm.md) | **繁體中文**

# 03 · Drizzle ORM

## 你會學到

- ORM、Query Builder、Raw SQL 三者的差異與選擇時機
- Drizzle 的兩種查詢風格,以及它們在效能與可讀性上的取捨
- N+1 查詢問題 — 後端最常見也最致命的效能陷阱
- Transaction 的 ACID 保證與在 Drizzle 中的使用
- 為什麼 `relations()` 不會建立 foreign key

---

## ORM 是什麼?要不要用?

「ORM」(Object-Relational Mapping)是一個範圍很廣的概念,實務上可以細分:

| 工具類型 | 代表 | 你寫什麼 | 優點 | 缺點 |
|---|---|---|---|---|
| **Heavy ORM** | Prisma、TypeORM、Sequelize | 物件操作 | 開發快、不必懂太多 SQL | 黑魔法多、效能難控、跑出複雜 SQL 你看不懂 |
| **Query Builder** | Drizzle、Knex、Kysely | 接近 SQL 的 API | 型別安全、SQL 預期得到、效能可控 | 要懂 SQL |
| **Raw SQL** | `pg.query('SELECT...')` | 純 SQL | 完全掌控 | 沒型別、易出錯、難重構 |

> 💡 **後端工程觀念**:成熟的後端工程師應該**會 SQL**。ORM 只是輔助工具,當你不懂 SQL 時,ORM 出問題你完全沒辦法 debug(俗稱「ORM 地獄」)。Drizzle 的設計哲學是:**你寫的 TypeScript 看起來就應該像它執行的 SQL**。

---

## 定義一張 Table

```ts
export const todos = pgTable('todos', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  isCompleted: boolean('is_completed').notNull().default(false),
  dueDate: timestamp('due_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

幾個值得注意的後端慣例:

### 為何用 UUID 而非自增 INT 當 PK?

| | INT 自增 | UUID |
|---|---|---|
| 體積 | 4-8 byte | 16 byte |
| 可預測 | ✅(`/users/123` 容易枚舉)| ❌(安全) |
| 跨服務唯一 | ❌ | ✅ |
| 可在 client 先生成 | ❌ | ✅(離線、optimistic UI) |
| 索引效能 | 較好 | 略差(可用 UUIDv7 改善) |

教學專案用 UUID 是為了示範現代分散式系統的常見選擇。

### 為何時間戳要 `withTimezone`?

PostgreSQL 的 `timestamp` 與 `timestamptz` 是**完全不同的型別**。

- `timestamp`:存 wall-clock,不知道時區。「2026-01-01 10:00」— 哪裡的 10 點?
- `timestamptz`:存 UTC 內部,客戶端讀取時轉換時區。**永遠用這個**。

> ⚠️ **真實事故**:某團隊把 `created_at` 用 `timestamp` 存,跨時區同事的時間互相打架,排序錯亂。修一次 migration 痛苦三天。**從第一行 schema 起就用 `timestamptz`**。

### `notNull()` 不是廢話

PostgreSQL 預設欄位**可以是 NULL**。`NULL` 在 SQL 中行為詭異(`NULL = NULL` 結果是 `NULL` 不是 `true`),會誤判很多查詢。**能 not null 就 not null**。

---

## Relations:給關聯查詢用的中介資料

```ts
export const todosCategoriesRelations = relations(todosCategories, ({ one }) => ({
  todo: one(todos, { fields: [todosCategories.todoId], references: [todos.id] }),
  category: one(categories, { fields: [todosCategories.categoryId], references: [categories.id] }),
}));
```

> ⚠️ **常見誤解**:`relations()` **不會**建立 foreign key constraint!FK 是寫在欄位上的 `.references()`(會被 migration 寫進 SQL)。

`relations()` 只是給 Drizzle 的關聯查詢 builder(`db.query.*`)看的「路標」,告訴它「從這張表怎麼跳到那張表」。

---

## 兩種查詢風格

### 1. SQL-style builder

```ts
const rows = await db
  .select()
  .from(todos)
  .where(and(eq(todos.isCompleted, false), gt(todos.dueDate, new Date())))
  .orderBy(desc(todos.createdAt))
  .limit(20);
```

特性:

- 跟 SQL 幾乎 1:1 對應 — 你想得到什麼 SQL,就寫什麼程式碼。
- 完全可控的查詢計畫,適合**效能敏感**的路徑。
- 不會自動 join 關聯,需要手動 `.leftJoin()`。

### 2. 關聯查詢 builder(`db.query.*`)

```ts
const row = await db.query.todos.findFirst({
  where: (t, { eq }) => eq(t.id, id),
  with: { todosCategories: { with: { category: true } } },
});
```

特性:

- 可以**結構化** eager-load 關聯,輸出直接是 nested object。
- 底層會被 Drizzle 編譯成「**單一 SQL**」(用 LATERAL JOIN + JSON aggregation),**不是**一筆筆查 — 這就避免了 N+1 問題。
- 開發體驗好,適合一般 CRUD。

> 💡 **實務選擇**:CRUD 用 `db.query.*`,需要極致效能或複雜聚合用 SQL builder,**不要害怕在同一個 repository 裡兩種混用**。

---

## N+1 查詢:後端最致命的效能陷阱

新手常寫:

```ts
// ❌ 災難
const todos = await db.select().from(todos);   // 1 query
for (const todo of todos) {
  todo.categories = await db.select()...
    .where(eq(todosCategories.todoId, todo.id));  // N queries!
}
```

100 筆 todos 就跑 101 次 query。1000 筆就 1001 次。**正式環境上線當天會被 DBA 抓過去談話**。

正確做法是用單一 query 同時撈 todos 與其 categories(用 join 或 aggregation),這就是 `db.query.*` 的 `with` 在底層做的事。

> ⚠️ **永遠**檢查 ORM 產出的實際 SQL。Drizzle 可以開 `logger: true` 觀察。

---

## Transactions 與 ACID

當一個業務動作要動到**多個表**(本專案的「建立 todo + 寫 join 表」就是),必須用 transaction:

```ts
return this.db.transaction(async (tx) => {
  const [row] = await tx.insert(todos).values({...}).returning();
  await tx.insert(todosCategories).values(...);
  return row.id;
});
```

Transaction 提供 **ACID** 保證:

| | 意義 |
|---|---|
| **A**tomicity | 全部成功 or 全部失敗,沒有「成功一半」這種狀態 |
| **C**onsistency | 結束後 DB 仍滿足所有 constraint(FK、unique、check) |
| **I**solation | 並行的 transaction 互不打擾 — 你的中間狀態別人看不見 |
| **D**urability | 一旦 commit,就算服務馬上掛,資料也保留 |

Drizzle 的 `tx` 是 `db` 的 superset — 同樣的 API,但綁在這個交易內。**Throw 任何 error 自動 rollback**。

### Isolation Level 補充

PostgreSQL 預設是 `READ COMMITTED`。常見場景:

- 銀行轉帳、庫存扣減 → `SERIALIZABLE`(最嚴格,可能會被 retry)
- 一般 CRUD → 預設足夠

```ts
await db.transaction(async (tx) => { ... }, { isolationLevel: 'serializable' });
```

---

## 型別推導:同一份 schema 的雙重身份

```ts
type TodoRow = InferSelectModel<typeof todos>;        // 查出來的型別
type TodoInsert = InferInsertModel<typeof todos>;     // 寫入時要傳的型別
```

**寫入型別** vs **讀取型別**不一樣 — 例如 `createdAt` 在讀取時是 `Date`,但寫入時可省略(DB 會給 default)。Drizzle 都幫你算好。

本專案的 `models/` 層用 `InferSelectModel` 把 row 型別「正規化」成 `TodoModel`,見 [docs/09](./09-models-layer.md)。

---

## Recap

- ORM 是工具,**SQL 是基本功**。Drizzle 的價值是 SQL-shaped 的 TypeScript。
- `db.select()` 適合精細控制,`db.query.*` 適合 nested eager-load。
- **N+1 是後端最常見的效能殺手**,永遠檢查實際 SQL。
- 多表寫入一律用 transaction,理解 ACID。
- 用 `InferSelectModel` 共享型別,別到處重新定義。
