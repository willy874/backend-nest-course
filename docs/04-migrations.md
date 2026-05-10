> 🌏 [English](./04-migrations.md) | [繁體中文](./04-migrations.zh-TW.md)

# 04 · Migrations with drizzle-kit

We use the **generate + migrate** workflow (not `db:push`), so DB evolution is recorded as version-controlled SQL files.

## Workflow

```
edit src/schemas/*.ts
        │
        ▼
npm run db:generate     ──► drizzle-kit reads schema
                              and writes a new SQL file
                              into src/database/migrations/
        │
        ▼
git commit              ──► migration is now part of history
        │
        ▼
npm run db:migrate      ──► applies any unrun migrations to DB
```

## Files

- `drizzle.config.ts` — declares schema path, output dir, and DB credentials.
- `src/database/migrations/` — generated SQL + a `meta/` snapshot folder. **Do not hand-edit.**
- `src/database/migrate.ts` — runtime runner using `drizzle-orm/node-postgres/migrator`.

## Why generate, not push?

| | `push` | `generate + migrate` |
|---|---|---|
| Speed | instant | one extra step |
| History | none | every change recorded |
| Production-safe | ❌ | ✅ |
| Reviewable diff | ❌ | ✅ (SQL in PR) |

In real projects, always prefer `generate + migrate`. `push` is fine for one-off prototyping.

## Common Operations

```bash
# Generate next migration after editing schemas
npm run db:generate

# Apply pending migrations to the DB
npm run db:migrate

# Drop the latest generated migration file (does NOT touch DB)
npm run db:drop

# Inspect tables in a GUI
npm run db:studio
```

## Rolling Back

drizzle-kit does **not** generate `down` migrations automatically. Strategies:

1. **Forward fix**: write a new migration that reverses the change.
2. **Manual**: write the rollback SQL by hand if needed.

For a teaching project, sticking with forward fixes is sufficient.
