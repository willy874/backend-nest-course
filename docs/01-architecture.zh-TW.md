> 🌏 [English](./01-architecture.md) | **繁體中文**

# 01 · 架構與分層設計

本專案採 **layer-based** 結構,每個職責各自一個資料夾,依賴只往單一方向流動。

## 分層概覽

```
HTTP Request
    │
    ▼
┌───────────────┐
│  controllers  │   HTTP 邊界,語言為 DTO ↔ Model
└───────┬───────┘
        ▼
┌───────────────┐
│   services    │   業務編排,語言為 Model
└───────┬───────┘
        ▼
┌───────────────┐
│ repositories  │   DB 存取,把 schema row → Model
└───────┬───────┘
        ▼
┌───────────────┐
│   schemas     │   Drizzle table 定義(DB 的形狀)
└───────────────┘

         models   ◄── 所有上層共用的純資料形狀
         dto      ◄── 由 Zod 驅動的 request / response 契約
```

## 依賴方向

```
controllers  →  services  →  repositories  →  schemas
     │             │              │
     └─── dto      └─── models ───┘
```

- Controller **絕不**直接操作 repository。
- Service **不** import DTO(請求/回應是 controller 的事)。
- Repository **不**知道 HTTP、Zod、DTO。
- **Models layer** 是位於 repository 之上的純資料共通語言。

## 為什麼選 layer 而不是 feature module?

兩種都可以。本專案教學目標是讓**每一種職責**都明顯可見。在 feature-based(`modules/todos/`)的結構下,同樣的檔案會散落在 feature 內,初學者容易把 DTO 的事跟 repository 的事混在一起。

理解分層後,要轉成 feature module 只是搬檔案,而不是重寫。

## Cross-cutting 關注點

| 關注點 | 位置 |
|---|---|
| 驗證 | `ZodValidationPipe`(全域)— 註冊在 `app.module.ts` |
| 例外格式化 | `AllExceptionsFilter` — `src/common/filters/` |
| 設定 | `ConfigModule` + `validateEnv()`(Zod)— `src/config/` |
| DB client | `DatabaseModule` 提供 `DRIZZLE` provider — `src/database/` |
