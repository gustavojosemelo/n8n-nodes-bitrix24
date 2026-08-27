#!/bin/sh
set -e

# Migrations do Prisma no startup do container (Etapa 1 / 10.3).
# migrate deploy e idempotente: aplica apenas o que falta.
echo '{"level":"info","msg":"aplicando migrations do Prisma"}'
npx prisma migrate deploy

exec "$@"
