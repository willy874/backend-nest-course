> 🌏 [English](./03-drizzle-orm.md) | **繁體中文**

# 03 · Drizzle ORM

Drizzle 是一個輕量、型別安全的 SQL builder。它**不**隱藏 SQL — 而是讓你的 TypeScript 程式碼貼近 SQL 的形狀。

## 定義 Table

```ts
// src/schemas/todos.schema.ts
export const todos = pgTable('todos', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  isCompleted: boolean('is_completed').notNull().default(false),
  dueDate: timestamp('due_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

第一個參數是 **DB 欄位名稱**,property key 是 **TS 欄位名稱**,Drizzle 處理對映。

## Relations(供 `db.query.*` 使用)

`relations()` 是給**關聯查詢 builder**(`db.query.todos.findMany({ with: { ... } })`)用的中介資訊。它**不會**建立 foreign key — FK 是寫在欄位上的 `.references()`。

```ts
export const todosCategoriesRelations = relations(todosCategories, ({ one }) => ({
  todo: one(todos, { fields: [todosCategories.todoId], references: [todos.id] }),
  category: one(categories, { fields: [todosCategories.categoryId], references: [categories.id] }),
}));
```

## 兩種查詢風格

### 1. SQL-style builder

```ts
const rows = await db.select().from(todos).where(eq(todos.id, id));
```

更貼近 SQL,適合需要明確控制時。

### 2. 關聯查詢 builder(`db.query.*`)

```ts
const row = await db.query.todos.findFirst({
  where: (t, { eq }) => eq(t.id, id),
  with: { todosCategories: { with: { category: true } } },
});
```

可以用結構化方式 eager load 關聯資料,本專案 `TodosRepository.findById` 採用此風格。

## Transactions

```ts
return this.db.transaction(async (tx) => {
  const [row] = await tx.insert(todos).values({...}).returning();
  await tx.insert(todosCategories).values(...);
  return row.id;
});
```

`tx` API 與 `db` 一樣,整個區塊在 throw 時自動 rollback。

## 型別推導

`InferSelectModel<typeof todos>` 取得 row 型別。本專案的 **models layer** 用得到(見 [docs/09](./09-models-layer.zh-TW.md))。

```ts
type TodoRow = InferSelectModel<typeof todos>;
```
