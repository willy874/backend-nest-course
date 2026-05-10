> 🌏 **English** | [繁體中文](./09-models-layer.zh-TW.md)

# 09 · Models Layer

## What you'll learn

- What an **Anti-Corruption Layer (ACL)** is and why backends need one
- Why passing Drizzle rows around the app is a bad idea
- The Anemic vs Rich Domain Model debate, and what this project chose
- Two flavors of the Mapper pattern (`class with static` vs `interface + namespace`)
- Clear responsibilities for DTO, Model, Schema row

---

## Start with a bad example

Beginners writing NestJS + Drizzle often do this:

```ts
// ❌ Service consumes Drizzle rows directly
async findById(id: string) {
  return await this.db.query.todos.findFirst({
    where: (t, { eq }) => eq(t.id, id),
    with: { todosCategories: { with: { category: true } } },
  });
}
```

What's wrong?

1. **Service knows about the join table**: `row.todosCategories[i].category` leaks into business code.
2. **Schema renames break everything**: rename `is_completed` → `done`, and not just SQL but every service/controller has to change.
3. **Type semantics are impure**: Drizzle's `description: string | null` reflects DB design; the app might prefer "always null" or "always empty string" — that's an *application* decision.
4. **Hard to test**: to unit-test a service, you have to construct a Drizzle-shaped row.

---

## The Models Layer's role: **Anti-Corruption Layer (ACL)**

ACL is a Domain-Driven Design concept:

> When your application talks to an external system (DB, third-party API, legacy system), **don't let its data structures pollute your core logic**. Build a translation layer at the boundary; convert external models into your own.

Mapping to this project:

| "External system" | "Core logic" | ACL = ? |
|---|---|---|
| Drizzle / Postgres schema | Service / Controller | **Models layer** |

> 💡 **Concept**: Even though Drizzle isn't truly "external", it's a **dependency that evolves on its own schedule**. Today you use Drizzle; tomorrow it could be Prisma or Kysely. Today it's a join table; tomorrow it's a JSONB column. The models layer **isolates that change inside the repository** so core logic doesn't have to move.

---

## What this layer is NOT

| **Not** | Because |
|---|---|
| Drizzle table definitions | That's the schema, in `schemas/` |
| DTOs | That's the HTTP contract, in `dto/` |
| Rich domain objects with methods | This project explicitly chose the anemic model — see below |

What it **is**: **pure data shape** + a `fromRow` mapper.

---

## Anemic vs Rich Domain Model: which side?

A century-long DDD debate.

### Rich Domain Model

```ts
class Todo {
  constructor(...) {}

  markCompleted() {
    if (this.dueDate < new Date()) throw new Error('Cannot complete overdue');
    this.isCompleted = true;
  }

  isOverdue(): boolean { ... }
}
```

- ✅ Logic and data **encapsulated together**
- ✅ Invariants enforced by the model itself
- ❌ Classes don't serialize cleanly (JSON, log)
- ❌ Awkward to convert between Drizzle rows, DTOs, and class instances
- ❌ ORM lazy loading / proxies clash with class semantics

### Anemic Domain Model (this project)

```ts
interface TodoModel { ... }   // pure data, no methods

// Logic lives in services
class TodosService {
  markCompleted(todo: TodoModel): TodoModel {
    if (todo.dueDate && todo.dueDate < new Date()) throw new BadRequestException();
    return { ...todo, isCompleted: true };
  }
}
```

- ✅ Pure data: spread / clone / serialize freely
- ✅ Easy to test (test functions, not class instances)
- ✅ Plays nicely with functional style
- ❌ Logic spread across services — some say this violates OOP encapsulation

> 💡 **Why anemic for this project**:
> 1. TypeScript `interface` doesn't exist at runtime — **conversion cost is zero**.
> 2. Functional / data-oriented style is increasingly mainstream in TS backend (Effect-ts, tRPC, Drizzle's design all lean this way).
> 3. Teaching project: clearly separate **data and behavior**. After you've absorbed the basics, you can choose to push methods back onto the model.
>
> Martin Fowler famously called Anemic an anti-pattern, but **only when there's no discipline about where logic lives**. We have a clear service layer, so this choice is principled.

---

## Shape: interface + same-named const namespace

```ts
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

> 💡 **TypeScript trick**: **interface + const with the same name** coexist (different declaration spaces). The call site reads `TodoModel.fromRow(row)` and gets a `TodoModel` — naturally namespaced, no `TodoModelMapper` / `TodoModelFactory` cruft.

Class-style alternative:

```ts
class TodoModel {
  static fromRow(row: TodoRow): TodoModel { ... }
}
```

Either works. The interface approach has a small win: **plain object — `JSON.stringify` won't drag class metadata along**.

---

## Data flow (full picture)

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Drizzle row                                           │
│   { id, title, todosCategories: [{ category: {...} }]}  │
│                                                         │
└────────────────────────┬────────────────────────────────┘
                         │  Repository:
                         │    TodoModel.fromRow(row, [...categories])
                         ▼
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   TodoModel                                             │
│   { id, title, categories: [CategoryModel, ...] }       │
│                                                         │
└────┬─────────────────────────────────────────┬──────────┘
     │  Service operations                     │
     │  (input + output are models)            │
     ▼                                         ▼
┌──────────────┐                    ┌────────────────────┐
│ Service flow │                    │ Controller project │
└──────────────┘                    │ toTodoResponse()   │
                                    └─────────┬──────────┘
                                              ▼
                                     ┌──────────────────┐
                                     │ TodoResponseDto  │
                                     │ → HTTP JSON      │
                                     └──────────────────┘
```

---

## Naming & responsibility cheat sheet

| Layer | Shape | Naming | Example |
|---|---|---|---|
| Schema | Drizzle table | Table name | `todos` |
| Schema row | TS type | `XxxRow` | `TodoRow` |
| Model | App-internal data | `XxxModel` | `TodoModel` |
| DTO (request) | API input | `CreateXxxDto` | `CreateTodoDto` |
| DTO (response) | API output | `XxxResponseDto` | `TodoResponseDto` |

Each layer recognizes only its own shape; **conversion happens at fixed entry points**:

- Row → Model: `Model.fromRow()` in the repository
- Model → DTO: `to*Response()` in the controller
- DTO → Model: at the service entry (this project's services accept DTO plain shapes directly)

---

## Anti-patterns

| Anti-pattern | Why bad |
|---|---|
| Methods on the model AND duplicates in services | Two implementations, unclear which to call |
| Repositories returning DTOs | Violates "convert at the boundary" |
| Services returning Drizzle rows to controllers | Internal logic bleeds into HTTP; schema changes break everything |
| One type that's both Model and DTO | Forces DB columns to mirror API contract; both sides become rigid |
| Mapper functions in controllers | Duplication, hard to reuse |

---

## Recap

- The models layer is an **Anti-Corruption Layer**, isolating DB schema change inside the repository.
- This project chose the **Anemic Domain Model** (pure data + logic in services).
- The **`interface + same-named const namespace`** trick gives the cleanest call sites.
- Three shapes flow through the app: **Schema Row → Model → DTO**, each with one fixed conversion point.
- Even if Drizzle is type-safe, models still earn their keep — **don't let an ORM's types become your app's internal types**.
