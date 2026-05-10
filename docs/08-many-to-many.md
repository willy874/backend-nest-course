> 🌏 [English](./08-many-to-many.md) | [繁體中文](./08-many-to-many.zh-TW.md)

# 08 · Many-to-Many: todos × categories

A todo can have multiple categories; a category can apply to multiple todos. The standard way to model this in a relational DB is a **join table**.

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

Key choices:

- **Composite primary key** `(todo_id, category_id)` — prevents duplicate links automatically.
- **`onDelete: 'cascade'`** on both FKs — deleting a todo or category cleans up its links.
- **Drizzle `relations()`** — declares the many-to-many shape so `db.query.*` can eager-load it.

## Drizzle Definition

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

Plus relations on both sides:

```ts
export const todosRelations = relations(todos, ({ many }) => ({
  todosCategories: many(todosCategories),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  todosCategories: many(todosCategories),
}));
```

## Reading Todos with Categories

The relational query builder traverses the join table for us:

```ts
const row = await db.query.todos.findFirst({
  where: (t, { eq }) => eq(t.id, id),
  with: { todosCategories: { with: { category: true } } },
});
```

We then flatten in the repository:

```ts
const categories = row.todosCategories.map((tc) => CategoryModel.fromRow(tc.category));
return TodoModel.fromRow(row, categories);
```

## Writing Links Atomically

Creating / updating must change two tables together — wrap in a transaction:

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

For updates, the simplest correct strategy is **delete-then-insert** the join rows:

```ts
await tx.delete(todosCategories).where(eq(todosCategories.todoId, id));
if (categoryIds.length > 0) {
  await tx.insert(todosCategories).values(...);
}
```

For higher-throughput cases you'd diff existing vs new sets and only modify the delta — but the simple version is easier to reason about.

## API Conventions

- `POST /todos` accepts `categoryIds: string[]` (optional, defaults to `[]`).
- `PATCH /todos/:id`:
  - **Omit** `categoryIds` → keep current links unchanged.
  - **Pass `[]`** → clear all links.
  - **Pass non-empty array** → replace with this set.
- `GET /todos?categoryId=<uuid>` filters todos that have the category.
