> 🌏 [English](./07-docker-compose.md) | **繁體中文**

# 07 · Docker Compose 與 PostgreSQL

把 PostgreSQL 跑在容器裡,好處是:

- 任何人本機環境都一致(都是 Postgres 16)。
- 不污染本機。
- 用 volume 保留資料,但要清掉也很容易。

## `docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: postgres-db
    environment:
      POSTGRES_USER: root
      POSTGRES_PASSWORD: password
      POSTGRES_DB: backend-course-nest-todo
    ports:
      - '5432:5432'
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U root -d backend-course-nest-todo']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres-data:
```

重點:

- `container_name: postgres-db` — 固定的容器名稱(本專案要求)。
- `POSTGRES_USER=root`、`POSTGRES_PASSWORD=password` — 對應 `.env.example`。
- `POSTGRES_DB=backend-course-nest-todo` — 第一次啟動會自動建立。
- Healthcheck 讓相依服務可用 `depends_on: condition: service_healthy` 等待就緒。

## 常用指令

```bash
npm run db:up       # docker compose up -d
npm run db:down     # docker compose down(保留 volume)

# 整個清掉(連資料也丟)
docker compose down -v
```

## 從本機連線

```
postgres://root:password@localhost:5432/backend-course-nest-todo
```

Nest app 透過 `.env` 讀取相同設定。

## Production 注意

這份 compose **僅供本機開發**。Production 應:

- 不要用明文密碼,改用 secret 管理。
- 關閉 host port 公開,或限制網路。
- 改用 managed Postgres(RDS、Cloud SQL、Neon 等)而非自建容器。
