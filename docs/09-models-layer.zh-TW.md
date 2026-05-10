> 🌏 [English](./09-models-layer.md) | **繁體中文**

# 09 · Models Layer

`models/` 是本專案結構中最特別的一塊。它**不是**:

- ❌ Drizzle table 定義(那在 `schemas/`)
- ❌ DTO(那在 `dto/`)
- ❌ 帶業務方法的 rich domain object

它**是**:**純資料形狀** — 應用內部所有層共同使用的標準資料表達。

## 為什麼要有 Models Layer

| 沒有它的痛點 | Models 怎麼解 |
|---|---|
| Drizzle row 是「以表格為視角」(欄位平鋪、FK 為 id、未解析關聯)。Service 程式碼到處心算 join。 | Model 把關聯 nested 進來 — 例如 `TodoModel.categories: CategoryModel[]`。 |
| 改 schema 欄位名會擴散到整個 codebase。 | 只有 repository 的 `fromRow()` mapper 會受影響。 |
| Drizzle 型別是 DB 直接給的(`Date`、`string \| null`)。有時你想要應用層 nullability/型別更一致。 | Model 把**內部型別契約**規範化。 |
| 在內部到處傳 DTO 會讓業務邏輯耦合到 HTTP 層。 | DTO 由 model 投影產生;內部完全不接觸 DTO。 |

## 形狀

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

模式是 **`interface + 同名 const namespace`**:

- interface 給消費者型別。
- namespace 提供 `fromRow()` — 唯一被認可的「製造 model」入口。

呼叫端讀起來很自然:`TodoModel.fromRow(row)` 取得一個 `TodoModel`。

## 使用位置

```
schemas (Drizzle row)
        │
        │  Repository: TodoModel.fromRow(row, [...categories])
        ▼
      models  ◄── Service 與 Controller 都講這個方言
        │
        │  Controller: toTodoResponse(model)
        ▼
       dto  ──► HTTP response
```

- **Repository** 是唯一的 model 生產者。
- **Service** 接收與回傳 model。
- **Controller** 只在最邊界把 model 轉為 response DTO。

## 為什麼 Model 上不放方法?

兩個原因:

1. **可預測性**:plain object 可以放心 log、序列化、複製、比對,不會踩雷。
2. **不外洩**:業務規則該放在 service,測試時可純粹測 function,不必 instantiate model 或 mock 方法。

當真的出現業務規則(例如「todo 只能在 24 小時內重新打開」),它的位置在 service,以接收 `TodoModel` 的 function 形式存在,而不是 model 的 method。

## 心智模型

把 models layer 想成兩種「外語」之間的**翻譯表**:

- **Schema 語**:DB 怎麼看世界。
- **App 語**:應用層想怎麼看世界。

Repository 是雙語者,上面的所有層只需要懂第二種語言。
