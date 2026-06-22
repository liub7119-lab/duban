# 数据库与持久化

读伴开发默认用 SQLite(零配置),生产可切到 PostgreSQL。

## 本地开发(SQLite)

```bash
# 数据库 schema 已就绪(在 prisma/schema.prisma)
npx prisma migrate dev    # 应用迁移 + 生成 client
npx prisma db push        # 开发用快速建表(不写迁移)
```

数据存在 `prisma/dev.db`,**不要 commit**(已在 .gitignore)。

## 数据备份

```bash
# 手动备份(SQLite + 上传文件 → ./backups/)
./scripts/backup.sh /path/to/backup

# 定时备份(crontab,每天凌晨 3 点)
0 3 * * * /opt/duban/scripts/backup.sh /var/backups/duban
```

自动保留 14 天。恢复:
```bash
# SQLite
cp /var/backups/duban/duban_sqlite_*.db prisma/dev.db

# 上传文件
tar xzf duban_uploads_*.tar.gz -C data/
tar xzf duban_covers_*.tar.gz -C data/
```

## 切到 PostgreSQL(生产推荐)

适用场景:多用户并发、长文本分析、跨实例部署、定期备份。

### 1. 启动 Postgres(Docker)

```bash
# 项目内置了 postgres profile
docker compose --profile postgres up -d
```

### 2. 切换 Prisma datasource

`prisma/schema.prisma` 改 provider:
```prisma
datasource db {
  provider = "postgresql"   // 原来是 "sqlite"
  url      = env("DATABASE_URL")
}
```

### 3. 配置连接串

`.env` 里:
```
DATABASE_URL="postgresql://duban:dubanpass@localhost:5432/duban"
```

`docker-compose.yml` 里:
```
DATABASE_URL: "postgresql://duban:${DB_PASSWORD:-dubanpass}@db:5432/duban"
```

### 4. 跑迁移

```bash
# 应用所有 migration 到新库
npx prisma migrate deploy

# 或者:从 SQLite 迁移数据(用 prisma db pull + 脚本)
# 见 prisma/docs 数据迁移章节
```

### 5. SQLite → Postgres 数据迁移(可选)

读伴暂不提供自动迁移工具(开发期间表结构会变),**生产环境建议从零建库让用户重新注册**。
如果你已有重要数据需要搬,可用:
- `pgloader` 工具从 SQLite 转 Postgres
- 或者写个 Node 脚本用 Prisma 读旧库 → 写新库

## 配额与备份要点

- **SQLite 模式**:备份 = `sqlite3 .backup` + 上传文件夹。简单,适合单机。
- **Postgres 模式**:用 `pg_dump` 备份,有 `pg_dump` cron + WAL 归档可做 PITR。
- **上传文件**:始终存在 `data/uploads/{userId}/`,跟 DB 一起备份。

## 性能调优(可选,Postgres)

```sql
-- 给常用查询加索引(prisma/schema 已加 @@index)
-- 长文本用 tsvector 做全文检索(章节搜索)
ALTER TABLE "Chapter" ADD COLUMN tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;
CREATE INDEX chapter_tsv_idx ON "Chapter" USING GIN (tsv);
```

这部分是后续扩展项,当前 schema 已够用。