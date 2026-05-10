> 🌏 **English** | [繁體中文](./03-drizzle-orm.zh-TW.md)

# 03 · Drizzle ORM

## What you'll learn

- The difference between ORMs, query builders, and raw SQL — and when to choose what
- Drizzle's two query styles and their performance / readability trade-offs
- The N+1 query problem — the most common (and lethal) backend performance trap
- How transactions provide ACID guarantees, and how to use them in Drizzle
- Why `relations()` does NOT create foreign keys

---

## "ORM" is a spectrum

| Tool type | Examples | What you write | Pros | Cons |
|---|---|---|---|---|
| **Heavy ORM** | Prisma, TypeORM, Sequelize | Object operations | Fast iteration, less SQL needed | Lots of magic, hard to control SQL output, debugging hell when it goes wrong |
| **Query Builder** | Drizzle, Knex, Kysely | SQL-shaped APIs | Type-safe, predictable SQL, controllable performance | You need to know SQL |
| **Raw SQL** | `pg.query('SELECT...')` | Pure SQL | Total control | No types, error-prone, hard to refactor |

> 💡 **Backend concept**: A senior backend engineer **knows SQL**. ORMs are a tool; when one misbehaves, you can't debug it without understanding the SQL it generates. Drizzle's design philosophy is: **your TypeScript should look like the SQL it runs**.

---

## Defining a table

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

A few backend conventions worth noting:

### Why UUID over auto-increment INT?

| | INT auto | UUID |
|---|---|---|
| Size | 4–8 bytes | 16 bytes |
| Predictable | ✅ (`/users/123` is enumerable) | ❌ (security win) |
| Cross-service uniqueness | ❌ | ✅ |
| Can be generated client-side | ❌ | ✅ (offline-first, optimistic UI) |
| Index performance | Better | Slightly worse (UUIDv7 helps) |

This project uses UUID to demonstrate the modern distributed-systems default.

### Why `withTimezone` for timestamps?

PostgreSQL's `timestamp` and `timestamptz` are **completely different types**:

- `timestamp`: stores wall-clock without a timezone. "2026-01-01 10:00" — 10am where?
- `timestamptz`: stores UTC internally, converts on read. **Always use this.**

> ⚠️ **Real incident**: A team stored `created_at` as plain `timestamp`. Cross-timezone teammates saw conflicting times, sort orders broke, and the migration to fix it took three painful days. **Use `timestamptz` from line one of every schema.**

### `notNull()` is not boilerplate

Postgres columns default to **nullable**. NULL behaves weirdly in SQL (`NULL = NULL` is `NULL`, not `true`), wrecking query logic. **If a value should always exist, declare it `notNull`.**

---

## Relations: metadata for the relational query builder

```ts
export const todosCategoriesRelations = relations(todosCategories, ({ one }) => ({
  todo: one(todos, { fields: [todosCategories.todoId], references: [todos.id] }),
  category: one(categories, { fields: [todosCategories.categoryId], references: [categories.id] }),
}));
```

> ⚠️ **Common misconception**: `relations()` does **NOT** create foreign key constraints! FKs come from `.references()` on the column (which migrations turn into SQL).

`relations()` is metadata for Drizzle's relational query builder (`db.query.*`), telling it "from this table, you can hop to that one."

---

## Two query styles

### 1. SQL-style builder

```ts
const rows = await db
  .select()
  .from(todos)
  .where(and(eq(todos.isCompleted, false), gt(todos.dueDate, new Date())))
  .orderBy(desc(todos.createdAt))
  .limit(20);
```

- Maps almost 1:1 to SQL — what you write is what runs.
- Total control over the query plan — best for **performance-sensitive paths**.
- Doesn't auto-join relations; you call `.leftJoin()` yourself.

### 2. Relational query builder (`db.query.*`)

```ts
const row = await db.query.todos.findFirst({
  where: (t, { eq }) => eq(t.id, id),
  with: { todosCategories: { with: { category: true } } },
});
```

- Eager-loads related data **structurally** as nested objects.
- Drizzle compiles this to a **single SQL** (LATERAL JOIN + JSON aggregation), **not** N queries — so it dodges N+1.
- Great DX, perfect for everyday CRUD.

> 💡 **Practical choice**: Use `db.query.*` for CRUD; drop to the SQL builder for performance-critical paths or complex aggregations. **Mixing both in the same repository is fine.**

---

## N+1: the deadliest backend performance trap

The naive write:

```ts
// ❌ Disaster
const list = await db.select().from(todos);   // 1 query
for (const todo of list) {
  todo.categories = await db.select()...
    .where(eq(todosCategories.todoId, todo.id));  // N queries!
}
```

100 todos = 101 queries. 1000 todos = 1001 queries. **Your DBA will know your name by the end of the week.**

The fix is one query that loads todos and their categories together (via JOIN or aggregation), which is exactly what `db.query.*` with `with` does under the hood.

> ⚠️ **Always** inspect the actual SQL your ORM emits. Drizzle accepts `logger: true` for that.

---

## Transactions and ACID

When a business action touches **multiple tables** ("create a todo + write its category links"), you need a transaction:

```ts
return this.db.transaction(async (tx) => {
  const [row] = await tx.insert(todos).values({...}).returning();
  await tx.insert(todosCategories).values(...);
  return row.id;
});
```

Transactions give you **ACID**:

| | Meaning |
|---|---|
| **A**tomicity | All succeed or none succeed — no "half-done" state |
| **C**onsistency | DB ends in a state satisfying all constraints (FK, unique, check) |
| **I**solation | Concurrent transactions don't see each other's intermediate states |
| **D**urability | Once committed, even a crash won't lose the data |

Drizzle's `tx` is a superset of `db`. **Throw anywhere → automatic rollback.**

### Isolation levels

Postgres defaults to `READ COMMITTED`. Common scenarios:

- Bank transfer / inventory deduction → `SERIALIZABLE` (strictest, may need retry on conflict)
- Routine CRUD → default is fine

```ts
await db.transaction(async (tx) => { ... }, { isolationLevel: 'serializable' });
```

---

## Type inference: one schema, two roles

```ts
type TodoRow = InferSelectModel<typeof todos>;        // shape of read rows
type TodoInsert = InferInsertModel<typeof todos>;     // shape of inserts
```

**Insert vs select types differ** — e.g., `createdAt` is `Date` on read but optional on insert (DB fills the default). Drizzle computes both.

This project's `models/` layer uses `InferSelectModel` to "normalize" the row type into `TodoModel`. See [docs/09](./09-models-layer.md).

---

## Recap

- ORM is a tool; **SQL is the foundation**. Drizzle's value is SQL-shaped TypeScript.
- `db.select()` for fine control; `db.query.*` for nested eager-load.
- **N+1 is the most common backend perf killer** — always check the real SQL.
- Multi-table writes always inside a transaction; understand ACID.
- Reuse `InferSelectModel` types instead of redefining shapes by hand.
