> 🌏 [English](./09-models-layer.md) | [繁體中文](./09-models-layer.zh-TW.md)

# 09 · Models Layer

The `models/` folder is what makes this project's structure unusual. It is **not**:

- ❌ Drizzle table definitions (those live in `schemas/`)
- ❌ DTOs (those live in `dto/`)
- ❌ Rich domain objects with business methods

It **is**: a **pure data shape** — the canonical internal representation that the rest of the app talks in.

## Why a Models Layer Exists

| Pain without it | Models solve it |
|---|---|
| Drizzle row types are *table-shaped* (flat, FK ids, no relations resolved). Service code keeps re-joining mentally. | Models nest related entities — e.g. `TodoModel.categories: CategoryModel[]`. |
| Schema column rename leaks across the whole codebase. | Only the repository's `fromRow()` mapper is affected. |
| Drizzle types use whatever the DB gave us (`Date`, `string | null`). Sometimes you want `null` everywhere consistent, sometimes you want richer types. | Models codify the **internal contract** for nullability and types. |
| Passing DTOs around internally couples business code to the HTTP layer. | DTOs are derived from models; internals never see DTOs. |

## Shape

```ts
// src/models/todo.model.ts
type TodoRow = InferSelectModel<typeof todos>;

export interface TodoModel {
  id: string;
  title: string;
  description: string | null;
  isCompleted: boolean;
  dueDate: Date | null;
  categories: CategoryModel[];
  createdAt: Date;
  updatedAt: Date;
}

export const TodoModel = {
  fromRow(row: TodoRow, categories: CategoryModel[] = []): TodoModel {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      isCompleted: row.isCompleted,
      dueDate: row.dueDate,
      categories,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },
};
```

The pattern is **`interface + same-named const namespace`**:

- The interface gives consumers the type.
- The namespace exposes `fromRow()` as the single approved way to mint a model.

Use sites read naturally: `TodoModel.fromRow(row)` returns a `TodoModel`.

## Where Models Are Used

```
schemas (Drizzle row)
        │
        │  Repository: TodoModel.fromRow(row, [...categories])
        ▼
      models  ◄── Service & Controller speak this dialect
        │
        │  Controller: toTodoResponse(model)
        ▼
       dto  ──► HTTP response
```

- **Repositories** are the only producers of models.
- **Services** consume and return models.
- **Controllers** convert models to response DTOs at the very edge.

## Why No Methods on the Model?

Two reasons:

1. **Predictability**: a plain object can be logged, serialized, copied, compared without surprises.
2. **No leakage**: business rules belong in services, where they can be tested without instantiating models or mocking methods.

If a real domain rule appears (e.g. "a todo can only be reopened within 24h"), it lives in the service as a function operating *on* a `TodoModel`, not as a method *of* it.

## Mental Model

Think of the models layer as a **translation table** between two foreign languages:

- **Schema language**: how the DB sees the world.
- **App language**: how the app wants to see the world.

The repository is the bilingual speaker. Everyone above it only needs the second language.
