> 🌏 **English** | [繁體中文](./07-docker-compose.zh-TW.md)

# 07 · Docker Compose & PostgreSQL

## What you'll learn

- Why backend dev should containerize dependencies instead of installing them locally
- Image vs Container, Volume vs Bind mount
- Docker's network isolation model and how services find each other
- Healthchecks and the value of `depends_on: service_healthy`
- Why this compose file is **not** suitable for production — and what production looks like instead

---

## Why containers?

Pain without containers:

- "On my laptop it's Postgres 14, yours is 16, behavior differs"
- "I installed Postgres once, settings got weird, I have to reinstall"
- "macOS uses brew, Linux uses apt, Windows is on WSL — every dev is different"
- "I want to run 5 projects simultaneously, each on a different Postgres version"

Containers solve all of it: **describe the environment in `docker-compose.yml` once, identical on every machine**.

> 💡 **Concept**: Containerization isn't only "for K8s deployment" — **the dev-loop value alone is worth it.**

---

## Image vs Container

| | Meaning | Analogy |
|---|---|---|
| **Image** | Read-only filesystem snapshot + start command | Like a "class" or VM template |
| **Container** | A running instance of an image | Like an "instance" or running VM |

`postgres:16-alpine` is the **image**; the running `postgres-db` is the **container**. One image can spawn many containers.

---

## Walking through `docker-compose.yml`

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

### `image: postgres:16-alpine`

- `postgres` — Docker Hub official image
- `16` — version tag
- `-alpine` — based on Alpine Linux (smaller, fewer system tools)

> 💡 **Production tip**: **Always pin a specific version** (`16` or even `16.4`). `latest` will silently upgrade some Tuesday and ruin your week.

### `container_name: postgres-db`

Fixes the container name (default would be `<project>_<service>_<n>`). The teaching project requires this name. **In production**, usually you let the orchestrator name freely.

### `environment`

`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` — convention-based env vars; the postgres image creates the user and DB on first start.

> ⚠️ Plain-text passwords are **dev-only**. Production needs Docker secrets, AWS Secrets Manager, HashiCorp Vault, etc.

### `ports: '5432:5432'`

Format is `host:container`. Exposes port 5432 of the container on the host's 5432.

> 💡 **Networking concept**: Containers on the same Docker network can reach each other **by service name** (`postgres:5432`) — no host port required. Host ports are only "the doorway from outside the container world" (e.g. for a Nest app running on the host).

### `volumes: postgres-data:/var/lib/postgresql/data`

A **named volume** (Docker-managed storage). Containers come and go; data persists.

#### Two flavors of volume

| Form | Example | Use |
|---|---|---|
| **Named volume** | `postgres-data:/var/lib/...` | Container persistence, Docker-managed |
| **Bind mount** | `./local-dir:/app` | Mount host dir into container (often for dev hot-reload) |

This project uses a named volume — **we don't need to peek inside Postgres' internal files**, so let Docker manage them.

#### Wipe everything

```bash
docker compose down -v   # remove volume too
```

### `healthcheck`

Periodically runs `pg_isready` to verify the DB is actually accepting connections.

> 💡 **Why it matters**: A container "started" (`docker ps` shows `Up`) doesn't mean the service is **ready to serve traffic**. Postgres needs seconds for recovery / initdb. Healthcheck provides the "actually ready" signal.

If a Nest app also lived in this compose, it could wait properly:

```yaml
services:
  app:
    depends_on:
      postgres:
        condition: service_healthy
```

---

## Networking: how containers talk

Compose creates a default network per project (`backend-nest-course_default` here). Services on the same network resolve each other **by service name**.

If the Nest app ran inside compose, it would connect using `postgres` as the host:

```
DB_HOST=postgres   # ← inside a container
DB_HOST=localhost  # ← when Nest runs on the host machine
```

This project runs Nest on the host, so we use `localhost`.

---

## Lifecycle commands

```bash
docker compose up -d              # start (background)
docker compose ps                 # status
docker compose logs -f postgres   # tail logs

docker compose stop               # stop containers, keep them around
docker compose start              # start back up

docker compose down               # remove containers, keep volume
docker compose down -v            # remove containers + volume (data wiped)
```

---

## Debugging inside the container

```bash
# psql inside the container
docker exec -it postgres-db psql -U root -d backend-course-nest-todo

# poke around the filesystem
docker exec -it postgres-db sh
```

---

## Why this compose isn't production-ready

| Issue | Production answer |
|---|---|
| Plain-text passwords | Secrets manager (Vault, AWS SM, K8s Secret) |
| `ports: 5432:5432` exposed to host | Don't bind to host or restrict by IP |
| Fixed container name | Let the orchestrator (K8s, ECS) manage names |
| Single instance | Use managed Postgres (RDS, Cloud SQL, Neon) for HA + backups |
| No resource limits | Set CPU/memory limits — avoid noisy-neighbor issues |
| No monitoring | Integrate Prometheus / Grafana / Datadog |

> 💡 **Core principle**: **Dev compose is for humans** (must be simple and debuggable); **production is for machines** (must be HA, observable, secure). Don't try to serve both with one yaml.

---

## Recap

- Containerization is the **bedrock of modern backend dev**, not just deployment.
- Image is template, Container is instance; Volumes survive container churn.
- On the same compose network, services use **service names**, not host ports.
- **Healthchecks** signal "actually ready"; pair with `depends_on: service_healthy`.
- This dev compose is for teaching — **production needs managed DB + serious secrets management**.
