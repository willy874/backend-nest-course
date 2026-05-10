> 🌏 **English** | [繁體中文](../zh-TW/04-migrations.md)

# 04 · Migrations & Schema Evolution

## What you'll learn

- Why production schema changes must go through migrations — never direct edits
- `generate + migrate` vs `push`, and why the former is the industry standard
- The forward-only migration philosophy
- The Expand-Contract pattern — how to change schemas with zero downtime
- How to recover when a migration goes wrong

---

## Why version-control your schema?

Think of DB schema as **part of your codebase** — because it is.

If schema and code drift apart:

- A teammate pulls latest code; their local app crashes (column missing)
- Staging and production schemas don't match → tests pass, prod explodes
- When something breaks, code is `git revert`-able. **What about the DB?**

**Migrations are git for your schema.** Each change becomes an ordered SQL file you can replay anywhere.

> 💡 **Industry rule**: **Never** hand-edit production with `ALTER TABLE`. All changes go through migration files, get code-reviewed, and ship with releases. The disasters from breaking this rule could fill a book.

---

## drizzle-kit's two modes

### `db:push` (fast, dangerous)

```bash
drizzle-kit push    # syncs schema directly, no SQL recorded
```

- ✅ Fastest in early prototype
- ❌ **No history**, no record of what changed
- ❌ **Never use in production**

### `db:generate + db:migrate` (this project)

```bash
drizzle-kit generate    # diffs schema vs last snapshot, writes SQL
drizzle-kit migrate     # applies unrun SQL to the DB
```

- ✅ Every change reviewable, replayable
- ✅ Production-safe
- ✅ Reviewers (and DBAs) can see the SQL diff in PRs
- ❌ One extra step

> 💡 **Key insight**: `generate` only writes files — **it doesn't touch the DB at all**. `migrate` is what connects to the DB. This separation lets you inspect SQL during code review *before* it's deployed.

---

## The full workflow

```
1. Edit src/schemas/*.ts
        │
        ▼
2. npm run db:generate   ──► drizzle-kit diffs schema vs the last snapshot
                              writes src/database/migrations/0001_xxx.sql
        │
        ▼
3. Open PR; reviewers see the SQL  ──► no ORM-hidden surprises
        │
        ▼
4. Merge → CI/CD          ──► deploy pipeline runs npm run db:migrate
        │
        ▼
5. Pending migrations applied
```

drizzle-kit creates a `drizzle_migrations` table in the DB to track which migrations have run — so re-running is safe. This property is called **idempotency**: running the same command N times is the same as running it once.

---

## Forward-only migrations

drizzle-kit doesn't auto-generate `down` migrations. This is **mainstream practice**, not an oversight.

Why no down?

1. **Down is rarely useful in production**: if a feature shipped and wrote data into the new column, dropping the column loses real data.
2. **Real rollback is just another forward migration** that reverses the change.
3. Tools that *do* offer down (Rails, Knex) tend to encourage the false sense of safety "I wrote a down, so I'm safe."

> 💡 **Rule of thumb**: Recovery is **roll forward**, not roll back.

---

## Expand-Contract: zero-downtime schema changes

When the service runs 24/7 and you can't take downtime, every change splits into stages.

### Example: split `name` into `first_name` + `last_name`

❌ One step (will break):

```sql
ALTER TABLE users DROP COLUMN name;
ALTER TABLE users ADD COLUMN first_name TEXT NOT NULL;  -- old code doesn't know this
```

✅ Expand-Contract:

| Phase | DB change | Code change |
|---|---|---|
| 1. **Expand** | Add `first_name`, `last_name`; **keep** `name` | Write to both old and new |
| 2. **Backfill** | Batch script to populate new columns | (none) |
| 3. **Migrate reads** | (none) | Read from new columns |
| 4. **Stop writing old** | (none) | Stop writing `name` |
| 5. **Contract** | DROP `name` | (none) |

Every phase is rollback-safe and lossless. **That's a production-safe migration.**

> 💡 **Industry concept**: This is the pattern Stripe, Shopify, GitHub, et al. all follow. The teaching project doesn't need this complexity — but **you should know it exists**.

---

## Migration writing taboos

| Bad pattern | Why it's dangerous |
|---|---|
| `UPDATE` huge tables inside a migration | Long lock times can take production down. Use a separate backfill job. |
| Add `NOT NULL` without a default | Existing rows violate the constraint, migration fails |
| Change column types | PG rewrites the whole table; multi-minute lock on big tables |
| Add an index without `CONCURRENTLY` | Locks the table (fine in dev, never in prod) |
| Rename a column or table | Old code breaks instantly. Use Expand-Contract. |

---

## Commands

```bash
# After editing schema, generate the next migration
npm run db:generate

# Apply pending migrations
npm run db:migrate

# Drop the latest migration FILE (does not touch DB)
npm run db:drop

# GUI inspector
npm run db:studio
```

---

## When something goes wrong

### Case A: generated but not yet applied — found a mistake

→ `npm run db:drop` to delete the file, fix the schema, re-generate.

### Case B: applied locally, not yet pushed

→ Either write a new forward-fix migration, **or** nuke the DB and replay:

```bash
docker compose down -v   # remove the volume too
docker compose up -d
npm run db:migrate
```

### Case C: already deployed to staging/production

→ **Always** write a forward fix. Never edit history.

---

## Recap

- Migrations are **git for schema**; production changes only via migrations.
- Use **`generate + migrate`** over `push` — leaves a reviewable SQL trail.
- Migrations are **idempotent**, tracked in `drizzle_migrations`.
- Recovery is **forward fix**, not down migrations.
- Big systems use **Expand-Contract** for zero-downtime evolution.
