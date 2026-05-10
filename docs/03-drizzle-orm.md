> 🌏 [English](./03-drizzle-orm.md) | [繁體中文](./03-drizzle-orm.zh-TW.md)

# 03 · Drizzle ORM

Drizzle is a thin, type-safe SQL builder. It does **not** hide SQL — it shapes your TypeScript code to mirror SQL.

## Defining a Table

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

The first argument is the **DB column name**, and the property key is the **TS field name**. Drizzle handles the mapping.

## Relations (for `db.query.*`)

`relations()` is metadata used by the **relational query builder** (`db.query.todos.findMany({ with: { ... } })`). It does **not** create foreign keys — those live on the columns via `.references()`.

```ts
export const todosCategoriesRelations = relations(todosCategories, ({ one }) => ({
  todo: one(todos, { fields: [todosCategories.todoId], references: [todos.id] }),
  category: one(categories, { fields: [todosCategories.categoryId], references: [categories.id] }),
}));
```

## Two Query Styles

### 1. SQL-style builder

```ts
const rows = await db.select().from(todos).where(eq(todos.id, id));
```

Closer to SQL. Use when you want explicit control.

### 2. Relational query builder (`db.query.*`)

```ts
const row = await db.query.todos.findFirst({
  where: (t, { eq }) => eq(t.id, id),
  with: { todosCategories: { with: { category: true } } },
});
```

Eager-loads related rows in a structured shape. Used in `TodosRepository.findById`.

## Transactions

```ts
return this.db.transaction(async (tx) => {
  const [row] = await tx.insert(todos).values({...}).returning();
  await tx.insert(todosCategories).values(...);
  return row.id;
});
```

`tx` mirrors the `db` API. The whole block rolls back on throw.

## Type Inference

`InferSelectModel<typeof todos>` gives you the row type. We use this in the **models layer** (see [docs/09](./09-models-layer.md)).

```ts
type TodoRow = InferSelectModel<typeof todos>;
```
