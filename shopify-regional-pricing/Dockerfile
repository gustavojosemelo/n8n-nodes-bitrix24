# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 - build: compila o servidor TS e a Admin UI (Vite)
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Dependencias do servidor (com devDependencies para compilar)
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Prisma client precisa do schema antes do generate
COPY prisma ./prisma
RUN npx prisma generate

# Servidor
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json

# Admin UI
COPY web ./web
RUN npm --prefix web ci --no-audit --no-fund && npm --prefix web run build

# Deps de producao limpas, para copiar ao runtime
RUN rm -rf node_modules && npm ci --omit=dev --no-audit --no-fund && npx prisma generate

# ---------------------------------------------------------------------------
# Stage 2 - runtime: apenas o necessario para rodar
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# openssl e exigido pelo engine do Prisma na imagem slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY package.json ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Usuario nao-root (o usuario "node" ja existe na imagem oficial)
RUN chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
