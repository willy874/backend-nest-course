> 🌏 **English** | [繁體中文](../zh-TW/08-many-to-many.md)

# 08 · Many-to-Many: todos × categories

## What you'll learn

- The three relational cardinalities: 1:1, 1:N, M:N
- Why M:N **must** use a join table — never an array column
- Foreign key cascade strategies — what happens to children when the parent is deleted
- Atomic write patterns (transaction) and update strategies (replace vs diff) for M:N
- When to add indexes or extra metadata to a join table

---

## Three cardinalities

| Cardinality | Example | How to model |
|---|---|---|
| **1:1** | user ↔ profile | Same table, or a unique FK in the child |
| **1:N** | user ↔ orders | FK on the "N side" pointing to the "1 side" |
| **M:N** | todos ↔ categories | **A dedicated join table** (this chapter's focus) |

---

## Why not an array column for M:N?

The naive idea: add `category_ids: uuid[]` on `todos`.

❌ Many problems:

| Problem | Why |
|---|---|
| **No referential integrity** | No FK; any nonexistent UUID can be inserted, the DB won't stop you |
| **Hard to query** | "All todos in category X" requires array operations, indexing is awkward |
| **Expensive updates** | Changing one link requires read-modify-write of the whole array |
| **Can't store metadata** | Want to record "when was this category attached"? Nowhere to put it |
| **Violates 1NF** | A column shouldn't be a "set" type |

✅ The right answer: **a dedicated join table** (a.k.a. junction / link / pivot table).

---

## This project's schema

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

### Design decision 1: composite PK `(todo_id, category_id)`

The PK does double duty:

1. **Uniqueness**: the same (todo, category) pair can never appear twice — DB enforces it; you don't have to check in app code.
2. **Default index**: PG automatically creates a B-tree index on the PK, so `WHERE todo_id = ? AND category_id = ?` is O(log n).

> ⚠️ **Common mistake**: using `id` as the PK and writing application-level uniqueness checks. **Let the DB enforce invariants** — it's faster and immune to race conditions.

### Design decision 2: `onDelete: 'cascade'`

```ts
todoId: uuid('todo_id').notNull().references(() => todos.id, { onDelete: 'cascade' }),
```

When a parent is deleted, what happens to the join row? Four choices:

| Behavior | Meaning | When to use |
|---|---|---|
| `cascade` | Delete with the parent | Join rows that have no meaning without both parents |
| `restrict` | Refuse to delete the parent | Force unlinking before deletion |
| `set null` | Set the FK to NULL on the join row | Only makes sense if the join is itself a 1:N child |
| `no action` | Default; behaves like restrict | Rarely chosen explicitly |

**Join tables for M:N usually want `cascade`** — orphaned join rows have no meaning.

> 💡 **Backend principle**: Push **data integrity** down to the DB rather than relying on app code. The DB is the last line of defense when application code has bugs.

---

## Drizzle definition (full)

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

Plus relations on both ends:

```ts
export const todosRelations = relations(todos, ({ many }) => ({
  todosCategories: many(todosCategories),
}));

export const todosCategoriesRelations = relations(todosCategories, ({ one }) => ({
  todo: one(todos, { fields: [todosCategories.todoId], references: [todos.id] }),
  category: one(categories, { fields: [todosCategories.categoryId], references: [categories.id] }),
}));
```

> ⚠️ **Once more**: `relations()` is for the Drizzle query builder; **it does NOT generate FK constraints**. Real FKs are in `.references()`, materialized by migration.

---

## Reading: eager-load relations

```ts
const row = await db.query.todos.findFirst({
  where: (t, { eq }) => eq(t.id, id),
  with: { todosCategories: { with: { category: true } } },
});
```

Drizzle compiles this to **one SQL** (LATERAL JOIN + JSON aggregation), not N+1. The repository then flattens the nested shape onto the model:

```ts
const categories = row.todosCategories.map((tc) => CategoryModel.fromRow(tc.category));
return TodoModel.fromRow(row, categories);
```

---

## Writing: atomic transaction

Creating / updating touches two tables — wrap in a transaction or you'll leave inconsistent state if the join insert fails.

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

Any throw → full rollback. That's the **A** in ACID.

---

## Update: replace vs diff

When a client sends `categoryIds: ['A', 'B', 'D']` and DB currently has `['A', 'C']`, you have two strategies.

### Replace (this project)

```ts
await tx.delete(todosCategories).where(eq(todosCategories.todoId, id));
if (categoryIds.length > 0) {
  await tx.insert(todosCategories).values(...);
}
```

- ✅ Short, easy to reason about, always correct
- ❌ Extra delete + insert (even 'A' that didn't change is rewritten)
- ❌ If the join row had metadata (like `created_at`), it gets reset

### Diff

```ts
const existing = await tx.select().from(todosCategories).where(eq(todosCategories.todoId, id));
const existingIds = new Set(existing.map((r) => r.categoryId));
const newIds = new Set(categoryIds);

const toAdd = [...newIds].filter((x) => !existingIds.has(x));     // ['B', 'D']
const toRemove = [...existingIds].filter((x) => !newIds.has(x));  // ['C']

if (toRemove.length) await tx.delete(...).where(...inArray...);
if (toAdd.length) await tx.insert(...).values(...);
```

- ✅ Only changes the rows that actually differ; preserves metadata
- ✅ Better under high write load
- ❌ More code

> 💡 **Choosing**: default to replace (simple). Switch to diff when join rows carry **important metadata** (e.g. `assigned_at`, `assigned_by`) or writes are very frequent.

---

## When does the join table need extra columns?

The teaching project's join table has only `created_at`, but production schemas often add metadata:

```ts
todosCategories: {
  todoId, categoryId, primaryKey,
  addedBy: uuid('added_by').references(() => users.id),
  addedAt: timestamp('added_at').defaultNow(),
  source: text('source'),    // manual / import / api
}
```

The join table becomes a **first-class entity** when:

- The relation itself has business meaning (e.g. "user joined group with role admin/member")
- You need provenance: who, when, and why the link exists
- The relation can change (e.g. a user is upgraded from member to admin)

At that point you typically also give the join row a surrogate UUID PK and rewrite `relations()` accordingly.

---

## API conventions

| Operation | Body | Result |
|---|---|---|
| `POST /todos` | with `categoryIds: ['A','B']` | Create todo + 2 join rows |
| `POST /todos` | no `categoryIds` | Create todo, no links |
| `PATCH /todos/:id` | **omit** `categoryIds` | Links **unchanged** |
| `PATCH /todos/:id` | `categoryIds: []` | Clear all links |
| `PATCH /todos/:id` | `categoryIds: ['X']` | Replace with `['X']` |
| `GET /todos?categoryId=X` | — | Filter to todos containing X |

> 💡 **API design tip**: **"omitted" and "empty array" must mean different things**. Zod's `.optional()` lets you distinguish "not sent" (undefined) from "sent as empty" (`[]`).

---

## Indexing strategy

The composite PK `(todo_id, category_id)` is already a B-tree index, so "given a todoId, find its categories" is fast.

But the reverse — "given a categoryId, find its todos"? A B-tree on `(A, B)` does **not** help queries that only filter on `B`.

**Production usually adds a reverse index:**

```sql
CREATE INDEX idx_todos_categories_category ON todos_categories (category_id);
```

We don't add it in the teaching project (data is tiny), but **real systems must measure with `EXPLAIN ANALYZE` and decide indexes from query patterns**.

---

## Recap

- M:N requires a **join table**, never an array column.
- Use a **composite PK** for both uniqueness and indexing.
- `onDelete: 'cascade'` pushes data-integrity invariants to the DB.
- Wrap multi-table writes in a **transaction** for atomicity.
- Update with **replace** by default; switch to **diff** when join metadata matters.
- Promote the join table to a first-class entity when the relation carries semantics.
- Real systems add **reverse indexes** based on actual query patterns.
