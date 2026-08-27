#!/bin/sh
# Restauração de um dump gerado por scripts/backup.sh.
#
#   DATABASE_URL=postgres://... ./scripts/restore.sh /var/backups/.../arquivo.sql.gz
#
# Teste o restore ao menos uma vez antes do go-live: um backup nunca testado
# não é um backup.
set -eu

FILE="${1:-}"

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "uso: DATABASE_URL=... $0 <arquivo.sql.gz>" >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL não definida" >&2
  exit 1
fi

printf 'Isto vai SOBRESCREVER o banco em %s. Digite "restaurar" para continuar: ' "$DATABASE_URL"
read -r answer
[ "$answer" = "restaurar" ] || { echo "cancelado"; exit 1; }

gunzip -c "$FILE" | psql --dbname="$DATABASE_URL" --set ON_ERROR_STOP=on

echo "restore concluído a partir de $FILE"
