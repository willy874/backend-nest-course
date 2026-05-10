> 🌏 [English](./02-nestjs-basics.md) | [繁體中文](./02-nestjs-basics.zh-TW.md)

# 02 · NestJS Basics

NestJS organizes a backend as a tree of **modules** that wire together **controllers** and **providers** through **dependency injection (DI)**.

## Module

A `@Module` declares what it imports, what it provides, and what it exports.

```ts
@Module({
  imports: [DatabaseModule],
  controllers: [TodosController],
  providers: [TodosService, TodosRepository],
})
export class AppModule {}
```

In this project, `app.module.ts` wires everything because we use a layered (not feature-modular) structure. As the project grows you would split into per-feature modules.

## Controller

Controllers are the HTTP boundary. They translate requests/responses but contain **no business logic**.

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

Note: the constructor parameter is enough — Nest's DI container resolves `TodosService` automatically.

## Service & Repository

Both are `@Injectable()` providers. The convention in this project:

- **Service**: orchestration, validation, throwing `NotFoundException` etc.
- **Repository**: pure DB access; no HTTP awareness.

## Dependency Injection

Nest builds an internal graph: each provider is constructed once and shared. Custom tokens use `Inject()`:

```ts
@Inject(DRIZZLE) private readonly db: Database
```

`DRIZZLE` is a `Symbol` used as a provider token in `database.module.ts` because the Drizzle client isn't a class.

## Pipes, Filters, Guards (used here)

| Kind | Purpose | This project |
|---|---|---|
| Pipe | Transform / validate input | `ZodValidationPipe` (global), `ParseUUIDPipe` (per-route) |
| Filter | Map exceptions to HTTP responses | `AllExceptionsFilter` (global) |
| Guard | AuthN/AuthZ (not used in this teaching project) | — |

Globally registering pipes/filters via `APP_PIPE` / `APP_FILTER` (in `app.module.ts`) keeps DI working — registering them in `main.ts` would lose access to other providers.
