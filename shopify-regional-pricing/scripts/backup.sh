#!/bin/sh
# ---------------------------------------------------------------------------
# Backup diário do banco (Etapa 10.4).
#
# A configuração de preços é o ativo crítico do app: perder isso significa
# refazer todo o cadastro manualmente, região por região.
#
# Uso (crontab do host, 3h da manhã):
#   0 3 * * * /caminho/scripts/backup.sh >> /var/log/regional-pricing-backup.log 2>&1
#
# Variáveis:
#   DATABASE_URL   string de conexão (obrigatória)
#   BACKUP_DIR     destino dos dumps (default: /var/backups/regional-pricing)
#   RETENTION_DAYS quantos dias manter (default: 14)
# ---------------------------------------------------------------------------
set -eu

BACKUP_DIR="${BACKUP_DIR:-/var/backups/regional-pricing}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/regional-pricing-$STAMP.sql.gz"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL não definida" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# --clean --if-exists deixa o dump pronto para restaurar sobre um banco existente.
pg_dump --dbname="$DATABASE_URL" --format=plain --clean --if-exists --no-owner --no-privileges \
  | gzip -9 > "$FILE.tmp"

mv "$FILE.tmp" "$FILE"

SIZE="$(wc -c < "$FILE")"
if [ "$SIZE" -lt 1024 ]; then
  echo "{\"level\":\"error\",\"msg\":\"backup suspeito (menor que 1KB)\",\"file\":\"$FILE\"}" >&2
  exit 1
fi

find "$BACKUP_DIR" -name 'regional-pricing-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete

echo "{\"level\":\"info\",\"msg\":\"backup concluido\",\"file\":\"$FILE\",\"bytes\":$SIZE}"
