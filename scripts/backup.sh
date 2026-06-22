#!/usr/bin/env bash
# 读伴 数据备份脚本
#
# 用法:
#   ./scripts/backup.sh                     # 默认 SQLite 备份到 ./backups/
#   ./scripts/backup.sh /path/to/backup     # 指定备份目录
#   DATABASE_URL=postgres://... ./scripts/backup.sh   # 备份 Postgres
#
# 建议:挂 cron 每日凌晨 3 点跑一次
#   0 3 * * * /opt/duban/scripts/backup.sh /var/backups/duban

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY=$(date +%Y%m%d)
mkdir -p "$BACKUP_DIR"

echo "📦 读伴备份 @ $TIMESTAMP"
echo "   目标: $BACKUP_DIR"

# 判断 provider
DATABASE_URL="${DATABASE_URL:-file:./prisma/dev.db}"

if [[ "$DATABASE_URL" =~ ^file: ]]; then
  # SQLite
  DB_FILE="${DATABASE_URL#file:}"
  # 相对路径基于项目根
  if [[ ! "$DB_FILE" =~ ^/ ]]; then
    DB_FILE="$(pwd)/$DB_FILE"
  fi
  if [[ ! -f "$DB_FILE" ]]; then
    echo "❌ 找不到数据库文件: $DB_FILE"
    exit 1
  fi
  OUT="$BACKUP_DIR/duban_sqlite_${TIMESTAMP}.db"
  # SQLite 在线备份(不锁库,适合生产)
  sqlite3 "$DB_FILE" ".backup '$OUT'"
  SIZE=$(du -h "$OUT" | cut -f1)
  echo "✅ SQLite 备份完成: $OUT ($SIZE)"

  # 同时备份上传文件
  UPLOAD_DIR="${STORAGE_DIR:-./data/uploads}"
  COVER_DIR="${STORAGE_DIR:-./data}/covers"
  if [[ -d "$UPLOAD_DIR" ]]; then
    TAR_OUT="$BACKUP_DIR/duban_uploads_${TIMESTAMP}.tar.gz"
    tar czf "$TAR_OUT" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")" 2>/dev/null || true
    if [[ -d "$COVER_DIR" ]]; then
      tar czf "$BACKUP_DIR/duban_covers_${TIMESTAMP}.tar.gz" -C "$(dirname "$COVER_DIR")" "$(basename "$COVER_DIR")" 2>/dev/null || true
    fi
    echo "✅ 上传文件已打包"
  fi

elif [[ "$DATABASE_URL" =~ ^postgres ]]; then
  # Postgres:用 pg_dump
  if ! command -v pg_dump >/dev/null 2>&1; then
    echo "❌ 需要安装 pg_dump"
    exit 1
  fi
  OUT="$BACKUP_DIR/duban_pg_${TIMESTAMP}.sql.gz"
  pg_dump "$DATABASE_URL" | gzip > "$OUT"
  SIZE=$(du -h "$OUT" | cut -f1)
  echo "✅ Postgres 备份完成: $OUT ($SIZE)"
fi

# 清理 14 天前的旧备份
find "$BACKUP_DIR" -maxdepth 1 -name "duban_*_${DAY:0:6}*.db" -mtime +14 -delete 2>/dev/null || true
find "$BACKUP_DIR" -maxdepth 1 -name "duban_pg_*.sql.gz" -mtime +14 -delete 2>/dev/null || true
find "$BACKUP_DIR" -maxdepth 1 -name "duban_uploads_*.tar.gz" -mtime +14 -delete 2>/dev/null || true
find "$BACKUP_DIR" -maxdepth 1 -name "duban_covers_*.tar.gz" -mtime +14 -delete 2>/dev/null || true
echo "🧹 旧备份清理完毕(保留 14 天)"

echo ""
echo "💡 恢复方法:"
echo "   SQLite:  cp $OUT prisma/dev.db"
echo "   Postgres: createdb duban && gunzip < $OUT | psql duban"