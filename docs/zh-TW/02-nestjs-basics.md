> 🌏 [English](../en-US/02-nestjs-basics.md) | **繁體中文**

# 02 · NestJS 基礎

## 你會學到

- NestJS 的核心構件:Module、Controller、Provider 三者的角色
- Dependency Injection (DI) 解決了什麼問題、為什麼後端框架幾乎都採用
- Decorator 與 metadata 反射 — Nest 怎麼「看懂」你的 class
- Pipe / Guard / Interceptor / Filter 的觸發順序與選用時機

---

## 為什麼後端要用「框架」?

寫一個簡單的 HTTP server,Node 內建 `http` 模組就行。為什麼還要用 Express,甚至 NestJS?

因為實際的後端服務需要處理:

- 路由(URL → handler)
- 驗證、授權、log、tracing(每條 request 都要做)
- DB 連線管理、設定載入、優雅關閉
- 模組化、可測試、可演進的程式碼結構

框架的價值是**把這些重複的東西內建好,讓你只寫業務邏輯**。NestJS 的特色是把這個哲學推到極致 — 它規定了「應用要怎麼組織」,讓所有 Nest 專案結構雷同,新人換專案幾乎沒學習成本。

---

## Module:組合的單位

```ts
@Module({
  imports: [DatabaseModule],          // 我需要哪些別人的能力
  controllers: [TodosController],     // 我提供哪些 HTTP 入口
  providers: [TodosService, TodosRepository],   // 我能 inject 給別人什麼
  exports: [TodosService],            // 別的 module import 我之後能用什麼
})
export class TodosModule {}
```

> 💡 **觀念**:Module 是一個「可組裝、可重用的單位」。大型系統會拆成 `AuthModule`、`PaymentModule`、`NotificationModule`,各自封裝完整能力,在 `AppModule` 裡組合起來。

本專案因為是教學用,**故意全放在 `AppModule`**,讓你看到完整的 wiring。等你熟悉後,再依 feature 拆 module 是很自然的演進。

---

## Controller:HTTP 邊界

```ts
@Controller('todos')
export class TodosController {
  constructor(private readonly service: TodosService) {}

  @Post()
  create(@Body() dto: CreateTodoDto) {
    return this.service.create(dto).then(toTodoResponse);
  }
}
```

兩個重點:

1. **Controller 不應有業務邏輯**。它只做三件事:解請求 → 呼叫 service → 把結果轉成 response。
2. **建構子參數就是依賴宣告**。Nest 看到 `service: TodosService`,會自動把 `TodosService` 實例注入進來 — 這就是 DI。

---

## Provider 與 Dependency Injection

### DI 解決什麼問題?

沒有 DI 的世界:

```ts
class TodosService {
  private repo = new TodosRepository(new Pool({...}));   // ❌ 自己建依賴
}
```

問題:

- **不可測試**:單元測試時無法替換 `repo` 為 mock。
- **耦合死**:`TodosService` 強綁 `TodosRepository` 的建構方式。
- **重複建構**:每個 service 都各自連一次 DB,連線池失控。

有 DI 的世界:

```ts
class TodosService {
  constructor(private readonly repo: TodosRepository) {}   // ✅ 由外部注入
}
```

DI 容器(IoC container)在啟動時:

1. 建一個 `Pool` 實例
2. 用它建一個 `TodosRepository`
3. 用 repository 建 `TodosService`
4. 用 service 建 `TodosController`

整個系統的物件圖**只建一次,共享給所有需要的人**。這就是 **Inversion of Control (IoC)** — 物件不再自己控制依賴,把控制權交給容器。

### 自訂 Token

當依賴**不是 class**(例如本專案的 Drizzle client),要用 token 來識別:

```ts
export const DRIZZLE = Symbol('DRIZZLE');

@Module({
  providers: [{
    provide: DRIZZLE,
    useFactory: (pool: Pool) => drizzle(pool),
    inject: [PG_POOL],
  }],
})
```

使用端:

```ts
constructor(@Inject(DRIZZLE) private readonly db: Database) {}
```

> 💡 **後端工程觀念**:用 `Symbol` 而非字串當 token,是為了避免命名衝突 — 兩個套件都用 `'DB'` 字串時誰會贏?Symbol 是唯一值,不可能撞名。

---

## Decorator 與 Metadata 反射

`@Controller('todos')`、`@Body()` 看起來像魔法,其實只是「在 class 上掛標籤」。

Nest 用 `reflect-metadata` 套件在執行期讀這些標籤,組合出路由表、DI 圖、驗證規則。這是為什麼:

- `tsconfig.json` 必須開 `experimentalDecorators` 與 `emitDecoratorMetadata`
- `main.ts` 必須 `import 'reflect-metadata'`(我們已經做了)

> 💡 **觀念**:這個機制叫 **AOP — Aspect-Oriented Programming**。你不必把「驗證」、「log」、「auth」散落在每個 handler;只要掛 decorator,框架在執行期統一處理。

---

## Request 生命週期(觸發順序)

```
HTTP Request
    │
    ▼
[1] Middleware            (Express 層級,通常用於 cookie / cors)
    │
    ▼
[2] Guard                 (準入決策:有沒有權限?)
    │
    ▼
[3] Interceptor (before)  (包圍式邏輯:log、tracing、cache lookup)
    │
    ▼
[4] Pipe                  (轉換 + 驗證 input,例如 ZodValidationPipe)
    │
    ▼
[5] Controller handler    (你的業務入口)
    │
    ▼
[6] Interceptor (after)   (改寫 response、logging、cache write)
    │
    ▼
HTTP Response

   任何階段 throw → [7] Exception Filter 統一格式化
```

本專案用到:

| 階段 | 機制 | 用途 |
|---|---|---|
| 4 | `ZodValidationPipe`(全域)| 驗證並轉型 request body / query / param |
| 4 | `ParseUUIDPipe`(逐路由)| 把 `:id` 轉為合法 UUID,失敗即 400 |
| 7 | `AllExceptionsFilter`(全域)| 把例外轉成統一的 JSON 錯誤格式 |

---

## 為什麼 Pipe / Filter 要用 `APP_PIPE` / `APP_FILTER` 註冊?

兩種寫法的差別:

```ts
// 寫法 A:在 main.ts
app.useGlobalPipes(new ZodValidationPipe());      // ❌ 拿不到 DI

// 寫法 B:在 app.module.ts(本專案採用)
{ provide: APP_PIPE, useClass: ZodValidationPipe }   // ✅ 走 DI 容器
```

寫法 A 直接 `new` 出來,實例**不在 DI 容器裡**,所以這個 pipe 不能 inject 任何 service(例如 logger)。

寫法 B 走容器,DI 全部能用 — 這是**更可擴充的做法**。

---

## Recap

- **Module** 是組裝單位,**Controller** 是 HTTP 邊界,**Provider** 是被 inject 的東西。
- **DI 容器**幫你管理物件生命週期,讓程式碼**可測試、可替換、可重用**。
- **Decorator** 透過 metadata 反射在執行期被框架讀取,這是 Nest 的「魔法」來源。
- Request 走 **Guard → Interceptor → Pipe → Handler** 的順序,例外走 **Filter** 統一格式化。
- Cross-cutting 關注點用 **`APP_*` token** 註冊,才能享受 DI。
