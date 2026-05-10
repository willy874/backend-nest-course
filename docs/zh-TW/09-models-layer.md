> 🌏 [English](../en-US/09-models-layer.md) | **繁體中文**

# 09 · Models Layer

## 你會學到

- 什麼是「Anti-Corruption Layer」(反腐層),以及為什麼後端需要它
- 為什麼 Drizzle row 直接到處用是個壞主意
- Anemic Domain Model vs Rich Domain Model 的爭論,以及本專案的選擇
- Mapper 模式的兩種寫法(class with static / interface + namespace)
- DTO、Model、Schema row 的明確職責切分

---

## 從一個壞例子開始

新手寫 NestJS + Drizzle 常常這樣:

```ts
// ❌ Service 直接吃 Drizzle row
async findById(id: string) {
  return await this.db.query.todos.findFirst({
    where: (t, { eq }) => eq(t.id, id),
    with: { todosCategories: { with: { category: true } } },
  });
}
```

問題出在哪?

1. **Service 知道 join table 的存在**:`row.todosCategories[i].category` 這種路徑滲透到業務碼裡。
2. **Schema 改了到處壞**:把欄位 `is_completed` 改名 `done`,影響的不只是 SQL,所有 service / controller 都要改。
3. **型別語意不純**:Drizzle row 的 `description: string | null` 是 DB 的設計考量;業務上你可能希望統一為 `null` 或統一為空字串,該由應用層決定。
4. **測試難寫**:要測 service,要先 mock 一個 Drizzle row 形狀的資料。

---

## Models Layer 的角色:**Anti-Corruption Layer (ACL)**

「反腐層」是 Domain-Driven Design 中的概念,意思是:

> 當你的應用要跟外部系統(DB、第三方 API、舊系統)交流時,**不要讓它們的資料結構直接污染你的核心邏輯**。在邊界蓋一層翻譯層,把外部模型轉成你自己的模型。

在本專案的對應:

| 「外部系統」 | 「核心邏輯」 | ACL = ? |
|---|---|---|
| Drizzle / Postgres schema | Service / Controller | **Models layer** |

> 💡 **觀念**:即使 Drizzle 不是「外部」系統,它仍是一個**會獨立演進的 dependency**。今天你用 Drizzle,明天可能改用 Prisma 或 Kysely;今天 schema 是 join table,明天可能改 jsonb 欄位。**用 models layer 把這層變動隔離在 repository 內**,核心邏輯不需要改。

---

## 本專案的 Models 不是什麼

| 它**不是** | 因為 |
|---|---|
| Drizzle table 定義 | 那是 schema,在 `schemas/` |
| DTO | 那是 HTTP 契約,在 `dto/` |
| Rich domain object(帶業務方法的 class) | 本專案明確選擇了 anemic 模型,見下方討論 |

它**就是**:**純資料形狀** + **fromRow 轉換函式**。

---

## Anemic vs Rich Domain Model:你選哪邊?

DDD 圈子的世紀之辯。

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

- ✅ 業務邏輯與資料**封裝在一起**
- ✅ Invariant 由 model 自己保護(例如不能完成過期的 todo)
- ❌ Class 不容易序列化(JSON、log)
- ❌ 難以跟 Drizzle row、DTO 之間轉換
- ❌ ORM 的 lazy load / proxy 跟 class 行為打架

### Anemic Domain Model(本專案選擇)

```ts
interface TodoModel { ... }   // 純資料,沒有方法

// 業務邏輯在 service 裡
class TodosService {
  markCompleted(todo: TodoModel): TodoModel {
    if (todo.dueDate && todo.dueDate < new Date()) throw new BadRequestException();
    return { ...todo, isCompleted: true };
  }
}
```

- ✅ 純資料隨便 spread / clone / serialize
- ✅ 容易測試(測 function,不用建 class instance)
- ✅ 與 functional style 自然
- ❌ 業務邏輯散在 service,有人說這違反 OOP 封裝精神

> 💡 **本專案選擇 Anemic 的理由**:
> 1. TypeScript 的 `interface` 在運作期不存在,**轉換成本為零**。
> 2. Functional / data-oriented 風格在 TS 後端越來越主流(看 Effect-ts、tRPC、Drizzle 的設計都偏這方向)。
> 3. 教學專案要清楚切分**「資料」與「行為」**。等你進階了再選擇要不要把方法掛回 model。
>
> Martin Fowler 把 Anemic 稱為 anti-pattern,但**前提是「沒有把邏輯放在別處的紀律」**。本專案有清楚的 service layer,因此是合理選擇。

---

## 形狀:Interface + 同名 Const Namespace

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

> 💡 **TypeScript 巧思**:**Interface 與 const 同名共存**。使用端寫 `TodoModel.fromRow(row)` 取得 `TodoModel` 型別 — 命名空間自然,沒有 `TodoModelMapper`、`TodoModelFactory` 之類的多餘符號。

對比 class 寫法:

```ts
class TodoModel {
  static fromRow(row: TodoRow): TodoModel { ... }
}
```

兩者都可以。Interface 寫法有個小優勢:**plain object,JSON.stringify 不會多 class metadata**。

---

## 資料流(完整版)

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
     │  (input, output 都是 model)             │
     ▼                                         ▼
┌──────────────┐                    ┌────────────────────┐
│ Service 編排 │                    │ Controller 投影    │
└──────────────┘                    │ toTodoResponse()   │
                                    └─────────┬──────────┘
                                              ▼
                                     ┌──────────────────┐
                                     │ TodoResponseDto  │
                                     │ → HTTP JSON      │
                                     └──────────────────┘
```

---

## 命名與職責切分速查表

| 層 | 形狀 | 命名 | 範例 |
|---|---|---|---|
| Schema | Drizzle table | 表名 | `todos` |
| Schema row | TS 型別 | `XxxRow` | `TodoRow` |
| Model | App 內部資料 | `XxxModel` | `TodoModel` |
| DTO (request) | API 入口 | `CreateXxxDto` | `CreateTodoDto` |
| DTO (response) | API 出口 | `XxxResponseDto` | `TodoResponseDto` |

每個位置只認自己這層的形狀,**轉換只在固定的入口**:

- Row → Model:Repository 的 `Model.fromRow()`
- Model → DTO:Controller 的 `to*Response()`
- DTO → Model:Service 入口(本專案 Service 直接接 DTO 的 plain shape)

---

## Models 的反 Pattern

| 反 pattern | 為什麼壞 |
|---|---|
| Model 上加業務方法,但又在 service 也寫一份 | 重複,也不知道呼叫哪個 |
| Repository 跨層丟 DTO | 違反「邊界一次轉換」原則 |
| Service 回 Drizzle row 給 controller | 內部邏輯洩到 HTTP,schema 改就爆 |
| 把 model 跟 DTO 合併成一個 type | 資料庫欄位被迫對齊 API 契約,兩邊都被卡住 |
| Mapper function 寫在 controller | 重複、難重用 |

---

## Recap

- Models layer 是**反腐層(ACL)**,把 DB schema 的變動隔離在 repository 內。
- 本專案選 **Anemic Domain Model**(純資料 + service 處理邏輯),而非 Rich。
- 用 **`interface + 同名 const namespace`** 的 TypeScript 巧思,讓使用端最自然。
- 三種資料形狀:**Schema Row → Model → DTO**,各自固定的轉換入口。
- 即使 Drizzle 是 type-safe 的,model 仍有獨立價值 —**不要把 ORM 的 type 直接當應用內部 type**。
