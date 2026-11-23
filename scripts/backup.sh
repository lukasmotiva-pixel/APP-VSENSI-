#!/usr/bin/env bash
# Backup do sistema V'Sensi: banco PostgreSQL (pg_dump, formato custom) + pasta de anexos.
# Uso: DATABASE_URL=... STORAGE_DIR=... BACKUP_DIR=/caminho ./scripts/backup.sh
# Mantém os últimos $KEEP_DAYS dias (padrão 30). Agende com cron (ver docs/06-operacao.md).
set -euo pipefail

: "${DATABASE_URL:?Defina DATABASE_URL}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
STORAGE_DIR="${STORAGE_DIR:-./storage/uploads}"
KEEP_DAYS="${KEEP_DAYS:-30}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
umask 077

# pg_dump não aceita parâmetros extras do Prisma (ex.: ?connection_limit=...)
PG_URL="${DATABASE_URL%%\?*}"

DB_FILE="$BACKUP_DIR/vsensi-db-$STAMP.dump"
pg_dump --format=custom --no-owner --file="$DB_FILE" "$PG_URL"
pg_restore --list "$DB_FILE" > /dev/null   # valida que o arquivo é legível

if [ -d "$STORAGE_DIR" ]; then
  tar -czf "$BACKUP_DIR/vsensi-anexos-$STAMP.tar.gz" -C "$(dirname "$STORAGE_DIR")" "$(basename "$STORAGE_DIR")"
fi

( cd "$BACKUP_DIR" && sha256sum vsensi-*-"$STAMP".* > "vsensi-$STAMP.sha256" )

find "$BACKUP_DIR" -name 'vsensi-*' -type f -mtime +"$KEEP_DAYS" -delete
echo "Backup concluído: $BACKUP_DIR (*-$STAMP)"
