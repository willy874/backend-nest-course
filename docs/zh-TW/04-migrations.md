> 🌏 [English](../en-US/04-migrations.md) | **繁體中文**

# 04 · Migrations 與 Schema 演進

## 你會學到

- 為什麼 production 的 schema 變更必須走 migration,不能直接改 DB
- `generate + migrate` vs `push` 的差別,以及為什麼前者才是業界標準
- Forward-only migration 的哲學
- Expand-Contract 模式 — 如何在不停機的情況下改 schema
- Migration 出錯時的修復策略

---

## 為什麼 Schema 必須版本化?

把 DB schema 想成「程式碼的一部分」 — 因為它就是。

如果你的 DB 跟程式碼不同步,會發生:

- 同事 pull 最新 code,本機跑不起來(欄位不存在)
- Staging 跟 production schema 不一致,測試通過上線爆炸
- 出事要 rollback 時,**程式碼可以 git revert,DB 怎麼辦?**

**Migration 就是 schema 的 git**。每次變更被記錄成有順序的 SQL 檔,任何環境都能重放出一致的 schema。

> 💡 **業界規則**:**從不**手動到 production DB 上 `ALTER TABLE`。所有變更走 migration 檔,經過 code review,跟著 release 一起部署。違反這條規則的災難史可以寫一本書。

---

## drizzle-kit 的兩種模式

### `db:push`(快速但危險)

```bash
drizzle-kit push    # 直接把 schema 同步到 DB,不留 SQL 檔
```

- ✅ 開發初期、prototype 階段最快
- ❌ **不留歷史**,也不知道做了什麼變更
- ❌ **正式環境絕不可用**

### `db:generate + db:migrate`(本專案採用)

```bash
drizzle-kit generate    # 比對 schema 變更,產生新的 SQL 檔
drizzle-kit migrate     # 套用未執行的 SQL 到 DB
```

- ✅ 每次變更都有版本檔可審查、可重放
- ✅ Production-safe
- ✅ Code review 看 PR 的 SQL diff,DBA 也能參與審查
- ❌ 多一個步驟

> 💡 **關鍵差別**:`generate` 只是寫檔,**完全不碰 DB**。`migrate` 才會連 DB 套用。這個分離讓你可以在 PR 階段先檢視產出的 SQL,等 review 過了才部署。

---

## 完整工作流

```
1. 編輯 src/schemas/*.ts
        │
        ▼
2. npm run db:generate   ──► drizzle-kit 比對 schema vs 上次的 snapshot
                              產生 src/database/migrations/0001_xxx.sql
        │
        ▼
3. 開 PR,讓人看 SQL      ──► 真正會跑的 SQL 一目了然,不會被 ORM 隱藏
        │
        ▼
4. PR merge → CI/CD      ──► 部署流程跑 npm run db:migrate
        │
        ▼
5. 套用未執行的 migrations
```

`drizzle_migrations` table 會被自動建立在 DB,記錄哪些 migration 已執行 — 重複跑不會出事。這個機制叫 **idempotency**(冪等性):同樣的指令跑幾次都得到同樣的結果。

---

## Forward-Only Migration

drizzle-kit **不會**自動產 `down`(回滾)migration。這其實**符合業界主流**。

為什麼不做 down?

1. **down 在生產環境幾乎沒用**:出包了通常是「資料已寫進新欄位、新欄位也被 read」,單純 drop 欄位會丟資料。
2. **真實的 rollback 是寫一筆新的 forward migration**,把上一次變更反向操作。
3. 有 down 的工具(如 Rails、Knex)鼓勵了「我寫 down 就安全」的錯覺,反而危險。

> 💡 **守則**:出事的修復方式是 **roll forward**(往前修),不是 **roll back**(往回滾)。

---

## Expand-Contract:不停機的 schema 變更

當服務 24/7 運作,不能停機改 schema 時,任何變更都要拆成兩階段:

### 範例:把 `name` 欄位拆成 `first_name` + `last_name`

❌ 一次改完(會炸):

```sql
ALTER TABLE users DROP COLUMN name;
ALTER TABLE users ADD COLUMN first_name TEXT NOT NULL;  -- 舊 code 不知道這欄位
```

✅ Expand-Contract:

| 階段 | DB 動作 | 程式碼動作 |
|---|---|---|
| 1. **Expand** | 加上 `first_name`、`last_name`,**保留** `name` | 同時寫新舊欄位 |
| 2. **Backfill** | 跑 batch script 把舊資料拆到新欄位 | (無) |
| 3. **Migrate reads** | (無) | 改成讀新欄位 |
| 4. **Stop writes to old** | (無) | 不再寫 `name` |
| 5. **Contract** | DROP `name` | (無) |

每個階段都可以 rollback 而不丟資料 — 這才叫 production-safe migration。

> 💡 **後端工程觀念**:這是所有大規模系統(Stripe、Shopify、GitHub)都遵守的模式。教學專案不需要做到這麼細,但你**要知道它存在**。

---

## 一些 Migration 寫法的禁忌

| 寫法 | 為何危險 |
|---|---|
| 在 migration 裡 `UPDATE` 大量資料 | 鎖表時間長,可能拖垮 production。應該用獨立的 backfill job。 |
| 加 `NOT NULL` 沒有 default | 舊資料會違反 constraint,migration 失敗 |
| 改欄位型別 | PostgreSQL 會 rewrite 整張表,大表可能鎖數十分鐘 |
| 加 index 不用 `CONCURRENTLY` | 鎖表(教學專案不在意,production 一定要) |
| 重命名欄位/表 | 舊 code 立刻死。要走 expand-contract |

---

## 操作指令

```bash
# 改完 schema 後產生下一筆 migration
npm run db:generate

# 套用未執行的 migration 到 DB
npm run db:migrate

# 刪除最新一筆 migration 檔(僅檔案,不影響 DB)
npm run db:drop

# 用 GUI 檢視資料表
npm run db:studio
```

---

## 出錯時怎麼辦?

### 情況 A:剛 generate 還沒 migrate,發現寫錯

→ `npm run db:drop` 把檔案刪掉,改 schema 重新 generate。

### 情況 B:已 migrate 到本機,但還沒 push

→ 寫一筆新 migration 反向操作,**或** drop 整個 DB 重來:

```bash
docker compose down -v   # 連 volume 一起砍
docker compose up -d
npm run db:migrate
```

### 情況 C:已部署到 staging/production

→ **永遠寫 forward fix**,不要嘗試手動編輯歷史 migration。

---

## Recap

- Migration 是 **schema 的 git**,production 變更只走 migration。
- 用 **`generate + migrate`** 而非 `push` — 留下可審查的 SQL 歷史。
- Migration 設計成 **idempotent**,執行紀錄存在 `drizzle_migrations` 表。
- 修錯走 **forward fix**,不靠 down migration。
- 大規模系統用 **Expand-Contract** 做不停機 schema 變更。
