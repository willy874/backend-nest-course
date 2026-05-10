> 🌏 [English](./02-nestjs-basics.md) | **繁體中文**

# 02 · NestJS 基礎

NestJS 把後端組織為一棵 **module 樹**,透過 **dependency injection (DI)** 把 **controllers** 與 **providers** 串在一起。

## Module

`@Module` 宣告自己 import 什麼、提供什麼、export 什麼。

```ts
@Module({
  imports: [DatabaseModule],
  controllers: [TodosController],
  providers: [TodosService, TodosRepository],
})
export class AppModule {}
```

本專案因為採分層結構而不是 feature module,所有東西都在 `app.module.ts` 組裝。專案規模變大時可以依 feature 拆分。

## Controller

Controller 是 HTTP 邊界,負責請求/回應的轉換,**不放業務邏輯**。

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

注意:建構子參數就足夠了,Nest 的 DI 會自動解析 `TodosService`。

## Service 與 Repository

兩者皆為 `@Injectable()` provider,本專案的慣例是:

- **Service**:編排、驗證、丟出 `NotFoundException` 等。
- **Repository**:純 DB 存取,完全不知道 HTTP。

## Dependency Injection

Nest 在內部建立一張 graph:每個 provider 只建立一次並共享。需要自訂 token 時用 `@Inject()`:

```ts
@Inject(DRIZZLE) private readonly db: Database
```

`DRIZZLE` 是定義在 `database.module.ts` 的 `Symbol`,因為 Drizzle client 不是 class。

## Pipe / Filter / Guard(本專案用到的)

| 種類 | 用途 | 本專案 |
|---|---|---|
| Pipe | 轉換 / 驗證 input | `ZodValidationPipe`(全域)、`ParseUUIDPipe`(逐路由) |
| Filter | 把例外轉為 HTTP 回應 | `AllExceptionsFilter`(全域) |
| Guard | AuthN/AuthZ(本教學專案未用) | — |

透過 `APP_PIPE` / `APP_FILTER`(在 `app.module.ts`)以全域 provider 註冊,DI 才能正常運作 — 寫在 `main.ts` 裡會吃不到其他 provider。
