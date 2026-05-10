> 🌏 [English](./08-many-to-many.md) | **繁體中文**

# 08 · 多對多: todos × categories

## 你會學到

- 關聯式資料庫的三種基數(cardinality):1:1、1:N、M:N
- 為什麼 M:N **必須**用 join table,不能用陣列欄位
- Foreign Key 的 cascade 策略 — 刪除父層時子層該怎麼辦
- M:N 寫入的 atomic 模式(transaction)與更新策略(replace vs diff)
- 何時該為 join table 加 index、加額外欄位

---

## 三種關聯基數

| 基數 | 例子 | 怎麼建模 |
|---|---|---|
| **1:1** | user ↔ profile | 同一張表,或在子表加 unique FK |
| **1:N** | user ↔ orders | 在「N 那邊」加 FK 指向「1 那邊」 |
| **M:N** | todos ↔ categories | **獨立的 join table**(本章重點) |

---

## 為什麼 M:N 不能用陣列欄位?

直覺寫法:在 `todos` 表加一個 `category_ids: uuid[]` 欄位。

❌ 問題很多:

| 問題 | 為什麼 |
|---|---|
| **無法保證 referential integrity** | 沒有 FK,可以塞進不存在的 categoryId,DB 不擋你 |
| **查詢困難** | 「哪些 todo 屬於 category X」要 array operation,索引難建 |
| **更新代價高** | 改一個關聯要 read-modify-write 整個陣列 |
| **無法保留 metadata** | 想記錄「何時被加上這個 category」就沒地方放了 |
| **違反第一正規化(1NF)** | 欄位不該是「集合」型別 |

✅ 正解:**獨立的 join table**(也叫 junction / link / pivot table)。

---

## 本專案的 Schema

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

### 設計重點 1:複合主鍵 `(todo_id, category_id)`

這個 PK 同時做兩件事:

1. **唯一性**:同一個 (todo, category) 組合不可能重複出現 — DB 直接擋,你不必在應用層檢查。
2. **預設索引**:PostgreSQL 會自動為 PK 建 B-tree 索引,所以 `WHERE todo_id = ? AND category_id = ?` 是 O(log n)。

> ⚠️ **常見錯誤**:用 `id` 當 PK,然後在應用層自己檢查 unique。**讓 DB 替你做 invariant check**,效能更好,也消除 race condition 漏洞。

### 設計重點 2:`onDelete: 'cascade'`

```ts
todoId: uuid('todo_id').notNull().references(() => todos.id, { onDelete: 'cascade' }),
```

「父層被刪時,join row 怎麼辦?」共有四種選擇:

| 行為 | 意義 | 用在哪 |
|---|---|---|
| `cascade` | 一起刪 | 「無父無意義」的 join row |
| `restrict` | 拒絕刪除父 | 想強制先 unlink 才能刪父 |
| `set null` | join row 的 FK 變 NULL | join 表本身是 1:N 的子表 |
| `no action` | 預設,類似 restrict | 一般不主動選 |

**M:N 的 join table 通常選 `cascade`** — 因為 join row 沒了任何一邊都沒意義。

> 💡 **後端工程觀念**:把「資料一致性」交給 DB 做,而不是應用層。應用層 buggy 的時候,DB 是最後防線。

---

## Drizzle 定義(完整版)

```ts
// src/schemas/todos-categories.schema.ts
export const todosCategories = pgTable(
  'todos_categories',
  {
    todoId: uuid('todo_id').notNull().references(() => todos.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.todoId, t.categoryId] }) }),
);
```

並在兩端宣告 relations:

```ts
export const todosRelations = relations(todos, ({ many }) => ({
  todosCategories: many(todosCategories),
}));

export const todosCategoriesRelations = relations(todosCategories, ({ one }) => ({
  todo: one(todos, { fields: [todosCategories.todoId], references: [todos.id] }),
  category: one(categories, { fields: [todosCategories.categoryId], references: [categories.id] }),
}));
```

> ⚠️ **再強調一次**:`relations()` 是給 Drizzle query builder 看的,**不會**產 FK constraint。真正的 FK 是 `.references()` 在 migration 中建立。

---

## 讀取:eager load 關聯

```ts
const row = await db.query.todos.findFirst({
  where: (t, { eq }) => eq(t.id, id),
  with: { todosCategories: { with: { category: true } } },
});
```

底層 Drizzle 編譯成**單一 SQL** (LATERAL JOIN + JSON aggregation),不是 N+1。然後 repository 把巢狀結構扁平化成 model 上的 `categories` 陣列:

```ts
const categories = row.todosCategories.map((tc) => CategoryModel.fromRow(tc.category));
return TodoModel.fromRow(row, categories);
```

---

## 寫入:Atomic Transaction

新增 / 更新會動到兩張表 — 必須包 transaction,否則「todos 寫入成功但 join 寫入失敗」會留下不一致狀態。

```ts
return this.db.transaction(async (tx) => {
  const [row] = await tx.insert(todos).values({...}).returning();
  if (categoryIds.length > 0) {
    await tx.insert(todosCategories).values(
      categoryIds.map((categoryId) => ({ todoId: row.id, categoryId })),
    );
  }
  return row.id;
});
```

任何一步 throw → 全部 rollback。這就是 ACID 的 **Atomicity**。

---

## 更新:Replace vs Diff 兩種策略

當 client 傳新的 `categoryIds: ['A', 'B', 'D']`,而 DB 現有 `['A', 'C']`,有兩種寫法:

### Replace 策略(本專案採用)

```ts
await tx.delete(todosCategories).where(eq(todosCategories.todoId, id));
if (categoryIds.length > 0) {
  await tx.insert(todosCategories).values(...);
}
```

- ✅ 程式碼短、容易理解、結果一定對
- ❌ 多餘的 delete + insert(本來就在的 'A' 也被砍掉重建)
- ❌ 如果 join row 上有 metadata(如 `created_at`)會被重置

### Diff 策略

```ts
const existing = await tx.select().from(todosCategories).where(eq(todosCategories.todoId, id));
const existingIds = new Set(existing.map((r) => r.categoryId));
const newIds = new Set(categoryIds);

const toAdd = [...newIds].filter((x) => !existingIds.has(x));     // ['B', 'D']
const toRemove = [...existingIds].filter((x) => !newIds.has(x));  // ['C']

if (toRemove.length) await tx.delete(...).where(...inArray...);
if (toAdd.length) await tx.insert(...).values(...);
```

- ✅ 只動真正改變的 row,保留 metadata
- ✅ 高頻寫入時效能更好
- ❌ 程式碼複雜

> 💡 **選擇建議**:預設用 replace(簡單)。當 join row 上**有重要的 metadata**(例如「assigned_at」、「assigned_by」)或**寫入超頻繁**時,改用 diff。

---

## 何時該為 join table 加額外欄位?

教學專案的 join table 只有 `created_at`,但實務上常加更多 metadata:

```ts
todosCategories: {
  todoId, categoryId, primaryKey,
  addedBy: uuid('added_by').references(() => users.id),  // 誰加的
  addedAt: timestamp('added_at').defaultNow(),           // 什麼時候
  source: text('source'),                                // 從哪裡來(manual / import / api)
}
```

**join table 升格為一等公民實體**的時機:

- 關聯本身有業務語意(例如「user 加入 group 的角色 = admin/member」)
- 要追溯「誰、何時、為何」建立關聯
- 關聯本身會變更(例如 user 從 member 升 admin)

這時 `relations()` 也要改寫,通常給 join row 一個獨立的 surrogate id(uuid)。

---

## API 慣例

| 操作 | Body | 結果 |
|---|---|---|
| `POST /todos` | 含 `categoryIds: ['A','B']` | 建立 todo + 兩筆 join |
| `POST /todos` | 不含 `categoryIds` | 建立 todo,無關聯 |
| `PATCH /todos/:id` | **省略** `categoryIds` | 關聯**不變** |
| `PATCH /todos/:id` | `categoryIds: []` | 清空所有關聯 |
| `PATCH /todos/:id` | `categoryIds: ['X']` | 替換為 `['X']` |
| `GET /todos?categoryId=X` | — | 過濾出含此 category 的 todo |

> 💡 **API 設計提示**:**「省略」與「傳空陣列」要有不同語意**。Zod 的 `.optional()` 讓你能區分「沒給」(undefined)與「給了空陣列」(`[]`)。

---

## 索引策略補充

複合 PK `(todo_id, category_id)` 已經是個 B-tree 索引,**所以「給定 todoId 找 categories」很快**。

但反方向「給定 categoryId 找 todos」呢?B-tree 是有方向性的,`(A, B)` 索引對「只查 B」沒幫助。

**production 通常會額外建一個反向索引**:

```sql
CREATE INDEX idx_todos_categories_category ON todos_categories (category_id);
```

教學專案因為資料量小沒做,但**真實系統一定要量測查詢計畫(`EXPLAIN ANALYZE`)再決定加哪些索引**。

---

## Recap

- M:N 必用 **join table**,不要用陣列欄位。
- 用**複合 PK** 同時做唯一性與索引。
- `onDelete: 'cascade'` 把資料一致性交給 DB。
- 寫入用 **transaction**,確保 atomicity。
- 更新預設用 **replace** 策略,需要保留 metadata 時改用 **diff**。
- Join table 有業務語意時可升格為一等實體,加 metadata。
- 真實系統要根據查詢模式**加反向索引**。
