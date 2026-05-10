> 🌏 [English](./07-docker-compose.md) | **繁體中文**

# 07 · Docker Compose 與 PostgreSQL

## 你會學到

- 為什麼後端開發強烈建議用容器跑相依服務,而不是裝在本機
- Image 與 Container、Volume 與 Bind mount 的差別
- Docker network 的隔離模型,以及 service 之間怎麼互相找到
- Healthcheck 與 `depends_on: service_healthy` 的價值
- Production 跟 dev compose 的關鍵差異 — 為什麼這份檔案**不該**用於 production

---

## 為什麼用容器?

不用容器的痛點:

- 「我本機 Postgres 14,你 16,測出不同的行為」
- 「本機裝過一次 Postgres,設定亂掉,要重灌」
- 「macOS 用 brew、Linux 用 apt、Windows 用 WSL...每個人 setup 都不同」
- 「我要同時跑 5 個專案,每個用不同 Postgres 版本」

容器解決:**用一份 `docker-compose.yml` 描述環境,任何機器跑出來的結果都一樣**。

> 💡 **觀念**:容器化不是「為了部署到 K8s」才需要,**本機開發的價值就已經足夠**。

---

## 核心觀念:Image vs Container

| | 意義 | 類比 |
|---|---|---|
| **Image** | 唯讀的檔案系統快照 + 啟動指令 | 像「class」或「VM 模板」 |
| **Container** | Image 的執行實例 | 像「instance」或「跑起來的 VM」 |

`postgres:16-alpine` 是 **image**,跑起來的 `postgres-db` 是 **container**。同一個 image 可以跑出多個 container。

---

## 本專案的 `docker-compose.yml` 解析

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

逐行拆解:

### `image: postgres:16-alpine`

- `postgres` 是 image 名稱(Docker Hub 官方)
- `16` 是版本 tag
- `-alpine` 是基於 Alpine Linux 的精簡版(小、快,但有些 system tool 沒有)

> 💡 **生產建議**:tag **永遠寫具體版本**(`16` 或更精準的 `16.4`)。寫 `latest` 會在某天無聲升級,把你炸醒。

### `container_name: postgres-db`

固定容器名稱(預設是 `<project>_<service>_<n>`)。本專案教學要求固定名 — 但 production 通常**不固定**,讓 orchestrator 自由命名。

### `environment`

`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` 是 postgres image 約定的環境變數,首次啟動會自動建立 user 與 DB。

> ⚠️ 明文密碼**只能用於本機**。Production 要用 Docker secrets、AWS Secrets Manager、HashiCorp Vault 等。

### `ports: '5432:5432'`

格式是 `host:container`。把容器內 5432 對外暴露在 host 5432。

> 💡 **網路觀念**:container 之間在同一個 docker network 內可以**用 service 名稱互相連線**(`postgres:5432`),不需要透過 host port。host port 只是「給容器外的東西(例如本機 Nest app)連的入口」。

### `volumes: postgres-data:/var/lib/postgresql/data`

這是 **named volume**(由 Docker 管理的儲存空間)。容器砍了重建,資料還在。

#### Volume 的兩種寫法

| 寫法 | 範例 | 用途 |
|---|---|---|
| **Named volume** | `postgres-data:/var/lib/...` | 容器持久化資料,Docker 管理 |
| **Bind mount** | `./local-dir:/app` | 把本機目錄掛進容器(常用於 dev 熱更新) |

教學專案用 named volume,因為**我們不需要直接看到 PostgreSQL 內部檔案**,讓 Docker 管最省事。

#### 全部清掉資料

```bash
docker compose down -v   # 連 volume 一起砍
```

### `healthcheck`

定期執行 `pg_isready` 檢查 DB 是否真的能接受連線。

> 💡 **為什麼重要**:容器**啟動成功**(`docker ps` 看到 `Up`)不代表 service **準備好接 request**。Postgres 啟動需要幾秒做 recovery、initdb 等。Healthcheck 提供「真正可用」的訊號。

如果有 Nest app 也跑在 compose 裡,可以這樣等 DB:

```yaml
services:
  app:
    depends_on:
      postgres:
        condition: service_healthy
```

---

## Networking:Container 之間怎麼通信?

Compose 為每個 project 建一個預設 network(本專案 `backend-nest-course_default`)。同一 network 內的服務可以**用 service 名互相 DNS 解析**。

如果 Nest app 也在 compose 裡,連 DB 的 host 應該寫 `postgres`(service 名),不是 `localhost`:

```
DB_HOST=postgres   # ← 在容器內
DB_HOST=localhost  # ← 在 host machine 上跑 Nest 時
```

教學專案目前 Nest 在 host 機跑,所以用 `localhost`。

---

## 資料生命週期管理

```bash
docker compose up -d              # 啟動(背景)
docker compose ps                 # 狀態
docker compose logs -f postgres   # 看 log

docker compose stop               # 停止但保留容器
docker compose start              # 重新啟動

docker compose down               # 砍容器但保留 volume
docker compose down -v            # 砍容器 + volume(資料全清)
```

---

## 進入容器除錯

```bash
# 開啟容器內 psql
docker exec -it postgres-db psql -U root -d backend-course-nest-todo

# 看實際檔案
docker exec -it postgres-db sh
```

---

## 為何這份 compose 不該用於 Production?

| 問題 | Production 該怎麼做 |
|---|---|
| 明文密碼 | 用 secrets manager(Vault、AWS SM、K8s Secret) |
| `ports: 5432:5432` 公開到 host | 不暴露 host port,或限制來源 IP |
| 容器名稱固定 | 讓 orchestrator(K8s、ECS)管理 |
| Single instance | 用 managed Postgres(RDS、Cloud SQL、Neon),自動 HA + backup |
| 沒設 resource limit | 設 CPU/memory limit 避免 noisy neighbor |
| 沒監控 | 接 Prometheus / Grafana / Datadog |

> 💡 **核心觀念**:**Dev compose 是給人類用的**(要簡單、要好除錯);**Production 是給機器用的**(要 HA、要可觀測、要安全)。兩者目標完全不同,別用同一份 yaml 服務兩種需求。

---

## Recap

- 容器化是**現代後端開發的基礎**,不只 production 才需要。
- Image 是模板,Container 是實例;Volume 讓資料活過容器生命週期。
- 同一 compose network 內**用 service 名互聯**,不要綁 host port。
- **Healthcheck** 是「真正可用」的訊號,搭配 `depends_on: service_healthy` 確保啟動順序正確。
- 這份 dev compose 是教學用,**production 要走 managed DB + 嚴格的 secrets 管理**。
