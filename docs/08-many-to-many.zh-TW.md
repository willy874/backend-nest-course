> 🌏 [English](./08-many-to-many.md) | **繁體中文**

# 08 · 多對多: todos × categories

一個 todo 可以掛多個 category;一個 category 可以套用到多個 todo。在關聯式資料庫中,標準作法是建一張 **join table**。

## Schema

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

設計選擇:

- **複合主鍵** `(todo_id, category_id)` — 自動防止重複關聯。
- **`onDelete: 'cascade'`** 在兩個 FK 上 — 刪除 todo 或 category 時自動清掉關聯。
- **Drizzle `relations()`** — 宣告 M:N 形狀,`db.query.*` 才能 eager load。

## Drizzle 定義

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

export const categoriesRelations = relations(categories, ({ many }) => ({
  todosCategories: many(todosCategories),
}));
```

## 讀取 Todo 同時載入 Categories

關聯查詢 builder 會替我們穿越 join table:

```ts
const row = await db.query.todos.findFirst({
  where: (t, { eq }) => eq(t.id, id),
  with: { todosCategories: { with: { category: true } } },
});
```

repository 接著扁平化:

```ts
const categories = row.todosCategories.map((tc) => CategoryModel.fromRow(tc.category));
return TodoModel.fromRow(row, categories);
```

## 寫入時的 Atomic 操作

新增 / 更新會同時動到兩張表 — 用 transaction:

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

更新時最簡單可靠的策略是 **delete-then-insert** join 列:

```ts
await tx.delete(todosCategories).where(eq(todosCategories.todoId, id));
if (categoryIds.length > 0) {
  await tx.insert(todosCategories).values(...);
}
```

需要更高吞吐量時可以做 set diff 只動差異 — 但簡單版本好理解,先學這個。

## API 慣例

- `POST /todos` 接受 `categoryIds: string[]`(可選,預設 `[]`)。
- `PATCH /todos/:id`:
  - **省略** `categoryIds` → 維持原狀。
  - **傳 `[]`** → 清空所有關聯。
  - **傳非空陣列** → 用此集合取代。
- `GET /todos?categoryId=<uuid>` 過濾出有此 category 的 todo。
