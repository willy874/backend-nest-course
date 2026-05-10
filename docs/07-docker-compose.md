> 🌏 [English](./07-docker-compose.md) | [繁體中文](./07-docker-compose.zh-TW.md)

# 07 · Docker Compose & PostgreSQL

We run PostgreSQL in a container so:

- Local setup is reproducible (anyone gets the same Postgres 16).
- Host machine stays clean.
- Volume-backed data survives restarts but is easy to wipe.

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

Key points:

- `container_name: postgres-db` — fixed, predictable name as required.
- `POSTGRES_USER=root`, `POSTGRES_PASSWORD=password` — match `.env.example`.
- `POSTGRES_DB=backend-course-nest-todo` — auto-created on first boot.
- Healthcheck lets dependents wait for readiness (`depends_on: condition: service_healthy`).

## Common Commands

```bash
npm run db:up       # docker compose up -d
npm run db:down     # docker compose down  (keeps volume)

# Wipe everything (data included)
docker compose down -v
```

## Connecting from the Host

```
postgres://root:password@localhost:5432/backend-course-nest-todo
```

The Nest app reads the same values from `.env`.

## Production Note

This compose file is for **local dev only**. In production:

- Replace plaintext passwords with secrets.
- Disable host port publishing or restrict by network.
- Use managed Postgres (RDS, Cloud SQL, Neon, etc.) instead of a container.
