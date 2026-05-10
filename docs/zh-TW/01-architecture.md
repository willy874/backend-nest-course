> 🌏 [English](../en-US/01-architecture.md) | **繁體中文**

# 01 · 架構與分層設計

## 你會學到

- 為什麼後端服務需要「分層」,而不是把所有程式碼塞進一個檔案
- Layer-based、Feature-based、Hexagonal(六角)架構的差別與選擇時機
- 「依賴方向」這個觀念為什麼比「程式碼長相」更重要
- 本專案六個層的職責切分與彼此的契約

---

## 為什麼要分層?

寫一個小腳本時,所有邏輯放一起最快。但後端服務通常活很久 — 兩年後可能你不在了,還有人要改它。屆時最大的成本不是「寫程式」,而是「**閱讀別人寫的程式**」。

分層的本質是:**讓一個檔案只回答一個問題**。

- 看 controller → 我只想知道這條 HTTP 路由怎麼進來、怎麼出去。
- 看 service → 我只想知道這個業務動作的流程是什麼。
- 看 repository → 我只想知道資料怎麼從 DB 進出。

當每層只回答一個問題,你就可以**獨立測試、獨立替換、獨立理解**任何一塊。這就是 SOLID 的 **Single Responsibility Principle**(單一職責)在大尺度下的展現。

---

## 後端常見的三種分層哲學

| 風格 | 組織方式 | 優點 | 缺點 |
|---|---|---|---|
| **Layer-based**(本專案) | 依「角色」分目錄(`controllers/`、`services/`...)| 角色清楚、新人易懂、職責邊界顯眼 | 改一個 feature 要跳多個資料夾 |
| **Feature-based** | 依「功能」分目錄(`modules/todos/`、`modules/users/`...)| 改 feature 一站到位、易於拆 microservice | 角色界線靠約定,容易混亂 |
| **Hexagonal / Clean Arch** | 業務核心(domain)向內,IO(DB/HTTP)向外 | 業務邏輯不耦合任何框架,可獨立測試 | 學習曲線陡峭、樣板碼多 |

> 💡 **實務提示**:沒有「最好」的架構,只有「在這個團隊規模、這個成熟度、這個業務複雜度下最合適」的架構。教學專案選 layer-based 是因為**它最能讓初學者看見每個職責**。

---

## 本專案的分層

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

每層的「對外貨幣」都不同:

- Controllers 對外 = **DTO**(HTTP 世界的契約,可序列化為 JSON)
- Services 對內 = **Model**(應用內部的純資料形狀)
- Repositories 對 DB = **Schema row**(Drizzle 從表格欄位推導出的型別)

---

## 依賴方向(這比結構更重要)

```
controllers  →  services  →  repositories  →  schemas
     │             │              │
     └─── dto      └─── models ───┘
```

規則只有一條:**箭頭只能單向流動**。

- ✅ Controller 可以呼叫 Service
- ❌ Service **絕不**可以呼叫 Controller
- ❌ Repository **絕不**可以丟出 `BadRequestException`(那是 HTTP 概念)

> 💡 **後端工程觀念**:這就是 Robert C. Martin 在 Clean Architecture 裡講的 **Dependency Rule**:source code dependencies must point only inward — 內層不依賴外層。違反這條規則,就會出現「我為了測試 service,要先 mock 一個 HTTP request」這種荒謬情況。

---

## 為什麼 Service 不能 import DTO?

新手最常犯的錯誤:覺得「DTO 就是物件啊,在 service 裡用很方便」。

問題是:**DTO 是 HTTP 世界的契約**。今天這個 service 被定時任務(cron)呼叫,它哪裡來的 HTTP request body?明天這個 service 被 Kafka consumer 呼叫,難道也丟一個 HTTP DTO 進去?

正確做法:**Controller 把 DTO 解開、轉成內部資料(model 或 plain object),才丟進 service**。Service 永遠只認得內部資料形狀。

這也是為什麼本專案有 `models/` 這層 — 它是 Service 的「正式語言」,見 [docs/09](./09-models-layer.md)。

---

## Cross-cutting 關注點放哪?

有些功能不屬於任何單一層,而是「橫切」整個應用:驗證、錯誤處理、log、authentication、tracing 等。NestJS 提供四個機制處理:

| 機制 | 何時觸發 | 本專案使用 |
|---|---|---|
| **Pipe** | request 進入 handler 之前 | `ZodValidationPipe`(全域驗證)、`ParseUUIDPipe`(逐路由) |
| **Guard** | pipe 之前,決定是否准入 | 教學專案無(可加 JWT auth) |
| **Interceptor** | handler 前後包圍(可改 response) | 教學專案無(可加 logging、cache) |
| **Filter** | 任何例外丟出時 | `AllExceptionsFilter`(全域錯誤格式化) |

這些都是「**aspect-oriented programming(AOP)**」概念在 Nest 中的體現:把橫切關注點從業務程式碼裡抽出去,集中管理。

---

## Recap

- 分層的目的是**讓每個檔案只回答一個問題**,降低長期維護成本。
- 分層的關鍵是**依賴方向單向流動**,不是「目錄怎麼分」。
- 每層之間用**明確的資料契約**(DTO、Model、Row)交流,不混用。
- Cross-cutting 關注點走 NestJS 的 Pipe / Guard / Interceptor / Filter,別塞進業務碼。
