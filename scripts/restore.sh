#!/usr/bin/env bash
# Restaura um backup gerado por backup.sh.  ATENÇÃO: substitui os dados do banco de destino.
# Uso: DATABASE_URL=... ./scripts/restore.sh backups/vsensi-db-AAAAMMDD-HHMMSS.dump [backups/vsensi-anexos-....tar.gz]
set -euo pipefail

: "${DATABASE_URL:?Defina DATABASE_URL}"
DB_FILE="${1:?Informe o arquivo .dump}"
FILES_ARCHIVE="${2:-}"
STORAGE_DIR="${STORAGE_DIR:-./storage/uploads}"
PG_URL="${DATABASE_URL%%\?*}"

echo "Isto vai SUBSTITUIR os dados do banco: ${PG_URL##*@}"
read -r -p "Digite RESTAURAR para continuar: " answer
[ "$answer" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }

pg_restore --clean --if-exists --no-owner --single-transaction --dbname="$PG_URL" "$DB_FILE"

if [ -n "$FILES_ARCHIVE" ]; then
  mkdir -p "$(dirname "$STORAGE_DIR")"
  tar -xzf "$FILES_ARCHIVE" -C "$(dirname "$STORAGE_DIR")"
fi
echo "Restauração concluída. Reinicie a aplicação."
