> 🌏 [English](./04-migrations.md) | **繁體中文**

# 04 · 用 drizzle-kit 做 Migration

我們採 **generate + migrate** 工作流(不用 `db:push`),讓 DB 演進以版本控管的 SQL 檔形式被記錄下來。

## 流程

```
編輯 src/schemas/*.ts
        │
        ▼
npm run db:generate     ──► drizzle-kit 讀取 schema
                              在 src/database/migrations/
                              產生新的 SQL 檔
        │
        ▼
git commit              ──► migration 進入版本歷史
        │
        ▼
npm run db:migrate      ──► 對 DB 套用尚未執行的 migration
```

## 檔案

- `drizzle.config.ts` — 宣告 schema 路徑、輸出資料夾、DB 連線資訊。
- `src/database/migrations/` — 產出的 SQL 與 `meta/` snapshot。**不要手動編輯。**
- `src/database/migrate.ts` — 透過 `drizzle-orm/node-postgres/migrator` 的執行腳本。

## 為何選 generate 而非 push?

| | `push` | `generate + migrate` |
|---|---|---|
| 速度 | 即時 | 多一步 |
| 歷史 | 無 | 每次變更都被記錄 |
| 適合 production | ❌ | ✅ |
| 可在 PR 中審查 | ❌ | ✅(SQL 直接看) |

實務上請永遠用 `generate + migrate`,`push` 只適合一次性的原型嘗試。

## 常用指令

```bash
# 改完 schema 後產生下一筆 migration
npm run db:generate

# 套用未執行的 migration 到 DB
npm run db:migrate

# 刪除最新一筆 migration 檔(不影響 DB)
npm run db:drop

# 用 GUI 檢視資料表
npm run db:studio
```

## 回滾 (Rollback)

drizzle-kit **不會**自動產生 `down` migration,策略有:

1. **向前修正**:寫一筆新 migration 把改動反向操作。
2. **手動**:必要時自己手寫 rollback SQL。

教學專案用「向前修正」就夠了。
